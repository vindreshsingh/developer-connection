import { useDispatch, useSelector } from 'react-redux';
import { useInjectReducer } from '@/commonUtils/useInjectReducer';
import { useRequests } from '@/hooks/requests/useRequests';
import RequestCard from '@/widgets/RequestCard/RequestCard';
import reducer, { tabChanged } from './reducer';
import { parsePendingRequests, parseSentRequests, parseRequestsError } from './parser';
import './Requests.scss';

export default function RequestsContainer() {
  useInjectReducer('requests', reducer);

  const dispatch = useDispatch();
  const activeTab = useSelector((state) => state.requests?.activeTab ?? 'pending');
  const { pendingRaw, sentRaw, pendingError, sentError, review } = useRequests();

  const pending = parsePendingRequests(pendingRaw);
  const sent = parseSentRequests(sentRaw);
  const error = parseRequestsError(pendingError, sentError);

  return (
    <div className="dc-requests">
      <h1 className="dc-requests-heading">Requests</h1>

      <div className="dc-requests-tabs">
        <button
          className={`dc-requests-tab dc-requests-tab--${activeTab === 'pending' ? 'active' : 'inactive'}`}
          onClick={() => dispatch(tabChanged('pending'))}
        >
          Received ({pending.length})
        </button>
        <button
          className={`dc-requests-tab dc-requests-tab--${activeTab === 'sent' ? 'active' : 'inactive'}`}
          onClick={() => dispatch(tabChanged('sent'))}
        >
          Sent ({sent.length})
        </button>
      </div>

      {error && <p className="dc-requests-error">{error}</p>}

      <div className="dc-requests-list">
        {activeTab === 'pending' &&
          (pending.length === 0 ? (
            <p className="dc-requests-empty">No pending requests.</p>
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
            <p className="dc-requests-empty">You haven't sent any requests yet.</p>
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
