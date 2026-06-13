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

  if (isFetching) return <p className="py-8 text-center text-sm text-gray-500">Finding good matches for you…</p>;

  if (error) {
    const message = ERROR_MESSAGES[error.data?.error] || getApiErrorMessage(error, 'Could not load recommendations');
    return <p className="my-3 text-[0.8125rem] text-red-500">{message}</p>;
  }

  const recommendations = data?.data || [];

  if (recommendations.length === 0) {
    return <p className="py-8 text-center text-sm text-gray-500">No new recommendations right now — check back later.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
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
