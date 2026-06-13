import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import { useSocket } from '@/hooks/chat/useSocket';
import {
  useGetGroupQuery,
  useJoinGroupMutation,
  useLeaveGroupMutation,
} from '@/hooks/groups/groupApi';
import { useGroupChat } from '@/hooks/groups/useGroupChat';
import { useInitiateCallMutation, useGetGroupTokenMutation } from '@/hooks/call/callApi';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import Button from '@/components/Button/Button';
import MessageComposer from '@/widgets/MessageComposer/MessageComposer';
import GroupMessageBubble from '@/widgets/GroupMessageBubble/GroupMessageBubble';
import GroupCallOverlay from '@/widgets/GroupCallOverlay/GroupCallOverlay';

/**
 * Group detail page — shows the group header, member sidebar, live chat thread,
 * and a message composer. Handles join / leave transitions.
 *
 * Phase 5 B3: group video call button + GroupCallOverlay integration.
 *
 * Call state machine (local to this page):
 *   null ──────── Start Call ──────► { callId, token }  →  overlay shown
 *   null ◄─── group_call_ended  ────
 *   null ────── incomingCall ──────► incomingCall banner  → Join → { callId, token }
 */
export default function GroupDetailContainer() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useCurrentUser();

  // ── Data ─────────────────────────────────────────────────────────────────
  const { data, isFetching, error } = useGetGroupQuery(groupId, { skip: !groupId });
  const group = data?.group;

  const isMember = group?.members?.some(
    (m) => m.userId?._id?.toString() === user?._id || m.userId?.toString() === user?._id,
  );

  // ── Real-time (only when member) ─────────────────────────────────────────
  const socket = useSocket();
  const { messages, isFetching: msgFetching, groupError, typingUserIds, sendMessage, onType } =
    useGroupChat(isMember ? socket : null, isMember ? groupId : null);

  const threadEndRef = useRef(null);
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── Join / Leave group ────────────────────────────────────────────────────
  const [joinGroup,  { isLoading: isJoining,  error: joinError  }] = useJoinGroupMutation();
  const [leaveGroup, { isLoading: isLeaving,  error: leaveError }] = useLeaveGroupMutation();

  const handleJoin = async () => {
    try { await joinGroup(groupId).unwrap(); } catch { /* joinError shown */ }
  };

  const handleLeave = async () => {
    try {
      await leaveGroup(groupId).unwrap();
      navigate('/groups');
    } catch { /* leaveError shown */ }
  };

  // ── Group call state ──────────────────────────────────────────────────────

  // Active call overlay: { callId, token } — null means overlay not shown
  const [activeGroupCall, setActiveGroupCall] = useState(null);
  // Incoming call notification: { callId, startedBy } — null means no banner
  const [incomingGroupCall, setIncomingGroupCall] = useState(null);
  // Track whether we're fetching a token so buttons can show loading
  const [initiateCall,   { isLoading: isStartingCall }] = useInitiateCallMutation();
  const [getGroupToken,  { isLoading: isFetchingToken }] = useGetGroupTokenMutation();
  const [callError, setCallError] = useState(null);

  const isCallBusy = isStartingCall || isFetchingToken || !!activeGroupCall;

  // Socket: listen for group_call_started / group_call_ended on this group
  useEffect(() => {
    if (!socket || !isMember) return undefined;

    const onCallStarted = ({ callId, startedBy, groupId: evtGroupId }) => {
      if (evtGroupId?.toString() !== groupId) return;
      // Only show incoming if we're not already in a call
      if (!activeGroupCall) {
        setIncomingGroupCall({ callId, startedBy });
      }
    };

    const onCallEnded = ({ groupId: evtGroupId }) => {
      if (evtGroupId?.toString() !== groupId) return;
      setIncomingGroupCall(null);
      setActiveGroupCall(null);
    };

    socket.on('group_call_started', onCallStarted);
    socket.on('group_call_ended',   onCallEnded);

    return () => {
      socket.off('group_call_started', onCallStarted);
      socket.off('group_call_ended',   onCallEnded);
    };
  }, [socket, isMember, groupId, activeGroupCall]);

  // Start a new group call (initiator path)
  const handleStartCall = useCallback(async () => {
    setCallError(null);
    try {
      const { callId } = await initiateCall({ type: 'group', groupId }).unwrap();
      const { token }  = await getGroupToken(callId).unwrap();
      setIncomingGroupCall(null);
      setActiveGroupCall({ callId, token });
    } catch (err) {
      setCallError(getApiErrorMessage(err, 'Could not start call'));
    }
  }, [initiateCall, getGroupToken, groupId]);

  // Join an existing group call (non-initiator path)
  const handleJoinCall = useCallback(async (callId) => {
    setCallError(null);
    try {
      const { token } = await getGroupToken(callId).unwrap();
      setIncomingGroupCall(null);
      setActiveGroupCall({ callId, token });
    } catch (err) {
      setCallError(getApiErrorMessage(err, 'Could not join call'));
    }
  }, [getGroupToken]);

  // Overlay closed (call ended / user left)
  const handleOverlayClose = useCallback(() => {
    setActiveGroupCall(null);
  }, []);

  // ── Loading / error states ────────────────────────────────────────────────
  if (isFetching) {
    return <div className="py-8 text-center text-gray-500">Loading group…</div>;
  }

  if (error || !group) {
    return (
      <div className="px-4 py-12 text-center text-red-600">
        {getApiErrorMessage(error, 'Group not found or has been deleted.')}
      </div>
    );
  }

  const typingNames = [...typingUserIds]
    .map((uid) => {
      const m = group.members?.find(
        (mem) => mem.userId?._id?.toString() === uid || mem.userId?.toString() === uid,
      );
      return m?.userId?.firstName ?? 'Someone';
    })
    .join(', ');

  return (
    <>
      <div className="mx-auto my-5 flex max-w-[1100px] flex-col gap-5 px-3 sm:my-8 sm:px-4">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 opacity-0 [animation:dc-fade-in-up_0.45s_ease_forwards] sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:py-5">
          <div>
            <h1 className="mb-1 text-[1.4rem] font-bold text-gray-900">{group.name}</h1>
            {group.description && (
              <p className="mb-2 text-[0.9rem] text-gray-600">{group.description}</p>
            )}
            {group.tags?.length > 0 && (
              <div className="flex flex-wrap gap-[0.35rem]">
                {group.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-violet-100 px-[0.55rem] py-[0.1rem] text-xs text-violet-800">{tag}</span>
                ))}
              </div>
            )}
          </div>

          <div className="flex w-full shrink-0 flex-col items-start gap-2 sm:w-auto sm:items-end">
            <span className="text-[0.8rem] whitespace-nowrap text-gray-500">
              {group.memberCount} / {group.maxMembers} members
            </span>

            {/* ── Video call button — members only ────────────────────── */}
            {isMember && (
              <button
                type="button"
                className="cursor-pointer rounded-lg border border-gray-200 bg-transparent px-[0.6rem] py-[0.35rem] text-base transition-colors duration-150 hover:not-disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                onClick={handleStartCall}
                disabled={isCallBusy}
                title={activeGroupCall ? 'Call in progress' : 'Start group video call'}
                aria-label="Start group video call"
              >
                {isStartingCall || isFetchingToken ? '⏳' : '📹'}
              </button>
            )}

            {isMember ? (
              <Button
                variant="danger"
                size="sm"
                disabled={isLeaving}
                onClick={handleLeave}
              >
                {isLeaving ? 'Leaving…' : 'Leave Group'}
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={isJoining || group.memberCount >= group.maxMembers}
                onClick={handleJoin}
              >
                {isJoining ? 'Joining…' : 'Join Group'}
              </Button>
            )}
          </div>
        </header>

        {(joinError || leaveError) && (
          <p className="text-sm text-red-600">
            {getApiErrorMessage(joinError || leaveError, 'Action failed')}
          </p>
        )}

        {callError && (
          <p className="text-sm text-red-600">{callError}</p>
        )}

        {/* ── Incoming call banner ────────────────────────────────────── */}
        {incomingGroupCall && !activeGroupCall && (
          <div className="flex items-center gap-3 rounded-xl bg-indigo-950 px-4 py-3 text-sm text-white [animation:dc-gc-banner-in_0.2s_ease-out]" role="alert">
            <span className="flex-1 font-medium">
              📹 Group call started{incomingGroupCall.startedBy ? ` by ${incomingGroupCall.startedBy}` : ''}
            </span>
            <button
              type="button"
              className="shrink-0 cursor-pointer rounded-full border-none bg-green-600 px-[0.9rem] py-[0.35rem] text-[0.8rem] font-semibold text-white transition-[filter] duration-150 hover:[filter:brightness(1.15)] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => handleJoinCall(incomingGroupCall.callId)}
              disabled={isFetchingToken}
            >
              {isFetchingToken ? 'Joining…' : '📞 Join'}
            </button>
            <button
              type="button"
              className="shrink-0 cursor-pointer rounded-full border-none bg-white/15 px-[0.6rem] py-[0.35rem] text-[0.8rem] font-semibold text-white transition-[filter] duration-150 hover:[filter:brightness(1.15)] disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => setIncomingGroupCall(null)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Layout ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-[220px_1fr]">
          {/* ── Members sidebar ──────────────────────────────────────────── */}
          <aside className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-3 text-[0.85rem] font-semibold text-gray-700 uppercase tracking-[0.05em]">Members</h2>
            <ul className="m-0 flex flex-col gap-[0.6rem] p-0 list-none">
              {group.members?.map((m) => {
                const memberUser = m.userId;
                const name = typeof memberUser === 'object'
                  ? [memberUser.firstName, memberUser.lastName].filter(Boolean).join(' ')
                  : 'Member';
                return (
                  <li key={m.userId?._id ?? m.userId} className="flex items-center gap-2">
                    {memberUser?.photoUrl && (
                      <img
                        className="h-7 w-7 shrink-0 rounded-full object-cover"
                        src={memberUser.photoUrl}
                        alt={name}
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{name}</span>
                    {m.role === 'admin' && (
                      <span className="shrink-0 rounded-full bg-blue-100 px-[0.45rem] py-[0.1rem] text-[0.7rem] text-blue-700">Admin</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* ── Chat thread ──────────────────────────────────────────────── */}
          <section className="flex min-h-[380px] flex-col overflow-hidden rounded-xl border border-gray-200 bg-white sm:min-h-[500px]">
            {!isMember ? (
              <div className="flex flex-1 items-center justify-center p-12 text-gray-500">
                <p>Join this group to see and send messages.</p>
              </div>
            ) : (
              <>
                <div className="flex max-h-[60vh] flex-1 flex-col gap-2 overflow-y-auto p-4 sm:max-h-[540px]">
                  {msgFetching && messages.length === 0 && (
                    <p className="py-8 text-center text-gray-500">Loading messages…</p>
                  )}
                  {groupError && (
                    <p className="text-sm text-red-600">{groupError}</p>
                  )}

                  {messages.map((msg) => {
                    const isOwn =
                      msg.senderId?.toString() === user?._id ||
                      msg.senderId?._id?.toString() === user?._id;
                    return (
                      <GroupMessageBubble
                        key={msg._id}
                        message={msg}
                        isOwn={isOwn}
                        members={group.members}
                      />
                    );
                  })}

                  {typingUserIds.size > 0 && (
                    <p className="py-1 text-[0.8rem] text-gray-500 italic">
                      {typingNames} {typingUserIds.size === 1 ? 'is' : 'are'} typing…
                    </p>
                  )}

                  <div ref={threadEndRef} />
                </div>

                <MessageComposer onSend={sendMessage} onType={onType} disabled={false} />
              </>
            )}
          </section>
        </div>
      </div>

      {/* ── Group call overlay — rendered outside layout flow ─────────── */}
      {activeGroupCall && (
        <GroupCallOverlay
          socket={socket}
          callId={activeGroupCall.callId}
          token={activeGroupCall.token}
          groupName={group.name}
          onClose={handleOverlayClose}
        />
      )}
    </>
  );
}
