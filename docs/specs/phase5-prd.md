# Phase 5 PRD — Video Calling

## Problem Statement

Text chat (Phase 3) and groups (Phase 4) let developers communicate asynchronously,
but pair programming, code reviews, technical interviews, and mentoring all benefit
from real-time voice and video. Without calling, users leave the platform for Zoom or
Google Meet — breaking the session and losing the context of the conversation thread.

## Goals

| Goal | Metric |
|---|---|
| Keep users on-platform for synchronous collaboration | ≥ 20 % of accepted connections initiate at least one video call within 30 days of launch |
| Reduce friction vs. scheduling an external meeting | Median time from "start call" click to both peers connected ≤ 8 s on a residential connection |
| Group calls adopted by community members | ≥ 15 % of active groups hold at least one group call per week within 4 weeks of launch |

## Non-Goals (deferred)

- Call recording / playback storage (Phase 6 — needs cloud storage budget decision)
- AI meeting summaries or transcripts (Phase 6)
- Phone / PSTN dial-in
- Paid "meeting rooms" (Phase 6 premium tier)
- Waiting rooms and call scheduling (Phase 6)
- Background blur / virtual backgrounds (Phase 6)
- Accessibility: live captions (Phase 6)

---

## User Stories

### 1:1 Video Calls
1. **As a connected user**, I can start a video call with any accepted connection from the chat thread so we can talk face-to-face without leaving the platform.
2. **As the recipient of a call**, I see an incoming call notification and can accept or decline.
3. **As a call participant**, I can mute / unmute my microphone and turn my camera on or off at any time during the call.
4. **As a call participant**, I can share my screen so I can do a live code review or pair program.
5. **As a call participant**, I can end the call at any time; the other participant sees a "Call ended" notice.
6. **As a user**, I can see a brief post-call summary (duration, timestamp) in the chat thread.

### Group Video Calls
7. **As a group admin or member**, I can start a group call from the group's chat page.
8. **As a group member**, I see a "join call" banner when a call is already in progress in a group I belong to.
9. **As a group call participant**, I can see video tiles for all active participants (up to 8 simultaneous video feeds; additional participants are audio-only).
10. **As a group call participant**, I can pin a specific participant's video to the main view.

### Calling Controls (both modes)
11. **As any participant**, I can toggle between camera-off (audio-only) and camera-on mode mid-call without dropping the connection.
12. **As any participant**, I can switch between my available cameras and microphones from the call overlay.

---

## Acceptance Criteria

### Signaling
- `POST /calls/initiate` — logged-in user initiates a call to a connection or group; returns `callId`
- `POST /calls/:callId/accept` / `POST /calls/:callId/decline` — callee responds
- `POST /calls/:callId/end` — either participant can end; broadcasts `call_ended` socket event to room
- Socket events: `call_offer`, `call_answer`, `ice_candidate`, `call_ended`, `call_rejected`, `call_incoming`
- `GET /calls/:callId` — returns call metadata (participants, status, startedAt, duration)
- Signaling is stateless: server only relays SDP offer/answer and ICE candidates; no media flows through the server for 1:1 calls

### Media (1:1)
- Pure WebRTC P2P for 1:1 calls (no SFU needed)
- ICE/TURN fallback for clients behind symmetric NAT (TURN server required — see RFC)
- Video tracks at up to 720p 30fps; audio at Opus
- Screen share replaces or supplements the outbound video track (not a separate stream slot)

### Media (Group — up to 8 participants)
- LiveKit SFU (or mediasoup) handles multi-party routing; clients connect to the SFU, not peer-to-peer
- Server-side mixing not required — selective forwarding only
- Up to 8 simultaneous active video feeds; beyond 8 participants, additional members join audio-only

### Frontend
- Call overlay rendered as a fixed, full-screen modal on top of the existing app — does not navigate away from the current page
- `useWebRTC` hook manages `RTCPeerConnection` lifecycle, ICE gathering, stream acquisition and teardown
- `useGroupCall` hook manages LiveKit/mediasoup room connection for group calls
- Incoming call notification: a persistent banner at the top of the screen with Accept / Decline buttons; also works when the user is on a different page
- Post-call: a `CallSummaryCard` appended to the chat thread showing duration and who was on the call

### Call Session Model
- `CallSession` document created on initiate; updated on accept/end
- Fields: `callId`, `type` (`1:1 | group`), `initiatorId`, `participants[]`, `groupId` (nullable), `status` (`ringing | active | ended | missed | declined`), `startedAt`, `endedAt`, `duration` (seconds)
- History endpoint: `GET /calls` — returns the logged-in user's call history (paginated)

---

## Data Model

```js
// CallSession
{
  type:        { type: String, enum: ['1:1', 'group'], required: true },
  initiatorId: { type: ObjectId, ref: 'User', required: true },
  participants: [{
    userId:   { type: ObjectId, ref: 'User', required: true },
    joinedAt: Date,
    leftAt:   Date,
  }],
  groupId:    { type: ObjectId, ref: 'Group', default: null },
  status:     { type: String, enum: ['ringing', 'active', 'ended', 'missed', 'declined'], default: 'ringing' },
  startedAt:  Date,  // set when first callee accepts
  endedAt:    Date,
  duration:   Number,  // seconds; computed on end
}
```

---

## Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| 1:1 media transport | WebRTC P2P | No server cost for media relay; industry standard for 2-party calls |
| Group media transport | LiveKit SFU (open-source, self-hosted) | Mesh (pure P2P) breaks above 4 participants; mediasoup is lower-level and requires more boilerplate; LiveKit has a modern JS SDK and is MIT-licensed |
| Signaling transport | Existing Socket.IO server | Reuses Phase 3 infra; no second server |
| TURN server | coturn (self-hosted) or Metered TURN (managed) | Required for ICE traversal behind symmetric NAT; evaluated at deploy time |
| Screen sharing | `getDisplayMedia` API | Browser-native; no plugins; replaces the camera track in the existing peer connection |
| Call history persistence | `CallSession` MongoDB collection | Consistent with existing Mongoose pattern; call history shown in chat thread |
| Max simultaneous video (group) | 8 | Beyond this, browser CPU/network cost becomes noticeable; audio-only fallback keeps calls usable at larger sizes |

---

## Risks

| Risk | Mitigation |
|---|---|
| ICE connectivity failures (users behind strict NAT/firewall) | TURN server configured as fallback; measure ICE failure rate in logs |
| LiveKit infra cost and ops burden | Start with a single LiveKit server on the same host as the app; only add capacity when group call concurrency warrants it |
| `getDisplayMedia` not available on mobile browsers | Screen share button hidden on mobile UA; call and audio/camera still work |
| WebRTC connection setup > 8s median | Monitor ICE gathering time; pre-warm TURN credentials on page load |
| Group calls exceeding 8 active video feeds | Hard cap enforced server-side by LiveKit room settings; UI shows audio-only indicator for overflow participants |
| Signaling race: callee accepts after caller hangs up | `call_ended` event sent to all participants; frontend ignores `call_answer` events for already-ended calls |

---

## Out of Scope (Phase 5)

- Recording and playback
- AI summaries / transcription
- Background blur / virtual backgrounds
- Waiting rooms / scheduled calls
- Breakout rooms within group calls
- Call analytics dashboard
- PSTN / phone dial-in
- Paid call features (Phase 6)
