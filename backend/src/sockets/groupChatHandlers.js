import mongoose from 'mongoose';
import GroupMessage from '../models/groupMessage.js';
import Group from '../models/group.js';
import { canUserAccessGroup } from '../utils/groupAuthorization.js';

const ROOM = (groupId) => `group:${groupId}`;

const ALLOWED_TYPES = ['text', 'snippet'];

/**
 * Per-event re-authorization against the group membership table.
 * Called before every handler — a member who was removed mid-session must be
 * rejected on the very next event, exactly like `authorizeConversationAccess`
 * in chatHandlers.js.
 *
 * Returns `{ group, role }` or emits a `group_error` event and returns null.
 */
const authorizeGroupAccess = async (socket, groupId) => {
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    socket.emit('group_error', { event: 'group_access', message: 'Invalid group id' });
    return null;
  }

  const { allowed, role, reason } = await canUserAccessGroup(socket.user._id, groupId);
  if (!allowed) {
    socket.emit('group_error', { event: 'group_access', message: reason });
    return null;
  }

  const group = await Group.findOne({ _id: groupId, deletedAt: null });
  return { group, role };
};

/**
 * Registers all group-chat socket event handlers on a connected, authenticated
 * socket. Mirrors the structure of registerChatHandlers for 1-1 conversations.
 *
 * Events handled:
 *   join_group          — socket joins the Socket.IO room for a group
 *   send_group_message  — persists a GroupMessage and fans out to the room
 *   typing              — group typing indicator (uses groupId context)
 *   leave_group         — socket leaves the Socket.IO room (does NOT remove DB membership)
 */
export const registerGroupChatHandlers = (io, socket) => {
  // ── join_group ─────────────────────────────────────────────────────────────
  socket.on('join_group', async ({ groupId } = {}, ack) => {
    try {
      const access = await authorizeGroupAccess(socket, groupId);
      if (!access) return;

      socket.join(ROOM(groupId));
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      socket.emit('group_error', { event: 'join_group', message: err.message });
    }
  });

  // ── send_group_message ─────────────────────────────────────────────────────
  socket.on('send_group_message', async ({ groupId, type = 'text', body, language = null } = {}, ack) => {
    try {
      if (!ALLOWED_TYPES.includes(type)) {
        socket.emit('group_error', { event: 'send_group_message', message: 'Invalid message type' });
        return;
      }
      if (!body || !body.trim()) {
        socket.emit('group_error', { event: 'send_group_message', message: 'Message body is required' });
        return;
      }

      const access = await authorizeGroupAccess(socket, groupId);
      if (!access) return;
      const { group } = access;

      const message = await GroupMessage.create({
        groupId,
        senderId: socket.user._id,
        type,
        body: body.trim(),
        language: type === 'snippet' ? language : null,
      });

      // Update group's last activity (non-blocking)
      group.updatedAt = message.createdAt;
      group.save().catch(() => {});

      io.to(ROOM(groupId)).emit('group_message_received', {
        _id:       message._id,
        groupId:   message.groupId,
        senderId:  message.senderId,
        type:      message.type,
        body:      message.body,
        language:  message.language,
        createdAt: message.createdAt,
      });

      if (typeof ack === 'function') ack({ ok: true, messageId: message._id });
    } catch (err) {
      socket.emit('group_error', { event: 'send_group_message', message: err.message });
    }
  });

  // ── typing (group context) ─────────────────────────────────────────────────
  // Payload: { groupId, isTyping }
  // Fans out to all OTHER sockets in the group room, excluding the sender.
  socket.on('group_typing', async ({ groupId, isTyping } = {}) => {
    try {
      const access = await authorizeGroupAccess(socket, groupId);
      if (!access) return;

      socket.to(ROOM(groupId)).emit('group_typing_update', {
        groupId,
        userId:   socket.user._id.toString(),
        isTyping: Boolean(isTyping),
      });
    } catch (err) {
      socket.emit('group_error', { event: 'group_typing', message: err.message });
    }
  });

  // ── leave_group ────────────────────────────────────────────────────────────
  // Leaves the Socket.IO room only — does NOT modify DB membership.
  // Actual membership removal goes through the REST DELETE /groups/:id/leave.
  socket.on('leave_group', async ({ groupId } = {}, ack) => {
    try {
      if (!mongoose.Types.ObjectId.isValid(groupId)) {
        socket.emit('group_error', { event: 'leave_group', message: 'Invalid group id' });
        return;
      }

      socket.leave(ROOM(groupId));
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      socket.emit('group_error', { event: 'leave_group', message: err.message });
    }
  });
};

export default registerGroupChatHandlers;
