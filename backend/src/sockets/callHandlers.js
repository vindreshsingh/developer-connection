/**
 * WebRTC call signaling handlers — Phase 5 Task A2.
 *
 * The server acts as a DUMB RELAY for SDP and ICE payloads. It never
 * interprets the contents of offer/answer/candidate — it only:
 *   1. Validates that the emitting socket is a participant in the CallSession
 *   2. Fans the event to the correct recipient(s) via user:<id> personal rooms
 *   3. Persists status transitions (ended / declined)
 *
 * Personal room naming: `user:<userId>` — each socket joins this room on
 * connect (see sockets/index.js). This lets us send to a user without
 * tracking individual socket IDs.
 *
 * Events handled:
 *   call_offer      caller → server → callee
 *   call_answer     callee → server → caller
 *   ice_candidate   either → server → other participant(s)
 *   call_ended      either → server → all participants  (+ DB update)
 *   call_rejected   callee → server → caller            (+ DB update)
 */

import mongoose from 'mongoose';
import CallSession from '../models/callSession.js';
import { createCallSummaryMessage } from '../utils/callSummaryUtils.js';

const validObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

/**
 * Load the call and verify the emitting user is a participant.
 * Returns { call } on success, emits `call_error` and returns null on failure.
 * Stale events (call already ended/declined) are silently dropped.
 */
const authorizeCallAccess = async (socket, callId, { allowTerminated = false } = {}) => {
  if (!callId || !validObjectId(callId)) {
    socket.emit('call_error', { event: 'call_access', message: 'Invalid call ID.' });
    return null;
  }

  const call = await CallSession.findById(callId);
  if (!call) {
    socket.emit('call_error', { event: 'call_access', message: 'Call not found.' });
    return null;
  }

  // Silently ignore stale signaling events for already-terminated calls unless
  // the caller explicitly wants to handle them (e.g. call_ended itself).
  if (!allowTerminated && ['ended', 'declined', 'missed'].includes(call.status)) {
    return null;
  }

  if (!call.isParticipant(socket.user._id)) {
    socket.emit('call_error', { event: 'call_access', message: 'You are not a participant in this call.' });
    return null;
  }

  return { call };
};

/**
 * Returns the userId of the "other" participant in a 1:1 call.
 * For group calls returns all other participant userIds.
 */
const getOtherParticipantIds = (call, myUserId) =>
  call.participants
    .filter((p) => !p.userId.equals(myUserId))
    .map((p) => p.userId.toString());

/**
 * Registers all call-signaling socket event handlers.
 * Must be called synchronously on every new socket connection.
 */
export const registerCallHandlers = (io, socket) => {
  // ── call_offer ─────────────────────────────────────────────────────────────
  // Caller sends SDP offer; relay to callee only.
  socket.on('call_offer', async ({ callId, sdp } = {}) => {
    try {
      const access = await authorizeCallAccess(socket, callId);
      if (!access) return;
      const { call } = access;

      if (!sdp) {
        socket.emit('call_error', { event: 'call_offer', message: 'SDP is required.' });
        return;
      }

      // In a 1:1 call the "other" participant is the callee; in a group call
      // the offer is re-sent to all others (Phase 5 A3 only uses 1:1, but the
      // relay is symmetric so group signaling works without code changes).
      const otherIds = getOtherParticipantIds(call, socket.user._id);
      otherIds.forEach((id) => {
        io.to(`user:${id}`).emit('call_offer', {
          callId:   callId.toString(),
          callerId: socket.user._id.toString(),
          sdp,
        });
      });
    } catch (err) {
      socket.emit('call_error', { event: 'call_offer', message: err.message });
    }
  });

  // ── call_answer ────────────────────────────────────────────────────────────
  // Callee sends SDP answer; relay back to caller only.
  socket.on('call_answer', async ({ callId, sdp } = {}) => {
    try {
      const access = await authorizeCallAccess(socket, callId);
      if (!access) return;
      const { call } = access;

      if (!sdp) {
        socket.emit('call_error', { event: 'call_answer', message: 'SDP is required.' });
        return;
      }

      // The initiator always receives the answer.
      io.to(`user:${call.initiatorId}`).emit('call_answer', {
        callId:   callId.toString(),
        calleeId: socket.user._id.toString(),
        sdp,
      });
    } catch (err) {
      socket.emit('call_error', { event: 'call_answer', message: err.message });
    }
  });

  // ── ice_candidate ──────────────────────────────────────────────────────────
  // Either participant sends an ICE candidate; relay to all other participants.
  socket.on('ice_candidate', async ({ callId, candidate } = {}) => {
    try {
      const access = await authorizeCallAccess(socket, callId);
      if (!access) return;
      const { call } = access;

      if (candidate === undefined) {
        socket.emit('call_error', { event: 'ice_candidate', message: 'Candidate is required.' });
        return;
      }

      const otherIds = getOtherParticipantIds(call, socket.user._id);
      otherIds.forEach((id) => {
        io.to(`user:${id}`).emit('ice_candidate', {
          callId:    callId.toString(),
          senderId:  socket.user._id.toString(),
          candidate,
        });
      });
    } catch (err) {
      socket.emit('call_error', { event: 'ice_candidate', message: err.message });
    }
  });

  // ── call_ended ─────────────────────────────────────────────────────────────
  // Either participant ends the call; relay to all participants and persist.
  socket.on('call_ended', async ({ callId } = {}) => {
    try {
      // allowTerminated: false — if already ended, silently drop (idempotent).
      const access = await authorizeCallAccess(socket, callId, { allowTerminated: false });
      if (!access) return;
      const { call } = access;

      // Persist (mirrors REST POST /calls/:id/end logic)
      const now = new Date();
      call.status  = 'ended';
      call.endedAt = now;
      call.duration = call.startedAt
        ? Math.round((now - call.startedAt) / 1000)
        : 0;

      const participant = call.participants.find((p) => p.userId.equals(socket.user._id));
      if (participant) participant.leftAt = now;

      await call.save();

      // Notify all participants (including the sender so their UI cleans up reliably)
      call.participants.forEach((p) => {
        io.to(`user:${p.userId}`).emit('call_ended', {
          callId:   callId.toString(),
          endedBy:  socket.user._id.toString(),
          duration: call.duration,
        });
      });

      // Post a call_summary system message into the chat thread (idempotent upsert)
      createCallSummaryMessage(io, call).catch(() => {});
    } catch (err) {
      socket.emit('call_error', { event: 'call_ended', message: err.message });
    }
  });

  // ── call_rejected ──────────────────────────────────────────────────────────
  // Callee declines via socket (parallel path to REST POST /calls/:id/decline).
  // Only valid while status is 'ringing'.
  socket.on('call_rejected', async ({ callId } = {}) => {
    try {
      const access = await authorizeCallAccess(socket, callId);
      if (!access) return;
      const { call } = access;

      if (call.status !== 'ringing') return; // idempotent if already transitioned

      call.status  = 'declined';
      call.endedAt = new Date();
      await call.save();

      // Notify the initiator only
      io.to(`user:${call.initiatorId}`).emit('call_rejected', {
        callId:     callId.toString(),
        rejectedBy: socket.user._id.toString(),
      });
    } catch (err) {
      socket.emit('call_error', { event: 'call_rejected', message: err.message });
    }
  });
};

export default registerCallHandlers;
