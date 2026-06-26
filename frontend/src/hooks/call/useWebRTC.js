import { useCallback, useEffect, useRef, useState } from 'react';

import { getMediaErrorMessage } from '@/commonUtils/mediaError';

/**
 * ICE servers used for STUN/TURN.
 * STUN (Google free) handles most NAT traversal cases.
 * A TURN server is required for symmetric NAT (corporate networks) — configure
 * VITE_TURN_URL / VITE_TURN_USERNAME / VITE_TURN_CREDENTIAL in .env.
 */
const buildIceServers = () => {
  const servers = [{ urls: 'stun:stun.l.google.com:19302' }];
  const turnUrl = import.meta.env.VITE_TURN_URL;
  if (turnUrl) {
    servers.push({
      urls:       turnUrl,
      username:   import.meta.env.VITE_TURN_USERNAME ?? '',
      credential: import.meta.env.VITE_TURN_CREDENTIAL ?? '',
    });
  }
  return servers;
};

/**
 * Manages a single WebRTC 1:1 peer connection.
 *
 * Accepts the shared socket instance so no extra connections are opened.
 * The hook is idle (no RTCPeerConnection) until `startCall()` or `acceptCall()`
 * is called; it tears down the connection on `endCall()` or component unmount.
 *
 * @param {import('socket.io-client').Socket|null} socket
 * @param {string|null} callId  — active call ID; null when no call in progress
 */
export const useWebRTC = (socket, callId) => {
  const [localStream,    setLocalStream]    = useState(null);
  const [remoteStream,   setRemoteStream]   = useState(null);
  // idle | ringing | active | ended
  const [callStatus,     setCallStatus]     = useState('idle');
  const [isMuted,        setIsMuted]        = useState(false);
  const [isCameraOff,    setIsCameraOff]    = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [webRTCError,    setWebRTCError]    = useState(null);

  const pcRef            = useRef(null); // RTCPeerConnection
  const localStreamRef   = useRef(null); // mirror of localStream for cleanup
  const cameraTrackRef   = useRef(null); // original camera track for screen-share restore

  // ── Connection teardown ───────────────────────────────────────────────────

  const teardown = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
    setIsMuted(false);
    setIsCameraOff(false);
    setIsScreenSharing(false);
    cameraTrackRef.current = null;
  }, []);

  // ── Build RTCPeerConnection with ICE candidates piped over socket ─────────

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection({ iceServers: buildIceServers() });

    pc.onicecandidate = ({ candidate }) => {
      if (!socket || !callId) return;
      // null candidate = end-of-candidates; still relay so the peer knows
      socket.emit('ice_candidate', { callId, candidate: candidate ?? null });
    };

    pc.ontrack = ({ streams }) => {
      if (streams?.[0]) {
        setRemoteStream(streams[0]);
      }
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
        setCallStatus('ended');
      }
    };

    pcRef.current = pc;
    return pc;
  }, [socket, callId]);

  // ── Acquire local media ───────────────────────────────────────────────────

  const acquireLocalMedia = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStreamRef.current = stream;
    setLocalStream(stream);
    cameraTrackRef.current = stream.getVideoTracks()[0] ?? null;
    return stream;
  }, []);

  // ── startCall — caller side ───────────────────────────────────────────────

  const startCall = useCallback(async () => {
    if (!socket || !callId) return;
    try {
      setWebRTCError(null);
      setCallStatus('ringing');

      const stream = await acquireLocalMedia();
      const pc     = createPeerConnection();

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.emit('call_offer', { callId, sdp: offer });
    } catch (err) {
      setWebRTCError(getMediaErrorMessage(err));
      teardown();
    }
  }, [socket, callId, acquireLocalMedia, createPeerConnection, teardown]);

  // ── acceptCall — callee side ──────────────────────────────────────────────

  const acceptCall = useCallback(async (offerSdp) => {
    if (!socket || !callId) return;
    try {
      setWebRTCError(null);
      setCallStatus('active');

      const stream = await acquireLocalMedia();
      const pc     = createPeerConnection();

      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offerSdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.emit('call_answer', { callId, sdp: answer });
    } catch (err) {
      setWebRTCError(getMediaErrorMessage(err));
      teardown();
    }
  }, [socket, callId, acquireLocalMedia, createPeerConnection, teardown]);

  // ── Toggle controls ───────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = isMuted; // flip
    });
    setIsMuted((m) => !m);
  }, [isMuted]);

  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = isCameraOff; // flip
    });
    setIsCameraOff((c) => !c);
  }, [isCameraOff]);

  // ── Screen share ──────────────────────────────────────────────────────────

  const stopScreenShare = useCallback(async () => {
    if (!pcRef.current || !cameraTrackRef.current) return;
    try {
      const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(cameraTrackRef.current);

      const newStream = new MediaStream([
        ...( localStreamRef.current?.getAudioTracks() ?? []),
        cameraTrackRef.current,
      ]);
      localStreamRef.current = newStream;
      setLocalStream(newStream);
      setIsScreenSharing(false);
    } catch (err) {
      setWebRTCError(err.message);
    }
  }, []);

  const startScreenShare = useCallback(async () => {
    if (!pcRef.current || !localStreamRef.current) return;
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const screenTrack  = screenStream.getVideoTracks()[0];

      // Replace the outgoing video sender track
      const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(screenTrack);

      // Update local preview
      const newStream = new MediaStream([
        ...localStreamRef.current.getAudioTracks(),
        screenTrack,
      ]);
      localStreamRef.current = newStream;
      setLocalStream(newStream);
      setIsScreenSharing(true);

      // Auto-restore camera when user stops sharing via browser UI
      screenTrack.onended = () => stopScreenShare();
    } catch (err) {
      if (err.name !== 'NotAllowedError') setWebRTCError(err.message);
    }
  }, [stopScreenShare]);

  // ── endCall ───────────────────────────────────────────────────────────────

  const endCall = useCallback(() => {
    if (socket && callId) {
      socket.emit('call_ended', { callId });
    }
    setCallStatus('ended');
    teardown();
  }, [socket, callId, teardown]);

  // ── Socket event listeners ────────────────────────────────────────────────

  useEffect(() => {
    if (!socket || !callId) return undefined;

    const onCallAnswer = async ({ sdp }) => {
      if (!pcRef.current) return;
      try {
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(sdp));
        setCallStatus('active');
      } catch (err) {
        setWebRTCError(err.message);
      }
    };

    const onIceCandidate = async ({ candidate }) => {
      if (!pcRef.current || candidate === undefined) return;
      try {
        if (candidate) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
        // null = end-of-candidates; nothing to add
      } catch {
        // ICE failures are non-fatal — the connection may still succeed via other candidates
      }
    };

    const onCallEnded = () => {
      setCallStatus('ended');
      teardown();
    };

    socket.on('call_answer',    onCallAnswer);
    socket.on('ice_candidate',  onIceCandidate);
    socket.on('call_ended',     onCallEnded);

    return () => {
      socket.off('call_answer',    onCallAnswer);
      socket.off('ice_candidate',  onIceCandidate);
      socket.off('call_ended',     onCallEnded);
    };
  }, [socket, callId, teardown]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      teardown();
    };
  }, [teardown]);

  return {
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
  };
};
