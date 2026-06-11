import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '@/components/Button/Button';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import RecommendationsTab from './RecommendationsTab';
import ResumeFeedbackTab from './ResumeFeedbackTab';
import InterviewPrepTab from './InterviewPrepTab';
import './AIAssistant.scss';

const TABS = [
  { key: 'recommendations', label: 'Recommendations' },
  { key: 'resume', label: 'Resume Feedback' },
  { key: 'interview', label: 'Interview Prep' },
];

export default function AIAssistantContainer() {
  const { user } = useCurrentUser();
  const [activeTab, setActiveTab] = useState('recommendations');

  return (
    <div className="dc-ai-assistant">
      <h1 className="dc-ai-assistant-heading">AI Developer Assistant</h1>
      <p className="dc-ai-assistant-subheading">
        Personalized connection picks, resume feedback, and mock interviews powered by AI.
      </p>

      {!user?.isPremium ? (
        <div className="dc-ai-assistant-upsell">
          <p>The AI Developer Assistant is a Premium feature.</p>
          <Link to="/pricing">
            <Button>View Premium plans</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="dc-ai-assistant-tabs">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`dc-ai-assistant-tab dc-ai-assistant-tab--${activeTab === tab.key ? 'active' : 'inactive'}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="dc-ai-assistant-content">
            {activeTab === 'recommendations' && <RecommendationsTab />}
            {activeTab === 'resume' && <ResumeFeedbackTab />}
            {activeTab === 'interview' && <InterviewPrepTab />}
          </div>
        </>
      )}
    </div>
  );
}
