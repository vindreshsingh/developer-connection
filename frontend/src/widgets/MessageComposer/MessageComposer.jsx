import { useState } from 'react';
import FormInput from '@/components/FormInput/FormInput';
import Button from '@/components/Button/Button';
import { SUPPORTED_LANGUAGES } from '@/widgets/SnippetBlock/snippetLanguages';
import { classNames } from '@/commonUtils/classNames';

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
    <form className="flex items-end gap-2 border-t border-gray-200 p-3" onSubmit={handleSubmit}>
      {/* Mode toggle */}
      <button
        type="button"
        className={classNames(
          'flex-shrink-0 self-end whitespace-nowrap rounded-md border border-gray-200 bg-gray-100 px-2 py-1.5 font-mono text-xs font-bold text-gray-500 transition-colors duration-150 hover:bg-gray-200 hover:text-gray-700',
          snippetMode && 'border-violet-300 bg-violet-100 text-violet-700',
        )}
        onClick={toggleSnippetMode}
        title={snippetMode ? 'Switch to text mode' : 'Switch to code snippet mode'}
        aria-pressed={snippetMode}
        disabled={disabled}
      >
        {'</>'}
      </button>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        {snippetMode && (
          <div className="flex items-center gap-2">
            <select
              className="cursor-pointer rounded-md border border-gray-300 bg-white px-2 py-1 text-[0.8rem] text-gray-700 focus:outline-2 focus:outline-offset-1 focus:outline-indigo-400"
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
            className="w-full resize-y rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-[0.8rem] text-gray-800 [tab-size:2] leading-[1.6] placeholder:text-gray-400 focus:outline-2 focus:outline-offset-1 focus:outline-indigo-400"
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
            wrapperClassName="flex-1"
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
