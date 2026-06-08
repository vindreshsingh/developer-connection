import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AnimatePresence } from 'framer-motion';
import { useInjectReducer } from '@/commonUtils/useInjectReducer';
import { useFeed } from '@/hooks/feed/useFeed';
import { useSendRequest } from '@/hooks/feed/useSendRequest';
import { useModeration } from '@/hooks/moderation/useModeration';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import FormInput from '@/components/FormInput/FormInput';
import Button from '@/components/Button/Button';
import SwipeDeck from '@/widgets/SwipeDeck/SwipeDeck';
import reducer, { profileDismissed } from './reducer';
import { parseFeedPage } from './parser';
import './Feed.scss';

export default function FeedContainer() {
  useInjectReducer('feed', reducer);

  const dispatch = useDispatch();
  const dismissed = useSelector((state) => state.feed?.dismissed ?? []);
  const { data, isFetching, error, loadNextPage, skills, setSkillsFilter } = useFeed();
  const { sendRequest } = useSendRequest();
  const { blockUser, reportUser } = useModeration();

  const [skillsInput, setSkillsInput] = useState(skills);

  const profiles = parseFeedPage(data, dismissed);

  useEffect(() => {
    if (!isFetching && profiles.length <= 2 && data?.pagination?.hasNextPage) {
      loadNextPage();
    }
  }, [profiles.length, isFetching, data, loadNextPage]);

  const handleSwipe = (status, userId) => {
    dispatch(profileDismissed(userId));
    sendRequest(status, userId);
  };

  const handleApplyFilter = (e) => {
    e.preventDefault();
    setSkillsFilter(skillsInput.trim());
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
    <div className="dc-feed">
      <h1 className="dc-feed-heading">Discover</h1>
      <p className="dc-feed-subheading">Swipe right to connect, left to pass</p>

      <form className="dc-feed-filter" onSubmit={handleApplyFilter}>
        <FormInput
          placeholder="Filter by skills (e.g. react, node)"
          value={skillsInput}
          onChange={(e) => setSkillsInput(e.target.value)}
          wrapperClassName="dc-feed-filter-input"
        />
        <Button type="submit" variant="outline">
          Apply
        </Button>
      </form>

      {error && (
        <p className="dc-feed-error">{getApiErrorMessage(error, 'Could not load feed')}</p>
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
    </div>
  );
}
