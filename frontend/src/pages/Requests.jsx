import { useState } from 'react';
import {
  useGetPendingRequestsQuery,
  useGetSentRequestsQuery,
  useReviewRequestMutation,
} from '../store/api';

function PersonRow({ person, children }) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm border border-gray-100">
      {person.photoUrl ? (
        <img src={person.photoUrl} alt={person.firstName} className="w-12 h-12 rounded-full object-cover" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 font-bold flex items-center justify-center">
          {person.firstName?.[0]}
          {person.lastName?.[0]}
        </div>
      )}
      <div className="flex-1 text-left">
        <p className="font-semibold text-gray-900">
          {person.firstName} {person.lastName}
        </p>
        {person.bio && <p className="text-sm text-gray-500 line-clamp-1">{person.bio}</p>}
      </div>
      {children}
    </div>
  );
}

export default function Requests() {
  const [tab, setTab] = useState('pending');

  const { data: pendingData, error: pendingError } = useGetPendingRequestsQuery();
  const { data: sentData, error: sentError } = useGetSentRequestsQuery();
  const [reviewRequest] = useReviewRequestMutation();

  const pending = pendingData?.data || [];
  const sent = sentData?.data || [];
  const error = pendingError?.data?.error || sentError?.data?.error || '';

  const review = (requestId, status) => {
    reviewRequest({ requestId, status });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Requests</h1>

      <div className="flex gap-2 mb-5">
        {['pending', 'sent'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
              tab === t ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {t === 'pending' ? `Received (${pending.length})` : `Sent (${sent.length})`}
          </button>
        ))}
      </div>

      {error && <p className="text-red-500 text-sm mb-3">{error}</p>}

      <div className="space-y-3">
        {tab === 'pending' &&
          (pending.length === 0 ? (
            <p className="text-gray-400 text-sm">No pending requests.</p>
          ) : (
            pending.map((r) => (
              <PersonRow key={r._id} person={r.fromUserId}>
                <div className="flex gap-2">
                  <button
                    onClick={() => review(r._id, 'rejected')}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => review(r._id, 'accepted')}
                    className="px-3 py-1.5 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700"
                  >
                    Accept
                  </button>
                </div>
              </PersonRow>
            ))
          ))}

        {tab === 'sent' &&
          (sent.length === 0 ? (
            <p className="text-gray-400 text-sm">You haven't sent any requests yet.</p>
          ) : (
            sent.map((r) => (
              <PersonRow key={r._id} person={r.toUserId}>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${
                    r.status === 'accepted'
                      ? 'bg-green-100 text-green-700'
                      : r.status === 'rejected'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {r.status}
                </span>
              </PersonRow>
            ))
          ))}
      </div>
    </div>
  );
}
