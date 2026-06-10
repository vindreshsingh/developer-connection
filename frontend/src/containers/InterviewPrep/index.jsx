import { useInterviewPrepChat } from '@/hooks/ai/useInterviewPrepChat';
import InterviewPrepChat from '@/widgets/InterviewPrepChat/InterviewPrepChat';
import Spinner from '@/components/Spinner/Spinner';
import './InterviewPrep.scss';

export default function InterviewPrepContainer() {
  const { messages, loadingHistory, isStreaming, error, sendMessage } = useInterviewPrepChat();

  return (
    <div className="dc-interview-prep">
      <h1 className="dc-interview-prep-heading">Interview Prep</h1>
      <p className="dc-interview-prep-subheading">Practice with an AI interview coach</p>

      {loadingHistory ? (
        <Spinner />
      ) : (
        <InterviewPrepChat messages={messages} isStreaming={isStreaming} error={error} onSend={sendMessage} />
      )}
    </div>
  );
}
