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
import './GroupDetail.scss';

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
    return <div className="dc-group-detail-loading">Loading group…</div>;
  }

  if (error || !group) {
    return (
      <div className="dc-group-detail-error">
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
      <div className="dc-group-detail">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="dc-group-detail-header">
          <div>
            <h1 className="dc-group-detail-name">{group.name}</h1>
            {group.description && (
              <p className="dc-group-detail-desc">{group.description}</p>
            )}
            {group.tags?.length > 0 && (
              <div className="dc-group-detail-tags">
                {group.tags.map((tag) => (
                  <span key={tag} className="dc-groups-tag">{tag}</span>
                ))}
              </div>
            )}
          </div>

          <div className="dc-group-detail-actions">
            <span className="dc-group-detail-count">
              {group.memberCount} / {group.maxMembers} members
            </span>

            {/* ── Video call button — members only ────────────────────── */}
            {isMember && (
              <button
                type="button"
                className="dc-group-detail-call-btn"
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
          <p className="dc-group-detail-error-inline">
            {getApiErrorMessage(joinError || leaveError, 'Action failed')}
          </p>
        )}

        {callError && (
          <p className="dc-group-detail-error-inline">{callError}</p>
        )}

        {/* ── Incoming call banner ────────────────────────────────────── */}
        {incomingGroupCall && !activeGroupCall && (
          <div className="dc-group-detail-call-banner" role="alert">
            <span className="dc-group-detail-call-banner-text">
              📹 Group call started{incomingGroupCall.startedBy ? ` by ${incomingGroupCall.startedBy}` : ''}
            </span>
            <button
              type="button"
              className="dc-group-detail-call-banner-btn dc-group-detail-call-banner-btn--join"
              onClick={() => handleJoinCall(incomingGroupCall.callId)}
              disabled={isFetchingToken}
            >
              {isFetchingToken ? 'Joining…' : '📞 Join'}
            </button>
            <button
              type="button"
              className="dc-group-detail-call-banner-btn dc-group-detail-call-banner-btn--dismiss"
              onClick={() => setIncomingGroupCall(null)}
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        )}

        {/* ── Layout ─────────────────────────────────────────────────────── */}
        <div className="dc-group-detail-layout">
          {/* ── Members sidebar ──────────────────────────────────────────── */}
          <aside className="dc-group-detail-sidebar">
            <h2 className="dc-group-detail-sidebar-title">Members</h2>
            <ul className="dc-group-detail-member-list">
              {group.members?.map((m) => {
                const memberUser = m.userId;
                const name = typeof memberUser === 'object'
                  ? [memberUser.firstName, memberUser.lastName].filter(Boolean).join(' ')
                  : 'Member';
                return (
                  <li key={m.userId?._id ?? m.userId} className="dc-group-detail-member">
                    {memberUser?.photoUrl && (
                      <img
                        className="dc-group-detail-avatar"
                        src={memberUser.photoUrl}
                        alt={name}
                      />
                    )}
                    <span className="dc-group-detail-member-name">{name}</span>
                    {m.role === 'admin' && (
                      <span className="dc-group-detail-admin-badge">Admin</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* ── Chat thread ──────────────────────────────────────────────── */}
          <section className="dc-group-detail-thread">
            {!isMember ? (
              <div className="dc-group-detail-join-prompt">
                <p>Join this group to see and send messages.</p>
              </div>
            ) : (
              <>
                <div className="dc-group-detail-thread-body">
                  {msgFetching && messages.length === 0 && (
                    <p className="dc-group-detail-loading">Loading messages…</p>
                  )}
                  {groupError && (
                    <p className="dc-group-detail-error-inline">{groupError}</p>
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
                    <p className="dc-group-detail-typing">
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
