import { useState } from 'react';
import { classNames } from '@/commonUtils/classNames';
import { formatTime } from '@/commonUtils/formatDate';
import SnippetBlock from '@/widgets/SnippetBlock/SnippetBlock';
import CallSummaryCard from '@/widgets/CallSummaryCard/CallSummaryCard';

const QUICK_EMOJI = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

/**
 * @param {{ message: object, isOwn: boolean, onReact: (messageId:string, emoji:string)=>void, seenAt: Date|null }} props
 *   seenAt — the other participant's last-read timestamp (from REST load or real-time socket event).
 *   A "Seen" badge appears on own messages whose createdAt ≤ seenAt.
 */
export default function MessageBubble({ message, isOwn, onReact, seenAt, senderName }) {
  const [pickerOpen, setPickerOpen] = useState(false);

  // Call summary messages are system events — render as a centred pill, not a bubble
  if (message.type === 'call_summary') {
    return <CallSummaryCard message={message} />;
  }

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

  const isSnippet = message.type === 'snippet';

  return (
    <div
      className={classNames(
        'group relative mb-3 max-w-[88%] self-start rounded-2xl bg-gray-100 px-3.5 pb-1.5 pt-2 [animation:dc-fade-in-up_0.25s_ease_both] sm:max-w-[75%]',
        isOwn && 'self-end bg-violet-100',
        isSnippet && 'max-w-[90%] overflow-hidden rounded-lg bg-transparent p-0',
      )}
    >
      {isSnippet ? (
        <SnippetBlock
          code={message.body}
          language={message.language}
          senderId={message.senderId}
          senderName={senderName}
        />
      ) : (
        <p className="m-0 mb-1 whitespace-pre-wrap break-words text-[0.9rem] text-gray-900">{message.body}</p>
      )}

      <div
        className={classNames(
          'flex items-center justify-end gap-1.5',
          isSnippet && 'bg-[#1a1a2e] px-3 pb-1 pt-[0.3rem]',
        )}
      >
        <span className={classNames('text-[0.7rem] text-gray-400', isSnippet && 'text-gray-500')}>
          {formatTime(message.createdAt)}
        </span>
        {isSeen && <span className="text-[0.7rem] italic text-indigo-400">Seen</span>}
      </div>

      {/* Reaction bar */}
      {reactionGroups.length > 0 && (
        <div className={classNames('mt-1 flex flex-wrap gap-1', isSnippet && 'bg-[#1a1a2e] px-2 py-1')}>
          {reactionGroups.map(({ emoji, count }) => (
            <button
              key={emoji}
              type="button"
              className="inline-flex items-center gap-[0.2rem] rounded-2xl border border-gray-200 bg-white px-[0.4rem] py-[0.1rem] text-[0.8rem] leading-[1.4] hover:border-gray-300 hover:bg-gray-50"
              onClick={() => handleReact(emoji)}
              aria-label={`React with ${emoji}`}
            >
              {emoji} {count}
            </button>
          ))}
        </div>
      )}

      {/* Emoji picker toggle */}
      <div className="absolute -right-1 -top-3 z-10 opacity-0 transition-opacity duration-150 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto">
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-white text-[0.85rem] shadow-[0_1px_4px_rgba(0,0,0,0.08)] hover:bg-gray-100"
          onClick={() => setPickerOpen((o) => !o)}
          aria-label="Add reaction"
        >
          😊
        </button>
        {pickerOpen && (
          <div className="absolute right-0 top-8 flex gap-1 whitespace-nowrap rounded-xl border border-gray-200 bg-white px-2 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.1)]">
            {QUICK_EMOJI.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="rounded px-[0.2rem] py-[0.15rem] text-[1.1rem] leading-none hover:bg-gray-100"
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
