import { motion, useMotionValue, useTransform } from 'framer-motion';
import Tag from '@/components/Tag/Tag';
import MatchInsight from '@/widgets/MatchInsight/MatchInsight';
import './SwipeCard.scss';

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
      className="dc-swipe-card"
      style={{ x, rotate }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ x: x.get() > 0 ? 400 : -400, opacity: 0, transition: { duration: 0.3 } }}
    >
      {(onBlock || onReport) && (
        <div className="dc-swipe-card-moderation">
          {onReport && (
            <button
              type="button"
              className="dc-swipe-card-moderation-action"
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
              className="dc-swipe-card-moderation-action"
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
      <div className="dc-swipe-card-photo">
        {profile.photoUrl ? (
          <img src={profile.photoUrl} alt={profile.firstName} className="w-full h-full object-cover" />
        ) : (
          <div className="dc-swipe-card-placeholder">
            {profile.initials}
          </div>
        )}
        <motion.div style={{ opacity: likeOpacity }} className="dc-swipe-card-badge dc-swipe-card-badge--like">
          INTERESTED
        </motion.div>
        <motion.div style={{ opacity: nopeOpacity }} className="dc-swipe-card-badge dc-swipe-card-badge--nope">
          PASS
        </motion.div>
      </div>
      <div className="dc-swipe-card-body">
        <h3 className="dc-swipe-card-name">
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
        {isTop && <MatchInsight userId={profile._id} />}
      </div>
    </motion.div>
  );
}
