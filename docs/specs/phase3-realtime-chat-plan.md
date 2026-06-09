# Implementation Plan: Phase 3 — Real-time Chat

## Overview
Build 1:1 real-time chat for accepted connections, vertically sliced: get a bare-bones persisted-message round trip working end-to-end first (Task 1-3), then layer presence/typing/receipts/reactions/snippets on top of that working spine. Each slice leaves the system in a demoable state. Backend foundation (models → routes → sockets) precedes frontend per the dependency graph; within each vertical slice, backend lands just before its matching frontend piece.

## Dependency Graph
```
Conversation/Message models
        │
        ├── REST routes (chat.js: list, history, get-or-create, mark-read)
        │         │
        │         └── chatApi.js (RTK Query) ── ConversationList / Messages container
        │
        └── Socket bootstrap + auth middleware
                  │
                  ├── PresenceService ──── presence_update events ── usePresence
                  │
                  └── chatHandlers (join/send/typing/react)
                            │
                            └── useSocket / useChat ── MessageBubble / MessageComposer
                                      │
                                      └── prism-react-renderer snippet rendering
```

## Tasks

## Task 1: Conversation & Message models + REST scaffolding
**Description:** Add `Conversation` and `Message` Mongoose models per the RFC schema, plus the `chat.js` route file wired into `app.js` with the four REST endpoints (list conversations, get-or-create, history, mark-read), all gated by the existing `userAuth` middleware and an explicit "is this an accepted connection, and not blocked" check shared via a small helper.

**Acceptance criteria:**
- [ ] `Conversation` (participants, lastMessageAt, lastReadBy map) and `Message` (conversationId, senderId, type, body, language, reactions[]) models exist with the indexes described in the RFC
- [ ] `POST /chat/conversations/:userId` creates-or-returns a conversation only between accepted, non-blocked connections (403/404 otherwise)
- [ ] `GET /chat/conversations`, `GET /chat/conversations/:id/messages` (paginated), `POST /chat/conversations/:id/read` all work and are auth-gated

**Verification:**
- [ ] `cd backend && nvm use 20.4.0 && npm test -- chat.test.js`
- [ ] Manual: curl through the four routes with two seeded test users (mirrors the Phase 2 curl-based verification approach)

**Dependencies:** None
**Files likely touched:** `backend/src/models/conversation.js`, `backend/src/models/message.js`, `backend/src/routes/chat.js`, `backend/src/constants/apiEndpoints.js`, `backend/src/app.js`, `backend/src/__tests__/chat.test.js`
**Estimated scope:** M (5 files)

---

## Task 2: Socket.IO bootstrap + auth middleware + PresenceService
**Description:** Attach Socket.IO to the existing HTTP server, add handshake middleware that decodes the same JWT cookie `userAuth` already validates (no parallel auth), and build `PresenceService` as a standalone module tracking connected-socket↔userId and emitting `presence_update` to a user's accepted connections on connect/disconnect. This is the reusable infra Phase 5 depends on — keep it chat-agnostic.

**Acceptance criteria:**
- [ ] Socket connections without a valid `token` cookie are rejected at handshake
- [ ] `PresenceService` exposes `isOnline(userId)` and emits `presence_update` on connect/disconnect to that user's accepted connections only
- [ ] Server starts cleanly with sockets attached; existing REST routes unaffected

**Verification:**
- [ ] `cd backend && nvm use 20.4.0 && npm test -- chatSockets.test.js` (connect/reject/presence cases)
- [ ] Manual: connect two `socket.io-client` instances against the running dev server with valid/invalid cookies

**Dependencies:** Task 1 (needs `Conversation`/connection-lookup helpers)
**Files likely touched:** `backend/src/sockets/index.js`, `backend/src/sockets/authMiddleware.js`, `backend/src/sockets/presenceService.js`, `backend/src/server.js`, `backend/src/__tests__/chatSockets.test.js`
**Estimated scope:** M (4-5 files)

---

## Checkpoint: After Tasks 1-2
- [ ] Backend tests pass (`npm test`)
- [ ] Socket connections authenticate using the existing cookie-based session — no second auth system
- [ ] Review with human before building chat-specific socket handlers

---

## Task 3: `send_message`/`message_received` handler + minimal frontend round trip
**Description:** Implement the `join_conversation` and `send_message` socket handlers (persist to `Message`, broadcast `message_received` to the room, update `Conversation.lastMessageAt`), each re-checking accepted-connection + not-blocked. On the frontend, build the minimal vertical slice: `chatApi.js`, `useSocket`/`useChat`, a bare-bones `Messages` container that lists conversations and shows a scrollable thread with a text-only composer — no presence/typing/snippets yet. This is the first end-to-end demoable slice.

**Acceptance criteria:**
- [ ] Two authenticated browser sessions can open a conversation and exchange plain-text messages in real time (<500ms)
- [ ] `send_message`/`join_conversation` reject non-accepted or blocked pairs with a clear error event
- [ ] Message history loads via REST on conversation open; new messages arrive via socket and persist across reload

**Verification:**
- [ ] `npm test -- chatSockets.test.js` (send/receive + auth-boundary-violation cases)
- [ ] `cd frontend && nvm use 22.14.0 && npm run lint`
- [ ] Manual smoke test with two seeded users (per existing email-verification workaround pattern), then clean up test data via direct-Mongo script

**Dependencies:** Tasks 1, 2
**Files likely touched:** `backend/src/sockets/chatHandlers.js`, `frontend/src/hooks/chat/{chatApi,useSocket,useChat}.js`, `frontend/src/containers/Messages/{index.jsx,Messages.scss}`, `frontend/src/widgets/{ConversationList,MessageBubble,MessageComposer}/*`
**Estimated scope:** L (8 files — acceptable here because it's one cohesive vertical slice; if it grows, split frontend scaffolding from the socket handler)

---

## Checkpoint: After Task 3 — CORE LOOP WORKING
- [ ] End-to-end: open conversation → send → receive in real time → reload → history persists
- [ ] `npm test` (backend) and `npm run lint` (frontend) green
- [ ] **Demo to human before layering presence/typing/receipts/reactions/snippets on top**

---

## Task 4: Presence + typing indicators
**Description:** Wire `PresenceService` events through to the frontend (`usePresence`) showing online/offline/last-seen on `ConversationList` and the active thread header; add `typing`/`typing_update` socket events with debounced emit from `MessageComposer` and a "X is typing…" indicator.

**Acceptance criteria:**
- [ ] Presence indicator updates live when the other user connects/disconnects
- [ ] Typing indicator appears within ~1s of the other user typing and clears after they stop

**Verification:**
- [ ] `npm test -- chatSockets.test.js` (presence + typing event cases)
- [ ] Manual: two-session smoke test toggling connect/disconnect and typing

**Dependencies:** Task 3
**Files likely touched:** `backend/src/sockets/chatHandlers.js`, `frontend/src/hooks/chat/usePresence.js`, `frontend/src/widgets/{ConversationList,MessageComposer}/*`
**Estimated scope:** S-M (3-4 files)

---

## Task 5: Read receipts + reactions
**Description:** Implement `POST /chat/conversations/:id/read` wiring on the frontend (mark-as-read on thread open/scroll-to-bottom, per-conversation `lastReadBy` model — no per-message receipts), and the `react`/`reaction_update` socket events plus an emoji-picker affordance on `MessageBubble`.

**Acceptance criteria:**
- [ ] Opening a thread updates `lastReadBy[me]`; the sender sees a "seen" indicator reflecting the recipient's last-read timestamp vs. message time
- [ ] Adding/toggling a reaction updates in real time for both participants

**Verification:**
- [ ] `npm test -- chat.test.js chatSockets.test.js` (read-receipt + reaction cases)
- [ ] Manual two-session smoke test

**Dependencies:** Task 3 (can run in parallel with Task 4 — independent subsystems)
**Files likely touched:** `backend/src/routes/chat.js`, `backend/src/sockets/chatHandlers.js`, `frontend/src/hooks/chat/{chatApi,useChat}.js`, `frontend/src/widgets/MessageBubble/*`
**Estimated scope:** M (4-5 files)

---

## Task 6: Code-snippet sharing with syntax highlighting
**Description:** Add `prism-react-renderer` to the frontend, extend `MessageComposer` with a "snippet mode" (language picker + code textarea), extend `MessageBubble` to render `type: 'snippet'` messages as highlighted blocks linking back to the sender's profile.

**Acceptance criteria:**
- [ ] A user can paste code, pick a language, send it, and see it rendered as a highlighted block on both ends
- [ ] The snippet links to the sender's profile page
- [ ] Bundle size impact is checked (`npm run build` output) and stays reasonable (no full-language-set import)

**Verification:**
- [ ] `npm run lint && npm run build` (frontend)
- [ ] Manual: send snippets in 2-3 supported languages, verify rendering + profile link

**Dependencies:** Task 3 (independent of Tasks 4/5 — can run in parallel)
**Files likely touched:** `frontend/src/widgets/{MessageComposer,MessageBubble}/*`, `frontend/package.json`
**Estimated scope:** S-M (3 files + dependency add)

---

## Task 7: Block ↔ chat-history interaction
**Description:** Implement the locked moderation decision: blocking hides the conversation from the blocker's `ConversationList` (filter at the REST/query layer, mirroring how Phase 2 already excludes blocked users from feed/connections) without deleting `Message` documents — and ensure live socket events (`join_conversation`, `send_message`) are immediately rejected once a block exists, even mid-session.

**Acceptance criteria:**
- [ ] After blocking, the conversation disappears from the blocker's list but `Message` documents remain in the database (verified directly, not just via UI)
- [ ] An open socket session is rejected on the next `send_message`/`join_conversation` after a block is created (re-check happens per-event, not just at connect time)

**Verification:**
- [ ] `npm test -- chat.test.js chatSockets.test.js` (block-mid-session rejection case)
- [ ] Manual: block during an active two-session chat, confirm immediate effect

**Dependencies:** Tasks 1, 3
**Files likely touched:** `backend/src/routes/{chat,connection}.js`, `backend/src/sockets/chatHandlers.js`, `backend/src/__tests__/chat.test.js`
**Estimated scope:** S (2-3 files — purely enforcing an existing decision, not new UI)

---

## Checkpoint: After Tasks 4-7 — FEATURE COMPLETE
- [ ] All PRD user stories (1-8) demoable end-to-end
- [ ] `npm test` (backend, 100% of chat REST + socket events covered) and `npm run lint && npm run build` (frontend) green
- [ ] Authorization-boundary tests cover: non-connection, pending-connection, and blocked-mid-session cases
- [ ] Test data cleaned up via direct-Mongo scripts
- [ ] Final review with human — ready for `code-review-and-quality` → `git-workflow-and-versioning` → `documentation-and-adrs` → `shipping-and-launch`

## Risks & Mitigations
- **Socket auth diverging from REST auth** → mitigated by reusing the exact same JWT-cookie decode logic (Task 2 explicitly shares it, not reimplements it)
- **Authorization re-check forgotten on a new event** → mitigate by centralizing the "accepted + not blocked" check into one helper used by every handler and REST route (Task 1 builds it once; Tasks 2-7 import it)
- **Bundle bloat from `prism-react-renderer`** → Task 6 explicitly checks build output; import only the language grammars actually offered in the picker
- **Task 3 sized L** → if it proves too large mid-session, split into "3a: socket handlers + tests" and "3b: minimal frontend slice"

## Parallelization Notes
- Tasks 4, 5, 6 are independent of each other (presence/typing, receipts/reactions, snippets touch disjoint code) — can be worked in parallel sessions once Task 3's checkpoint is demoed and approved
- Task 7 depends only on Tasks 1 and 3, so it can also run in parallel with 4-6
