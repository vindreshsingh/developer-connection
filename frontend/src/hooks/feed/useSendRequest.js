import { useSendRequestMutation } from '@/hooks/requests/requestsApi';

export const useSendRequest = () => {
  const [sendRequest] = useSendRequestMutation();
  return { sendRequest: (status, toUserId) => sendRequest({ status, toUserId }) };
};
