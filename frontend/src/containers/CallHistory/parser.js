import { getApiErrorMessage } from '@/commonUtils/apiError';

const formatDuration = (seconds) => {
  if (!seconds && seconds !== 0) return null;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
};

export const parseCallHistory = (data, currentUserId) =>
  (data?.data || []).map((call) => {
    const otherParticipant =
      call.type === '1:1'
        ? call.participants.find((p) => p.userId?._id !== currentUserId)?.userId
        : null;

    return {
      _id: call._id,
      type: call.type,
      status: call.status,
      groupId: call.groupId,
      isOutgoing: call.initiatorId?._id === currentUserId,
      otherUser: otherParticipant
        ? {
            fullName: `${otherParticipant.firstName} ${otherParticipant.lastName ?? ''}`.trim(),
            photoUrl: otherParticipant.photoUrl || '',
            initials: `${otherParticipant.firstName?.[0] ?? ''}${otherParticipant.lastName?.[0] ?? ''}`.toUpperCase(),
          }
        : null,
      participantCount: call.participants?.length ?? 0,
      duration: formatDuration(call.duration),
      createdAt: call.createdAt,
    };
  });

export const parseCallHistoryPagination = (data) => data?.pagination ?? null;

export const parseCallHistoryError = (error) => getApiErrorMessage(error, 'Could not load call history');
