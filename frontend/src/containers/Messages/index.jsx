import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import { useGetConversationsQuery } from '@/hooks/chat/chatApi';
import { useChat } from '@/hooks/chat/useChat';
import { usePresence } from '@/hooks/chat/usePresence';
import { useSocket } from '@/hooks/chat/useSocket';
import { useCall } from '@/context/CallProvider';
import { useInitiateCallMutation } from '@/hooks/call/callApi';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import ConversationList from '@/widgets/ConversationList/ConversationList';
import MessageBubble from '@/widgets/MessageBubble/MessageBubble';
import MessageComposer from '@/widgets/MessageComposer/MessageComposer';
import { parseConversations, parseConversationsError } from './parser';
import './Messages.scss';

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
    <div className="dc-messages">
      <h1 className="dc-messages-heading">Messages</h1>

      {conversationsError && <p className="dc-messages-error">{conversationsError}</p>}

      <div className="dc-messages-layout">
        <aside className="dc-messages-sidebar">
          {isFetching ? (
            <p className="dc-messages-loading">Loading conversations…</p>
          ) : (
            <ConversationList
              conversations={conversations}
              activeConversationId={activeConversationId}
              onSelect={setActiveConversationId}
              isOnline={isOnline}
            />
          )}
        </aside>

        <section className="dc-messages-thread">
          {!activeConversationId ? (
            <p className="dc-messages-placeholder">Select a conversation to start chatting.</p>
          ) : (
            <>
              {activeConversation && (
                <header className="dc-messages-thread-header">
                  <span>{activeConversation.otherUser?.firstName} {activeConversation.otherUser?.lastName}</span>
                  {isOnline(activeConversation.otherUser?._id) && (
                    <span className="dc-messages-thread-online">● Online</span>
                  )}
                  <button
                    type="button"
                    className="dc-messages-call-btn"
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

              <div className="dc-messages-thread-body">
                {isThreadFetching && messages.length === 0 && (
                  <p className="dc-messages-loading">Loading messages…</p>
                )}
                {threadError && (
                  <p className="dc-messages-error">{getApiErrorMessage(threadError, 'Could not load messages')}</p>
                )}
                {chatError && <p className="dc-messages-error">{chatError}</p>}

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
                  <p className="dc-messages-typing">
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
