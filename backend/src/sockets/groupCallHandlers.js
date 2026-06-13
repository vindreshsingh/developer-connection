/**
 * Group-call socket handlers — Phase 5 Task B2.
 *
 * In the LiveKit SFU model the server does NOT relay media.  Socket.IO is
 * used only for:
 *   1. Keeping the CallSession participant list up-to-date in MongoDB.
 *   2. Notifying other call members when someone joins or leaves.
 *   3. Ending the session and broadcasting to the wider group room.
 *
 * ┌─────────────────────────────────────────────────────────────────────────┐
 * │ Event flow                                                              │
 * │                                                                         │
 * │  Client wants to join:                                                  │
 * │    1. REST  POST /calls/group-token  → LiveKit JWT                      │
 * │    2. Client connects to LiveKit room directly (media)                  │
 * │    3. Socket group_call_join  → DB participant added, others notified   │
 * │                                                                         │
 * │  Client leaves voluntarily:                                             │
 * │    Socket group_call_leave → leftAt persisted, others notified          │
 * │    If last participant out → session auto-ended                         │
 * │                                                                         │
 * │  Any participant ends for everyone:                                     │
 * │    Socket group_call_end → session ended, entire group:xxx room told    │
 * └─────────────────────────────────────────────────────────────────────────┘
 *
 * Room naming:
 *   `group:<groupId>`  — all members of the group (joined in groupChatHandlers)
 *   `user:<userId>`    — personal room (joined in sockets/index.js)
 */

import mongoose from 'mongoose';
import CallSession from '../models/callSession.js';
import { canUserAccessGroup } from '../utils/groupAuthorization.js';
import { createCallSummaryMessage } from '../utils/callSummaryUtils.js';

const validObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Load a group CallSession and verify it is still joinable (active or ringing).
 * Emits `call_error` and returns null on failure; returns { call } on success.
 */
const loadActiveGroupCall = async (socket, callId) => {
  if (!callId || !validObjectId(callId)) {
    socket.emit('call_error', { event: 'group_call', message: 'Invalid call ID.' });
    return null;
  }

  const call = await CallSession.findById(callId);
  if (!call) {
    socket.emit('call_error', { event: 'group_call', message: 'Call not found.' });
    return null;
  }
  if (call.type !== 'group') {
    socket.emit('call_error', { event: 'group_call', message: 'Not a group call.' });
    return null;
  }
  if (!['active', 'ringing'].includes(call.status)) {
    socket.emit('call_error', {
      event:   'group_call',
      message: `Cannot interact with a call that has status "${call.status}".`,
    });
    return null;
  }

  return { call };
};

/**
 * End the call, persist to DB and broadcast to the group room.
 * Returns the saved call.
 */
const persistAndBroadcastEnd = async (io, call, endedById) => {
  const now = new Date();
  call.status   = 'ended';
  call.endedAt  = now;
  call.duration = call.startedAt ? Math.round((now - call.startedAt) / 1000) : 0;
  await call.save();

  const payload = {
    callId:   call._id.toString(),
    groupId:  call.groupId.toString(),
    endedBy:  endedById.toString(),
    duration: call.duration,
  };

  // Broadcast to the group room — notifies all members (even those not in the call).
  io.to(`group:${call.groupId}`).emit('group_call_ended', payload);

  // Also emit to each participant's personal room so active call participants
  // receive the event even if they haven't joined the group chat socket room.
  // Duplicate delivery is intentional and handled idempotently on the client.
  call.participants.forEach((p) => {
    io.to(`user:${p.userId}`).emit('group_call_ended', payload);
  });

  // Post a call_summary system message into the group chat thread (idempotent upsert)
  createCallSummaryMessage(io, call).catch(() => {});

  return call;
};

// ── Handler registration ───────────────────────────────────────────────────────

/**
 * Registers all group-call socket event handlers.
 * Must be called synchronously on every new socket connection.
 */
export const registerGroupCallHandlers = (io, socket) => {
  // ── group_call_join ──────────────────────────────────────────────────────────
  //
  // Emitted by a group member who has already obtained a LiveKit token via REST
  // (POST /calls/group-token) and connected to the LiveKit room.  This handler:
  //   1. Verifies the user is a group member.
  //   2. Upserts them into the participants array (idempotent — safe to re-emit).
  //   3. Notifies everyone already in the call.
  //   4. Confirms back to the joining user with the current participant list.
  socket.on('group_call_join', async ({ callId } = {}) => {
    try {
      const result = await loadActiveGroupCall(socket, callId);
      if (!result) return;
      const { call } = result;

      // Must be a member of the group (not just any user with the callId)
      const auth = await canUserAccessGroup(socket.user._id, call.groupId.toString());
      if (!auth.allowed) {
        socket.emit('call_error', { event: 'group_call_join', message: auth.reason });
        return;
      }

      // Upsert participant (idempotent — if they already have a joinedAt keep it)
      const existing = call.participants.find((p) => p.userId.equals(socket.user._id));
      if (!existing) {
        call.participants.push({ userId: socket.user._id, joinedAt: new Date() });
      } else if (!existing.joinedAt) {
        existing.joinedAt = new Date();
      }
      await call.save();

      const joiningUserId = socket.user._id.toString();

      // Notify everyone currently in the call (excluding the joiner) that a new
      // participant arrived.
      call.participants.forEach((p) => {
        const id = p.userId.toString();
        if (id !== joiningUserId) {
          io.to(`user:${id}`).emit('group_participant_joined', {
            callId:   call._id.toString(),
            groupId:  call.groupId.toString(),
            userId:   joiningUserId,
          });
        }
      });

      // Confirm back to the joining socket with the current participant list
      socket.emit('group_call_joined', {
        callId:       call._id.toString(),
        groupId:      call.groupId.toString(),
        participants: call.participants.map((p) => ({
          userId:   p.userId.toString(),
          joinedAt: p.joinedAt,
        })),
      });
    } catch (err) {
      socket.emit('call_error', { event: 'group_call_join', message: err.message });
    }
  });

  // ── group_call_leave ─────────────────────────────────────────────────────────
  //
  // Emitted when a participant voluntarily leaves the LiveKit room.
  // If the last active participant leaves the call is auto-ended.
  socket.on('group_call_leave', async ({ callId } = {}) => {
    try {
      const result = await loadActiveGroupCall(socket, callId);
      if (!result) return;
      const { call } = result;

      if (!call.isParticipant(socket.user._id)) {
        socket.emit('call_error', {
          event:   'group_call_leave',
          message: 'You are not a participant in this call.',
        });
        return;
      }

      const now = new Date();
      const leavingUserId = socket.user._id.toString();

      // Mark this participant's leftAt
      const participant = call.participants.find((p) => p.userId.equals(socket.user._id));
      if (participant && !participant.leftAt) {
        participant.leftAt = now;
      }
      await call.save();

      // Check how many participants remain without a leftAt (still active)
      const remaining = call.participants.filter((p) => !p.leftAt);

      if (remaining.length === 0) {
        // Last participant left — auto-end the session
        await persistAndBroadcastEnd(io, call, socket.user._id);
      } else {
        // Notify remaining participants that this user left
        remaining.forEach((p) => {
          io.to(`user:${p.userId}`).emit('group_participant_left', {
            callId:  call._id.toString(),
            groupId: call.groupId.toString(),
            userId:  leavingUserId,
          });
        });
      }
    } catch (err) {
      socket.emit('call_error', { event: 'group_call_leave', message: err.message });
    }
  });

  // ── group_call_end ───────────────────────────────────────────────────────────
  //
  // Any participant can end the session for everyone.
  // Broadcasts `group_call_ended` to the entire `group:<groupId>` room so
  // members who have not yet joined also see the notification.
  socket.on('group_call_end', async ({ callId } = {}) => {
    try {
      const result = await loadActiveGroupCall(socket, callId);
      if (!result) return;
      const { call } = result;

      if (!call.isParticipant(socket.user._id)) {
        socket.emit('call_error', {
          event:   'group_call_end',
          message: 'You are not a participant in this call.',
        });
        return;
      }

      await persistAndBroadcastEnd(io, call, socket.user._id);
    } catch (err) {
      socket.emit('call_error', { event: 'group_call_end', message: err.message });
    }
  });
};

export default registerGroupCallHandlers;
