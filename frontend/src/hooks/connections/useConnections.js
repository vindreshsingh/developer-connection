import { useGetConnectionsQuery } from '@/hooks/requests/requestsApi';

export const useConnections = () => {
  const { data, error, isLoading } = useGetConnectionsQuery();

  return { connectionsRaw: data, error, isLoading };
};
