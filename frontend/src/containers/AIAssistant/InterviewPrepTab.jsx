import { useState } from 'react';
import Button from '@/components/Button/Button';
import FormInput from '@/components/FormInput/FormInput';
import AIChatBubble from '@/widgets/AIChatBubble/AIChatBubble';
import { useInterviewSession } from '@/hooks/ai/useInterviewSession';

const FOCUS_AREAS = [
  { value: '', label: 'General software engineering' },
  { value: 'frontend', label: 'Frontend' },
  { value: 'backend', label: 'Backend' },
  { value: 'system-design', label: 'System design' },
];

const ERROR_MESSAGES = {
  AI_RATE_LIMIT_EXCEEDED: "You've reached today's AI usage limit. Try again tomorrow.",
  AI_SERVICE_ERROR: 'The AI assistant is temporarily unavailable. Please try again shortly.',
};

export default function InterviewPrepTab() {
  const [focusArea, setFocusArea] = useState('');
  const [answer, setAnswer] = useState('');
  const { messages, status, start, respond, end, reset, starting, responding, error } = useInterviewSession();

  const errorMessage = error ? ERROR_MESSAGES[error] || error : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = answer.trim();
    if (!trimmed) return;
    setAnswer('');
    respond(trimmed);
  };

  if (status === 'idle') {
    return (
      <div className="dc-ai-assistant-interview-start">
        <p className="dc-ai-assistant-resume-intro">
          Practice for your next technical interview with an AI interviewer. You'll get up to 10 questions with
          feedback after each answer.
        </p>

        <select
          className="dc-ai-assistant-interview-focus"
          value={focusArea}
          onChange={(e) => setFocusArea(e.target.value)}
        >
          {FOCUS_AREAS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        <Button onClick={() => start(focusArea)} disabled={starting}>
          {starting ? 'Starting…' : 'Start mock interview'}
        </Button>

        {errorMessage && <p className="dc-ai-assistant-error">{errorMessage}</p>}
      </div>
    );
  }

  return (
    <div className="dc-ai-assistant-interview">
      <div className="dc-ai-assistant-interview-chat">
        {messages.map((message, i) => (
          <AIChatBubble key={i} role={message.role} content={message.content} />
        ))}
      </div>

      {errorMessage && <p className="dc-ai-assistant-error">{errorMessage}</p>}

      {status === 'active' ? (
        <form className="dc-ai-assistant-interview-form" onSubmit={handleSubmit}>
          <FormInput
            as="textarea"
            rows={3}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer…"
            wrapperClassName="dc-ai-assistant-interview-input"
          />
          <div className="dc-ai-assistant-interview-actions">
            <Button type="submit" disabled={responding || !answer.trim()}>
              {responding ? 'Sending…' : 'Send answer'}
            </Button>
            <Button type="button" variant="outline" onClick={end} disabled={responding}>
              End session
            </Button>
          </div>
        </form>
      ) : (
        <div className="dc-ai-assistant-interview-actions">
          <p className="dc-ai-assistant-empty">Interview complete!</p>
          <Button onClick={reset}>Start a new session</Button>
        </div>
      )}
    </div>
  );
}
