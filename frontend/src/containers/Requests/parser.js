import { getApiErrorMessage } from '@/commonUtils/apiError';

// Shapes a raw request list (pending or sent) into widget-friendly items.
export const parsePendingRequests = (data) =>
  (data?.data || []).map((r) => ({
    requestId: r._id,
    person: {
      _id: r.fromUserId._id,
      fullName: `${r.fromUserId.firstName} ${r.fromUserId.lastName}`.trim(),
      initials: `${r.fromUserId.firstName?.[0] ?? ''}${r.fromUserId.lastName?.[0] ?? ''}`.toUpperCase(),
      photoUrl: r.fromUserId.photoUrl || '',
      bio: r.fromUserId.bio || '',
    },
  }));

export const parseSentRequests = (data) =>
  (data?.data || []).map((r) => ({
    requestId: r._id,
    status: r.status,
    person: {
      _id: r.toUserId._id,
      fullName: `${r.toUserId.firstName} ${r.toUserId.lastName}`.trim(),
      initials: `${r.toUserId.firstName?.[0] ?? ''}${r.toUserId.lastName?.[0] ?? ''}`.toUpperCase(),
      photoUrl: r.toUserId.photoUrl || '',
      bio: r.toUserId.bio || '',
    },
  }));

export const parseRequestsError = (pendingError, sentError) =>
  getApiErrorMessage(pendingError, '') || getApiErrorMessage(sentError, '');
