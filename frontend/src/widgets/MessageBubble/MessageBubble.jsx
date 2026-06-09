import { useState } from 'react';
import { classNames } from '@/commonUtils/classNames';
import { formatTime } from '@/commonUtils/formatDate';
import SnippetBlock from '@/widgets/SnippetBlock/SnippetBlock';
import './MessageBubble.scss';

const QUICK_EMOJI = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

/**
 * @param {{ message: object, isOwn: boolean, onReact: (messageId:string, emoji:string)=>void, seenAt: Date|null }} props
 *   seenAt — the other participant's last-read timestamp (from REST load or real-time socket event).
 *   A "Seen" badge appears on own messages whose createdAt ≤ seenAt.
 */
export default function MessageBubble({ message, isOwn, onReact, seenAt, senderName }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  // Group reactions: emoji → { count, hasMe }
  const reactionGroups = (message.reactions || []).reduce((acc, r) => {
    const existing = acc.find((g) => g.emoji === r.emoji);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ emoji: r.emoji, count: 1 });
    }
    return acc;
  }, []);

  const isSeen =
    isOwn &&
    seenAt &&
    message.createdAt &&
    new Date(seenAt) >= new Date(message.createdAt);

  const handleReact = (emoji) => {
    if (onReact) onReact(message._id, emoji);
    setPickerOpen(false);
  };

  return (
    <div className={classNames('dc-message-bubble', isOwn && 'dc-message-bubble--own', message.type === 'snippet' && 'dc-message-bubble--snippet')}>
      {message.type === 'snippet' ? (
        <SnippetBlock
          code={message.body}
          language={message.language}
          senderId={message.senderId}
          senderName={senderName}
        />
      ) : (
        <p className="dc-message-bubble-body">{message.body}</p>
      )}

      <div className="dc-message-bubble-footer">
        <span className="dc-message-bubble-time">{formatTime(message.createdAt)}</span>
        {isSeen && <span className="dc-message-bubble-seen">Seen</span>}
      </div>

      {/* Reaction bar */}
      {reactionGroups.length > 0 && (
        <div className="dc-message-bubble-reactions">
          {reactionGroups.map(({ emoji, count }) => (
            <button
              key={emoji}
              type="button"
              className="dc-message-bubble-reaction"
              onClick={() => handleReact(emoji)}
              aria-label={`React with ${emoji}`}
            >
              {emoji} {count}
            </button>
          ))}
        </div>
      )}

      {/* Emoji picker toggle */}
      <div className="dc-message-bubble-emoji-trigger">
        <button
          type="button"
          className="dc-message-bubble-emoji-btn"
          onClick={() => setPickerOpen((o) => !o)}
          aria-label="Add reaction"
        >
          😊
        </button>
        {pickerOpen && (
          <div className="dc-message-bubble-emoji-picker">
            {QUICK_EMOJI.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="dc-message-bubble-emoji-option"
                onClick={() => handleReact(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
