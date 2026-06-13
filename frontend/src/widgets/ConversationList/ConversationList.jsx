import { classNames } from '@/commonUtils/classNames';
import Avatar from '@/components/Avatar/Avatar';

/**
 * @param {{ conversations: object[], activeConversationId: string|null, onSelect: (id:string)=>void, isOnline: (userId:string)=>boolean }} props
 */
export default function ConversationList({ conversations, activeConversationId, onSelect, isOnline }) {
  if (conversations.length === 0) {
    return <p className="px-3 py-4 text-sm text-gray-500">No conversations yet — start one from your Connections.</p>;
  }

  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {conversations.map((conversation) => {
        const otherId = conversation.otherUser?._id;
        const online = isOnline ? isOnline(otherId) : false;

        return (
          <li key={conversation._id}>
            <button
              type="button"
              className={classNames(
                'flex w-full items-center gap-3 rounded-lg border-none bg-transparent px-3 py-2.5 text-left transition-colors duration-150 ease hover:bg-gray-100',
                conversation._id === activeConversationId && 'bg-violet-100 hover:bg-violet-100',
              )}
              onClick={() => onSelect(conversation._id)}
            >
              <div className="relative flex-shrink-0">
                <Avatar user={conversation.otherUser} size="sm" />
                {online && <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-green-500" aria-label="Online" />}
              </div>
              <span className="text-[0.9rem] font-semibold text-gray-900">
                {conversation.otherUser?.firstName} {conversation.otherUser?.lastName}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
