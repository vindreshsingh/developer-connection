import { classNames } from '@/commonUtils/classNames';
import { formatTime } from '@/commonUtils/formatDate';
import SnippetBlock from '@/widgets/SnippetBlock/SnippetBlock';
import CallSummaryCard from '@/widgets/CallSummaryCard/CallSummaryCard';

/**
 * Message bubble for group chat.
 * Shows sender name for messages from others (unlike 1-1 chat where the
 * other participant is already shown in the thread header).
 *
 * @param {{ message: object, isOwn: boolean, members: Array }} props
 */
export default function GroupMessageBubble({ message, isOwn, members = [] }) {
  // Call summary messages are system events — render as a centred pill, not a bubble
  if (message.type === 'call_summary') {
    return <CallSummaryCard message={message} />;
  }

  const senderName = (() => {
    if (isOwn) return 'You';
    const senderId =
      typeof message.senderId === 'object' ? message.senderId?._id : message.senderId;
    const member = members.find(
      (m) =>
        m.userId?._id?.toString() === senderId?.toString() ||
        m.userId?.toString() === senderId?.toString(),
    );
    if (!member) return 'Member';
    const u = member.userId;
    return typeof u === 'object'
      ? [u.firstName, u.lastName].filter(Boolean).join(' ')
      : 'Member';
  })();

  const isSnippet = message.type === 'snippet';

  return (
    <div
      className={classNames(
        'relative mb-2 max-w-[75%] self-start rounded-2xl bg-gray-100 px-3.5 pb-1.5 pt-2',
        isOwn && 'self-end bg-violet-100',
        isSnippet && 'max-w-[90%] overflow-hidden rounded-lg bg-transparent p-0',
      )}
    >
      {!isOwn && (
        <span className="mb-[0.15rem] block text-[0.72rem] font-semibold text-violet-800">{senderName}</span>
      )}

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
          'flex items-center justify-end',
          isSnippet && 'bg-[#1a1a2e] px-3 pb-1 pt-[0.3rem]',
        )}
      >
        <span className={classNames('text-[0.7rem] text-gray-400', isSnippet && 'text-gray-500')}>
          {formatTime(message.createdAt)}
        </span>
      </div>
    </div>
  );
}
