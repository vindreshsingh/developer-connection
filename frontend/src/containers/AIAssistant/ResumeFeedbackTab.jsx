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
    <div>
      <h3 className="mb-2 text-[0.95rem] font-semibold text-gray-900">{title}</h3>
      <ul className="m-0 pl-5 text-sm leading-[1.6] text-gray-600">
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
    <div>
      <p className="mb-4 text-sm text-gray-500">
        Upload your resume as a PDF (max 5MB) for AI-powered feedback on strengths, areas to improve, and ATS
        readiness.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFileChange}
      />
      <Button onClick={() => fileInputRef.current?.click()} disabled={submitting}>
        {submitting ? 'Analyzing…' : 'Upload resume'}
      </Button>

      {errorMessage && <p className="my-3 text-[0.8125rem] text-red-500">{errorMessage}</p>}

      {latest && (
        <div className="mt-6 flex flex-col gap-5">
          <FeedbackSection title="Strengths" items={latest.feedback.strengths} />
          <FeedbackSection title="Improvements" items={latest.feedback.improvements} />
          <FeedbackSection title="ATS notes" items={latest.feedback.atsNotes} />
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-6 border-t border-gray-200 pt-4">
          <h3 className="mb-2 text-[0.95rem] font-semibold text-gray-900">Past reviews</h3>
          <ul className="m-0 pl-5 text-sm leading-[1.6] text-gray-600">
            {history.map((item) => (
              <li key={item._id}>{new Date(item.createdAt).toLocaleString()}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
