import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import { useGetConversationsQuery } from '@/hooks/chat/chatApi';
import { useChat } from '@/hooks/chat/useChat';
import { usePresence } from '@/hooks/chat/usePresence';
import { useSocket } from '@/hooks/chat/useSocket';
import { useCall } from '@/context/CallContext';
import { useInitiateCallMutation } from '@/hooks/call/callApi';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import { classNames } from '@/commonUtils/classNames';
import ConversationList from '@/widgets/ConversationList/ConversationList';
import MessageBubble from '@/widgets/MessageBubble/MessageBubble';
import MessageComposer from '@/widgets/MessageComposer/MessageComposer';
import { parseConversations, parseConversationsError } from './parser';

export default function MessagesContainer() {
  const { user } = useCurrentUser();
  const location = useLocation();
  const socket = useSocket();
  const { initiateCall, activeCall } = useCall() ?? {};
  const [initiateCallMutation, { isLoading: isCallInitiating }] = useInitiateCallMutation();
  const { isOnline } = usePresence(socket);
  const { data, isFetching, error } = useGetConversationsQuery();
  const [activeConversationId, setActiveConversationId] = useState(null);

  const conversations = parseConversations(data);
  const conversationsError = parseConversationsError(error);

  const {
    messages,
    isFetching: isThreadFetching,
    error: threadError,
    chatError,
    sendMessage,
    sendReaction,
    markAsRead,
    otherUserSeenAt,
    typingUserId,
    onType,
  } = useChat(socket, activeConversationId);

  const threadEndRef = useRef(null);

  // Default to the conversation we navigated here for (e.g. "Message" from a
  // connection card), falling back to the most recent conversation once the
  // list loads — adjusting state in response to async-loaded query data is the
  // documented exception (React docs: "Adjusting state when a prop changes").
  useEffect(() => {
    if (activeConversationId || conversations.length === 0) return;

    const requestedId = location.state?.conversationId;
    const requested = requestedId && conversations.find((c) => c._id === requestedId);

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setActiveConversationId(requested ? requested._id : conversations[0]._id);
  }, [activeConversationId, conversations, location.state]);

  // Mark the active conversation as read whenever it changes or new messages arrive
  useEffect(() => {
    if (activeConversationId) markAsRead();
  }, [activeConversationId, messages.length, markAsRead]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const activeConversation = conversations.find((c) => c._id === activeConversationId);

  // Effective "seen" time for own messages: the latest of the REST-loaded snapshot
  // and any real-time `conversation_read` event received since the page loaded.
  const restSeenAt = activeConversation?.otherUserLastReadAt
    ? new Date(activeConversation.otherUserLastReadAt)
    : null;
  const seenAt =
    otherUserSeenAt && restSeenAt
      ? new Date(Math.max(otherUserSeenAt, restSeenAt))
      : otherUserSeenAt || restSeenAt;

  return (
    <div className="mx-auto max-w-[56rem] px-2 py-4 sm:px-4 sm:py-8">
      <h1 className="mb-4 text-2xl font-bold text-gray-900 opacity-0 [animation:dc-fade-in-up_0.45s_ease_forwards]">Messages</h1>

      {conversationsError && <p className="my-2 text-sm text-red-500">{conversationsError}</p>}

      <div className="relative flex h-[calc(100svh-9rem)] gap-0 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-[0_12px_32px_-20px_rgba(17,24,39,0.25)] opacity-0 [animation:dc-fade-in-up_0.45s_ease_forwards] [animation-delay:0.05s] sm:static sm:h-[32rem] sm:gap-4 sm:rounded-xl">
        <aside
          className={classNames(
            'w-full overflow-y-auto p-2 sm:w-64 sm:shrink-0 sm:border-r sm:border-gray-200',
            activeConversationId ? 'hidden sm:block' : 'block sm:block',
          )}
        >
          {isFetching ? (
            <p className="m-auto p-4 text-sm text-gray-500">Loading conversations…</p>
          ) : (
            <ConversationList
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelect={setActiveConversationId}
              isOnline={isOnline}
            />
          )}
        </aside>

        <section
          className={classNames(
            'w-full min-w-0 flex-1 flex-col',
            activeConversationId ? 'flex sm:flex' : 'hidden sm:flex',
          )}
        >
          {!activeConversationId ? (
            <p className="m-auto p-4 text-sm text-gray-500">Select a conversation to start chatting.</p>
          ) : (
            <>
              {activeConversation && (
                <header className="flex items-center gap-2 border-b border-gray-200 px-4 py-3.5 font-semibold text-gray-900">
                  <button
                    type="button"
                    className="-mt-1 -mb-1 -ml-1.5 mr-1 inline-flex items-center rounded-md border-none bg-transparent px-1.5 py-1 text-lg leading-none text-gray-600 transition-colors duration-150 hover:bg-gray-100 sm:hidden"
                    aria-label="Back to conversations"
                    onClick={() => setActiveConversationId(null)}
                  >
                    ←
                  </button>
                  <span>{activeConversation.otherUser?.firstName} {activeConversation.otherUser?.lastName}</span>
                  {isOnline(activeConversation.otherUser?._id) && (
                    <span className="text-xs font-normal text-green-500">● Online</span>
                  )}
                  <button
                    type="button"
                    className="ml-auto cursor-pointer rounded-lg border border-gray-200 bg-transparent px-[0.6rem] py-[0.35rem] text-base transition-colors duration-150 hover:not-disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                    disabled={!!activeCall || isCallInitiating}
                    title="Start video call"
                    aria-label="Start video call"
                    onClick={async () => {
                      try {
                        const result = await initiateCallMutation({
                          type: '1:1',
                          targetUserId: activeConversation.otherUser._id,
                        }).unwrap();
                        initiateCall?.({
                          callId:         result.callId,
                          remoteUserName: [activeConversation.otherUser?.firstName, activeConversation.otherUser?.lastName].filter(Boolean).join(' '),
                        });
                      } catch {
                        // error handled by RTK Query
                      }
                    }}
                  >
                    📹
                  </button>
                </header>
              )}

              <div className="flex flex-1 flex-col overflow-y-auto p-4">
                {isThreadFetching && messages.length === 0 && (
                  <p className="m-auto p-4 text-sm text-gray-500">Loading messages…</p>
                )}
                {threadError && (
                  <p className="my-2 text-sm text-red-500">{getApiErrorMessage(threadError, 'Could not load messages')}</p>
                )}
                {chatError && <p className="my-2 text-sm text-red-500">{chatError}</p>}

                {messages.map((message) => {
                  const isOwn = message.senderId === user?._id || message.senderId?._id === user?._id;
                  const senderName = isOwn
                    ? [user?.firstName, user?.lastName].filter(Boolean).join(' ')
                    : [activeConversation?.otherUser?.firstName, activeConversation?.otherUser?.lastName].filter(Boolean).join(' ');
                  return (
                    <MessageBubble
                      key={message._id}
                      message={message}
                      isOwn={isOwn}
                      onReact={sendReaction}
                      seenAt={seenAt}
                      senderName={senderName}
                    />
                  );
                })}
                {typingUserId && (
                  <p className="py-1 text-[0.8rem] text-gray-500 italic [animation:dc-blink_1.2s_ease-in-out_infinite]">
                    {activeConversation?.otherUser?.firstName ?? 'Someone'} is typing…
                  </p>
                )}
                <div ref={threadEndRef} />
              </div>

              <MessageComposer onSend={sendMessage} onType={onType} disabled={!activeConversationId} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
