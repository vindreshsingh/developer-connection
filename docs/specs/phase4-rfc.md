# Phase 4 RFC — OAuth / Profile Enrichment & Groups

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        TRACK A: OAuth                           │
│                                                                 │
│  Browser ──► GET /auth/oauth/github                             │
│              │                                                  │
│              ▼                                                  │
│         302 → provider (with state cookie)                      │
│              │                                                  │
│              ▼                                                  │
│         Provider OAuth flow                                     │
│              │                                                  │
│              ▼                                                  │
│         GET /auth/oauth/github/callback?code=&state=            │
│              │                                                  │
│         ┌────▼──────────────────────┐                          │
│         │  OAuthService             │                          │
│         │  1. validate state        │                          │
│         │  2. exchange code→token   │                          │
│         │  3. fetch user profile    │                          │
│         │  4. upsert User in DB     │                          │
│         │  5. set JWT cookie        │                          │
│         └────────────────┬──────────┘                          │
│                          │                                      │
│              302 → FRONTEND_URL/                                │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   TRACK A: Profile Enrichment                   │
│                                                                 │
│  Client ──► POST /profile/github/connect                        │
│              │                                                  │
│              ▼  (server-side OAuth for GitHub API scope)        │
│         GitHubEnrichmentService                                 │
│         – GET /user  (login, avatar)                            │
│         – GET /user/repos?sort=stars&per_page=6                 │
│         – GET /users/:login/events (contribution proxy)         │
│              │                                                  │
│              ▼                                                  │
│         Encrypt token (AES-256-GCM) → User.oauthProviders       │
│         Store enrichment  → User.github                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      TRACK B: Groups                            │
│                                                                 │
│  REST layer (Express)          Socket.IO layer                  │
│  ─────────────────             ───────────────────              │
│  POST   /groups                join_group                       │
│  GET    /groups                leave_group (on disconnect)      │
│  GET    /groups/:id            send_group_message               │
│  POST   /groups/:id/join       group_message_received           │
│  DELETE /groups/:id/leave      typing (group context)           │
│  POST   /groups/:id/members    typing_update (group)            │
│  DELETE /groups/:id/members    group_member_count               │
│  PATCH  /groups/:id                                             │
│  DELETE /groups/:id                                             │
│                                                                 │
│  Auth boundary: group membership re-checked on every socket     │
│  event (same per-event pattern as Phase 3 canUsersChat)         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Track A — OAuth & Enrichment

### OAuth Library Decision

**Chosen: `passport` + `passport-github2` + `passport-google-oauth20` + `passport-linkedin-oauth2`**

Rationale:
- Passport is the de facto standard for Express OAuth; all three providers have maintained strategy packages
- Keeps OAuth strategy logic out of route handlers — strategies encapsulate token exchange + profile normalisation
- Works cleanly as ES modules with `import` (tested with existing `"type": "module"` in `package.json`)
- Alternative considered: manual `fetch`-based OAuth — more lines of code, no advantage for this use case

### State / CSRF Protection

- A random `state` value is generated per OAuth initiation, stored in an `httpOnly` session cookie (`oauth_state`), and validated on callback
- Mismatch → 400, session cookie cleared
- We do NOT use Passport's built-in `session: false` for OAuth because we want stateless JWT — `passport.authenticate(..., { session: false })` used consistently

### Token Encryption

GitHub/LinkedIn access tokens are stored in `User.oauthProviders[].accessToken` encrypted with **AES-256-GCM** using `node:crypto` (already a dependency):

```js
// utils/encryption.js
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // 32-byte key from env

export const encrypt = (plaintext) => { ... }; // returns { iv, tag, ciphertext }
export const decrypt = ({ iv, tag, ciphertext }) => { ... };
```

Stored as a JSON string in the `accessToken` field. The key is **never** returned to the client.

### User Upsert Logic

```
OAuthCallback received (provider, providerId, email, profile)
  │
  ├── findOne({ "oauthProviders.provider": provider, "oauthProviders.providerId": providerId })
  │     └── found → update token, set cookie, done
  │
  ├── findOne({ email }) [email match across providers]
  │     └── found → push new oauthProvider entry, set cookie, done
  │
  └── not found → create new User, isEmailVerified: true (provider verified it), set cookie
```

Edge case: GitHub returns no public email → store `null`, prompt frontend to collect it via `GET /profile/me` returning `{ needsEmail: true }`.

### GitHub Enrichment Service

`GitHubEnrichmentService` is a standalone class (no framework coupling):

```js
class GitHubEnrichmentService {
  async fetchProfile(accessToken)    // login, avatarUrl, profileUrl
  async fetchTopRepos(accessToken)   // top 6 by stars
  async fetchTopLanguages(accessToken) // aggregated from repos
  async fetchContributions(accessToken) // public events count (proxy)
}
```

Rate limit: GitHub allows 5 000 req/hr for authenticated tokens. On-demand sync (not per-login) keeps usage well within limits.

### New ENV variables

```
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
LINKEDIN_CLIENT_ID=
LINKEDIN_CLIENT_SECRET=
ENCRYPTION_KEY=           # 32-byte hex string for AES-256-GCM
OAUTH_CALLBACK_BASE_URL=  # e.g. http://localhost:3008 (backend base)
```

---

## Track B — Groups

### Data Model

```js
// Group model
const groupSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true, maxlength: 80 },
  description: { type: String, trim: true, maxlength: 500, default: '' },
  tags:        [{ type: String, trim: true, lowercase: true, maxlength: 30 }],
  createdBy:   { type: ObjectId, ref: 'User', required: true },
  members: [{
    userId:   { type: ObjectId, ref: 'User', required: true },
    role:     { type: String, enum: ['admin', 'member'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  }],
  memberCount: { type: Number, default: 1 },   // denormalised for fast list queries
  maxMembers:  { type: Number, default: 500 },  // Phase 4 cap
  visibility:  { type: String, enum: ['public'], default: 'public' },
  deletedAt:   { type: Date, default: null },
}, { timestamps: true });

groupSchema.index({ tags: 1 });
groupSchema.index({ memberCount: -1 });
groupSchema.index({ 'members.userId': 1 });
```

```js
// GroupMessage model (mirrors Message schema)
const groupMessageSchema = new mongoose.Schema({
  groupId:   { type: ObjectId, ref: 'Group', required: true },
  senderId:  { type: ObjectId, ref: 'User', required: true },
  type:      { type: String, enum: ['text', 'snippet'], default: 'text' },
  body:      { type: String, required: true, trim: true, maxlength: 10000 },
  language:  { type: String, default: null, maxlength: 32 },
  reactions: [{ userId: ObjectId, emoji: String }],
}, { timestamps: true });

groupMessageSchema.index({ groupId: 1, createdAt: -1, _id: -1 });
```

### Socket.IO Group Rooms

Room naming: `group:<groupId>` — mirrors the `conversation:<id>` pattern from Phase 3.

Authorization helper (new, analogous to `canUsersChat`):

```js
// utils/groupAuthorization.js
export const canUserAccessGroup = async (userId, groupId) => {
  const group = await Group.findOne({ _id: groupId, deletedAt: null });
  if (!group) return { allowed: false, reason: 'Group not found' };
  const member = group.members.find(m => m.userId.equals(userId));
  if (!member) return { allowed: false, reason: 'You are not a member of this group' };
  return { allowed: true, role: member.role };
};
```

Per-event re-auth on **every** group socket event — same pattern as Phase 3's `authorizeConversationAccess`.

### `send_group_message` flow

```
client.emit('send_group_message', { groupId, type, body, language })
  │
  ├── canUserAccessGroup(socket.user._id, groupId)
  │     └── not allowed → emit chat_error
  │
  ├── GroupMessage.create(...)
  │
  └── io.to(`group:${groupId}`).emit('group_message_received', { ... })
```

### Group REST — Authorization Matrix

| Endpoint | Auth | Extra check |
|---|---|---|
| `POST /groups` | logged in | — |
| `GET /groups` | logged in | filter out deleted groups |
| `GET /groups/:id` | logged in | public visibility |
| `POST /groups/:id/join` | logged in | memberCount < maxMembers |
| `DELETE /groups/:id/leave` | member | admin can't leave if sole admin |
| `POST /groups/:id/members/:userId` | admin | target must be a connection |
| `DELETE /groups/:id/members/:userId` | admin | can't remove themselves |
| `PATCH /groups/:id` | admin | — |
| `DELETE /groups/:id` | admin | soft-delete only |

### Frontend Architecture

Track B reuses Phase 3 widgets directly:
- `MessageBubble` — unchanged (works for group messages)
- `MessageComposer` — unchanged
- `SnippetBlock` — unchanged
- `useGroupChat` — mirrors `useChat`, uses `group:<id>` room events
- New pages: `pages/Groups/Groups.jsx` (browse), `pages/Groups/GroupDetail.jsx` (chat)
- New container: `containers/GroupChat/` (analogous to `containers/Messages/`)

---

## Shared Concerns

### Existing Code Impact

| Existing file | Change needed |
|---|---|
| `models/user.js` | Add `oauthProviders`, `github`, `linkedin` sub-documents |
| `routes/auth.js` | Add OAuth routes (`/auth/oauth/:provider` + callback) |
| `src/app.js` | Mount `groupRouter`; add Passport middleware |
| `src/server.js` | No change |
| `sockets/index.js` | Register `registerGroupChatHandlers` alongside chat handlers |
| `sockets/chatHandlers.js` | No change |
| Frontend `store/api.js` | Add `'Groups'`, `'GroupMessages'` tag types |
| Frontend `NavBar.jsx` | Add Groups link |

### No Breaking Changes

- All Phase 1–3 REST routes unchanged
- Socket event names unchanged (`message_received`, `presence_update`, etc.)
- Existing JWT cookie format unchanged — OAuth login sets the same cookie
- `canUsersChat` unchanged — group auth uses a parallel helper

### Testing Strategy

Same pattern as Phase 3:
- `backend/src/__tests__/oauth.test.js` — mock provider responses with `nock`, test upsert logic
- `backend/src/__tests__/groups.test.js` — REST CRUD, membership, auth matrix
- `backend/src/__tests__/groupSockets.test.js` — join/message/typing events, per-event auth
- Frontend: `npm run lint` + `npm run build`; manual smoke test

### Open Questions Resolved

| Question | Decision |
|---|---|
| OAuth callback on backend or frontend? | Backend server-side redirect (locked) |
| GitHub sync on login or on-demand? | On-demand only (locked) |
| Group member cap? | 500 (locked) |
| Passport vs. manual OAuth? | Passport |
| Token storage? | AES-256-GCM encrypted in DB, never returned to client |
