import { useState } from 'react';
import FormInput from '@/components/FormInput/FormInput';
import Button from '@/components/Button/Button';
import './InterviewPrepChat.scss';

export default function InterviewPrepChat({ messages, isStreaming, error, onSend }) {
  const [input, setInput] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    onSend(input);
    setInput('');
  };

  return (
    <div className="dc-interview-prep-chat">
      <div className="dc-interview-prep-chat-messages">
        {messages.length === 0 && (
          <p className="dc-interview-prep-chat-empty">
            Ask for help with interview questions, mock answers, or career advice.
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`dc-interview-prep-chat-message dc-interview-prep-chat-message--${msg.role}`}>
            <p>{msg.content || (isStreaming && i === messages.length - 1 ? '...' : '')}</p>
          </div>
        ))}
      </div>

      {error && <p className="dc-interview-prep-chat-error">{error}</p>}

      <form className="dc-interview-prep-chat-form" onSubmit={handleSubmit}>
        <FormInput
          placeholder="Ask your interview-prep question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          wrapperClassName="dc-interview-prep-chat-input"
          disabled={isStreaming}
        />
        <Button type="submit" disabled={isStreaming}>
          {isStreaming ? 'Thinking...' : 'Send'}
        </Button>
      </form>
    </div>
  );
}
