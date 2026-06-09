/**
 * CallSummaryCard — system-message style card shown in chat threads after a call ends.
 *
 * Rendered inline in both 1:1 `MessageBubble` and group `GroupMessageBubble`
 * when `message.type === 'call_summary'`.  Displayed centred, not as a bubble,
 * so it reads as a neutral timeline event rather than a participant's message.
 *
 * @param {{ message: object }} props
 *   message.callSummary: { duration, status, callType }
 *   message.createdAt:   ISO string
 */

import { formatTime } from '@/commonUtils/formatDate';
import './CallSummaryCard.scss';

// ── Duration formatter ────────────────────────────────────────────────────────

const formatDuration = (seconds) => {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(' ');
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function CallSummaryCard({ message }) {
  const cs = message?.callSummary ?? {};
  const isGroup   = cs.callType === 'group';
  const duration  = formatDuration(cs.duration);
  const timeStamp = formatTime(message.createdAt);

  const label = isGroup ? 'Group video call' : 'Video call';

  return (
    <div className="dc-call-summary-card" role="status" aria-label={label}>
      <div className="dc-call-summary-card-inner">
        <span className="dc-call-summary-card-icon" aria-hidden="true">📹</span>
        <span className="dc-call-summary-card-label">{label}</span>

        {duration && (
          <>
            <span className="dc-call-summary-card-sep" aria-hidden="true">·</span>
            <span className="dc-call-summary-card-duration">{duration}</span>
          </>
        )}

        <span className="dc-call-summary-card-sep" aria-hidden="true">·</span>
        <span className="dc-call-summary-card-time">{timeStamp}</span>
      </div>
    </div>
  );
}
