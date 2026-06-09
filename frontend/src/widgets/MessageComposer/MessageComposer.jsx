import { useState } from 'react';
import FormInput from '@/components/FormInput/FormInput';
import Button from '@/components/Button/Button';
import { SUPPORTED_LANGUAGES } from '@/widgets/SnippetBlock/snippetLanguages';
import './MessageComposer.scss';

export default function MessageComposer({ onSend, onType, disabled }) {
  const [body, setBody] = useState('');
  const [snippetMode, setSnippetMode] = useState(false);
  const [language, setLanguage] = useState('javascript');

  const handleChange = (e) => {
    setBody(e.target.value);
    if (onType && !snippetMode) onType(); // only emit typing for plain text
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || disabled) return;

    if (snippetMode) {
      onSend({ type: 'snippet', body: trimmed, language });
    } else {
      onSend({ type: 'text', body: trimmed });
    }
    setBody('');
  };

  const toggleSnippetMode = () => {
    setSnippetMode((prev) => !prev);
    setBody('');
  };

  return (
    <form className="dc-message-composer" onSubmit={handleSubmit}>
      {/* Mode toggle */}
      <button
        type="button"
        className={`dc-message-composer-mode-btn${snippetMode ? ' dc-message-composer-mode-btn--active' : ''}`}
        onClick={toggleSnippetMode}
        title={snippetMode ? 'Switch to text mode' : 'Switch to code snippet mode'}
        aria-pressed={snippetMode}
        disabled={disabled}
      >
        {'</>'}
      </button>

      <div className="dc-message-composer-body">
        {snippetMode && (
          <div className="dc-message-composer-snippet-controls">
            <select
              className="dc-message-composer-lang-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={disabled}
              aria-label="Snippet language"
            >
              {SUPPORTED_LANGUAGES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        )}

        {snippetMode ? (
          <textarea
            className="dc-message-composer-code-area"
            placeholder="Paste or type your code here…"
            value={body}
            onChange={handleChange}
            disabled={disabled}
            rows={6}
            spellCheck={false}
          />
        ) : (
          <FormInput
            placeholder="Type a message…"
            value={body}
            onChange={handleChange}
            wrapperClassName="dc-message-composer-input"
            disabled={disabled}
          />
        )}
      </div>

      <Button type="submit" disabled={disabled || !body.trim()}>
        Send
      </Button>
    </form>
  );
}
