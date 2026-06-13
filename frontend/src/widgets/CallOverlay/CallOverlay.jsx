import { useEffect, useRef } from 'react';
import { useEndCallMutation } from '@/hooks/call/callApi';
import { useWebRTC } from '@/hooks/call/useWebRTC';
import CallControls from '@/widgets/CallControls/CallControls';
import './CallOverlay.scss';

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
    <div className="dc-call-overlay" role="dialog" aria-label="Video call" aria-modal="true">
      {/* Remote video — fills the overlay */}
      <video
        ref={remoteVideoRef}
        className="dc-call-overlay-remote"
        autoPlay
        playsInline
      />

      {/* Placeholder when remote video isn't connected yet */}
      {!remoteStream && callStatus !== 'ended' && (
        <div className="dc-call-overlay-waiting">
          <div className="dc-call-overlay-avatar">
            {remoteUserName?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <p className="dc-call-overlay-waiting-name">{remoteUserName}</p>
          <p className="dc-call-overlay-status">{statusLabel}</p>
        </div>
      )}

      {/* Call ended message */}
      {callStatus === 'ended' && (
        <div className="dc-call-overlay-ended">
          <p>Call ended</p>
        </div>
      )}

      {/* Error banner */}
      {webRTCError && (
        <div className="dc-call-overlay-error">{webRTCError}</div>
      )}

      {/* Local video — picture-in-picture, bottom right */}
      <video
        ref={localVideoRef}
        className="dc-call-overlay-local"
        autoPlay
        playsInline
        muted  // always muted locally to avoid echo
      />

      {/* Header — remote name + status */}
      <header className="dc-call-overlay-header">
        <span className="dc-call-overlay-header-name">{remoteUserName}</span>
        <span className="dc-call-overlay-header-status">{statusLabel}</span>
      </header>

      {/* Controls */}
      {callStatus !== 'ended' && (
        <div className="dc-call-overlay-controls">
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
