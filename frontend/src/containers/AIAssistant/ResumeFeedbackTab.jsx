import { useRef } from 'react';
import { useSubmitResumeMutation, useGetResumeFeedbackHistoryQuery } from '@/hooks/ai/aiApi';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import Button from '@/components/Button/Button';

const ERROR_MESSAGES = {
  AI_RATE_LIMIT_EXCEEDED: "You've reached today's AI usage limit. Try again tomorrow.",
  AI_SERVICE_ERROR: 'The AI assistant is temporarily unavailable. Please try again shortly.',
};

const FeedbackSection = ({ title, items }) => {
  if (!items?.length) return null;
  return (
    <div className="dc-ai-assistant-resume-section">
      <h3 className="dc-ai-assistant-resume-section-title">{title}</h3>
      <ul className="dc-ai-assistant-resume-section-list">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
};

export default function ResumeFeedbackTab() {
  const fileInputRef = useRef(null);
  const [submitResume, { isLoading: submitting, error, data }] = useSubmitResumeMutation();
  const { data: historyData } = useGetResumeFeedbackHistoryQuery(1);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    submitResume(file);
  };

  const errorMessage = error
    ? ERROR_MESSAGES[error.data?.error] || getApiErrorMessage(error, 'Could not analyze resume')
    : null;

  const latest = data?.data;
  const history = historyData?.data || [];

  return (
    <div className="dc-ai-assistant-resume">
      <p className="dc-ai-assistant-resume-intro">
        Upload your resume as a PDF (max 5MB) for AI-powered feedback on strengths, areas to improve, and ATS
        readiness.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="dc-ai-assistant-resume-input"
        onChange={handleFileChange}
      />
      <Button onClick={() => fileInputRef.current?.click()} disabled={submitting}>
        {submitting ? 'Analyzing…' : 'Upload resume'}
      </Button>

      {errorMessage && <p className="dc-ai-assistant-error">{errorMessage}</p>}

      {latest && (
        <div className="dc-ai-assistant-resume-feedback">
          <FeedbackSection title="Strengths" items={latest.feedback.strengths} />
          <FeedbackSection title="Improvements" items={latest.feedback.improvements} />
          <FeedbackSection title="ATS notes" items={latest.feedback.atsNotes} />
        </div>
      )}

      {history.length > 0 && (
        <div className="dc-ai-assistant-resume-history">
          <h3 className="dc-ai-assistant-resume-section-title">Past reviews</h3>
          <ul className="dc-ai-assistant-resume-section-list">
            {history.map((item) => (
              <li key={item._id}>{new Date(item.createdAt).toLocaleString()}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
