import { Highlight, themes } from 'prism-react-renderer';
import { Link } from 'react-router-dom';
import { SUPPORTED_LANGUAGES } from './snippetLanguages';

const LANGUAGE_LABEL = Object.fromEntries(
  SUPPORTED_LANGUAGES.map(({ value, label }) => [value, label])
);

/**
 * Renders a syntax-highlighted code snippet with an optional "view profile"
 * link to the sender. Used inside MessageBubble for type === 'snippet'.
 *
 * @param {{ code: string, language: string, senderId: string|object, senderName: string }} props
 */
export default function SnippetBlock({ code, language, senderId, senderName }) {
  const lang = language || 'javascript';
  const langLabel = LANGUAGE_LABEL[lang] || lang;

  // senderId may be a plain string id or a populated object from history
  const profileId = senderId?._id || senderId;

  return (
    <div className="max-w-full overflow-hidden rounded-lg text-[0.8rem]">
      <div className="flex items-center justify-between gap-2 border-b border-[#2d2d2d] bg-[#1e1e1e] px-3 py-1.5">
        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.05em] text-gray-400">{langLabel}</span>
        {profileId && (
          <Link
            to={`/profile?userId=${profileId}`}
            className="text-[0.7rem] text-indigo-400 no-underline hover:text-[#a5b4fc] hover:underline"
          >
            {senderName || 'View profile'}
          </Link>
        )}
      </div>

      <Highlight theme={themes.vsDark} code={code} language={lang}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre className={`m-0 overflow-x-auto py-3 font-mono text-[0.8rem] leading-relaxed [border-radius:0_!important] ${className}`} style={style}>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                <span className="inline-block w-9 select-none pr-3 text-right text-xs text-gray-600">{i + 1}</span>
                {line.map((token, key) => (
                  <span key={key} {...getTokenProps({ token })} />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
