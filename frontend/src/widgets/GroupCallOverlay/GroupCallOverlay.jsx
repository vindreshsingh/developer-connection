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
import { classNames } from '@/commonUtils/classNames';
import CallControls from '@/widgets/CallControls/CallControls';
import ParticipantTile from '@/widgets/ParticipantTile/ParticipantTile';

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

  const gridCount = Math.min(participants.length, 4);

  return (
    <div
      className="fixed inset-0 z-[9100] flex flex-col overflow-hidden bg-[#0d0d1a]"
      role="dialog"
      aria-label={`Group call — ${groupName}`}
      aria-modal="true"
    >
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="pointer-events-none absolute left-6 top-5 z-10 flex flex-col gap-[0.15rem]">
        <span className="text-base font-semibold text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.5)]">{groupName}</span>
        <span className="text-[0.78rem] text-white/55">{statusLabel}</span>
      </header>

      {/* ── Error banner ──────────────────────────────────────────────────── */}
      {groupCallError && (
        <div className="absolute left-1/2 top-4 z-20 max-w-[80vw] -translate-x-1/2 rounded-lg bg-red-600/90 px-5 py-2 text-center text-sm text-white" role="alert">
          {groupCallError}
        </div>
      )}

      {/* ── Connecting / ended state ──────────────────────────────────────── */}
      {callState === 'connecting' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-base text-white/70">
          <div className="h-10 w-10 animate-[dc-spin-slow_0.75s_linear_infinite] rounded-full border-[3px] border-white/15 border-t-violet-500" aria-hidden="true" />
          <p>Joining call…</p>
        </div>
      )}

      {(callState === 'ended' || callState === 'error') && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-base text-white/70">
          <p>{callState === 'error' ? 'Could not connect to the call.' : 'Call ended'}</p>
        </div>
      )}

      {/* ── Participant grid ──────────────────────────────────────────────── */}
      {callState === 'active' && participants.length > 0 && (
        <div
          className={classNames(
            'grid flex-1 gap-1.5 px-2 pt-16 pb-22 sm:gap-2 sm:px-4 sm:pt-18 sm:pb-24',
            gridCount === 1 && '[grid-template-columns:1fr]',
            gridCount === 2 && '[grid-template-columns:1fr] sm:[grid-template-columns:1fr_1fr]',
            (gridCount === 3 || gridCount === 4) &&
              '[grid-template-columns:1fr] sm:[grid-template-columns:1fr_1fr] sm:[grid-template-rows:1fr_1fr]',
          )}
          aria-label="Participants"
        >
          {participants.map((p) => (
            <ParticipantTile key={p.identity} participant={p} />
          ))}
        </div>
      )}

      {/* ── Controls bar ─────────────────────────────────────────────────── */}
      {callState === 'active' && (
        <div className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3">
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
            className="whitespace-nowrap rounded-full border border-white/20 bg-white/12 px-4 py-2 text-[0.8rem] font-medium text-white transition-colors hover:bg-white/20"
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
