import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/Button/Button';
import { classNames } from '@/commonUtils/classNames';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import RecommendationsTab from './RecommendationsTab';
import ResumeFeedbackTab from './ResumeFeedbackTab';
import InterviewPrepTab from './InterviewPrepTab';

const TABS = [
  { key: 'recommendations', label: 'Recommendations' },
  { key: 'resume', label: 'Resume Feedback' },
  { key: 'interview', label: 'Interview Prep' },
];

export default function AIAssistantContainer() {
  const { user } = useCurrentUser();
  const [activeTab, setActiveTab] = useState('recommendations');

  return (
    <div className="mx-auto max-w-[40rem] px-3 py-5 sm:px-4 sm:py-8">
      <h1 className="mb-1 text-2xl font-bold text-gray-900 opacity-0 [animation:dc-fade-in-up_0.45s_ease_forwards]">AI Developer Assistant</h1>
      <p className="mb-6 text-sm text-gray-500 opacity-0 [animation:dc-fade-in-up_0.45s_ease_forwards] [animation-delay:0.05s]">
        Personalized connection picks, resume feedback, and mock interviews powered by AI.
      </p>

      {!user?.isPremium ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-gray-100 p-6 text-gray-700 opacity-0 [animation:dc-fade-in-up_0.45s_ease_forwards] [animation-delay:0.1s] [background:linear-gradient(180deg,rgba(147,51,234,0.05),#ffffff)]">
          <p>The AI Developer Assistant is a Premium feature.</p>
          <Link to="/pricing">
            <Button>View Premium plans</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-5 flex flex-wrap gap-2 opacity-0 [animation:dc-fade-in-up_0.45s_ease_forwards] [animation-delay:0.1s]">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={classNames(
                  'cursor-pointer rounded-full border-none px-4 py-1.5 text-sm font-medium transition-colors duration-150',
                  activeTab === tab.key ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600',
                )}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="opacity-0 [animation:dc-fade-in-up_0.45s_ease_forwards] [animation-delay:0.15s]">
            {activeTab === 'recommendations' && <RecommendationsTab />}
            {activeTab === 'resume' && <ResumeFeedbackTab />}
            {activeTab === 'interview' && <InterviewPrepTab />}
          </div>
        </>
      )}
    </div>
  );
}
