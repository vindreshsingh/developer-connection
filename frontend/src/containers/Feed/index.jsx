import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AnimatePresence } from 'framer-motion';
import { useInjectReducer } from '@/commonUtils/useInjectReducer';
import { useFeed } from '@/hooks/feed/useFeed';
import { useSendRequest } from '@/hooks/feed/useSendRequest';
import { useModeration } from '@/hooks/moderation/useModeration';
import { useCurrentUser } from '@/hooks/auth/useCurrentUser';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import FormInput from '@/components/FormInput/FormInput';
import Button from '@/components/Button/Button';
import SwipeDeck from '@/widgets/SwipeDeck/SwipeDeck';
import UpsellModal from '@/widgets/UpsellModal/UpsellModal';
import AIPicks from '@/widgets/AIPicks/AIPicks';
import { classNames } from '@/commonUtils/classNames';
import reducer, { profileDismissed } from './reducer';
import { parseFeedPage } from './parser';

const EXPERIENCE_LEVELS = [
  { value: '', label: 'Any experience' },
  { value: 'junior', label: 'Junior (< 2 yrs)' },
  { value: 'mid', label: 'Mid-level (2-5 yrs)' },
  { value: 'senior', label: 'Senior (5+ yrs)' },
];

export default function FeedContainer() {
  useInjectReducer('feed', reducer);

  const dispatch = useDispatch();
  const dismissed = useSelector((state) => state.feed?.dismissed ?? []);
  const { user } = useCurrentUser();
  const { data, isFetching, error, loadNextPage, skills, experienceLevel, setSkillsFilter, setExperienceLevelFilter } = useFeed();
  const { sendRequest } = useSendRequest();
  const { blockUser, reportUser } = useModeration();

  const [skillsInput, setSkillsInput] = useState(skills);
  const [upsellReason, setUpsellReason] = useState(null);

  const profiles = parseFeedPage(data, dismissed);

  useEffect(() => {
    if (!isFetching && profiles.length <= 2 && data?.pagination?.hasNextPage) {
      loadNextPage();
    }
  }, [profiles.length, isFetching, data, loadNextPage]);

  const handleSwipe = async (status, userId) => {
    dispatch(profileDismissed(userId));
    const result = await sendRequest(status, userId);
    if (result.error?.data?.error === 'SWIPE_LIMIT_REACHED') {
      setUpsellReason('SWIPE_LIMIT_REACHED');
    }
  };

  const handleApplyFilter = (e) => {
    e.preventDefault();
    setSkillsFilter(skillsInput.trim());
  };

  const handleExperienceLevelChange = (e) => {
    if (!user?.isPremium) {
      setUpsellReason('PREMIUM_REQUIRED');
      return;
    }
    setExperienceLevelFilter(e.target.value);
  };

  const handleBlock = (userId) => {
    if (!window.confirm('Block this developer? You will no longer see each other.')) return;
    dispatch(profileDismissed(userId));
    blockUser(userId);
  };

  const handleReport = (userId) => {
    const reason = window.prompt('Tell us why you are reporting this profile:');
    if (!reason || !reason.trim()) return;
    dispatch(profileDismissed(userId));
    reportUser(userId, reason.trim());
  };

  return (
    <div className="mx-auto max-w-[28rem] px-3 py-5 sm:px-4 sm:py-8">
      <h1 className="mb-1 text-2xl font-bold text-gray-900 opacity-0 [animation:dc-fade-in-up_0.45s_ease_forwards]">Discover</h1>
      <p className="mb-6 text-sm text-gray-500 opacity-0 [animation:dc-fade-in-up_0.45s_ease_forwards] [animation-delay:0.05s]">Swipe right to connect, left to pass</p>

      <AIPicks />

      <form
        className="mb-5 flex flex-col items-start gap-2 opacity-0 [animation:dc-fade-in-up_0.45s_ease_forwards] [animation-delay:0.1s] sm:flex-row"
        onSubmit={handleApplyFilter}
      >
        <FormInput
          placeholder="Filter by skills (e.g. react, node)"
          value={skillsInput}
          onChange={(e) => setSkillsInput(e.target.value)}
          wrapperClassName="w-full flex-1"
        />
        <Button type="submit" variant="outline" className="w-full sm:w-auto">
          Apply
        </Button>

        <select
          className={classNames(
            'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 sm:w-auto',
            !user?.isPremium && 'cursor-pointer border-purple-600 text-purple-600',
          )}
          value={experienceLevel}
          onChange={handleExperienceLevelChange}
          title={!user?.isPremium ? 'Upgrade to Premium to filter by experience level' : undefined}
        >
          {EXPERIENCE_LEVELS.map((level) => (
            <option key={level.value} value={level.value}>
              {!user?.isPremium && level.value ? `🔒 ${level.label}` : level.label}
            </option>
          ))}
        </select>
      </form>

      {error && (
        <p className="mb-4 text-sm text-red-500">{getApiErrorMessage(error, 'Could not load feed')}</p>
      )}

      <AnimatePresence>
        <SwipeDeck
          profiles={profiles}
          isFetching={isFetching}
          onSwipe={handleSwipe}
          onBlock={handleBlock}
          onReport={handleReport}
        />
      </AnimatePresence>

      <UpsellModal reason={upsellReason} onClose={() => setUpsellReason(null)} />
    </div>
  );
}
