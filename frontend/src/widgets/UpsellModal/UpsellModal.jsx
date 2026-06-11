import { Link } from 'react-router-dom';
import Button from '@/components/Button/Button';
import './UpsellModal.scss';

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
    <div className="dc-upsell-modal-overlay" onClick={onClose}>
      <div className="dc-upsell-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="dc-upsell-modal-close" aria-label="Close" onClick={onClose}>
          ×
        </button>

        <h2 className="dc-upsell-modal-title">{copy.title}</h2>
        <p className="dc-upsell-modal-body">{copy.body}</p>

        <div className="dc-upsell-modal-actions">
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
