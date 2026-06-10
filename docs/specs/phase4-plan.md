# Implementation Plan — Phase 4

Both tracks are **fully independent** and can be worked in parallel.

## Dependency Graph

```
Track A                                      Track B
───────                                      ───────
Task A1: User model extensions               Task B1: Group model + REST CRUD
    │                                            │
Task A2: OAuth login (GitHub, Google,        Task B2: Group socket handlers
         LinkedIn) + server-side callback        │
    │                                        Task B3: Groups frontend
Task A3: Profile enrichment                      (browse, GroupDetail chat)
         (GitHub sync + LinkedIn sync)
    │
Task A4: Linked accounts UI
         (profile page additions)

  ▲ A1 must land before A2/A3
  ▲ B1 must land before B2
  ▲ B2 must land before B3
  ▲ A-track and B-track have zero dependencies on each other
```

---

## Track A Tasks

---

### Task A1 — User model extensions
**Description:** Add `oauthProviders`, `github`, and `linkedin` sub-documents to the User schema. Add `encryption.js` util (AES-256-GCM). No routes yet — just the data layer and helper.

**Acceptance criteria:**
- `User` schema has `oauthProviders[]`, `github{}`, `linkedin{}` fields with correct types/defaults
- `encrypt(plaintext)` / `decrypt(payload)` round-trips correctly
- Existing user model tests unaffected

**Files:** `backend/src/models/user.js`, `backend/src/utils/encryption.js`, `backend/src/__tests__/encryption.test.js`
**Estimated scope:** S

---

### Task A2 — OAuth login (all three providers)
**Description:** Install `passport`, three strategy packages. Add `GET /auth/oauth/:provider` (redirect) and `GET /auth/oauth/:provider/callback` (exchange code → JWT cookie → redirect to frontend). Handles new-user creation, email match across providers, and the "no email from GitHub" edge case. State/CSRF validation.

**Acceptance criteria:**
- GET `/auth/oauth/github` redirects to GitHub with correct scopes + state cookie
- Callback validates state, exchanges code, upserts User, sets JWT cookie, redirects to `FRONTEND_URL/`
- Same flow works for Google and LinkedIn
- Connecting a second provider to an existing email-matched account links without creating a duplicate user
- `npm test -- oauth.test.js` passes (mock provider responses via `nock`)

**Files:** `backend/src/routes/auth.js`, `backend/src/middlewares/passport.js`, `backend/src/app.js`, `backend/package.json`, `backend/src/__tests__/oauth.test.js`
**Estimated scope:** M

---

### Task A3 — Profile enrichment (GitHub + LinkedIn sync)
**Description:** `POST /profile/github/connect` → OAuth for GitHub API scope → stores encrypted token → `POST /profile/github/sync` → fetches repos/languages/contributions via `GitHubEnrichmentService` → stores in `User.github`. Same pattern for LinkedIn (headline, company, job title). `DELETE` endpoints to disconnect. `GET /profile/linked-accounts` returns connected providers.

**Acceptance criteria:**
- After connect + sync, `GET /profile` returns `github.topRepos`, `github.topLanguages`, `github.contributionsLastYear`
- After LinkedIn sync, `GET /profile` returns `linkedin.headline`, `linkedin.company`, `linkedin.jobTitle`
- Disconnect clears enrichment data and removes token
- GitHub API calls use the stored (decrypted) token; LinkedIn API calls likewise
- `npm test -- enrichment.test.js` passes (mock GitHub/LinkedIn API responses)

**Files:** `backend/src/services/GitHubEnrichmentService.js`, `backend/src/services/LinkedInEnrichmentService.js`, `backend/src/routes/profile.js`, `backend/src/__tests__/enrichment.test.js`
**Estimated scope:** M

---

### Task A4 — Linked accounts + enrichment UI
**Description:** Add a "Connected Accounts" section to the Profile page showing GitHub / Google / LinkedIn connection status with Connect/Disconnect buttons and a GitHub Sync button. Display `github.topRepos`, `github.topLanguages`, and `linkedin.headline` on the public profile card.

**Acceptance criteria:**
- Profile edit page shows Connect/Disconnect for each OAuth provider
- GitHub Sync button triggers `POST /profile/github/sync` and refreshes the display
- Public profile (`GET /profile/:userId`) shows GitHub repos + languages if connected
- `npm run lint` passes

**Files:** `frontend/src/hooks/auth/oauthApi.js`, `frontend/src/containers/Profile/index.jsx`, `frontend/src/widgets/LinkedAccounts/`, `frontend/src/widgets/GitHubCard/`
**Estimated scope:** M

---

## Track B Tasks

---

### Task B1 — Group model + REST CRUD
**Description:** `Group` and `GroupMessage` Mongoose models. Full REST API: create, list (paginated + tag filter), get by id, join, leave, invite member, remove member, update, soft-delete. `canUserAccessGroup` authorization helper. `GET /groups` excludes soft-deleted groups and groups where requester is blocked/banned.

**Acceptance criteria:**
- `POST /groups` creates a group with the creator as admin
- `GET /groups` returns public groups sorted by memberCount, filterable by `?tags=react,typescript`
- `POST /groups/:id/join` enforces `memberCount < maxMembers` (500)
- Admin-only endpoints (invite/remove/update/delete) return 403 for non-admins
- Sole admin cannot leave without transferring ownership (return 400 with helpful message)
- `npm test -- groups.test.js` passes

**Files:** `backend/src/models/group.js`, `backend/src/models/groupMessage.js`, `backend/src/utils/groupAuthorization.js`, `backend/src/routes/groups.js`, `backend/src/constants/apiEndpoints.js`, `backend/src/app.js`, `backend/src/__tests__/groups.test.js`
**Estimated scope:** M

---

### Task B2 — Group socket handlers
**Description:** `registerGroupChatHandlers` analogous to Phase 3's `registerChatHandlers`. Events: `join_group`, `send_group_message` (persist + broadcast `group_message_received`), `typing` in group context, `leave_group` on disconnect. Per-event `canUserAccessGroup` re-auth. Register alongside chat handlers in `sockets/index.js`.

**Acceptance criteria:**
- Two members can join a group room and exchange messages in real time
- `send_group_message` is rejected if the sender is no longer a member (mid-session remove)
- `typing_update` reaches other room members only (not the sender)
- `npm test -- groupSockets.test.js` passes

**Files:** `backend/src/sockets/groupChatHandlers.js`, `backend/src/sockets/index.js`, `backend/src/__tests__/groupSockets.test.js`
**Estimated scope:** S-M

---

### Task B3 — Groups frontend
**Description:** Groups browse page (`/groups`), GroupDetail page (`/groups/:id` with real-time chat). `useGroupChat` hook mirrors `useChat`. `groupApi.js` RTK Query endpoints. Wire into router + NavBar.

**Acceptance criteria:**
- `/groups` lists public groups with tag filters; Join button works
- `/groups/:id` shows member list, real-time chat using existing `MessageBubble`/`MessageComposer`
- `useGroupChat` connects to the correct `group:<id>` room and delivers `group_message_received` events
- `npm run lint` passes

**Files:** `frontend/src/hooks/groups/groupApi.js`, `frontend/src/hooks/groups/useGroupChat.js`, `frontend/src/containers/GroupChat/`, `frontend/src/pages/Groups/`, `frontend/src/routes/index.js`, `frontend/src/widgets/NavBar/NavBar.jsx`
**Estimated scope:** L (mirrors Phase 3 Messages slice; same architecture, new domain)

---

## Checkpoints

### Checkpoint 1 — After A1 + A2
- [ ] GitHub OAuth login works end-to-end in dev (new account + existing email link)
- [ ] Google + LinkedIn OAuth login work
- [ ] No existing auth tests broken

### Checkpoint 2 — After A3 + A4
- [ ] GitHub sync shows repos + languages on profile
- [ ] LinkedIn sync shows headline on profile
- [ ] Connected Accounts UI shows correct state

### Checkpoint 3 — After B1 + B2
- [ ] Group CRUD + membership REST all pass tests
- [ ] Two users can chat in a group room in real time
- [ ] Mid-session member removal is enforced on next socket event

### Checkpoint 4 — FEATURE COMPLETE (after B3)
- [ ] Full Groups UI end-to-end
- [ ] All backend tests pass (`npm test`)
- [ ] Frontend lint + build green

---

## Parallelisation Notes

- A1 → A2 → A3 → A4 must be sequential within Track A
- B1 → B2 → B3 must be sequential within Track B
- **A-track and B-track are fully parallel** — different models, different routes, different frontend pages, zero shared files except `app.js` (mount both routers) and `sockets/index.js` (register both handler sets)
- A1 is the smallest task and can be done first to unblock A2 while B1 starts in parallel
