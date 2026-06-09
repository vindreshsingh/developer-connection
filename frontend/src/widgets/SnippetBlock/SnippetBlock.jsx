import { Highlight, themes } from 'prism-react-renderer';
import { Link } from 'react-router-dom';
import { SUPPORTED_LANGUAGES } from './snippetLanguages';
import './SnippetBlock.scss';

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
    <div className="dc-snippet-block">
      <div className="dc-snippet-block-header">
        <span className="dc-snippet-block-lang">{langLabel}</span>
        {profileId && (
          <Link
            to={`/profile?userId=${profileId}`}
            className="dc-snippet-block-author"
          >
            {senderName || 'View profile'}
          </Link>
        )}
      </div>

      <Highlight theme={themes.vsDark} code={code} language={lang}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre className={`dc-snippet-block-pre ${className}`} style={style}>
            {tokens.map((line, i) => (
              <div key={i} {...getLineProps({ line })}>
                <span className="dc-snippet-block-lineno">{i + 1}</span>
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
