# Phase 3: Real-time Chat — PRD

## Problem & Target User
(From [docs/ideas/phase3-realtime-chat.md](../ideas/phase3-realtime-chat.md), itself a refinement of [the parent idea doc](../ideas/dev-connect-tinder-for-developers.md))
Once two developers connect (Phase 2), they need a real, ongoing way to actually talk — not just a static "you matched!" screen. This phase gives accepted connections a real-time conversation surface that feels alive (presence, typing, instant delivery) and is built *for developers* (syntax-highlighted code-snippet sharing), while establishing the websocket/presence infrastructure that Phase 5's video calling will reuse.

## Goals
- Two users with an **accepted** connection can message each other in real time, with messages persisted and delivered instantly when both are online
- The experience feels "alive": online/offline presence, typing indicators, read receipts, and emoji reactions
- Developers can share code snippets that render with syntax highlighting and link back to the sender's profile — the thing that differentiates this from generic chat
- The presence/pub-sub layer is built as a reusable service (not chat-coupled) so Phase 5 (video signaling) can consume it directly without rework

## Non-Goals (this phase)
- Group chat — explicitly Phase 4 (would mean redesigning multi-party presence/permissions twice)
- Video/voice calling — Phase 5 (this phase only builds the infra it will reuse)
- Generic file attachments (images, PDFs, arbitrary uploads) — only syntax-highlighted code snippets ship; broader file sharing is a future iteration if validated
- Live collaborative code editing / mini-IDE — snippets are paste-and-render only
- Message search, threading/replies, message editing or deletion
- Multi-instance horizontal scaling (Redis pub/sub adapter) — deferred until there's a concrete deployment plan that needs it (see RFC Open Questions)

## Success Metrics
- A message sent by an online user is delivered to the other (online) user in under 500ms
- 100% of chat REST + socket event handlers covered by automated tests (send, receive, presence, typing, receipts, reactions)
- Chat session frequency is measurable against swipe session frequency post-launch — directly validates the parent doc's "is chat the retention driver?" assumption
- Zero cross-connection data leakage: a user can only open a conversation with an accepted connection (enforced server-side, not just hidden in the UI)

## User Stories / Core Flows
1. **Open a conversation**: from the Connections list, a user opens a chat with an accepted connection → conversation loads with message history
2. **Send/receive a message**: user types and sends → message persists, appears instantly in their own thread, and is pushed in real time to the recipient if online (delivered on next load if offline)
3. **See presence**: user sees whether their connection is online, offline, or "last seen X ago"
4. **See typing**: while composing a reply, the other user sees a "typing…" indicator
5. **Read receipts**: user can see whether their last message has been read (per-conversation last-read marker, not per-message — see RFC)
6. **React to a message**: user adds an emoji reaction to a message; the sender sees it update in real time
7. **Share a code snippet**: user pastes code, selects a language, and sends it → renders as a syntax-highlighted block with a link to their profile
8. **Authorization boundary**: a user cannot open, send to, or read a conversation with someone who isn't an accepted connection — and a block (Phase 2) immediately ends the ability to message

## MVP Scope
**In:** stories 1–8 above, on web (responsive — desktop + mobile browser), 1:1 only
**Out:** group chat, video/voice, generic file attachments, collaborative editing, message search/threading/edit/delete, Redis-backed multi-instance scaling

## Decisions Locked (see RFC for detail)
- Real-time transport: Socket.IO (self-hosted, on top of the existing Express server)
- Authorization boundary: conversations are gated by `ConnectionRequest.status === 'accepted'`, re-checked on every socket connection and message send
- Read receipts: per-conversation last-read timestamp (Slack/Linear model), not per-message — simpler to build and matches how developer tools actually do it
