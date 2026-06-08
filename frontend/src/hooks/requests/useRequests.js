import {
  useGetPendingRequestsQuery,
  useGetSentRequestsQuery,
  useReviewRequestMutation,
} from './requestsApi';

export const useRequests = () => {
  const { data: pendingData, error: pendingError, isLoading: pendingLoading } = useGetPendingRequestsQuery();
  const { data: sentData, error: sentError, isLoading: sentLoading } = useGetSentRequestsQuery();
  const [reviewRequest, { isLoading: reviewing }] = useReviewRequestMutation();

  return {
    pendingRaw: pendingData,
    sentRaw: sentData,
    pendingError,
    sentError,
    pendingLoading,
    sentLoading,
    review: (requestId, status) => reviewRequest({ requestId, status }),
    reviewing,
  };
};
