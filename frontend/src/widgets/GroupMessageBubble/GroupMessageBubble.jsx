import { classNames } from '@/commonUtils/classNames';
import { formatTime } from '@/commonUtils/formatDate';
import SnippetBlock from '@/widgets/SnippetBlock/SnippetBlock';
import './GroupMessageBubble.scss';

/**
 * Message bubble for group chat.
 * Shows sender name for messages from others (unlike 1-1 chat where the
 * other participant is already shown in the thread header).
 *
 * @param {{ message: object, isOwn: boolean, members: Array }} props
 */
export default function GroupMessageBubble({ message, isOwn, members = [] }) {
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

  return (
    <div
      className={classNames(
        'dc-gm-bubble',
        isOwn && 'dc-gm-bubble--own',
        message.type === 'snippet' && 'dc-gm-bubble--snippet',
      )}
    >
      {!isOwn && (
        <span className="dc-gm-bubble-sender">{senderName}</span>
      )}

      {message.type === 'snippet' ? (
        <SnippetBlock
          code={message.body}
          language={message.language}
          senderId={message.senderId}
          senderName={senderName}
        />
      ) : (
        <p className="dc-gm-bubble-body">{message.body}</p>
      )}

      <div className="dc-gm-bubble-footer">
        <span className="dc-gm-bubble-time">{formatTime(message.createdAt)}</span>
      </div>
    </div>
  );
}
