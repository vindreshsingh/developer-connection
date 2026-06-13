import { useCallback, useEffect, useState } from 'react';
import { useSocket } from '@/hooks/chat/useSocket';
import { useAcceptCallMutation, useDeclineCallMutation } from '@/hooks/call/callApi';
import { CallContext } from '@/context/CallContext';
import CallOverlay from '@/widgets/CallOverlay/CallOverlay';
import './CallProvider.scss';

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
        <div className="dc-incoming-call-banner" role="alertdialog" aria-label="Incoming call">
          <div className="dc-incoming-call-info">
            {incomingCall.callerPhotoUrl ? (
              <img
                className="dc-incoming-call-avatar"
                src={incomingCall.callerPhotoUrl}
                alt={incomingCall.callerName}
              />
            ) : (
              <div className="dc-incoming-call-avatar dc-incoming-call-avatar--placeholder">
                {incomingCall.callerName?.charAt(0)?.toUpperCase() ?? '?'}
              </div>
            )}
            <div>
              <p className="dc-incoming-call-name">{incomingCall.callerName}</p>
              <p className="dc-incoming-call-label">Incoming video call…</p>
            </div>
          </div>
          <div className="dc-incoming-call-actions">
            <button
              type="button"
              className="dc-incoming-call-btn dc-incoming-call-btn--accept"
              onClick={handleAccept}
              aria-label="Accept call"
            >
              📞 Accept
            </button>
            <button
              type="button"
              className="dc-incoming-call-btn dc-incoming-call-btn--decline"
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
