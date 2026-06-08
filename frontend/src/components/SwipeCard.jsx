import { motion, useMotionValue, useTransform } from 'framer-motion';

export default function SwipeCard({ user, onSwipe, isTop }) {
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
      className="absolute inset-0 bg-white rounded-2xl shadow-xl overflow-hidden cursor-grab active:cursor-grabbing select-none"
      style={{ x, rotate }}
      drag={isTop ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ x: x.get() > 0 ? 400 : -400, opacity: 0, transition: { duration: 0.3 } }}
    >
      <div className="relative h-3/4 bg-gray-200">
        {user.photoUrl ? (
          <img src={user.photoUrl} alt={user.firstName} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-6xl font-bold text-gray-400 bg-gradient-to-br from-pink-100 to-purple-100">
            {user.firstName?.[0]}
            {user.lastName?.[0]}
          </div>
        )}
        <motion.div
          style={{ opacity: likeOpacity }}
          className="absolute top-6 left-6 border-4 border-green-500 text-green-500 font-extrabold text-2xl px-3 py-1 rounded-lg rotate-[-15deg]"
        >
          INTERESTED
        </motion.div>
        <motion.div
          style={{ opacity: nopeOpacity }}
          className="absolute top-6 right-6 border-4 border-red-500 text-red-500 font-extrabold text-2xl px-3 py-1 rounded-lg rotate-[15deg]"
        >
          PASS
        </motion.div>
      </div>
      <div className="p-4 text-left">
        <h3 className="text-xl font-bold text-gray-900">
          {user.firstName} {user.lastName}
          {user.age ? <span className="font-normal text-gray-500">, {user.age}</span> : null}
        </h3>
        {user.bio && <p className="text-sm text-gray-600 mt-1 line-clamp-2">{user.bio}</p>}
        {user.skills?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {user.skills.slice(0, 5).map((skill) => (
              <span key={skill} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
                {skill}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
