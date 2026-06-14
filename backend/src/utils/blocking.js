import User from '../models/user.js';

/** Returns the ObjectIds to exclude for `user`: users they blocked + users who blocked them. */
export const getExcludedUserIds = async (user) => {
  const blockedMe = await User.find({ blockedUsers: user._id }).select('_id');
  return [...user.blockedUsers, ...blockedMe.map((u) => u._id)];
};
