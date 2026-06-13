# Implementation Plan — Phase 5

Two tracks that must be done sequentially (each task blocks the next within its track),
but the tracks themselves can be worked independently up until the final wiring task.

## Dependency Graph

```
Track A — 1:1 Calling                   Track B — Group Calling
──────────────────────                   ──────────────────────
Task A1: CallSession model               Task B1: LiveKit setup +
         + call REST routes                       token service
    │                                        │
Task A2: Call signaling socket           Task B2: Group call socket
         handlers (offer/answer/              handlers
         ICE/end/reject)                      │
    │                                    Task B3: Group call UI
Task A3: useWebRTC hook +                    (ParticipantTile grid,
         1:1 Call overlay UI                  join banner, controls)
    │                                        │
    └─────────────┬───────────────────────── ┘
                  │
           Task C1: CallProvider + IncomingCallBanner
                    (wrap App.jsx; surfaces calls on every page)
                  │
           Task C2: Wire call buttons into Messages + GroupDetail;
                    CallSummaryCard in chat threads
```

---

## Track A — 1:1 Calling

---

### Task A1 — CallSession model + call REST routes

**Description:**
`CallSession` Mongoose model and the five REST endpoints that manage call lifecycle.
No socket work yet — just the data layer and HTTP surface.

**Acceptance criteria:**
- `POST /calls/initiate` creates a `CallSession` (status `ringing`), emits `call_incoming`
  to the callee's socket, and returns `{ callId }`
- `POST /calls/:callId/accept` sets status → `active`, `startedAt` = now
- `POST /calls/:callId/decline` sets status → `declined`; broadcasts `call_rejected`
- `POST /calls/:callId/end` sets status → `ended`, computes `duration`, broadcasts `call_ended`
- `GET /calls/:callId` returns full call document for a participant
- `GET /calls` returns the caller/callee's call history, paginated (page/pageSize)
- Initiating a call to a non-connection returns 403
- Calling yourself returns 400
- `npm test -- calls.test.js` passes

**Files:**
- `backend/src/models/callSession.js`
- `backend/src/routes/calls.js`
- `backend/src/constants/apiEndpoints.js` (add `CALLS` constant)
- `backend/src/app.js` (mount `/calls` router)
- `backend/src/__tests__/calls.test.js`

**Estimated scope:** M

---

### Task A2 — Call signaling socket handlers

**Description:**
`registerCallHandlers` in `sockets/callHandlers.js`. Handles the SDP exchange and ICE
relay for 1:1 calls. The server is a dumb relay — it validates that the emitting socket
is a participant in the CallSession, then fans the event to the other participant.

**Events handled:**
- `call_offer` → validate participant → relay to callee's socket
- `call_answer` → validate participant → relay to caller's socket
- `ice_candidate` → validate participant → relay to the other participant's socket
- `call_ended` → validate participant → relay to both → mark CallSession ended
- `call_rejected` → validate participant → relay to caller → mark CallSession declined

**Acceptance criteria:**
- `call_offer` from a non-participant is silently dropped (no error broadcast)
- ICE candidates relayed bidirectionally between caller and callee
- `call_ended` by either side sets `CallSession.status = 'ended'` and notifies both sockets
- Stale events (e.g., `call_answer` arrives after `call_ended`) are ignored gracefully
- `npm test -- callSignaling.test.js` passes

**Files:**
- `backend/src/sockets/callHandlers.js`
- `backend/src/sockets/index.js` (register `registerCallHandlers`)
- `backend/src/__tests__/callSignaling.test.js`

**Estimated scope:** M

---

### Task A3 — `useWebRTC` hook + 1:1 Call overlay UI

**Description:**
Frontend WebRTC hook and the visual call overlay for 1:1 calls. The hook manages
`RTCPeerConnection` lifecycle; the overlay renders two `<video>` elements (local PiP +
remote full-screen) and the call controls bar.

**Acceptance criteria:**
- `startCall()` acquires camera + mic via `getUserMedia`, creates offer, emits `call_offer`
- `acceptCall(sdp)` acquires camera + mic, sets remote description, creates answer, emits `call_answer`
- `ice_candidate` events add candidates to the peer connection
- `toggleMute()` toggles the outgoing audio track's `enabled` flag (no renegotiation)
- `toggleCamera()` toggles the outgoing video track's `enabled` flag
- `startScreenShare()` calls `getDisplayMedia`, replaces the video sender track; restores camera on stop
- `endCall()` closes the `RTCPeerConnection`, stops all tracks, emits `call_ended`
- Call overlay renders remote stream in the main video element, local stream as a PiP
- Controls: Mute, Camera, Screen Share, End Call buttons with correct active/inactive states
- `npm run build` passes; `npm run lint` passes

**Files:**
- `frontend/src/hooks/call/useWebRTC.js`
- `frontend/src/widgets/CallOverlay/CallOverlay.jsx` + `.scss`
- `frontend/src/widgets/CallControls/CallControls.jsx` + `.scss`
- `frontend/src/store/api.js` (add `'Calls'` tag type)
- `frontend/src/hooks/call/callApi.js` (RTK Query: `useInitiateCallMutation`, `useAcceptCallMutation`, `useDeclineCallMutation`, `useEndCallMutation`, `useGetCallHistoryQuery`)

**Estimated scope:** L

---

## Track B — Group Calling

---

### Task B1 — LiveKit setup + token service

**Description:**
Self-hosted LiveKit server (Docker Compose) and the backend service that issues
short-lived room tokens. No UI yet — just the infra and the token endpoint.

**Acceptance criteria:**
- LiveKit server running locally (Docker) and accessible from the backend and browser
- `POST /calls/group-token` — authenticated member of a group gets a LiveKit JWT for
  `call:<callId>` room; non-members get 403
- Token contains `roomJoin: true`, `canPublish: true`, `canSubscribe: true`, TTL 1 h
- `npm test -- callService.test.js` passes (mocked `livekit-server-sdk`)

**Files:**
- `docker-compose.livekit.yml` (or additions to root `docker-compose.yml`)
- `backend/src/services/LiveKitService.js`
- `backend/src/routes/calls.js` (add group-token endpoint)
- `backend/src/__tests__/callService.test.js`
- Backend `package.json` (add `livekit-server-sdk`)

**Estimated scope:** S-M

---

### Task B2 — Group call socket handlers

**Description:**
Adds group-call-specific socket events to the existing group room infrastructure.
The server creates a `CallSession` (type: `group`), fans out the `group_call_started`
notification to the group room, and issues LiveKit tokens to joining members.

**Events handled:**
- `group_call_start` → create `CallSession` → broadcast `group_call_started` to `group:<id>` room → return LiveKit token to initiator
- `group_call_join` → verify group membership + active call → issue LiveKit token → respond with `group_call_token`
- `group_call_end` → triggered when last participant leaves LiveKit room (webhook) or explicitly by any member → broadcast `group_call_ended`; update CallSession

**Acceptance criteria:**
- `group_call_start` is rejected for non-members (403)
- `group_call_join` for an expired/ended call returns an error event, not a token
- `group_call_ended` is broadcast to all group room sockets when the last participant leaves
- `npm test -- groupCallSignaling.test.js` passes

**Files:**
- `backend/src/sockets/groupChatHandlers.js` (extend with group call events, or add `groupCallHandlers.js`)
- `backend/src/__tests__/groupCallSignaling.test.js`

**Estimated scope:** M

---

### Task B3 — Group call UI

**Description:**
Group call frontend using `@livekit/components-react`. Shows a participant tile grid,
a join-call banner when a call is in progress, and the call controls bar.

**Acceptance criteria:**
- "Start Group Call" button in GroupDetail header; triggers `group_call_start` socket event
- When a call is active, non-participants see a persistent "Join call — N in call" banner inside the group page
- Joining fetches a LiveKit token from `POST /calls/group-token` and connects `useGroupCall` hook
- `<ParticipantTile>` grid renders up to 8 active video feeds
- 9th+ participants shown as audio-only with avatar placeholder
- Mute, camera, screen share, and leave buttons functional
- `npm run build` passes; `npm run lint` passes

**Files:**
- `frontend/src/hooks/call/useGroupCall.js`
- `frontend/src/widgets/GroupCallOverlay/GroupCallOverlay.jsx` + `.scss`
- `frontend/src/widgets/ParticipantGrid/ParticipantGrid.jsx` + `.scss`
- `frontend/src/containers/GroupDetail/index.jsx` (add Start Call button + join banner)
- `frontend/package.json` (add `@livekit/client`, `@livekit/components-react`)

**Estimated scope:** L

---

## Track C — Cross-Cutting Wiring

These tasks depend on both Track A and Track B completing their core work.

---

### Task C1 — CallProvider + IncomingCallBanner

**Description:**
A React context (`CallProvider`) mounted in `App.jsx` that holds the active call state
and subscribes to `call_incoming` / `group_call_started` socket events globally.
`IncomingCallBanner` is a fixed-position overlay that appears on every page.

**Acceptance criteria:**
- `call_incoming` event (from `useSocket` shared instance) triggers the banner on any page,
  including if the user is on `/groups` or `/profile`
- Accept → opens `CallOverlay`; Decline → emits `call_rejected`, banner dismisses
- If the user is already in a call, incoming call is auto-declined (busy signal)
- `group_call_started` for a group the user is a member of shows a lighter "join call" banner
- `npm run build` passes; `npm run lint` passes

**Files:**
- `frontend/src/context/CallProvider.jsx`
- `frontend/src/widgets/IncomingCallBanner/IncomingCallBanner.jsx` + `.scss`
- `frontend/src/App.jsx` (wrap with `<CallProvider>`)
- `frontend/src/hooks/call/useCall.js` (consume CallContext)

**Estimated scope:** M

---

### Task C2 — Wire call entry points + CallSummaryCard

**Description:**
Adds "Start Call" buttons to the 1:1 Messages thread header and the GroupDetail header.
Adds `CallSummaryCard` to `MessageBubble` / `GroupMessageBubble` for messages with
`type: 'call_summary'`. Adds `'call_summary'` type to the backend `Message` and
`GroupMessage` schemas.

**Acceptance criteria:**
- "📞 Start Call" button in Messages thread header → initiates call to the active conversation's other participant
- Post-call, a `CallSummaryCard` appears in the chat thread with: call icon, duration (e.g. "2 m 34 s"), timestamp
- `CallSummaryCard` is rendered for both `Message` (1:1) and `GroupMessage` (group) documents with `type: 'call_summary'`
- `npm test` passes (all 146+ existing tests still green)
- `npm run build` passes; `npm run lint` passes

**Files:**
- `backend/src/models/message.js` (add `'call_summary'` to type enum)
- `backend/src/models/groupMessage.js` (add `'call_summary'` to type enum)
- `backend/src/sockets/callHandlers.js` (emit `call_summary` message on end)
- `frontend/src/widgets/CallSummaryCard/CallSummaryCard.jsx` + `.scss`
- `frontend/src/widgets/MessageBubble/MessageBubble.jsx` (render `CallSummaryCard` for `type === 'call_summary'`)
- `frontend/src/widgets/GroupMessageBubble/GroupMessageBubble.jsx` (same)
- `frontend/src/containers/Messages/index.jsx` (add Start Call button)

**Estimated scope:** S-M

---

## Checkpoints

### Checkpoint 1 — After A1 + A2
- [ ] `POST /calls/initiate` creates a CallSession and emits `call_incoming` to the callee's socket
- [ ] SDP offer/answer relayed correctly between two connected test sockets
- [ ] ICE candidates relayed bidirectionally
- [ ] All new backend tests pass; existing 146 tests still green

### Checkpoint 2 — After A3
- [ ] Two browser tabs can establish a WebRTC video call via the `CallOverlay` UI
- [ ] Mute, camera toggle, screen share, and end call all work
- [ ] Frontend lint + build green

### Checkpoint 3 — After B1 + B2
- [ ] LiveKit server running locally; group token endpoint works
- [ ] `group_call_started` event fans out to the group room correctly
- [ ] Non-member token request returns 403

### Checkpoint 4 — After B3
- [ ] Multiple browsers can join a group call via LiveKit
- [ ] Participant tiles render correctly for ≤ 8 and > 8 participants
- [ ] Frontend lint + build green

### Checkpoint 5 — FEATURE COMPLETE (after C1 + C2)
- [ ] Incoming call banner appears on any page, not just Messages
- [ ] "Start Call" button in Messages header initiates a call end-to-end
- [ ] Post-call `CallSummaryCard` appears in both 1:1 and group chat threads
- [ ] All backend tests pass (`npm test`)
- [ ] Frontend lint + build green

---

## New Dependencies

### Backend
```
livekit-server-sdk    # LiveKit token generation (MIT)
```

### Frontend
```
@livekit/client              # LiveKit browser WebRTC client
@livekit/components-react    # Pre-built ParticipantTile, VideoConference, etc.
```

No changes to existing dependencies.

---

## Parallelisation Notes

- A1 → A2 → A3 must be sequential within Track A
- B1 → B2 → B3 must be sequential within Track B
- **Track A and Track B are fully parallel** — different models, different socket files, different frontend components; only `app.js` and `sockets/index.js` are touched by both (mount router, register handlers)
- C1 and C2 must come last — both depend on at least one working call path
- C1 and C2 can be worked in parallel with each other
- A1 is the smallest task and can start immediately; B1 (LiveKit Docker setup) can run in parallel
