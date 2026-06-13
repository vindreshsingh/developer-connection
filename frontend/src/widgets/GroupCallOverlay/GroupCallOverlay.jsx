/**
 * GroupCallOverlay — full-screen overlay for an active LiveKit group call.
 *
 * Wraps `useGroupCall` for LiveKit room management and renders a responsive
 * participant grid plus the shared CallControls bar.
 *
 * Auto-dismisses 1.5 s after the call reaches the 'ended' state so the user
 * can read the "Call ended" message.
 *
 * @param {{
 *   socket:    import('socket.io-client').Socket,
 *   callId:    string,
 *   token:     string,     // LiveKit JWT from POST /calls/group-token
 *   groupName: string,
 *   onClose:   () => void, // called after the call ends and banner dismisses
 * }} props
 */

import { useEffect } from 'react';
import { useGroupCall } from '@/hooks/call/useGroupCall';
import CallControls from '@/widgets/CallControls/CallControls';
import ParticipantTile from '@/widgets/ParticipantTile/ParticipantTile';
import './GroupCallOverlay.scss';

export default function GroupCallOverlay({
  socket,
  callId,
  token,
  groupName,
  onClose,
}) {
  const {
    callState,
    participants,
    isMuted,
    isCameraOff,
    isScreenSharing,
    groupCallError,
    toggleMute,
    toggleCamera,
    startScreenShare,
    stopScreenShare,
    leave,
    endForAll,
  } = useGroupCall({ socket, callId, token });

  // Auto-dismiss 1.5 s after call ends
  useEffect(() => {
    if (callState === 'ended' || callState === 'error') {
      const timer = setTimeout(onClose, 1500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [callState, onClose]);

  const handleScreenShare = () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  };

  const statusLabel =
    callState === 'connecting' ? 'Connecting…' :
    callState === 'active'     ? `${participants.length} participant${participants.length !== 1 ? 's' : ''}` :
    callState === 'ended'      ? 'Call ended' :
    callState === 'error'      ? 'Connection error' :
    '';

  return (
    <div
      className="dc-group-call-overlay"
      role="dialog"
      aria-label={`Group call — ${groupName}`}
      aria-modal="true"
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="dc-group-call-header">
        <span className="dc-group-call-header-name">{groupName}</span>
        <span className="dc-group-call-header-status">{statusLabel}</span>
      </header>

      {/* ── Error banner ──────────────────────────────────────────────────── */}
      {groupCallError && (
        <div className="dc-group-call-error" role="alert">
          {groupCallError}
        </div>
      )}

      {/* ── Connecting / ended state ──────────────────────────────────────── */}
      {callState === 'connecting' && (
        <div className="dc-group-call-connecting">
          <div className="dc-group-call-spinner" aria-hidden="true" />
          <p>Joining call…</p>
        </div>
      )}

      {(callState === 'ended' || callState === 'error') && (
        <div className="dc-group-call-ended">
          <p>{callState === 'error' ? 'Could not connect to the call.' : 'Call ended'}</p>
        </div>
      )}

      {/* ── Participant grid ──────────────────────────────────────────────── */}
      {callState === 'active' && participants.length > 0 && (
        <div
          className={`dc-group-call-grid dc-group-call-grid--${Math.min(participants.length, 4)}`}
          aria-label="Participants"
        >
          {participants.map((p) => (
            <ParticipantTile key={p.identity} participant={p} />
          ))}
        </div>
      )}

      {/* ── Controls bar ─────────────────────────────────────────────────── */}
      {callState === 'active' && (
        <div className="dc-group-call-controls">
          <CallControls
            isMuted={isMuted}
            isCameraOff={isCameraOff}
            isScreenSharing={isScreenSharing}
            onToggleMute={toggleMute}
            onToggleCamera={toggleCamera}
            onScreenShare={handleScreenShare}
            onEndCall={endForAll}
          />
          {/* Leave without ending for everyone */}
          <button
            type="button"
            className="dc-group-call-leave-btn"
            onClick={leave}
            title="Leave call (others stay)"
            aria-label="Leave call"
          >
            ↩ Leave
          </button>
        </div>
      )}
    </div>
  );
}
