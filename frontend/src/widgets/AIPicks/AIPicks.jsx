import { Link } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import { useGetRecommendationsQuery } from '@/hooks/ai/aiApi';
import './AIPicks.scss';

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
    <div className="dc-ai-picks">
      <div className="dc-ai-picks-header">
        <h2 className="dc-ai-picks-heading">AI Picks for you</h2>
        <Link to="/ai-assistant" className="dc-ai-picks-link">
          See all
        </Link>
      </div>

      <div className="dc-ai-picks-list">
        {picks.map(({ user: pick, reason }) => (
          <Link key={pick._id} to={`/users/${pick._id}`} className="dc-ai-picks-item">
            <img
              className="dc-ai-picks-photo"
              src={pick.photoUrl || '/default-avatar.png'}
              alt={`${pick.firstName} ${pick.lastName ?? ''}`}
            />
            <div className="dc-ai-picks-item-body">
              <span className="dc-ai-picks-name">
                {pick.firstName} {pick.lastName}
              </span>
              <span className="dc-ai-picks-reason">{reason}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
