import { useCallback, useEffect, useState } from 'react';
import { useTyping } from './useTyping';
import { useGetMessageHistoryQuery, useMarkConversationReadMutation } from './chatApi';

/**
 * Combines REST history (initial load) with live socket delivery for one
 * conversation. New messages arrive via `message_received` and are appended
 * to local state — REST is the source of truth for "what happened before I
 * connected," sockets are the source of truth for "what's happening now."
 *
 * Accepts the socket instance from the parent so the single connection created
 * by the container is shared across usePresence, useTyping, and this hook —
 * no duplicate connections.
 */
export const useChat = (socket, conversationId) => {
  const { typingUserId, onType } = useTyping(socket, conversationId);
  const { data: history, isFetching, error } = useGetMessageHistoryQuery(
    { conversationId },
    { skip: !conversationId }
  );
  const [markConversationRead] = useMarkConversationReadMutation();
  const [liveMessages, setLiveMessages] = useState([]);
  const [chatError, setChatError] = useState(null);
  // messageId → reactions[] — overrides both history and liveMessages reactions
  // so a single subscription drives updates regardless of which "bucket" the
  // message originally came from.
  const [reactionsOverrides, setReactionsOverrides] = useState(new Map());
  // Real-time read receipt from the other participant (supplements the initial
  // `otherUserLastReadAt` field that arrives with the conversations REST response).
  const [otherUserSeenAt, setOtherUserSeenAt] = useState(null);

  // Reset all local state when switching conversations
  useEffect(() => {
    // Resetting locally-accumulated state when the "external" identity
    // (which conversation we're subscribed to) changes — the documented
    // exception (React docs: "Adjusting state when a prop changes").
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLiveMessages([]);
    setChatError(null);
    setReactionsOverrides(new Map());
    setOtherUserSeenAt(null);
  }, [conversationId]);

  useEffect(() => {
    if (!socket || !conversationId) return undefined;

    socket.emit('join_conversation', { conversationId });

    const onReceive = (message) => {
      if (String(message.conversationId) !== String(conversationId)) return;
      setLiveMessages((prev) => [...prev, message]);
    };
    const onChatError = (payload) => setChatError(payload?.message || 'Something went wrong');
    const onReactionUpdate = ({ messageId, reactions }) => {
      setReactionsOverrides((prev) => {
        const next = new Map(prev);
        next.set(messageId.toString(), reactions);
        return next;
      });
    };
    // Server only emits this to OTHER sockets in the room, so every event we
    // receive here is from the other participant — no userId filtering needed.
    const onConversationRead = ({ readAt }) => {
      setOtherUserSeenAt(new Date(readAt));
    };

    socket.on('message_received', onReceive);
    socket.on('chat_error', onChatError);
    socket.on('reaction_update', onReactionUpdate);
    socket.on('conversation_read', onConversationRead);

    return () => {
      socket.off('message_received', onReceive);
      socket.off('chat_error', onChatError);
      socket.off('reaction_update', onReactionUpdate);
      socket.off('conversation_read', onConversationRead);
    };
  }, [socket, conversationId]);

  const sendMessage = useCallback(
    (payload) => {
      if (!socket || !conversationId) return;
      socket.emit('send_message', { conversationId, ...payload });
    },
    [socket, conversationId]
  );

  const sendReaction = useCallback(
    (messageId, emoji) => {
      if (!socket || !conversationId) return;
      socket.emit('react', { conversationId, messageId, emoji });
    },
    [socket, conversationId]
  );

  const markAsRead = useCallback(() => {
    if (!socket || !conversationId) return;
    // Use the socket event for real-time delivery to the other participant,
    // and keep the REST mutation as a fallback (already fires on conversation open).
    socket.emit('mark_read', { conversationId });
    markConversationRead(conversationId);
  }, [socket, conversationId, markConversationRead]);

  const messages = [...(history?.data || []), ...liveMessages].map((msg) => {
    const override = reactionsOverrides.get(msg._id?.toString());
    return override !== undefined ? { ...msg, reactions: override } : msg;
  });

  return {
    messages,
    isFetching,
    error,
    chatError,
    sendMessage,
    sendReaction,
    markAsRead,
    otherUserSeenAt,
    typingUserId,
    onType,
  };
};
