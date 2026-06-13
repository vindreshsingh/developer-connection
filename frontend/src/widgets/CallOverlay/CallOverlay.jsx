import { useEffect, useRef } from 'react';
import { useEndCallMutation } from '@/hooks/call/callApi';
import { useWebRTC } from '@/hooks/call/useWebRTC';
import CallControls from '@/widgets/CallControls/CallControls';

/**
 * Full-screen call overlay for 1:1 WebRTC calls.
 * Rendered on top of the entire app by CallProvider — the user never
 * navigates away from the current page while on a call.
 *
 * @param {{
 *   socket:           import('socket.io-client').Socket,
 *   callId:           string,
 *   isCaller:         boolean,
 *   incomingOfferSdp: object|null,   // set only for callee (from call_offer socket event)
 *   remoteUserName:   string,
 *   onClose:          () => void,    // called when call ends / user dismisses
 * }} props
 */
export default function CallOverlay({
  socket,
  callId,
  isCaller,
  incomingOfferSdp,
  remoteUserName,
  onClose,
}) {
  const localVideoRef  = useRef(null);
  const remoteVideoRef = useRef(null);

  const [endCallMutation] = useEndCallMutation();

  const {
    localStream,
    remoteStream,
    callStatus,
    isMuted,
    isCameraOff,
    isScreenSharing,
    webRTCError,
    startCall,
    acceptCall,
    toggleMute,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    endCall,
  } = useWebRTC(socket, callId);

  // ── Kick off WebRTC on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (isCaller) {
      startCall();
    } else if (incomingOfferSdp) {
      acceptCall(incomingOfferSdp);
    }
    // Only run on mount — no deps change after initial render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Attach streams to <video> elements ───────────────────────────────────
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // ── Dismiss overlay when call reaches ended state ─────────────────────────
  useEffect(() => {
    if (callStatus === 'ended') {
      const timer = setTimeout(onClose, 1500); // brief "Call ended" message before closing
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [callStatus, onClose]);

  // ── Handle end call (both socket + REST) ─────────────────────────────────
  const handleEndCall = () => {
    endCall(); // tears down WebRTC + emits socket event
    endCallMutation(callId).catch(() => {}); // persist in DB (best-effort)
  };

  const handleScreenShare = () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  };

  const statusLabel =
    callStatus === 'ringing' ? 'Calling…' :
    callStatus === 'active'  ? 'Connected' :
    callStatus === 'ended'   ? 'Call ended' :
    '';

  return (
    <div
      className="fixed inset-0 z-[9000] flex flex-col items-center justify-center overflow-hidden bg-[#111]"
      role="dialog"
      aria-label="Video call"
      aria-modal="true"
    >
      {/* Remote video — fills the overlay */}
      <video
        ref={remoteVideoRef}
        className="absolute inset-0 h-full w-full object-cover"
        autoPlay
        playsInline
      />

      {/* Placeholder when remote video isn't connected yet */}
      {!remoteStream && callStatus !== 'ended' && (
        <div className="relative z-[1] flex flex-col items-center gap-3">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-violet-800 text-2xl font-bold text-white">
            {remoteUserName?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <p className="text-xl font-semibold text-white">{remoteUserName}</p>
          <p className="text-[0.9rem] text-white/65">{statusLabel}</p>
        </div>
      )}

      {/* Call ended message */}
      {callStatus === 'ended' && (
        <div className="relative z-[1] text-[1.1rem] text-white/80">
          <p>Call ended</p>
        </div>
      )}

      {/* Error banner */}
      {webRTCError && (
        <div className="absolute left-1/2 top-4 z-10 max-w-[80vw] -translate-x-1/2 rounded-lg bg-red-600/85 px-5 py-2 text-center text-sm text-white">
          {webRTCError}
        </div>
      )}

      {/* Local video — picture-in-picture, bottom right */}
      <video
        ref={localVideoRef}
        className="absolute bottom-24 right-5 z-[5] h-[105px] w-[140px] rounded-lg border-2 border-white/25 bg-[#1a1a1a] object-cover max-[480px]:bottom-[5.5rem] max-[480px]:h-[68px] max-[480px]:w-[90px]"
        autoPlay
        playsInline
        muted  // always muted locally to avoid echo
      />

      {/* Header — remote name + status */}
      <header className="absolute left-6 top-6 z-[5] flex flex-col gap-[0.2rem]">
        <span className="text-[1.1rem] font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">{remoteUserName}</span>
        <span className="text-[0.8rem] text-white/65">{statusLabel}</span>
      </header>

      {/* Controls */}
      {callStatus !== 'ended' && (
        <div className="absolute bottom-6 left-1/2 z-[5] -translate-x-1/2">
          <CallControls
            isMuted={isMuted}
            isCameraOff={isCameraOff}
            isScreenSharing={isScreenSharing}
            onToggleMute={toggleMute}
            onToggleCamera={toggleCamera}
            onScreenShare={handleScreenShare}
            onEndCall={handleEndCall}
          />
        </div>
      )}
    </div>
  );
}
