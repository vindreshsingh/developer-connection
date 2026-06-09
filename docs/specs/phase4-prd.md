# Phase 4 PRD — OAuth / Profile Enrichment & Groups

## Problem Statement

Two friction points limit growth after Phase 3:

1. **Sign-up friction** — email + password + email verification is a 3-step barrier. Developers already trust GitHub/Google/LinkedIn and expect one-click login.
2. **Isolated users** — the platform is purely 1:1. Developers want communities (React devs, open-source contributors, bootcamp alumni) where they can discover peers organically without needing a prior match.

## Goals

| Goal | Metric |
|---|---|
| Reduce sign-up drop-off | ≥ 40 % of new registrations via OAuth within 4 weeks of launch |
| Richer profiles → better matches | Connection-acceptance rate ≥ 15 % higher for GitHub-linked profiles vs. manual-only |
| Community engagement | ≥ 30 % of active users join at least one group within 2 weeks of Groups launch |

## Non-Goals (deferred)

- Video/voice calls in groups (Phase 5)
- AI-powered group recommendations (Phase 6)
- Paid "private groups" or group analytics (Phase 6)
- Resume upload / portfolio PDF parsing

---

## Track A — OAuth & Profile Enrichment

### User Stories

1. **As a new user**, I can sign up with one click using GitHub, Google, or LinkedIn so I don't have to create a password.
2. **As a returning user**, I can log in with any OAuth provider I linked, and my session works the same as email/password.
3. **As a developer**, I can link my GitHub account to my profile to automatically pull in my top repos, languages, and contribution activity.
4. **As a developer**, I can link my LinkedIn account to auto-fill my current job title, company, and experience.
5. **As a user**, I can unlink any OAuth provider as long as I have at least one login method remaining.
6. **As a user who signed up via OAuth**, I can optionally set a password later so I have a fallback login method.

### Acceptance Criteria

**OAuth Login**
- `POST /auth/oauth/:provider` (provider = `github` | `google` | `linkedin`) — exchanges a provider auth code for a JWT cookie; creates a new user or links to an existing account matched by email
- If email already registered via email/password, the OAuth provider is linked automatically and login succeeds
- If provider returns no email (GitHub private email), prompt user to enter one before completing registration
- All existing REST routes, socket auth, and cookie behavior unchanged

**GitHub Profile Enrichment**
- `POST /profile/github/connect` — OAuth flow, stores `githubId` + access token (encrypted)
- `POST /profile/github/sync` — fetches top 6 repos (by stars), top 3 languages, public contribution count; stored in `User.github` sub-document
- `DELETE /profile/github/disconnect` — removes enrichment data + token
- Profile API (`GET /profile`) returns `github.repos`, `github.languages`, `github.contributionsLastYear`
- Displayed on profile card and used as additional signal in feed discovery filters

**LinkedIn Profile Enrichment**
- `POST /profile/linkedin/connect` + `POST /profile/linkedin/sync` — pulls current job title, company, headline, profile URL
- Stored in `User.linkedin` sub-document; displayed on profile

**Account Management**
- `GET /profile/linked-accounts` — returns which providers are connected
- `DELETE /auth/oauth/:provider` — unlinks; blocked if it would leave the account with no login method

### Data Model Changes

```js
// User schema additions
oauthProviders: [{
  provider:    { type: String, enum: ['github', 'google', 'linkedin'] },
  providerId:  String,
  accessToken: String, // AES-256 encrypted at rest
  linkedAt:    Date,
}]
github: {
  username:              String,
  avatarUrl:             String,
  profileUrl:            String,
  topRepos:              [{ name, url, stars, language }],
  topLanguages:          [String],
  contributionsLastYear: Number,
  syncedAt:              Date,
}
linkedin: {
  headline:   String,
  company:    String,
  jobTitle:   String,
  profileUrl: String,
  syncedAt:   Date,
}
```

---

## Track B — Groups & Communities

### User Stories

1. **As a developer**, I can create a public group with a name, description, and tags (tech stack, topic) so others with similar interests can find it.
2. **As a developer**, I can browse and search public groups by tag or keyword to find communities I care about.
3. **As a group member**, I can chat in real time with everyone in the group, just like 1:1 chat.
4. **As a group admin**, I can invite connections to the group, remove members, and edit group details.
5. **As a user**, I can leave a group at any time; admins can remove members.
6. **As a user**, I can report a group for policy violations.

### Acceptance Criteria

**Group REST API**
- `POST /groups` — create group (name, description, tags, visibility = `public`)
- `GET /groups` — paginated list of public groups, filterable by tags; excludes groups where requester is banned
- `GET /groups/:id` — group detail + member list + recent message count
- `POST /groups/:id/join` + `DELETE /groups/:id/leave` — membership management
- `POST /groups/:id/members/:userId` (admin only) — invite a connection to the group
- `DELETE /groups/:id/members/:userId` (admin only) — remove member
- `PATCH /groups/:id` (admin only) — update name/description/tags
- `DELETE /groups/:id` (admin only) — soft-delete group and archive messages

**Group Chat (Socket.IO)**
- `join_group` / `leave_group` socket events — joins/leaves the `group:<id>` room; auth check verifies membership
- `send_group_message` — persists to `GroupMessage` collection, broadcasts `group_message_received` to room
- `typing` + `typing_update` in group context (extend existing typing handler, scoped by group room)
- Group presence: member count in room shown live

**Frontend**
- `/groups` page — browse/search groups, join button
- `/groups/:id` — group detail: member list, real-time chat thread (reuses `MessageBubble`, `MessageComposer`)
- NavBar link for Groups
- `useGroupChat` hook — mirrors `useChat` for group rooms

### Data Model (new collections)

```js
// Group
{
  name:        { type: String, required, maxlength: 80 },
  description: { type: String, maxlength: 500 },
  tags:        [String],               // e.g. ['react', 'open-source']
  createdBy:   ObjectId (ref: User),
  members: [{
    userId: ObjectId,
    role:   { type: String, enum: ['admin','member'], default: 'member' },
    joinedAt: Date,
  }],
  visibility:  { type: String, enum: ['public'], default: 'public' },
  deletedAt:   Date,
}

// GroupMessage (mirrors Message schema)
{
  groupId:      ObjectId (ref: Group),
  senderId:     ObjectId (ref: User),
  type:         { type: String, enum: ['text','snippet'] },
  body:         String,
  language:     String,
  reactions:    [{ userId, emoji }],
}
```

---

## Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| OAuth flow | Server-side redirect | Token never touches the browser; consistent with existing cookie-based auth |
| GitHub sync trigger | On-demand only (user clicks Sync) | Avoids rate limits; login stays fast |
| Group member cap | 500 members | Keeps Socket.IO rooms manageable before Redis pub-sub is needed |

---

## Shared Concerns

### Security
- OAuth tokens stored encrypted (AES-256-GCM), never returned to client
- `state` parameter validated on every OAuth callback to prevent CSRF
- Group membership checked on every socket event (not just at room join time) — same per-event re-auth pattern as Phase 3

### Testing Strategy
- Unit: `canUsersChat` extensions for group auth; OAuth token encryption/decryption util
- Integration: OAuth login flow (mock provider responses); GitHub/LinkedIn sync (mock API responses)
- Socket: group join/message/typing events mirroring Phase 3's `chatSockets.test.js` pattern
- No E2E browser automation — manual smoke test with seeded data per Phase 3 convention

### Risks

| Risk | Mitigation |
|---|---|
| GitHub API rate limits during sync | Sync on demand only (user-triggered `POST /profile/github/sync`), not on every login |
| LinkedIn API scope restrictions | Store only fields available in basic profile scope; document limitations clearly |
| Group chat blowing up the Socket.IO room count | Rooms are cheap in Socket.IO (string keys, no DB entry); no mitigation needed at this scale |
| OAuth provider outages blocking login | Users who set a password can always fall back to email/password login |

---

## Out of Scope (Phase 4)

- Direct message from within a group (still 1:1 via Phase 3 chat)
- Private / invite-only groups (public only for now)
- Group file uploads / image attachments
- Group video calls (Phase 5)
- AI group recommendations (Phase 6)
