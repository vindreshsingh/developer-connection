import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from '@/store/baseQuery';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import { useGetInterviewPrepHistoryQuery } from './aiApi';

// Reads an SSE response body, calling onDelta for each `data: {"delta": ...}`
// chunk. Throws if the stream emits a `data: {"error": ...}` event.
const consumeInterviewPrepStream = async (response, onDelta) => {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop();

    for (const event of events) {
      const line = event.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue;

      const payload = line.slice('data: '.length);
      if (payload === '[DONE]') continue;

      const parsed = JSON.parse(payload);
      if (parsed.error) throw new Error(parsed.error);
      onDelta(parsed.delta);
    }
  }
};

export const useInterviewPrepChat = () => {
  const { data: historyData, isLoading: loadingHistory } = useGetInterviewPrepHistoryQuery(1);
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Seed local chat state from the loaded history once — see Profile
    // container for the same documented "init from query data" pattern.
    /* eslint-disable react-hooks/set-state-in-effect */
    if (historyData?.data) setMessages(historyData.data);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [historyData]);

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      setError('');
      setMessages((prev) => [...prev, { role: 'user', content: trimmed }, { role: 'assistant', content: '' }]);
      setIsStreaming(true);

      try {
        const response = await fetch(`${API_BASE_URL}/ai/interview-prep`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed }),
        });

        if (!response.ok || !response.body) {
          const body = await response.json().catch(() => ({}));
          throw new Error(getApiErrorMessage({ data: body }, 'Could not reach the AI assistant.'));
        }

        await consumeInterviewPrepStream(response, (delta) => {
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            next[next.length - 1] = { ...last, content: last.content + delta };
            return next;
          });
        });
      } catch (err) {
        setError(err.message || 'Could not reach the AI assistant.');
      } finally {
        setIsStreaming(false);
      }
    },
    [isStreaming]
  );

  return { messages, loadingHistory, isStreaming, error, sendMessage };
};
