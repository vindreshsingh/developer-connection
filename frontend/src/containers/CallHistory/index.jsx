import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetCallHistoryQuery } from '@/hooks/call/callApi';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import Avatar from '@/components/Avatar/Avatar';
import Button from '@/components/Button/Button';
import { parseCallHistory, parseCallHistoryPagination, parseCallHistoryError } from './parser';
import './CallHistory.scss';

const STATUS_LABELS = {
  ringing: 'Ringing',
  active: 'Active',
  ended: 'Ended',
  missed: 'Missed',
  declined: 'Declined',
};

export default function CallHistoryContainer() {
  const { user } = useCurrentUser();
  const [page, setPage] = useState(1);
  const { data, isFetching, error } = useGetCallHistoryQuery(page);

  const calls = parseCallHistory(data, user?._id);
  const pagination = parseCallHistoryPagination(data);

  return (
    <div className="dc-call-history">
      <h1 className="dc-call-history-heading">Call History</h1>

      {error && <p className="dc-call-history-error">{parseCallHistoryError(error)}</p>}

      {isFetching ? (
        <p className="dc-call-history-loading">Loading calls…</p>
      ) : calls.length === 0 ? (
        <p className="dc-call-history-empty">No calls yet.</p>
      ) : (
        <ul className="dc-call-history-list">
          {calls.map((call) => (
            <li key={call._id} className="dc-call-history-item">
              {call.type === '1:1' && call.otherUser ? (
                <Avatar
                  photoUrl={call.otherUser.photoUrl}
                  initials={call.otherUser.initials}
                  size="sm"
                />
              ) : (
                <span className="dc-call-history-icon">👥</span>
              )}

              <div className="dc-call-history-info">
                <span className="dc-call-history-name">
                  {call.type === '1:1'
                    ? call.otherUser?.fullName ?? 'Unknown user'
                    : call.groupId
                      ? <Link to={`/groups/${call.groupId}`}>Group call</Link>
                      : 'Group call'}
                </span>
                <span className="dc-call-history-meta">
                  {call.isOutgoing ? 'Outgoing' : 'Incoming'} · {new Date(call.createdAt).toLocaleString()}
                  {call.duration && ` · ${call.duration}`}
                </span>
              </div>

              <span className={`dc-call-history-status dc-call-history-status--${call.status}`}>
                {STATUS_LABELS[call.status] ?? call.status}
              </span>
            </li>
          ))}
        </ul>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="dc-call-history-pagination">
          <Button
            variant="ghost"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Prev
          </Button>
          <span className="dc-call-history-pagination-info">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="ghost"
            disabled={!pagination.hasNextPage || isFetching}
            onClick={() => setPage((p) => p + 1)}
          >
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
