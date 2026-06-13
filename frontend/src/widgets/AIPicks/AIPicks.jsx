import { Link } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import { useGetRecommendationsQuery } from '@/hooks/ai/aiApi';

const MAX_PICKS = 3;

// Premium-only teaser shown on the Feed: a couple of AI-suggested
// connections with a link through to the full Recommendations tab.
export default function AIPicks() {
  const { user } = useCurrentUser();
  const { data, isFetching, error } = useGetRecommendationsQuery(undefined, { skip: !user?.isPremium });

  if (!user?.isPremium || isFetching || error) return null;

  const picks = (data?.data || []).slice(0, MAX_PICKS);
  if (picks.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-gray-100 bg-[linear-gradient(180deg,rgba(147,51,234,0.05),#ffffff)] p-4 px-5 opacity-0 [animation:dc-fade-in-up_0.45s_ease_forwards] [animation-delay:0.05s]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[0.95rem] font-bold text-gray-900">AI Picks for you</h2>
        <Link to="/ai-assistant" className="text-[0.8125rem] font-semibold text-purple-600 no-underline">
          See all
        </Link>
      </div>

      <div className="flex flex-col gap-2.5">
        {picks.map(({ user: pick, reason }) => (
          <Link key={pick._id} to={`/users/${pick._id}`} className="flex items-center gap-3 text-inherit no-underline">
            <img
              className="h-10 w-10 flex-shrink-0 rounded-full bg-gray-100 object-cover"
              src={pick.photoUrl || '/default-avatar.png'}
              alt={`${pick.firstName} ${pick.lastName ?? ''}`}
            />
            <div className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold text-gray-900">
                {pick.firstName} {pick.lastName}
              </span>
              <span className="overflow-hidden text-xs text-gray-500 text-ellipsis whitespace-nowrap">{reason}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
