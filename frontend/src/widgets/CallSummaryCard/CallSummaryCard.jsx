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
    <div className="flex justify-center py-[0.35rem] my-[0.1rem]" role="status" aria-label={label}>
      <div className="inline-flex max-w-[90%] items-center gap-[0.35rem] overflow-hidden whitespace-nowrap rounded-full border border-gray-200 bg-gray-100 px-[0.85rem] py-[0.3rem] text-[0.78rem] text-gray-500">
        <span className="flex-shrink-0 text-[0.85rem]" aria-hidden="true">📹</span>
        <span className="whitespace-nowrap font-medium text-gray-700">{label}</span>

        {duration && (
          <>
            <span className="text-[0.7rem] text-gray-300" aria-hidden="true">·</span>
            <span className="font-medium text-gray-700">{duration}</span>
          </>
        )}

        <span className="text-[0.7rem] text-gray-300" aria-hidden="true">·</span>
        <span className="text-[0.73rem] text-gray-400">{timeStamp}</span>
      </div>
    </div>
  );
}
