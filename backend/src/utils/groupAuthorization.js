/**
 * Group authorization helper — analogous to `canUsersChat` in chatAuthorization.js.
 *
 * Used by every group REST route AND every group socket handler so membership
 * is re-checked in exactly one place.
 *
 * Returns `{ allowed: true, role }` or `{ allowed: false, reason }`.
 */

import Group from '../models/group.js';

/**
 * Check whether userId is an active member of groupId.
 *
 * @param {string|ObjectId} userId
 * @param {string|ObjectId} groupId
 * @returns {Promise<{ allowed: boolean, role?: string, reason?: string }>}
 */
export const canUserAccessGroup = async (userId, groupId) => {
  const group = await Group.findOne({ _id: groupId, deletedAt: null });

  if (!group) {
    return { allowed: false, reason: 'Group not found or has been deleted.' };
  }

  const member = group.members.find((m) => m.userId.equals(userId));

  if (!member) {
    return { allowed: false, reason: 'You are not a member of this group.' };
  }

  return { allowed: true, role: member.role };
};
