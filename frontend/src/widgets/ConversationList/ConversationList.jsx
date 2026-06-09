import { classNames } from '@/commonUtils/classNames';
import Avatar from '@/components/Avatar/Avatar';
import './ConversationList.scss';

/**
 * @param {{ conversations: object[], activeConversationId: string|null, onSelect: (id:string)=>void, isOnline: (userId:string)=>boolean }} props
 */
export default function ConversationList({ conversations, activeConversationId, onSelect, isOnline }) {
  if (conversations.length === 0) {
    return <p className="dc-conversation-list-empty">No conversations yet — start one from your Connections.</p>;
  }

  return (
    <ul className="dc-conversation-list">
      {conversations.map((conversation) => {
        const otherId = conversation.otherUser?._id;
        const online = isOnline ? isOnline(otherId) : false;

        return (
          <li key={conversation._id}>
            <button
              type="button"
              className={classNames(
                'dc-conversation-list-item',
                conversation._id === activeConversationId && 'dc-conversation-list-item--active'
              )}
              onClick={() => onSelect(conversation._id)}
            >
              <div className="dc-conversation-list-item-avatar">
                <Avatar user={conversation.otherUser} size="sm" />
                {online && <span className="dc-conversation-list-item-dot" aria-label="Online" />}
              </div>
              <span className="dc-conversation-list-item-name">
                {conversation.otherUser?.firstName} {conversation.otherUser?.lastName}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
