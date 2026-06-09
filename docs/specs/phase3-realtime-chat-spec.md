# Spec: Phase 3 — Real-time Chat

> Builds directly on the approved [PRD](./phase3-realtime-chat-prd.md) and [RFC](./phase3-realtime-chat-rfc.md). Those documents are the source of truth for *why* and *what stack*; this spec turns them into an executable build plan (commands, structure, style, tests, boundaries) for the `planning-and-task-breakdown` → `incremental-implementation` phases that follow.

## Objective
Give two users with an **accepted** `ConnectionRequest` a real-time 1:1 messaging surface: instant delivery, presence, typing indicators, per-conversation read receipts, emoji reactions, and syntax-highlighted code-snippet sharing. Build the presence/socket layer as reusable infrastructure Phase 5 (video) can consume without rework.

**Done means:** an accepted connection can open `/messages`, see conversation history, send/receive messages in real time (<500ms when both online), see presence + typing, mark threads read, react with emoji, and share a highlighted code snippet — all gated server-side by the accepted-connection + not-blocked check.

## Tech Stack (locked in RFC — do not deviate without updating the RFC first)
- **Backend**: Express 5 + Mongoose (existing) + **`socket.io`** (new) attached to the existing HTTP server in `backend/src/server.js`
- **Frontend**: React 19 + Vite + Redux Toolkit/RTK Query + SCSS (existing) + **`socket.io-client`** (new) + **`prism-react-renderer`** (new, for snippet highlighting)
- **Persistence**: MongoDB/Mongoose — new `Conversation` and `Message` collections
- **Auth**: reuse existing JWT-in-httpOnly-cookie (`token`) — socket handshake middleware decodes the same cookie, no parallel auth system
- **Pub/Sub**: Socket.IO in-memory adapter only (Redis explicitly deferred per RFC)

## Commands
```
Backend dev:    cd backend && nvm use 20.4.0 && npm run dev
Backend test:   cd backend && nvm use 20.4.0 && npm test
Backend test (watch one file): npm test -- chat.test.js

Frontend dev:   cd frontend && nvm use 22.14.0 && npm run dev
Frontend lint:  cd frontend && nvm use 22.14.0 && npm run lint
Frontend build: cd frontend && nvm use 22.14.0 && npm run build
```
(Always `source "$HOME/.nvm/nvm.sh" && nvm use <version>` first — the system default node is too old for either side.)

## Project Structure (new files only — follows existing layered conventions)

**Backend:**
```
backend/src/models/conversation.js       → Conversation schema
backend/src/models/message.js            → Message schema
backend/src/routes/chat.js               → REST: list conversations, history, get-or-create, mark-read
backend/src/sockets/index.js             → Socket.IO server bootstrap, attaches to httpServer
backend/src/sockets/authMiddleware.js    → handshake auth (decodes existing JWT cookie)
backend/src/sockets/presenceService.js   → reusable connected-socket↔userId registry (Phase 5 reuses this)
backend/src/sockets/chatHandlers.js      → join_conversation, send_message, typing, react event handlers
backend/src/constants/apiEndpoints.js    → add CHAT route constants (existing file, extend)
backend/src/__tests__/chat.test.js       → REST endpoint tests (supertest, mirrors profile.test.js)
backend/src/__tests__/chatSockets.test.js → socket event tests (socket.io-client against test server)
```

**Frontend:**
```
frontend/src/hooks/chat/chatApi.js        → RTK Query injectEndpoints (conversations, history, mark-read)
frontend/src/hooks/chat/useChat.js        → wraps chatApi + socket connection lifecycle
frontend/src/hooks/chat/useSocket.js      → low-level socket.io-client connection hook (singleton per session)
frontend/src/hooks/chat/usePresence.js    → subscribes to presence_update events
frontend/src/widgets/ConversationList/    → ConversationList.jsx + .scss
frontend/src/widgets/MessageBubble/       → MessageBubble.jsx + .scss (renders text or snippet via prism-react-renderer)
frontend/src/widgets/MessageComposer/     → MessageComposer.jsx + .scss (text + snippet input, typing emit)
frontend/src/containers/Messages/         → index.jsx + Messages.scss (page-level: list + active thread)
```

## Code Style
Follow the exact patterns already in the codebase — one socket-aware example:

```js
// frontend/src/hooks/chat/useChat.js — mirrors useFeed.js's shape: RTK Query + local state + useCallback
export const useChat = (conversationId) => {
  const socket = useSocket();
  const { data: history, isFetching } = useGetMessageHistoryQuery(conversationId, { skip: !conversationId });
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    if (!socket || !conversationId) return undefined;
    socket.emit('join_conversation', { conversationId });
    const onReceive = (msg) => setMessages((prev) => [...prev, msg]);
    socket.on('message_received', onReceive);
    return () => socket.off('message_received', onReceive);
  }, [socket, conversationId]);

  const sendMessage = useCallback(
    (payload) => socket?.emit('send_message', { conversationId, ...payload }),
    [socket, conversationId],
  );

  return { history, messages, isFetching, sendMessage };
};
```
- `@/` path alias for all internal imports; RTK Query `injectEndpoints` + `providesTags`/`invalidatesTags`, mirroring `feedApi.js`/`moderationApi.js`
- BEM-ish SCSS class names prefixed `dc-` (e.g. `.dc-message-bubble`, `.dc-message-bubble-snippet`), mirroring `Feed.scss`/`SwipeCard.scss`
- Backend routes follow the `connection.js`/`profile.js` pattern: constants from `apiEndpoints.js`, inline validation, explicit error JSON shapes (`{ error: '...' }`)
- Socket handlers are pure functions taking `(io, socket, payload)` so they're independently testable without a live server

## Testing Strategy
- **Backend**: Jest + Supertest (existing setup in `__tests__/setup.js`) for REST routes; `socket.io-client` connected to an in-memory test server (`httpServer.listen(0)`) for socket event tests — mirrors `auth.test.js`'s `createAuthenticatedUser` helper for getting a valid JWT cookie
- **Coverage bar** (per PRD Success Metrics): every chat REST route and every socket event (send, receive, presence, typing, read receipt, reaction) has at least one passing + one authorization-boundary-violation test (e.g. "rejects send_message when connection is not accepted", "rejects join_conversation after block")
- **Frontend**: existing lint/build gates; manual smoke test via two authenticated browser sessions (no component test harness currently exists in the repo — do not introduce one mid-feature; flag if needed as a separate task)
- Test data cleanup: any users/conversations created for manual verification must be removed via the same direct-Mongo cleanup pattern used in Phase 2 verification

## Boundaries
- **Always**: re-check `ConnectionRequest.status === 'accepted'` AND `blockedUsers` on every socket connection, `join_conversation`, and `send_message` — never trust client-side gating alone (this is the PRD's "zero cross-connection leakage" success metric)
- **Always**: run backend tests (`npm test`) before considering a chat backend task done; run frontend lint before considering a chat frontend task done
- **Ask first**: adding `socket.io`, `socket.io-client`, `prism-react-renderer` as new dependencies (RFC already justifies these — flagging here because "adding dependencies" is a standing ask-first boundary; get a quick go-ahead before `npm install`)
- **Ask first**: any deviation from the locked Stack Decision (e.g., wanting to add Redis earlier than planned, switching highlight libraries)
- **Never**: store or log raw message bodies in places other than the `Message` collection (no console.log of chat content — privacy)
- **Never**: cascade-delete `Message` documents on block (RFC decision: hide-but-retain for moderation evidence)
- **Never**: build group-chat, video signaling, or file-attachment support in this phase — explicitly out of scope per PRD Non-Goals

## Success Criteria (from PRD — restated as test-able conditions)
- [ ] Message delivery latency < 500ms between two online users (manual timing check during smoke test)
- [ ] 100% of chat REST routes + socket events have passing tests, including auth-boundary-violation cases
- [ ] A user cannot create/join/send to a conversation with a non-accepted-connection or a blocked user (enforced server-side; covered by tests)
- [ ] Blocking hides the conversation from the blocker's list without deleting `Message` data (covered by test)
- [ ] Code snippets render with syntax highlighting via `prism-react-renderer` and link to the sender's profile
- [ ] `npm run lint` (frontend) and `npm test` (backend) pass with zero new failures

## Open Questions
None remaining — all four open questions from the idea doc were resolved in the RFC (Redis deferred, per-conversation read receipts, `prism-react-renderer`, hide-but-retain on block) and confirmed by the user.
