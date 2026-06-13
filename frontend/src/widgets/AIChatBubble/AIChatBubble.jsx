import { classNames } from '@/commonUtils/classNames';

export default function AIChatBubble({ role, content }) {
  return (
    <div
      className={classNames(
        'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
        role === 'assistant' && 'self-start rounded-bl-md bg-gray-100 text-gray-900',
        role === 'user' && 'self-end rounded-br-md bg-gradient-to-br from-purple-600 to-pink-500 text-white',
      )}
    >
      <p className="m-0">{content}</p>
    </div>
  );
}
