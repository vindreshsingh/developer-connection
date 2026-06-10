/**
 * callSummaryUtils — post-call system message emission (Phase 5 C2).
 *
 * After a call ends, a `call_summary` system message is inserted into the
 * conversation (1:1) or group (group call) message feed.  The message is
 * upserted by `callSummary.callId` so calling this function multiple times
 * for the same call is safe (idempotent).
 *
 * The message is then emitted via Socket.IO so the chat thread updates in
 * real time without requiring a page refresh.
 *
 * Socket events used (must match chatHandlers / groupChatHandlers):
 *   1:1  → `message_received`       on room `conv:<conversationId>`
 *   group → `group_message_received` on room `group:<groupId>`
 */

import Conversation  from '../models/conversation.js';
import Message       from '../models/message.js';
import GroupMessage  from '../models/groupMessage.js';

// ── Public helper ─────────────────────────────────────────────────────────────

/**
 * Create (or no-op if already exists) a call_summary message for a call that
 * has just ended.  Only `status === 'ended'` calls get a summary.
 *
 * @param {import('socket.io').Server|null} io
 * @param {import('../models/callSession.js').default} call   — saved CallSession document
 */
export const createCallSummaryMessage = async (io, call) => {
  if (call.status !== 'ended') return;

  if (call.type === '1:1') {
    await _create1on1Summary(io, call);
  } else if (call.type === 'group') {
    await _createGroupSummary(io, call);
  }
};

// ── 1:1 summary ───────────────────────────────────────────────────────────────

async function _create1on1Summary(io, call) {
  // Look up the Conversation between the two participants.
  // The pre-validate hook in conversation.js sorts participants, so $all works.
  const participantIds = call.participants.map((p) => p.userId);
  const conv = await Conversation.findOne({
    participants: { $all: participantIds },
  });
  if (!conv) return; // conversation might not exist yet (edge-case) — skip gracefully

  // Upsert: $setOnInsert means this is a no-op if the document already exists.
  const result = await Message.findOneAndUpdate(
    { 'callSummary.callId': call._id },
    {
      $setOnInsert: {
        conversationId: conv._id,
        senderId:       call.initiatorId,
        type:           'call_summary',
        callSummary: {
          callId:   call._id,
          duration: call.duration ?? 0,
          status:   'ended',
          callType: '1:1',
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  // Push to chat thread in real time
  if (io && result) {
    io.to(`conv:${conv._id}`).emit('message_received', {
      message:        result.toObject(),
      conversationId: conv._id.toString(),
    });
  }
}

// ── Group summary ─────────────────────────────────────────────────────────────

async function _createGroupSummary(io, call) {
  const result = await GroupMessage.findOneAndUpdate(
    { 'callSummary.callId': call._id },
    {
      $setOnInsert: {
        groupId:  call.groupId,
        senderId: call.initiatorId,
        type:     'call_summary',
        callSummary: {
          callId:   call._id,
          duration: call.duration ?? 0,
          status:   'ended',
          callType: 'group',
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  if (io && result) {
    io.to(`group:${call.groupId}`).emit('group_message_received', {
      message: result.toObject(),
      groupId: call.groupId.toString(),
    });
  }
}
