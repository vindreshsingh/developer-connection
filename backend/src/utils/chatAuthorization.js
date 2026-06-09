import ConnectionRequest from '../models/connectionRequest.js';
import User from '../models/user.js';

/**
 * Shared "can these two users chat right now?" check, used by every chat REST
 * route AND every socket handler so the authorization boundary is enforced in
 * exactly one place (per the spec's "Always" boundary: never trust client-side
 * gating, never re-implement this check ad hoc).
 *
 * A conversation is allowed only when:
 *   1. There is an `accepted` ConnectionRequest between the two users, AND
 *   2. Neither user has blocked the other.
 *
 * Returns `{ allowed: true }` or `{ allowed: false, reason }`.
 */
export const canUsersChat = async (userAId, userBId) => {
  if (userAId.toString() === userBId.toString()) {
    return { allowed: false, reason: 'Cannot chat with yourself' };
  }

  const [userA, userB, connection] = await Promise.all([
    User.findById(userAId).select('blockedUsers'),
    User.findById(userBId).select('blockedUsers'),
    ConnectionRequest.findOne({
      status: 'accepted',
      $or: [
        { fromUserId: userAId, toUserId: userBId },
        { fromUserId: userBId, toUserId: userAId },
      ],
    }),
  ]);

  if (!userA || !userB) return { allowed: false, reason: 'User not found' };

  if (!connection) {
    return { allowed: false, reason: 'You can only message accepted connections' };
  }

  const aBlockedB = userA.blockedUsers.some((id) => id.equals(userBId));
  const bBlockedA = userB.blockedUsers.some((id) => id.equals(userAId));
  if (aBlockedB || bBlockedA) {
    return { allowed: false, reason: 'You cannot message this user' };
  }

  return { allowed: true };
};
