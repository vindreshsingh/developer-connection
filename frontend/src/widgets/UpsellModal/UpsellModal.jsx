import { Link } from 'react-router-dom';
import Button from '@/components/Button/Button';

const FEATURE_COPY = {
  SWIPE_LIMIT_REACHED: {
    title: "You've hit today's swipe limit",
    body: 'Free accounts can send a limited number of connection requests per day. Upgrade to Premium for unlimited swipes.',
  },
  PREMIUM_REQUIRED: {
    title: 'This is a Premium feature',
    body: 'Upgrade to Premium to unlock advanced filters, priority group calls, and the AI developer assistant.',
  },
  AI_RATE_LIMIT_EXCEEDED: {
    title: "You've reached today's AI usage limit",
    body: 'The AI assistant has a daily usage cap to keep things fair for everyone. Please try again tomorrow.',
  },
};

// Shown whenever a request fails with `PREMIUM_REQUIRED` or
// `SWIPE_LIMIT_REACHED` — `reason` is the backend error code.
export default function UpsellModal({ reason, onClose }) {
  if (!reason) return null;

  const copy = FEATURE_COPY[reason] || FEATURE_COPY.PREMIUM_REQUIRED;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4" onClick={onClose}>
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-8 text-center opacity-0 [animation:dc-fade-in-up_0.25s_ease_forwards]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="absolute right-3 top-3 border-none bg-transparent text-2xl leading-none text-gray-400 hover:text-gray-600"
          aria-label="Close"
          onClick={onClose}
        >
          ×
        </button>

        <h2 className="mb-2 text-xl font-extrabold text-gray-900">{copy.title}</h2>
        <p className="mb-6 text-[0.9rem] text-gray-500">{copy.body}</p>

        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={onClose}>
            Not now
          </Button>
          <Link to="/pricing" onClick={onClose}>
            <Button>View Premium plans</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
