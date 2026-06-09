import { useCallback, useEffect, useRef, useState } from 'react';
import { useGetGroupMessagesQuery } from './groupApi';

const TYPING_DEBOUNCE_MS = 1500;

/**
 * Manages real-time group chat for a single group.
 * Mirrors the structure of useChat (1-1) but uses group-specific socket events:
 *   join_group / leave_group / send_group_message / group_typing / group_typing_update / group_message_received
 *
 * Accepts the shared socket instance from the parent container so no extra
 * connections are opened.
 */
export const useGroupChat = (socket, groupId) => {
  const { data: history, isFetching, error } = useGetGroupMessagesQuery(
    { groupId },
    { skip: !groupId },
  );

  const [liveMessages, setLiveMessages] = useState([]);
  const [groupError, setGroupError] = useState(null);
  const [typingUserIds, setTypingUserIds] = useState(new Set());

  // Typing send-side debounce
  const isSendingTyping = useRef(false);
  const stopTimer = useRef(null);
  const typingClearTimers = useRef(new Map()); // userId → timer

  // Reset live state when switching groups
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLiveMessages([]);
    setGroupError(null);
    setTypingUserIds(new Set());
  }, [groupId]);

  useEffect(() => {
    if (!socket || !groupId) return undefined;

    socket.emit('join_group', { groupId });

    const onMessage = (msg) => {
      if (msg.groupId?.toString() !== groupId?.toString()) return;
      setLiveMessages((prev) => [...prev, msg]);
    };

    const onGroupError = (payload) =>
      setGroupError(payload?.message || 'Something went wrong');

    const onTypingUpdate = ({ groupId: evtGroupId, userId, isTyping }) => {
      if (evtGroupId?.toString() !== groupId?.toString()) return;

      clearTimeout(typingClearTimers.current.get(userId));

      if (isTyping) {
        setTypingUserIds((prev) => new Set([...prev, userId]));
        const timer = setTimeout(() => {
          setTypingUserIds((prev) => {
            const next = new Set(prev);
            next.delete(userId);
            return next;
          });
          typingClearTimers.current.delete(userId);
        }, TYPING_DEBOUNCE_MS * 3);
        typingClearTimers.current.set(userId, timer);
      } else {
        setTypingUserIds((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
        typingClearTimers.current.delete(userId);
      }
    };

    socket.on('group_message_received', onMessage);
    socket.on('group_error', onGroupError);
    socket.on('group_typing_update', onTypingUpdate);

    return () => {
      socket.off('group_message_received', onMessage);
      socket.off('group_error', onGroupError);
      socket.off('group_typing_update', onTypingUpdate);
      socket.emit('leave_group', { groupId });
    };
  }, [socket, groupId]);

  const sendMessage = useCallback(
    ({ type = 'text', body, language = null } = {}) => {
      if (!socket || !groupId) return;
      socket.emit('send_group_message', { groupId, type, body, language });
    },
    [socket, groupId],
  );

  const onType = useCallback(() => {
    if (!socket || !groupId) return;

    if (!isSendingTyping.current) {
      isSendingTyping.current = true;
      socket.emit('group_typing', { groupId, isTyping: true });
    }

    clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(() => {
      isSendingTyping.current = false;
      socket.emit('group_typing', { groupId, isTyping: false });
    }, TYPING_DEBOUNCE_MS);
  }, [socket, groupId]);

  // Cleanup send-side timers on unmount / group change
  useEffect(() => {
    return () => {
      clearTimeout(stopTimer.current);
      if (isSendingTyping.current && socket && groupId) {
        socket.emit('group_typing', { groupId, isTyping: false });
        isSendingTyping.current = false;
      }
      typingClearTimers.current.forEach((t) => clearTimeout(t));
      typingClearTimers.current.clear();
    };
  }, [socket, groupId]);

  const messages = [...(history?.messages || []), ...liveMessages];

  return {
    messages,
    isFetching,
    error,
    groupError,
    typingUserIds,
    sendMessage,
    onType,
  };
};
