import { useCallback, useEffect, useRef, useState } from 'react';

const TYPING_DEBOUNCE_MS = 1500; // clear "X is typing" banner after 1.5s of silence

/**
 * Handles both sides of the typing-indicator contract:
 *
 * - **Sending:** `onType()` debounces a `typing` socket event so we emit
 *   `isTyping: true` on the first keystroke, then `isTyping: false` once the
 *   user pauses for TYPING_DEBOUNCE_MS ms — not on every single keystroke.
 *
 * - **Receiving:** Subscribes to `typing_update` events for the active
 *   conversation and exposes `typingUserId` (the other participant's id) when
 *   they are currently typing, or `null` when they stop.
 *
 * @param {import('socket.io-client').Socket|null} socket
 * @param {string|null} conversationId  active conversation
 */
export const useTyping = (socket, conversationId) => {
  const [typingUserId, setTypingUserId] = useState(null);
  const typingClearTimer = useRef(null);
  const isSendingTyping = useRef(false);
  const stopTimer = useRef(null);

  // Receive: track when the other participant is typing
  useEffect(() => {
    if (!socket || !conversationId) return undefined;

    const onTypingUpdate = ({ conversationId: eventConvId, userId, isTyping }) => {
      if (eventConvId !== conversationId) return;
      clearTimeout(typingClearTimer.current);
      if (isTyping) {
        setTypingUserId(userId);
        // Auto-clear after a generous window in case the "stop" event is lost
        typingClearTimer.current = setTimeout(() => {
          setTypingUserId(null);
        }, TYPING_DEBOUNCE_MS * 3);
      } else {
        setTypingUserId(null);
      }
    };

    socket.on('typing_update', onTypingUpdate);
    return () => {
      socket.off('typing_update', onTypingUpdate);
      clearTimeout(typingClearTimer.current);
    };
  }, [socket, conversationId]);

  // Clear typing state when switching conversations
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTypingUserId(null);
    clearTimeout(typingClearTimer.current);
  }, [conversationId]);

  // Send: debounced emit on every keystroke
  const onType = useCallback(() => {
    if (!socket || !conversationId) return;

    if (!isSendingTyping.current) {
      isSendingTyping.current = true;
      socket.emit('typing', { conversationId, isTyping: true });
    }

    clearTimeout(stopTimer.current);
    stopTimer.current = setTimeout(() => {
      isSendingTyping.current = false;
      socket.emit('typing', { conversationId, isTyping: false });
    }, TYPING_DEBOUNCE_MS);
  }, [socket, conversationId]);

  // Cleanup send-side timers on unmount / conversation change
  useEffect(() => {
    return () => {
      clearTimeout(stopTimer.current);
      if (isSendingTyping.current && socket && conversationId) {
        socket.emit('typing', { conversationId, isTyping: false });
        isSendingTyping.current = false;
      }
    };
  }, [socket, conversationId]);

  return { typingUserId, onType };
};
