import { AnimatePresence } from 'framer-motion';
import SwipeCard from '@/widgets/SwipeCard/SwipeCard';

export default function SwipeDeck({ profiles, isFetching, onSwipe, onBlock, onReport }) {
  const topProfile = profiles[0];

  return (
    <>
      <div className="relative h-[min(28rem,65vh)] sm:h-[32.5rem]">
        <AnimatePresence>
          {profiles.length === 0 && !isFetching && (
            <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center text-gray-400 opacity-0 [animation:dc-fade-in-up_0.45s_ease_forwards]">
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
              onBlock={onBlock && (() => onBlock(profile._id))}
              onReport={onReport && (() => onReport(profile._id))}
            />
          ))}
        </AnimatePresence>
      </div>

      {topProfile && (
        <div className="mt-6 flex justify-center gap-6">
          <button
            className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-red-400 bg-white text-2xl text-red-500 shadow-[0_1px_3px_rgba(0,0,0,0.1)] transition-[transform,box-shadow] duration-150 ease hover:-translate-y-0.5 hover:scale-[1.08] hover:shadow-[0_8px_16px_-8px_rgba(0,0,0,0.25)] active:scale-[0.96]"
            onClick={() => onSwipe('ignored', topProfile._id)}
            aria-label="Pass"
          >
            ✕
          </button>
          <button
            className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-green-400 bg-white text-2xl text-green-500 shadow-[0_1px_3px_rgba(0,0,0,0.1)] transition-[transform,box-shadow] duration-150 ease hover:-translate-y-0.5 hover:scale-[1.08] hover:shadow-[0_8px_16px_-8px_rgba(0,0,0,0.25)] active:scale-[0.96]"
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
