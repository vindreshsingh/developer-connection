import { useGetRecommendationsQuery, useDismissRecommendationMutation } from '@/hooks/ai/aiApi';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import RecommendationCard from '@/widgets/RecommendationCard/RecommendationCard';

const ERROR_MESSAGES = {
  AI_RATE_LIMIT_EXCEEDED: "You've reached today's AI usage limit. Try again tomorrow.",
  AI_SERVICE_ERROR: 'The AI assistant is temporarily unavailable. Please try again shortly.',
};

export default function RecommendationsTab() {
  const { data, isFetching, error } = useGetRecommendationsQuery();
  const [dismissRecommendation, { isLoading: dismissing }] = useDismissRecommendationMutation();

  if (isFetching) return <p className="dc-ai-assistant-loading">Finding good matches for you…</p>;

  if (error) {
    const message = ERROR_MESSAGES[error.data?.error] || getApiErrorMessage(error, 'Could not load recommendations');
    return <p className="dc-ai-assistant-error">{message}</p>;
  }

  const recommendations = data?.data || [];

  if (recommendations.length === 0) {
    return <p className="dc-ai-assistant-empty">No new recommendations right now — check back later.</p>;
  }

  return (
    <div className="dc-ai-assistant-recommendations">
      {recommendations.map((rec) => (
        <RecommendationCard
          key={rec.user._id}
          recommendation={rec}
          onDismiss={dismissRecommendation}
          dismissing={dismissing}
        />
      ))}
    </div>
  );
}
