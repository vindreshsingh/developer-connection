import { useState } from 'react';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import { useStartInterviewMutation, useRespondToInterviewMutation, useEndInterviewMutation } from './aiApi';

// Drives a single mock-interview chat: tracks the running transcript locally
// (the backend only returns one turn at a time) and exposes start/respond/end
// actions plus loading + error state for the AI Assistant's Interview Prep tab.
export const useInterviewSession = () => {
  const [sessionId, setSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | active | completed

  const [startInterviewMutation, { isLoading: starting, error: startError }] = useStartInterviewMutation();
  const [respondMutation, { isLoading: responding, error: respondError }] = useRespondToInterviewMutation();
  const [endMutation, { isLoading: ending }] = useEndInterviewMutation();

  const start = async (focusArea) => {
    const result = await startInterviewMutation(focusArea ? { focusArea } : {});
    if (result.error) return result;

    setSessionId(result.data.data.sessionId);
    setMessages([{ role: 'assistant', content: result.data.data.question }]);
    setStatus('active');
    return result;
  };

  const respond = async (answer) => {
    if (!sessionId) return;
    setMessages((prev) => [...prev, { role: 'user', content: answer }]);

    const result = await respondMutation({ sessionId, answer });
    if (result.error) return result;

    const { feedback, nextQuestion, status: nextStatus } = result.data.data;
    const assistantContent = nextQuestion ? `${feedback}\n\n${nextQuestion}` : feedback;
    setMessages((prev) => [...prev, { role: 'assistant', content: assistantContent }]);
    setStatus(nextStatus);
    return result;
  };

  const end = async () => {
    if (!sessionId) return;
    await endMutation(sessionId);
    setStatus('completed');
  };

  const reset = () => {
    setSessionId(null);
    setMessages([]);
    setStatus('idle');
  };

  return {
    sessionId,
    messages,
    status,
    start,
    respond,
    end,
    reset,
    starting,
    responding,
    ending,
    error: getApiErrorMessage(startError || respondError, null),
  };
};
