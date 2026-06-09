# Phase 3: Real-time Chat — RFC / HLD

## Architecture

```
┌─────────────────┐   HTTPS/JSON (history,    ┌──────────────────┐        ┌──────────────┐
│  React (Vite)   │   read-receipts, etc.)    │  Express API     │ ─────▶ │  MongoDB     │
│  Frontend       │ ─────────────────────────▶│  (backend/src)   │ ◀───── │  (Mongoose)  │
│  RTK Query      │                           │  - routes/chat   │        │  - messages  │
│  hooks/chat/*   │   WebSocket (Socket.IO)   │  - sockets/      │        │  - convos    │
│  containers/    │ ◀────────────────────────▶│    (handlers,    │        └──────────────┘
│   Messages      │   messages, presence,     │     PresenceSvc) │
└─────────────────┘   typing, reactions       └────────┬─────────┘
                                                        │
                                            in-process Socket.IO
                                            adapter (single instance —
                                            see Open Questions for
                                            the multi-instance/Redis path)
```

Socket.IO attaches to the **same Express HTTP server** (`backend/src/server.js`), reusing the existing `cookie-parser`-based JWT auth (the socket handshake reads the same httpOnly `token` cookie `userAuth` already validates) — no second auth system. This keeps the "infra Phase 5 can reuse" promise: `PresenceService` and the socket auth middleware are written as standalone modules under `backend/src/sockets/`, not entangled with chat-specific message handlers, so video signaling can register its own event handlers against the same connected-socket registry later.

## Stack Decision
- **Real-time transport**: **Socket.IO** (server: `socket.io`, client: `socket.io-client`) — reason: self-hosted, attaches directly to the existing Express HTTP server with no new infra dependency, has first-class room/namespace support that maps cleanly onto "one room per conversation," and is the most common reusable choice for the WebRTC-signaling Phase 5 will need
- **Persistence**: MongoDB/Mongoose (existing) — two new collections, `Conversation` and `Message` (schema below); no new database
- **Pub/Sub for multi-instance scaling**: **deferred** — Socket.IO's default in-memory adapter is correct for a single backend instance; the `@socket.io/redis-adapter` is a drop-in addition only needed once there's a concrete plan to run >1 backend instance (see Open Questions — this directly tests the idea doc's "won't become an ops burden" assumption by not paying the cost until it's real)
- **Syntax highlighting**: **`prism-react-renderer`** — reason: smallest bundle footprint of the three candidates evaluated (`highlight.js` ships its own CSS/theme bundle; `shiki` is significantly heavier and async-loads grammars), renders as React components (fits the existing component-driven frontend), and only needs the languages we explicitly support
- **Frontend**: React 19 + Vite + Redux Toolkit (RTK Query) + TailwindCSS — unchanged, matches existing scaffold; chat gets its own `containers/Messages/`, `hooks/chat/`, and `widgets/{ConversationList,MessageBubble,MessageComposer}` following the Phase 2 layered-architecture pattern
- **Backend**: Express 5 + Mongoose — unchanged; new `routes/chat.js` (REST: history, conversation list, mark-as-read) + `sockets/` directory (real-time: send/receive, presence, typing, reactions)

This section is the binding contract — Socket.IO + MongoDB + `prism-react-renderer`, no managed real-time vendor, Redis deferred until needed.

## Data Model

```js
// New: Conversation — one document per accepted-connection pair
{
  participants: [ObjectId, ObjectId],   // exactly 2, sorted for a stable compound index
  lastMessageAt: Date,
  lastReadBy: {                          // per-conversation last-read timestamp (NOT per-message)
    <userId>: Date,
    <userId>: Date,
  },
  createdAt, updatedAt
}
// Unique compound index on participants prevents duplicate conversation docs

// New: Message
{
  conversationId: ObjectId,  // ref Conversation
  senderId:       ObjectId,  // ref User
  type:           'text' | 'snippet',
  body:           String,         // plain text, or the code for a snippet
  language:       String | null,  // set when type === 'snippet' (e.g. 'javascript')
  reactions: [{ userId: ObjectId, emoji: String }],
  createdAt, updatedAt
}
```

`ConnectionRequest` (Phase 2, untouched) remains the **authorization source of truth**: a `Conversation` may only be created between two users with an `accepted` request between them, re-checked on every socket connection and `send_message` event — not just hidden in the UI. Blocking (Phase 2) immediately invalidates the conversation: the socket layer checks `blockedUsers` on every event, matching how Phase 2 already makes blocked users disappear from feed/connections/requests.

## API & Event Contract (sketch — detailed shapes deferred to `api-and-interface-design`)

**REST** (`/chat`, mounted alongside `/auth`, `/profile`, `/request`):
| Method | Route | Purpose |
|---|---|---|
| GET | `/chat/conversations` | List the user's conversations (with last message + unread state) |
| GET | `/chat/conversations/:conversationId/messages` | Paginated message history |
| POST | `/chat/conversations/:userId` | Get-or-create a conversation with an accepted connection |
| POST | `/chat/conversations/:conversationId/read` | Mark conversation as read (updates `lastReadBy[me] = now`) |

**Socket.IO events** (namespace: default `/`, one room per `conversationId`):
| Direction | Event | Payload | Purpose |
|---|---|---|---|
| client → server | `join_conversation` | `{ conversationId }` | Join the room (server re-validates accepted-connection + not-blocked) |
| client → server | `send_message` | `{ conversationId, type, body, language? }` | Persist + broadcast a message |
| client → server | `typing` | `{ conversationId, isTyping }` | Broadcast typing state to the room |
| client → server | `react` | `{ messageId, emoji }` | Add/toggle a reaction |
| server → client | `message_received` | `Message` | New message in a joined room |
| server → client | `presence_update` | `{ userId, status: 'online'\|'offline', lastSeenAt }` | From `PresenceService`, broadcast to that user's connections |
| server → client | `typing_update` | `{ conversationId, userId, isTyping }` | Relay of `typing` to the room |
| server → client | `reaction_update` | `{ messageId, reactions }` | Relay of `react` to the room |

`PresenceService` tracks connected-socket → userId mappings in memory (single instance) and emits `presence_update` to a user's accepted connections on connect/disconnect — written so Phase 5 can call `presenceService.isOnline(userId)` directly for call-availability checks.

## Risks, Open Questions & Alternatives Considered

**Alternatives rejected:**
- *Managed real-time vendor (Ably/Pusher/Stream)* — would add a paid dependency and a parallel auth/integration surface; rejected in favor of staying on the self-hosted Express stack the rest of the app uses, and because the doc's stated goal is infra Phase 5 can directly reuse (a vendor's presence model wouldn't transfer to self-hosted WebRTC signaling)
- *REST-polling chat (no websockets)* — considered as a "10x simpler" derisking step, but rejected because it would mean building the real real-time layer twice; the "feels alive" success criterion (presence, typing) is fundamentally a push problem polling handles poorly

**Open Questions:**
1. **Redis timing** — ship single-instance (in-memory adapter) now and add `@socket.io/redis-adapter` only when a concrete multi-instance deployment plan exists, *or* add it now to de-risk the ops-burden assumption early? **Recommendation: defer** — adding infra before there's a scaling need to validate is exactly the premature-investment risk the idea doc flags, and the adapter is a clean drop-in later (no architecture change required).
2. **Read-receipt granularity** — per-message vs per-conversation last-read timestamp? **Recommendation: per-conversation** (locked in the PRD) — matches Slack/Linear, is dramatically simpler to build/query, and the user-facing difference ("seen ✓✓" vs "seen at message #47") is negligible for 1:1 chat.
3. **Snippet rendering library** — `prism-react-renderer` vs `highlight.js` vs `shiki`? **Recommendation: `prism-react-renderer`** (locked above) for bundle size and React-component fit; revisit if the supported-language list grows large enough that Prism's grammar set becomes limiting.
4. **Blocking + chat history** — when user A blocks user B, should existing message history be hidden/archived for both, or remain visible to the non-blocking party? **Recommendation: hide the conversation from the blocker's list (matching how Phase 2 already removes blocked users from feed/connections), but retain the data** (no deletion) so a subsequent `report` has evidence to review — this needs explicit confirmation before the block-handler implementation task, since it's a moderation-policy decision, not a technical one.
