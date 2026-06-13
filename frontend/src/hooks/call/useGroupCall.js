/**
 * useGroupCall — manages a LiveKit SFU room for a group video call.
 *
 * Responsibilities:
 *   • Connect to / disconnect from the LiveKit room with the supplied JWT token.
 *   • Enable local camera + microphone tracks on connect.
 *   • Keep a flat `participants` array in sync with Room events so the UI can
 *     re-render without coupling to LiveKit internals.
 *   • Emit Socket.IO signals (group_call_join, group_call_leave, group_call_end)
 *     to keep the backend CallSession participant list up-to-date.
 *   • Listen for `group_call_ended` from the server and tear down the room.
 *
 * Env var: VITE_LIVEKIT_URL  (default: ws://localhost:7880)
 *
 * @param {{
 *   socket:  import('socket.io-client').Socket | null,
 *   callId:  string,
 *   token:   string,   // LiveKit JWT returned by POST /calls/group-token
 * }} options
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL ?? 'ws://localhost:7880';

// ── Participant snapshot ──────────────────────────────────────────────────────

/**
 * Build a plain-object snapshot from a LiveKit participant.
 * This is stored in React state so the UI doesn't hold live SDK references.
 * The videoTrack reference IS kept so ParticipantTile can call track.attach().
 */
const snapshotParticipant = (participant, isLocal) => {
  // Prefer screen share over camera when the participant is screen-sharing
  const videoPub =
    participant.getTrackPublication(Track.Source.ScreenShare) ??
    participant.getTrackPublication(Track.Source.Camera);

  return {
    identity:    participant.identity,
    name:        participant.name ?? participant.identity,
    isLocal,
    videoTrack:  videoPub?.track ?? null,
    isMuted:     !participant.isMicrophoneEnabled,
    isCameraOff: !participant.isCameraEnabled,
  };
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export const useGroupCall = ({ socket, callId, token }) => {
  const roomRef = useRef(null);

  /**
   * participants: Array<{
   *   identity:    string,   // userId (LiveKit identity)
   *   name:        string,
   *   isLocal:     boolean,
   *   videoTrack:  LocalVideoTrack | RemoteVideoTrack | null,
   *   isMuted:     boolean,
   *   isCameraOff: boolean,
   * }>
   * Local participant is always first.
   */
  const [participants, setParticipants] = useState([]);
  // 'connecting' | 'active' | 'ended' | 'error'
  const [callState, setCallState]       = useState('connecting');
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [groupCallError, setGroupCallError]   = useState(null);

  // ── Derived local-participant flags ─────────────────────────────────────────
  const localParticipant = participants.find((p) => p.isLocal);
  const isMuted    = localParticipant?.isMuted     ?? false;
  const isCameraOff = localParticipant?.isCameraOff ?? false;

  // ── Sync participants from Room state ───────────────────────────────────────

  const syncParticipants = useCallback((room) => {
    const list = [];

    if (room.localParticipant) {
      list.push(snapshotParticipant(room.localParticipant, true));
    }
    for (const rp of room.remoteParticipants.values()) {
      list.push(snapshotParticipant(rp, false));
    }

    setParticipants(list);
  }, []);

  // ── Room lifecycle ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!token || !callId) return undefined;

    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    const refresh = () => syncParticipants(room);

    // ── Room event subscriptions ────────────────────────────────────────────
    room.on(RoomEvent.Connected, async () => {
      setCallState('active');
      refresh();

      // Enable local A/V tracks (may take a moment)
      try {
        await Promise.all([
          room.localParticipant.setCameraEnabled(true),
          room.localParticipant.setMicrophoneEnabled(true),
        ]);
      } catch {
        // Camera/mic might be denied — continue without them
      }

      // Notify backend to update DB participant list
      if (socket) {
        socket.emit('group_call_join', { callId });
      }
    });

    room.on(RoomEvent.Disconnected,              () => setCallState('ended'));
    room.on(RoomEvent.ParticipantConnected,      refresh);
    room.on(RoomEvent.ParticipantDisconnected,   refresh);
    room.on(RoomEvent.TrackSubscribed,           refresh);
    room.on(RoomEvent.TrackUnsubscribed,         refresh);
    room.on(RoomEvent.LocalTrackPublished,       refresh);
    room.on(RoomEvent.LocalTrackUnpublished,     refresh);
    room.on(RoomEvent.TrackMuted,                refresh);
    room.on(RoomEvent.TrackUnmuted,              refresh);

    // ── Connect ──────────────────────────────────────────────────────────────
    room.connect(LIVEKIT_URL, token).catch((err) => {
      setGroupCallError(err.message);
      setCallState('error');
    });

    return () => {
      room.disconnect();
      roomRef.current = null;
    };
    // token and callId are stable once the overlay mounts — no re-connect needed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // intentionally empty: connect once on mount

  // ── Socket: server-side group_call_ended → disconnect ──────────────────────

  useEffect(() => {
    if (!socket || !callId) return undefined;

    const onGroupCallEnded = ({ callId: endedCallId }) => {
      if (endedCallId?.toString() !== callId?.toString()) return;
      roomRef.current?.disconnect();
      setCallState('ended');
    };

    socket.on('group_call_ended', onGroupCallEnded);
    return () => socket.off('group_call_ended', onGroupCallEnded);
  }, [socket, callId]);

  // ── Controls ────────────────────────────────────────────────────────────────

  const toggleMute = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setMicrophoneEnabled(isMuted); // flip
      syncParticipants(room);
    } catch (err) {
      setGroupCallError(err.message);
    }
  }, [isMuted, syncParticipants]);

  const toggleCamera = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setCameraEnabled(isCameraOff); // flip
      syncParticipants(room);
    } catch (err) {
      setGroupCallError(err.message);
    }
  }, [isCameraOff, syncParticipants]);

  const startScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setScreenShareEnabled(true);
      setIsScreenSharing(true);
      syncParticipants(room);
    } catch (err) {
      if (err.name !== 'NotAllowedError') setGroupCallError(err.message);
    }
  }, [syncParticipants]);

  const stopScreenShare = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setScreenShareEnabled(false);
      setIsScreenSharing(false);
      syncParticipants(room);
    } catch (err) {
      setGroupCallError(err.message);
    }
  }, [syncParticipants]);

  /** Leave without ending — call continues for remaining participants. */
  const leave = useCallback(() => {
    if (socket && callId) {
      socket.emit('group_call_leave', { callId });
    }
    roomRef.current?.disconnect();
    setCallState('ended');
  }, [socket, callId]);

  /** End the call for everyone. */
  const endForAll = useCallback(() => {
    if (socket && callId) {
      socket.emit('group_call_end', { callId });
    }
    roomRef.current?.disconnect();
    setCallState('ended');
  }, [socket, callId]);

  return {
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
  };
};
