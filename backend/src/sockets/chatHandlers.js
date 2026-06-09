import mongoose from 'mongoose';
import Conversation from '../models/conversation.js';
import Message from '../models/message.js';
import { canUsersChat } from '../utils/chatAuthorization.js';

const ROOM = (conversationId) => `conversation:${conversationId}`;

const ALLOWED_TYPES = ['text', 'snippet'];

/**
 * Loads a conversation the socket's user is a participant of, and re-checks
 * the "accepted connection + not blocked" boundary on every single event —
 * not just at connect time. This is the per-event re-check the RFC and spec
 * call out as non-negotiable (a block created mid-session must take effect
 * on the very next event).
 *
 * Returns `{ conversation, otherUserId }` or emits a `chat_error` event
 * (using a custom event name rather than the reserved-feeling `error` to
 * avoid any ambiguity with Socket.IO's own connection-level error events)
 * and returns `null`.
 */
const authorizeConversationAccess = async (socket, conversationId) => {
  if (!mongoose.Types.ObjectId.isValid(conversationId)) {
    socket.emit('chat_error', { event: 'conversation_access', message: 'Invalid conversation id' });
    return null;
  }

  const conversation = await Conversation.findOne({
    _id: conversationId,
    participants: socket.user._id,
  });
  if (!conversation) {
    socket.emit('chat_error', { event: 'conversation_access', message: 'Conversation not found' });
    return null;
  }

  const otherUserId = conversation.participants.find(
    (participantId) => !participantId.equals(socket.user._id)
  );

  const authorization = await canUsersChat(socket.user._id, otherUserId);
  if (!authorization.allowed) {
    socket.emit('chat_error', { event: 'conversation_access', message: authorization.reason });
    return null;
  }

  return { conversation, otherUserId };
};

/**
 * Registers all chat-related event handlers on a connected, authenticated
 * socket. Pure-ish: takes `(io, socket)` so handlers stay independently
 * testable without spinning up a full server.
 */
export const registerChatHandlers = (io, socket) => {
  socket.on('join_conversation', async ({ conversationId } = {}, ack) => {
    try {
      const access = await authorizeConversationAccess(socket, conversationId);
      if (!access) return;

      socket.join(ROOM(conversationId));
      if (typeof ack === 'function') ack({ ok: true });
    } catch (err) {
      socket.emit('chat_error', { event: 'join_conversation', message: err.message });
    }
  });

  // mark_read — persists the per-conversation last-read timestamp for the sender
  // and broadcasts `conversation_read` to the room so the other participant
  // sees the "Seen" indicator update in real time (no poll required).
  socket.on('mark_read', async ({ conversationId } = {}) => {
    try {
      const access = await authorizeConversationAccess(socket, conversationId);
      if (!access) return;
      const { conversation } = access;

      if (!conversation.lastReadBy) conversation.lastReadBy = new Map();
      const readAt = new Date();
      conversation.lastReadBy.set(socket.user._id.toString(), readAt);
      await conversation.save();

      // Only the OTHER participant(s) in the room need to know about this read
      socket.to(ROOM(conversationId)).emit('conversation_read', {
        conversationId,
        userId: socket.user._id.toString(),
        readAt,
      });
    } catch (err) {
      socket.emit('chat_error', { event: 'mark_read', message: err.message });
    }
  });

  // react — toggles a reaction on a message: same emoji → remove, different emoji
  // → replace, no reaction yet → add. One reaction entry per user per message.
  socket.on('react', async ({ conversationId, messageId, emoji } = {}) => {
    try {
      if (!emoji || typeof emoji !== 'string' || emoji.trim().length === 0 || emoji.length > 8) {
        socket.emit('chat_error', { event: 'react', message: 'Invalid emoji' });
        return;
      }

      const access = await authorizeConversationAccess(socket, conversationId);
      if (!access) return;

      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        socket.emit('chat_error', { event: 'react', message: 'Invalid message id' });
        return;
      }

      const message = await Message.findOne({ _id: messageId, conversationId });
      if (!message) {
        socket.emit('chat_error', { event: 'react', message: 'Message not found' });
        return;
      }

      const userId = socket.user._id;
      const existingIdx = message.reactions.findIndex((r) => r.userId.equals(userId));

      if (existingIdx !== -1) {
        if (message.reactions[existingIdx].emoji === emoji) {
          // Same emoji — toggle off
          message.reactions.splice(existingIdx, 1);
        } else {
          // Different emoji — replace
          message.reactions[existingIdx].emoji = emoji;
        }
      } else {
        message.reactions.push({ userId, emoji });
      }
      await message.save();

      io.to(ROOM(conversationId)).emit('reaction_update', {
        messageId: message._id.toString(),
        conversationId,
        reactions: message.reactions.map((r) => ({
          userId: r.userId.toString(),
          emoji: r.emoji,
        })),
      });
    } catch (err) {
      socket.emit('chat_error', { event: 'react', message: err.message });
    }
  });

  // typing — debounced on the client; server just re-checks auth and fans out
  // to the other participant only (not back to the sender's own socket).
  socket.on('typing', async ({ conversationId, isTyping } = {}) => {
    try {
      const access = await authorizeConversationAccess(socket, conversationId);
      if (!access) return;
      const { otherUserId } = access;

      // Emit only to other sockets in the room — `socket.to` excludes the sender
      // so the typing banner never appears on the sender's own screen.
      socket.to(ROOM(conversationId)).emit('typing_update', {
        conversationId,
        userId: socket.user._id.toString(),
        isTyping: Boolean(isTyping),
      });

      void otherUserId; // already validated above; used for auth only
    } catch (err) {
      socket.emit('chat_error', { event: 'typing', message: err.message });
    }
  });

  socket.on('send_message', async ({ conversationId, type = 'text', body, language = null } = {}, ack) => {
    try {
      if (!ALLOWED_TYPES.includes(type)) {
        socket.emit('chat_error', { event: 'send_message', message: 'Invalid message type' });
        return;
      }
      if (!body || !body.trim()) {
        socket.emit('chat_error', { event: 'send_message', message: 'Message body is required' });
        return;
      }

      const access = await authorizeConversationAccess(socket, conversationId);
      if (!access) return;
      const { conversation } = access;

      const message = await Message.create({
        conversationId,
        senderId: socket.user._id,
        type,
        body: body.trim(),
        language: type === 'snippet' ? language : null,
      });

      conversation.lastMessageAt = message.createdAt;
      await conversation.save();

      io.to(ROOM(conversationId)).emit('message_received', {
        _id: message._id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        type: message.type,
        body: message.body,
        language: message.language,
        reactions: message.reactions,
        createdAt: message.createdAt,
      });

      if (typeof ack === 'function') ack({ ok: true, messageId: message._id });
    } catch (err) {
      socket.emit('chat_error', { event: 'send_message', message: err.message });
    }
  });
};

export default registerChatHandlers;
