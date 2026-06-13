import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetCallHistoryQuery } from '@/hooks/call/callApi';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import Avatar from '@/components/Avatar/Avatar';
import Button from '@/components/Button/Button';
import { classNames } from '@/commonUtils/classNames';
import { parseCallHistory, parseCallHistoryPagination, parseCallHistoryError } from './parser';

const STATUS_LABELS = {
  ringing: 'Ringing',
  active: 'Active',
  ended: 'Ended',
  missed: 'Missed',
  declined: 'Declined',
};

const STATUS_CLASSES = {
  ended: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-600',
  ringing: 'bg-yellow-100 text-yellow-600',
  missed: 'bg-red-100 text-red-600',
  declined: 'bg-red-100 text-red-600',
};

export default function CallHistoryContainer() {
  const { user } = useCurrentUser();
  const [page, setPage] = useState(1);
  const { data, isFetching, error } = useGetCallHistoryQuery(page);

  const calls = parseCallHistory(data, user?._id);
  const pagination = parseCallHistoryPagination(data);

  return (
    <div className="mx-auto max-w-[36rem] px-3 py-5 sm:px-4 sm:py-8">
      <h1 className="mb-4 text-2xl font-bold text-gray-900 opacity-0 [animation:dc-fade-in-up_0.45s_ease_forwards]">Call History</h1>

      {error && <p className="mb-3 text-sm text-red-500">{parseCallHistoryError(error)}</p>}

      {isFetching ? (
        <p className="text-sm text-gray-400">Loading calls…</p>
      ) : calls.length === 0 ? (
        <p className="text-sm text-gray-400">No calls yet.</p>
      ) : (
        <ul className="m-0 flex flex-col gap-2.5 p-0 list-none">
          {calls.map((call) => (
            <li
              key={call._id}
              className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 transition-[transform,box-shadow] duration-200 ease hover:-translate-y-[3px] hover:shadow-[0_12px_24px_-12px_rgba(147,51,234,0.35)]"
            >
              {call.type === '1:1' && call.otherUser ? (
                <Avatar
                  photoUrl={call.otherUser.photoUrl}
                  initials={call.otherUser.initials}
                  size="sm"
                />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gray-100 text-2xl">👥</span>
              )}

              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[0.9375rem] font-medium text-gray-900 [&_a]:text-inherit [&_a]:underline">
                  {call.type === '1:1'
                    ? call.otherUser?.fullName ?? 'Unknown user'
                    : call.groupId
                      ? <Link to={`/groups/${call.groupId}`}>Group call</Link>
                      : 'Group call'}
                </span>
                <span className="mt-0.5 text-xs text-gray-500">
                  {call.isOutgoing ? 'Outgoing' : 'Incoming'} · {new Date(call.createdAt).toLocaleString()}
                  {call.duration && ` · ${call.duration}`}
                </span>
              </div>

              <span className={classNames('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold capitalize', STATUS_CLASSES[call.status])}>
                {STATUS_LABELS[call.status] ?? call.status}
              </span>
            </li>
          ))}
        </ul>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <Button
            variant="ghost"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            ← Prev
          </Button>
          <span className="text-sm text-gray-500">
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
