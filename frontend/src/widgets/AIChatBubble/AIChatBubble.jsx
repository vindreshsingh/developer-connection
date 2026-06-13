import './AIChatBubble.scss';

export default function AIChatBubble({ role, content }) {
  return (
    <div className={`dc-ai-chat-bubble dc-ai-chat-bubble--${role}`}>
      <p className="dc-ai-chat-bubble-content">{content}</p>
    </div>
  );
}
