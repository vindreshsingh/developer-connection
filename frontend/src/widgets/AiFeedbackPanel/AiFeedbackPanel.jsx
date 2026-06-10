import { useGetProfileFeedbackMutation } from '@/hooks/ai/aiApi';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import Button from '@/components/Button/Button';
import './AiFeedbackPanel.scss';

export default function AiFeedbackPanel() {
  const [getProfileFeedback, { data, isLoading, error }] = useGetProfileFeedbackMutation();
  const feedback = data?.data?.feedback;

  return (
    <div className="dc-ai-feedback-panel">
      <div className="dc-ai-feedback-panel-header">
        <div>
          <h2 className="dc-ai-feedback-panel-heading">AI Profile Feedback</h2>
          <p className="dc-ai-feedback-panel-subheading">Get tips from an AI coach on making your profile stand out</p>
        </div>
        <Button variant="outline" onClick={() => getProfileFeedback()} disabled={isLoading}>
          {isLoading ? 'Analyzing...' : feedback ? 'Regenerate' : 'Get feedback'}
        </Button>
      </div>

      {error && (
        <p className="dc-ai-feedback-panel-error">{getApiErrorMessage(error, 'Could not get feedback')}</p>
      )}
      {feedback && <p className="dc-ai-feedback-panel-text">{feedback}</p>}
    </div>
  );
}
