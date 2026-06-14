import { useGetRecommendationsQuery, useDismissRecommendationMutation } from '@/hooks/ai/aiApi';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import RecommendationCard from '@/widgets/RecommendationCard/RecommendationCard';

const ERROR_MESSAGES = {
  AI_RATE_LIMIT_EXCEEDED: "You've reached today's AI usage limit. Try again tomorrow.",
  AI_SERVICE_ERROR: 'The AI assistant is temporarily unavailable. Please try again shortly.',
};

// While the server is generating recommendations in the background (202 +
// status: 'generating'), poll until the warmed cache comes back.
const GENERATING_POLL_MS = 4000;

export default function RecommendationsTab() {
  // Read the latest response first so we can decide whether to keep polling.
  const { data: peek } = useGetRecommendationsQuery();
  const generating = peek?.status === 'generating';

  const { data, isLoading, error } = useGetRecommendationsQuery(undefined, {
    pollingInterval: generating ? GENERATING_POLL_MS : 0,
  });
  const [dismissRecommendation, { isLoading: dismissing }] = useDismissRecommendationMutation();

  // Initial load, or the server is still building the shortlist in the worker.
  if (isLoading || data?.status === 'generating') {
    return <p className="py-8 text-center text-sm text-gray-500">Finding good matches for you…</p>;
  }

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
