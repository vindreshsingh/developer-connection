import { useBlockUserMutation, useReportUserMutation } from './moderationApi';

export const useModeration = () => {
  const [blockUser, { isLoading: isBlocking }] = useBlockUserMutation();
  const [reportUser, { isLoading: isReporting }] = useReportUserMutation();

  return {
    blockUser: (userId) => blockUser(userId),
    reportUser: (userId, reason) => reportUser({ userId, reason }),
    isBlocking,
    isReporting,
  };
};
