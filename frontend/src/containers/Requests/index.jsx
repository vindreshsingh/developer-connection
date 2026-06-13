import { useDispatch, useSelector } from 'react-redux';
import { useInjectReducer } from '@/commonUtils/useInjectReducer';
import { useRequests } from '@/hooks/requests/useRequests';
import RequestCard from '@/widgets/RequestCard/RequestCard';
import { classNames } from '@/commonUtils/classNames';
import reducer, { tabChanged } from './reducer';
import { parsePendingRequests, parseSentRequests, parseRequestsError } from './parser';

const TAB_BASE = 'cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-150';

export default function RequestsContainer() {
  useInjectReducer('requests', reducer);

  const dispatch = useDispatch();
  const activeTab = useSelector((state) => state.requests?.activeTab ?? 'pending');
  const { pendingRaw, sentRaw, pendingError, sentError, review } = useRequests();

  const pending = parsePendingRequests(pendingRaw);
  const sent = parseSentRequests(sentRaw);
  const error = parseRequestsError(pendingError, sentError);

  return (
    <div className="mx-auto max-w-[42rem] px-3 py-5 sm:px-4 sm:py-8">
      <h1 className="mb-4 text-2xl font-bold text-gray-900 opacity-0 [animation:dc-fade-in-up_0.45s_ease_forwards]">Requests</h1>

      <div className="mb-5 flex gap-2 opacity-0 [animation:dc-fade-in-up_0.45s_ease_forwards] [animation-delay:0.05s]">
        <button
          className={classNames(TAB_BASE, activeTab === 'pending' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
          onClick={() => dispatch(tabChanged('pending'))}
        >
          Received ({pending.length})
        </button>
        <button
          className={classNames(TAB_BASE, activeTab === 'sent' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
          onClick={() => dispatch(tabChanged('sent'))}
        >
          Sent ({sent.length})
        </button>
      </div>

      {error && <p className="mb-3 text-sm text-red-500">{error}</p>}

      <div className="flex flex-col gap-3">
        {activeTab === 'pending' &&
          (pending.length === 0 ? (
            <p className="text-sm text-gray-400">No pending requests.</p>
          ) : (
            pending.map(({ requestId, person }) => (
              <RequestCard
                key={requestId}
                person={person}
                actions={[
                  { label: 'Decline', variant: 'outline', onClick: () => review(requestId, 'rejected') },
                  { label: 'Accept', variant: 'primary', onClick: () => review(requestId, 'accepted') },
                ]}
              />
            ))
          ))}

        {activeTab === 'sent' &&
          (sent.length === 0 ? (
            <p className="text-sm text-gray-400">You haven't sent any requests yet.</p>
          ) : (
            sent.map(({ requestId, person, status }) => (
              <RequestCard
                key={requestId}
                person={person}
                statusBadge={status}
              />
            ))
          ))}
      </div>
    </div>
  );
}
