import { useCallback, useEffect, useState } from 'react';
import { useSocket } from '@/hooks/chat/useSocket';
import { useAcceptCallMutation, useDeclineCallMutation } from '@/hooks/call/callApi';
import { CallContext } from '@/context/CallContext';
import CallOverlay from '@/widgets/CallOverlay/CallOverlay';

// ── Provider ──────────────────────────────────────────────────────────────────

/**
 * Wraps the entire app so incoming call notifications surface on every page.
 *
 * Manages three states:
 *   incomingCall  — metadata received from `call_incoming` socket event (banner shown)
 *   activeCall    — call currently in progress (CallOverlay shown)
 *   offerSdp      — SDP offer from the caller, stored until the callee accepts
 *
 * The shared socket instance (from useSocket) is reused here so there is still
 * only one WebSocket connection per session.
 */
export default function CallProvider({ children }) {
  const socket = useSocket();

  // Incoming ring notification: { callId, callerId, callerName, callerPhotoUrl, type }
  const [incomingCall, setIncomingCall] = useState(null);
  // Active call in progress: { callId, remoteUserName, isCaller, offerSdp }
  const [activeCall, setActiveCall]     = useState(null);
  // SDP offer buffered until the user clicks Accept
  const [pendingOffer, setPendingOffer] = useState(null);

  const [acceptCallMutation]  = useAcceptCallMutation();
  const [declineCallMutation] = useDeclineCallMutation();

  // ── Socket listeners ────────────────────────────────────────────────────

  useEffect(() => {
    if (!socket) return undefined;

    const onCallIncoming = (payload) => {
      // Auto-decline if already in a call (busy)
      if (activeCall) {
        socket.emit('call_rejected', { callId: payload.callId });
        return;
      }
      setIncomingCall(payload);
    };

    const onCallOffer = (payload) => {
      // Buffer the SDP offer until the callee taps Accept
      setPendingOffer({ callId: payload.callId, sdp: payload.sdp });
    };

    const onCallRejected = () => {
      // If our outgoing call was declined, clear the active call overlay
      setActiveCall(null);
    };

    const onCallEnded = () => {
      // Remote side ended — overlay dismisses itself via callStatus transition,
      // but also clear here as a safety net for when the overlay isn't mounted.
      setActiveCall(null);
    };

    socket.on('call_incoming',  onCallIncoming);
    socket.on('call_offer',     onCallOffer);
    socket.on('call_rejected',  onCallRejected);
    socket.on('call_ended',     onCallEnded);

    return () => {
      socket.off('call_incoming',  onCallIncoming);
      socket.off('call_offer',     onCallOffer);
      socket.off('call_rejected',  onCallRejected);
      socket.off('call_ended',     onCallEnded);
    };
  }, [socket, activeCall]);

  // ── Caller initiates — open overlay immediately ──────────────────────────

  const initiateCall = useCallback(({ callId, remoteUserName }) => {
    setActiveCall({ callId, remoteUserName, isCaller: true, offerSdp: null });
  }, []);

  // ── Callee accepts ───────────────────────────────────────────────────────

  const handleAccept = async () => {
    if (!incomingCall) return;
    try {
      await acceptCallMutation(incomingCall.callId).unwrap();
      setActiveCall({
        callId:         incomingCall.callId,
        remoteUserName: incomingCall.callerName,
        isCaller:       false,
        offerSdp:       pendingOffer?.sdp ?? null,
      });
    } catch {
      // acceptCall REST failed — clear the notification
    } finally {
      setIncomingCall(null);
      setPendingOffer(null);
    }
  };

  // ── Callee declines ──────────────────────────────────────────────────────

  const handleDecline = async () => {
    if (!incomingCall) return;
    try {
      await declineCallMutation(incomingCall.callId).unwrap();
    } catch {
      // Best-effort
    } finally {
      setIncomingCall(null);
      setPendingOffer(null);
    }
  };

  // ── Close overlay after call ends ────────────────────────────────────────

  const handleOverlayClose = useCallback(() => {
    setActiveCall(null);
  }, []);

  return (
    <CallContext.Provider value={{ initiateCall, activeCall }}>
      {children}

      {/* ── Incoming call banner ───────────────────────────────────────── */}
      {incomingCall && !activeCall && (
        <div
          className="fixed left-1/2 top-4 z-[8500] flex min-w-[300px] max-w-[90vw] -translate-x-1/2 items-center gap-4 rounded-2xl bg-[#1e1b4b] px-5 py-4 text-white shadow-[0_8px_32px_rgba(0,0,0,0.35)] [animation:dc-banner-slide-in_0.25s_ease-out]"
          role="alertdialog"
          aria-label="Incoming call"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            {incomingCall.callerPhotoUrl ? (
              <img
                className="h-11 w-11 flex-shrink-0 rounded-full object-cover"
                src={incomingCall.callerPhotoUrl}
                alt={incomingCall.callerName}
              />
            ) : (
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-violet-800 text-[1.1rem] font-bold">
                {incomingCall.callerName?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
            )}
            <div>
              <p className="overflow-hidden whitespace-nowrap text-ellipsis text-[0.95rem] font-semibold">{incomingCall.callerName}</p>
              <p className="mt-[0.1rem] text-xs text-white/65">Incoming video call…</p>
            </div>
          </div>
          <div className="flex flex-shrink-0 gap-2">
            <button
              type="button"
              className="rounded-full bg-green-600 px-4 py-[0.45rem] text-[0.8rem] font-semibold text-white transition-[filter] duration-150 hover:brightness-[1.15]"
              onClick={handleAccept}
              aria-label="Accept call"
            >
              📞 Accept
            </button>
            <button
              type="button"
              className="rounded-full bg-red-600 px-4 py-[0.45rem] text-[0.8rem] font-semibold text-white transition-[filter] duration-150 hover:brightness-[1.15]"
              onClick={handleDecline}
              aria-label="Decline call"
            >
              📵 Decline
            </button>
          </div>
        </div>
      )}

      {/* ── Active call overlay ────────────────────────────────────────── */}
      {activeCall && (
        <CallOverlay
          socket={socket}
          callId={activeCall.callId}
          isCaller={activeCall.isCaller}
          incomingOfferSdp={activeCall.offerSdp}
          remoteUserName={activeCall.remoteUserName}
          onClose={handleOverlayClose}
        />
      )}
    </CallContext.Provider>
  );
}
