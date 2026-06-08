import { getApiErrorMessage } from '@/commonUtils/apiError';

export const parseConnections = (data) =>
  (data?.data || []).map((c) => ({
    _id: c._id,
    fullName: `${c.firstName} ${c.lastName}`.trim(),
    initials: `${c.firstName?.[0] ?? ''}${c.lastName?.[0] ?? ''}`.toUpperCase(),
    photoUrl: c.photoUrl || '',
    bio: c.bio || '',
    topSkills: (c.skills || []).slice(0, 5),
  }));

export const parseConnectionsError = (error) =>
  getApiErrorMessage(error, '');
