# Phase 5 RFC — Video Calling

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          1:1 Call Flow                                     │
│                                                                            │
│  CallerBrowser ──► POST /calls/initiate  ──► Express REST                  │
│                                               │                            │
│                                         CallSession.create (status: ringing)│
│                                               │                            │
│                                         io.to(calleeSocketId)              │
│                                              .emit('call_incoming', {...}) │
│                                                                            │
│  CalleeBrowser accepts                                                     │
│       │                                                                    │
│       ├── POST /calls/:callId/accept  ──► CallSession (status: active)     │
│       │                                                                    │
│       ├── socket.emit('call_offer',   { sdp })  ──► relay to caller         │
│       │         ◄── 'call_answer',   { sdp }  ──► relay to callee          │
│       │         ◄─► 'ice_candidate', { candidate } (bidirectional relay)   │
│       │                                                                    │
│       └── WebRTC P2P media established directly between browsers           │
│           (TURN relay fallback when P2P NAT traversal fails)               │
│                                                                            │
│  Either side: socket.emit('call_ended') ──► both browsers tear down        │
│               POST /calls/:callId/end  ──► CallSession (status: ended,     │
│                                               endedAt, duration)           │
└────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                        Group Call Flow                                     │
│                                                                            │
│  Admin/Member: socket.emit('group_call_start', { groupId })                │
│       │                                                                    │
│       ├── Server creates CallSession (type: group)                         │
│       ├── Broadcasts 'group_call_started' to group:<groupId> room          │
│       └── Returns LiveKit room token (JWT signed with LiveKit API secret)  │
│                                                                            │
│  Each joining member:                                                      │
│       ├── socket.emit('group_call_join', { groupId, callId })              │
│       ├── Server issues new LiveKit room token                              │
│       └── Browser connects to LiveKit SFU using the token                  │
│                                                                            │
│  LiveKit SFU ─── selective forwarding ──► each participant receives        │
│                   individual tracks from every other active sender         │
│                                                                            │
│  Last participant leaves → LiveKit room closes → server ends CallSession   │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Signaling Layer

### Why Socket.IO (not a separate signaling server)

The Phase 3 Socket.IO server already authenticates every connection via the JWT
cookie and maintains per-user socket mappings (used by presence). Reusing it for
WebRTC signaling means:
- No second auth system
- No second server
- `socket.to(room)` relays already work; signaling is just two more event types

The server is a **dumb relay** for SDP and ICE — it never interprets the payloads.

### Signaling Event Contract

| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `call_incoming` | server → callee | `{ callId, callerId, callerName, callerPhotoUrl, type }` | Ring notification |
| `call_offer` | caller → server → callee | `{ callId, sdp }` | WebRTC offer SDP |
| `call_answer` | callee → server → caller | `{ callId, sdp }` | WebRTC answer SDP |
| `ice_candidate` | either → server → other | `{ callId, candidate }` | ICE candidate relay |
| `call_ended` | either → server → both | `{ callId, endedBy }` | Tear down both sides |
| `call_rejected` | callee → server → caller | `{ callId }` | Decline notification |
| `group_call_started` | server → group room | `{ callId, groupId, startedBy }` | Join-call banner trigger |
| `group_call_join` | member → server | `{ callId, groupId }` | Request LiveKit token |
| `group_call_token` | server → member | `{ token, livekitUrl }` | LiveKit room JWT |
| `group_call_ended` | server → group room | `{ callId }` | All participants disconnect |

### REST Endpoints

```
POST   /calls/initiate                  Start a 1:1 or group call
POST   /calls/:callId/accept            Callee accepts
POST   /calls/:callId/decline           Callee declines
POST   /calls/:callId/end               Either participant ends
GET    /calls/:callId                   Call metadata
GET    /calls                           Paginated call history for the logged-in user
```

All call REST routes are protected by the existing `userAuth` middleware.

---

## 1:1 Media Layer

### Connection Setup

```
Caller                    Signaling Server              Callee
  │                            │                           │
  │── call_offer(sdp) ────────►│── call_offer(sdp) ───────►│
  │                            │                           │ createAnswer()
  │◄── call_answer(sdp) ───────│◄── call_answer(sdp) ──────│
  │                            │                           │
  │── ice_candidate ──────────►│── ice_candidate ─────────►│ (bidirectional)
  │◄── ice_candidate ──────────│◄── ice_candidate ──────────│
  │                            │                           │
  │◄══════════════════ P2P media (audio + video tracks) ═══│
```

### `useWebRTC` Hook (1:1)

```js
// frontend/src/hooks/call/useWebRTC.js
export const useWebRTC = (socket, callId, isCaller) => {
  // State
  const [localStream, setLocalStream]   = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [callStatus, setCallStatus]     = useState('idle'); // idle|ringing|active|ended
  const [isMuted, setIsMuted]           = useState(false);
  const [isCameraOff, setIsCameraOff]   = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const pcRef = useRef(null); // RTCPeerConnection

  // Actions
  startCall()          // getUserMedia → createOffer → emit call_offer
  acceptCall(sdp)      // getUserMedia → setRemoteDescription → createAnswer → emit call_answer
  addIceCandidate(c)   // pcRef.current.addIceCandidate(c)
  toggleMute()
  toggleCamera()
  startScreenShare()   // getDisplayMedia → replace video sender track
  stopScreenShare()    // restore camera track
  endCall()            // close pc → emit call_ended → POST /calls/:callId/end

  return { localStream, remoteStream, callStatus, isMuted, isCameraOff,
           isScreenSharing, startCall, acceptCall, toggleMute, toggleCamera,
           startScreenShare, stopScreenShare, endCall }
}
```

### TURN Server

WebRTC requires ICE for NAT traversal. STUN (Google's free stun.l.google.com:19302) handles
most cases. Symmetric NAT (common in corporate networks) requires TURN relay.

**Options evaluated:**

| Option | Cost | Ops burden | Decision |
|---|---|---|---|
| Google free STUN | Free | None | Use as primary ICE server |
| coturn (self-hosted) | Server cost only | Medium (config, TLS, monitoring) | Use if managed is too expensive |
| Metered.ca TURN (managed) | ~$0.40 / GB relay | Minimal | **Recommended for Phase 5** — pay only for actual relay traffic; free tier covers dev |
| Twilio TURN | ~$0.40 / GB | None | Equivalent to Metered; Twilio adds more billing complexity |

ICE server config (frontend):
```js
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls:       process.env.VITE_TURN_URL,
    username:   process.env.VITE_TURN_USERNAME,
    credential: process.env.VITE_TURN_CREDENTIAL,
  },
];
```

TURN credentials are either static (from Metered) or short-lived (server-generated
`/calls/ice-credentials` endpoint that returns time-limited HMAC credentials from coturn).

---

## Group Media Layer — LiveKit

### Why LiveKit over mediasoup

| Criterion | mediasoup | LiveKit |
|---|---|---|
| API level | Low-level C++ SFU + Node.js wrapper | High-level SFU with JS/TS SDK |
| Boilerplate | ~800 lines of server-side plumbing | ~50 lines (room token + client SDK) |
| Browser SDK | Manual track subscription | `@livekit/client` React hooks |
| Scalability | Horizontal with external config | Horizontal with Redis pub-sub (built-in) |
| License | ISC | Apache 2.0 |
| Hosting | Self-hosted only | Self-hosted or LiveKit Cloud |

LiveKit provides a `@livekit/client` SDK and a `@livekit/components-react` package with
ready-made `<VideoConference>` and `<ParticipantTile>` components that handle track
subscription, rendering, and quality adaptation out of the box.

### Token Issuance

LiveKit rooms are access-controlled by short-lived JWTs (signed with `LIVEKIT_API_KEY` +
`LIVEKIT_API_SECRET`). The Express server generates these server-side — the client
never sees the API secret.

```js
// backend/src/services/LiveKitService.js
import { AccessToken } from 'livekit-server-sdk';

export const generateRoomToken = (roomName, participantIdentity, participantName) => {
  const at = new AccessToken(
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
    { identity: participantIdentity, name: participantName, ttl: '1h' }
  );
  at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
  return at.toJwt();
};
```

Room naming: `call:<callId>` — unique per CallSession.

### `useGroupCall` Hook

```js
// frontend/src/hooks/call/useGroupCall.js
import { useRoom, useTracks } from '@livekit/components-react';

export const useGroupCall = (token, livekitUrl) => {
  // LiveKit handles track subscription, quality adaptation, and reconnect
  const { room, connect, disconnect } = useRoom();
  const tracks = useTracks([Track.Source.Camera, Track.Source.Microphone, Track.Source.ScreenShare]);

  // Actions exposed to UI
  connect(livekitUrl, token)
  disconnect()
  toggleMicrophone()
  toggleCamera()
  startScreenShare()

  return { room, tracks, connect, disconnect, toggleMicrophone, toggleCamera, startScreenShare }
}
```

---

## Frontend Architecture

### Component Tree

```
App
└── CallProvider (React context — holds active call state + socket listeners)
    ├── IncomingCallBanner   (fixed top banner, visible on any page)
    ├── CallOverlay          (full-screen fixed modal while call is active)
    │   ├── 1:1 mode
    │   │   ├── <video> (remote stream)
    │   │   ├── <video> (local stream, picture-in-picture)
    │   │   └── CallControls (mute, camera, screen share, end)
    │   └── group mode
    │       ├── <ParticipantTile> × N  (LiveKit components-react)
    │       ├── PinnedParticipantView  (active speaker or manually pinned)
    │       └── CallControls
    └── ... rest of existing app (Messages, Groups, Profile, etc.)
```

`CallProvider` wraps the entire app (mounted in `App.jsx`) so incoming call
notifications surface on every page — not just the Messages or Groups page.

### New ENV variables (frontend)

```
VITE_TURN_URL=
VITE_TURN_USERNAME=
VITE_TURN_CREDENTIAL=
VITE_LIVEKIT_URL=     # wss://your-livekit-server.example.com
```

### New ENV variables (backend)

```
LIVEKIT_API_KEY=
LIVEKIT_API_SECRET=
LIVEKIT_URL=          # same as VITE_LIVEKIT_URL
TURN_SECRET=          # for HMAC coturn credentials (if using coturn)
```

---

## Existing Code Impact

| Existing file | Change |
|---|---|
| `backend/src/app.js` | Mount `callsRouter` at `/calls` |
| `backend/src/sockets/index.js` | Register `registerCallHandlers` alongside chat/group handlers |
| `backend/src/sockets/chatHandlers.js` | No change |
| `backend/src/sockets/groupChatHandlers.js` | No change |
| `frontend/src/App.jsx` | Wrap with `<CallProvider>` |
| `frontend/src/routes/index.js` | No new routes needed (overlay, not page) |
| `frontend/src/widgets/NavBar/NavBar.jsx` | No change |
| `frontend/src/containers/Messages/index.jsx` | Add "Start Call" button to conversation thread header |
| `frontend/src/containers/GroupDetail/index.jsx` | Add "Start Group Call" button; show join-call banner |

No breaking changes to existing API, socket events, or DB schemas.

---

## Data Flow: Post-Call Summary in Chat Thread

When a call ends:

1. Server computes `duration = endedAt - startedAt`
2. Server creates a special `Message` with `type: 'call_summary'` in the existing `Conversation`
   (1:1) or `GroupMessage` in the `Group` collection (group call)
3. `message_received` / `group_message_received` delivers it in real time
4. `MessageBubble` / `GroupMessageBubble` render a `CallSummaryCard` widget for `type: 'call_summary'` messages

This reuses the existing message delivery pipeline — no new REST polling for call history.

---

## Authorization Matrix

| Action | Requirement |
|---|---|
| Initiate 1:1 call | Logged in; target must be an accepted connection |
| Accept / decline / end 1:1 call | Logged in; must be a participant in the CallSession |
| Start group call | Logged in; must be a group member |
| Join group call | Logged in; must be a group member; call must be active |
| End group call | Any participant (last to leave closes the session) |
| GET /calls history | Logged in; returns only calls the user participated in |

---

## Testing Strategy

Same pattern as Phase 3 + 4:

| Test file | Coverage |
|---|---|
| `callService.test.js` | `CallSession` CRUD; token generation; duration computation |
| `calls.test.js` | REST endpoints (initiate, accept, decline, end, history) |
| `callSignaling.test.js` | Socket relay: offer → relay to callee; ice_candidate bidirectional; call_ended both sides; rejected call not relayed after end |

WebRTC itself is not tested in Jest — browser APIs (`RTCPeerConnection`, `getUserMedia`) are
mocked. E2E WebRTC verification is done via manual smoke test with two browser tabs.

---

## Open Questions

| Question | Options | Recommendation |
|---|---|---|
| TURN server | coturn self-hosted vs. Metered managed | Start with Metered (zero ops); migrate to coturn if cost becomes an issue at scale |
| LiveKit hosting | Self-hosted (Docker on same VPS) vs. LiveKit Cloud | Self-hosted for Phase 5 (predictable cost); LiveKit Cloud if multi-region is needed in Phase 6+ |
| Group call hard cap | 8 active video / unlimited audio-only vs. 8 total participants | 8 active video + audio-only overflow is better UX for large groups |
| Screen share co-existence with camera | Replace camera track vs. add a third track | Replace camera track (simpler peer connection negotiation, supported everywhere) |
