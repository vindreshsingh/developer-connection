import { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import { useSocket } from '@/hooks/chat/useSocket';
import {
  useGetGroupQuery,
  useJoinGroupMutation,
  useLeaveGroupMutation,
} from '@/hooks/groups/groupApi';
import { useGroupChat } from '@/hooks/groups/useGroupChat';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import Button from '@/components/Button/Button';
import MessageComposer from '@/widgets/MessageComposer/MessageComposer';
import GroupMessageBubble from '@/widgets/GroupMessageBubble/GroupMessageBubble';
import './GroupDetail.scss';

/**
 * Group detail page — shows the group header, member sidebar, live chat thread,
 * and a message composer. Handles join / leave transitions.
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

  // ── Real-time chat (only when member) ────────────────────────────────────
  const socket = useSocket();
  const { messages, isFetching: msgFetching, groupError, typingUserIds, sendMessage, onType } =
    useGroupChat(isMember ? socket : null, isMember ? groupId : null);

  const threadEndRef = useRef(null);
  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── Join / Leave ─────────────────────────────────────────────────────────
  const [joinGroup, { isLoading: isJoining, error: joinError }] = useJoinGroupMutation();
  const [leaveGroup, { isLoading: isLeaving, error: leaveError }] = useLeaveGroupMutation();

  const handleJoin = async () => {
    try {
      await joinGroup(groupId).unwrap();
    } catch {
      // joinError shown below
    }
  };

  const handleLeave = async () => {
    try {
      await leaveGroup(groupId).unwrap();
      navigate('/groups');
    } catch {
      // leaveError shown below
    }
  };

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
  );
}
