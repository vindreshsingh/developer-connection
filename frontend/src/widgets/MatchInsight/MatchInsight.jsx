import { useGetMatchInsightMutation } from '@/hooks/ai/aiApi';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import './MatchInsight.scss';

export default function MatchInsight({ userId }) {
  const [getMatchInsight, { data, isLoading, error }] = useGetMatchInsightMutation();
  const insight = data?.data?.insight;

  const handleClick = (e) => {
    e.stopPropagation();
    getMatchInsight(userId);
  };

  if (insight) return <p className="dc-match-insight-text">✨ {insight}</p>;

  return (
    <div className="dc-match-insight">
      <button type="button" className="dc-match-insight-button" onClick={handleClick} disabled={isLoading}>
        {isLoading ? 'Thinking...' : '✨ Why connect?'}
      </button>
      {error && <p className="dc-match-insight-error">{getApiErrorMessage(error, 'Could not generate insight')}</p>}
    </div>
  );
}
