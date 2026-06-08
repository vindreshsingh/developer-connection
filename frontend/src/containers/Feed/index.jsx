import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AnimatePresence } from 'framer-motion';
import { useInjectReducer } from '@/commonUtils/useInjectReducer';
import { useFeed } from '@/hooks/feed/useFeed';
import { useSendRequest } from '@/hooks/feed/useSendRequest';
import { getApiErrorMessage } from '@/commonUtils/apiError';
import SwipeDeck from '@/widgets/SwipeDeck/SwipeDeck';
import reducer, { profileDismissed } from './reducer';
import { parseFeedPage } from './parser';
import './Feed.scss';

export default function FeedContainer() {
  useInjectReducer('feed', reducer);

  const dispatch = useDispatch();
  const dismissed = useSelector((state) => state.feed?.dismissed ?? []);
  const { data, isFetching, error, loadNextPage } = useFeed();
  const { sendRequest } = useSendRequest();

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

  return (
    <div className="dc-feed">
      <h1 className="dc-feed-heading">Discover</h1>
      <p className="dc-feed-subheading">Swipe right to connect, left to pass</p>

      {error && (
        <p className="dc-feed-error">{getApiErrorMessage(error, 'Could not load feed')}</p>
      )}

      <AnimatePresence>
        <SwipeDeck
          profiles={profiles}
          isFetching={isFetching}
          onSwipe={handleSwipe}
        />
      </AnimatePresence>
    </div>
  );
}
