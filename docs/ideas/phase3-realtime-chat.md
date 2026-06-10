# Phase 3 — Real-time Chat

## Problem Statement
How might we let two developers who've matched on Dev Connect have real, ongoing conversations — in a way that feels instant and alive — while building the real-time infrastructure (presence, pub-sub) that video calls will later reuse?

## Recommended Direction
Build the full vertical slice the roadmap already scopes — messaging, presence, typing indicators, read receipts, reactions, and file/code-snippet sharing — on a self-hosted **Socket.IO + Redis** real-time layer that sits alongside the existing Express + MongoDB backend. This is "Direction A" (full slice, as roadmapped), with one important fold-in from a stronger differentiation angle ("Direction B"): file/snippet sharing should specifically mean **syntax-highlighted code blocks with inline links to the sender's GitHub profile/repos** — not generic file attachments. That's the thing that makes this feel like chat *for developers* rather than WhatsApp-with-a-different-logo, and it's cheap to add on top of the base messaging primitive rather than bolt on later.

We rejected two alternative directions: surfacing chat inline on `ConnectionCard` with no dedicated inbox (breaks down once Phase 4 groups and Phase 5 video need a real "home" for conversations — would mean rework), and building group chat now (explicitly Phase 4's job; doing it early is scope creep into infra that would likely get redone anyway once group semantics are nailed down).

Self-hosting on Socket.IO + Redis (rather than a managed real-time vendor like Ably/Pusher) keeps the stack consistent with the existing Express/MongoDB scaffold, avoids a new paid-vendor dependency, and — critically — means the presence/pub-sub work done here is the *same* infrastructure Phase 5's WebRTC signaling will reuse, which is the doc's stated reason for sequencing chat before video.

## Key Assumptions to Validate
- [ ] Self-hosted Socket.IO + Redis won't become an ops burden before there's enough scale to justify it — validate cheaply now (single-instance Socket.IO needs no Redis adapter at all; only add Redis pub/sub when running multiple backend instances) rather than guessing at scale you don't have yet
- [ ] The presence/pub-sub architecture built for 1:1 chat generalizes cleanly to WebRTC signaling in Phase 5 — if this bet is wrong, the infra gets reworked twice; mitigate by keeping the presence layer transport-agnostic (a `PresenceService` the chat module consumes, not chat-specific code)
- [ ] Real-time chat is the actual retention driver, not the swipe mechanic (carried over from the parent idea doc) — validate post-launch by comparing chat session frequency vs. swipe session frequency
- [ ] "Syntax-highlighted code snippets" is the differentiating feature developers actually want in chat (vs. just wanting fast, reliable messaging) — validate via usage analytics on snippet-message frequency vs. plain-text messages once shipped

## MVP Scope (Phase 3 — Real-time Chat)
**In:**
- 1:1 real-time messaging (send/receive/persist) over Socket.IO, scoped to accepted connections only (reuses Phase 2's `ConnectionRequest` model as the authorization boundary)
- Presence (online/offline/last-seen) — built as a reusable service, not chat-coupled, so Phase 5 can consume it directly
- Typing indicators
- Read receipts
- Message reactions (emoji)
- Code-snippet sharing: paste-and-render with syntax highlighting (e.g., via a lightweight highlighter library) + inline link back to the sender's profile/GitHub — explicitly *not* live collaborative editing or a mini-IDE
- Dedicated `/messages` area in the frontend (new page/container in the existing layered architecture), reusing `useCurrentUser`/connection data

**Out (deferred):**
- Group chat — Phase 4's job; building it now risks redoing the infra once group-specific semantics (multi-party presence, permissions) are designed
- Video/voice — Phase 5; this phase only builds the signaling-reusable presence/pub-sub foundation
- Generic file attachments (images, PDFs, arbitrary uploads) — only syntax-highlighted code snippets ship in this slice; broaden later if validated
- Message search, threading/replies, message editing/deletion — nice-to-haves that don't block the core "feels alive" loop

## Not Doing (and Why)
- **Managed real-time vendor (Ably/Pusher/Stream)** — would add a paid dependency and a new integration surface inconsistent with the self-hosted Express/MongoDB stack; self-hosting keeps full control over the presence layer Phase 5 needs to reuse
- **Group chat now** — explicitly sequenced to Phase 4 in the parent roadmap; pulling it forward is exactly the kind of "redesign shared infra multiple times" the phasing strategy is meant to avoid
- **Live collaborative code editing** — the "expert lens" variation that inspired snippet-sharing could balloon into a mini-IDE; drawing a hard line at "paste + render" keeps the MVP shippable
- **Inline chat with no dedicated inbox** — reduces nav friction short-term but creates rework risk once Phase 4 (groups) and Phase 5 (video) need a real conversational "home"

## Open Questions
- Single-instance Socket.IO needs no Redis adapter — should Redis be deferred entirely until there's a concrete multi-instance deployment plan (avoiding infra cost/complexity before it's needed), or added now to de-risk the "won't become an ops burden" assumption early?
- Which syntax-highlighting library best fits the existing frontend stack (Vite + React + SCSS) without bloating the bundle — `prism-react-renderer`, `highlight.js`, or `shiki`?
- Should read receipts be per-message or per-conversation (last-read timestamp) — the latter is significantly simpler to build and is what most developer-facing tools (Slack, Linear) actually use
- Does the "messages scoped to accepted connections only" boundary need any additional moderation hooks, given Phase 2 just shipped block/report — e.g., should blocking a user also hide/archive existing chat history with them?
