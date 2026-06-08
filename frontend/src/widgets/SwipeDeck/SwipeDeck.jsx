import { AnimatePresence } from 'framer-motion';
import SwipeCard from '@/widgets/SwipeCard/SwipeCard';
import './SwipeDeck.scss';

export default function SwipeDeck({ profiles, isFetching, onSwipe }) {
  const topProfile = profiles[0];

  return (
    <>
      <div className="dc-swipe-deck">
        <AnimatePresence>
          {profiles.length === 0 && !isFetching && (
            <div className="dc-swipe-deck-empty">
              <p className="text-lg font-medium">No more profiles right now</p>
              <p className="text-sm mt-1">Check back later for new developers</p>
            </div>
          )}
          {profiles.slice(0, 3).map((profile, i) => (
            <SwipeCard
              key={profile._id}
              profile={profile}
              isTop={i === 0}
              onSwipe={(status) => onSwipe(status, profile._id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {topProfile && (
        <div className="dc-swipe-deck-actions">
          <button
            className="dc-swipe-deck-action dc-swipe-deck-action--pass"
            onClick={() => onSwipe('ignored', topProfile._id)}
            aria-label="Pass"
          >
            ✕
          </button>
          <button
            className="dc-swipe-deck-action dc-swipe-deck-action--like"
            onClick={() => onSwipe('interested', topProfile._id)}
            aria-label="Interested"
          >
            ♥
          </button>
        </div>
      )}
    </>
  );
}
