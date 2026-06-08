import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useGetFeedQuery, useSendRequestMutation } from '../store/api';
import SwipeCard from '../components/SwipeCard';

export default function Feed() {
  const [page, setPage] = useState(1);
  const [dismissed, setDismissed] = useState(() => new Set());
  const { data, isFetching, error } = useGetFeedQuery(page);
  const [sendRequest] = useSendRequestMutation();

  const profiles = useMemo(
    () => (data?.data || []).filter((p) => !dismissed.has(p._id)),
    [data, dismissed]
  );

  // prefetch the next page once the current deck is running low
  useEffect(() => {
    if (!isFetching && profiles.length <= 2 && data?.pagination?.hasNextPage) {
      setPage((p) => p + 1);
    }
  }, [profiles.length, isFetching, data, page]);

  const handleSwipe = (status, userId) => {
    setDismissed((prev) => new Set(prev).add(userId));
    sendRequest({ status, toUserId: userId });
  };

  return (
    <div className="max-w-md mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Discover</h1>
      <p className="text-gray-500 text-sm mb-6">Swipe right to connect, left to pass</p>

      {error && <p className="text-red-500 text-sm mb-4">{error.data?.error || 'Could not load feed'}</p>}

      <div className="relative h-[520px]">
        <AnimatePresence>
          {profiles.length === 0 && !isFetching && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white rounded-2xl border border-dashed border-gray-300 text-gray-400">
              <p className="text-lg font-medium">No more profiles right now</p>
              <p className="text-sm mt-1">Check back later for new developers</p>
            </div>
          )}
          {profiles.slice(0, 3).map((p, i) => (
            <SwipeCard
              key={p._id}
              user={p}
              isTop={i === 0}
              onSwipe={(status) => handleSwipe(status, p._id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {profiles[0] && (
        <div className="flex justify-center gap-6 mt-6">
          <button
            onClick={() => handleSwipe('ignored', profiles[0]._id)}
            className="w-14 h-14 rounded-full bg-white border-2 border-red-400 text-red-500 text-2xl shadow flex items-center justify-center hover:scale-105 transition"
            aria-label="Pass"
          >
            ✕
          </button>
          <button
            onClick={() => handleSwipe('interested', profiles[0]._id)}
            className="w-14 h-14 rounded-full bg-white border-2 border-green-400 text-green-500 text-2xl shadow flex items-center justify-center hover:scale-105 transition"
            aria-label="Interested"
          >
            ♥
          </button>
        </div>
      )}
    </div>
  );
}
