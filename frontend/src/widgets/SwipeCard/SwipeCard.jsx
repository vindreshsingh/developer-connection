import { motion, useMotionValue, useTransform } from 'framer-motion';
import Tag from '@/components/Tag/Tag';

export default function SwipeCard({ profile, onSwipe, onBlock, onReport, isTop }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-15, 15]);
  const likeOpacity = useTransform(x, [20, 120], [0, 1]);
  const nopeOpacity = useTransform(x, [-120, -20], [1, 0]);

  const handleDragEnd = (_, info) => {
    if (info.offset.x > 120) onSwipe('interested');
    else if (info.offset.x < -120) onSwipe('ignored');
  };

  return (
    <motion.div
      className="absolute inset-0 cursor-grab select-none overflow-hidden rounded-2xl bg-white shadow-[0_20px_25px_-5px_rgba(0,0,0,0.15),0_8px_10px_-6px_rgba(147,51,234,0.1)] active:cursor-grabbing"
      style={{ x, rotate }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ x: x.get() > 0 ? 400 : -400, opacity: 0, transition: { duration: 0.3 } }}
    >
      {(onBlock || onReport) && (
        <div className="absolute right-3 top-3 z-10 flex gap-1.5">
          {onReport && (
            <button
              type="button"
              className="cursor-pointer rounded-full border-none bg-[rgba(17,24,39,0.55)] px-[0.7rem] py-[0.3rem] text-[0.7rem] font-semibold uppercase tracking-[0.02em] text-white hover:bg-[rgba(17,24,39,0.75)]"
              onClick={(e) => {
                e.stopPropagation();
                onReport();
              }}
            >
              Report
            </button>
          )}
          {onBlock && (
            <button
              type="button"
              className="cursor-pointer rounded-full border-none bg-[rgba(17,24,39,0.55)] px-[0.7rem] py-[0.3rem] text-[0.7rem] font-semibold uppercase tracking-[0.02em] text-white hover:bg-[rgba(17,24,39,0.75)]"
              onClick={(e) => {
                e.stopPropagation();
                onBlock();
              }}
            >
              Block
            </button>
          )}
        </div>
      )}
      <div className="relative h-[75%] bg-gray-200">
        {profile.photoUrl ? (
          <img src={profile.photoUrl} alt={profile.firstName} className="w-full h-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-100 to-purple-100 text-6xl font-bold text-gray-400">
            {profile.initials}
          </div>
        )}
        <motion.div
          style={{ opacity: likeOpacity }}
          className="absolute left-6 top-6 rounded-lg border-4 border-green-500 px-3 py-1 text-2xl font-extrabold text-green-500 [transform:rotate(-15deg)]"
        >
          INTERESTED
        </motion.div>
        <motion.div
          style={{ opacity: nopeOpacity }}
          className="absolute right-6 top-6 rounded-lg border-4 border-red-500 px-3 py-1 text-2xl font-extrabold text-red-500 [transform:rotate(15deg)]"
        >
          PASS
        </motion.div>
      </div>
      <div className="p-4 text-left">
        <h3 className="text-xl font-bold text-gray-900">
          {profile.fullName}
          {profile.age ? <span className="font-normal text-gray-500">, {profile.age}</span> : null}
        </h3>
        {profile.bio && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{profile.bio}</p>}
        {profile.topSkills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {profile.topSkills.map((skill) => (
              <Tag key={skill}>{skill}</Tag>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
