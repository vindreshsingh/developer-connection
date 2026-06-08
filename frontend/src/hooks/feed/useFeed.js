import { useCallback, useState } from 'react';
import { useGetFeedQuery } from './feedApi';

export const useFeed = () => {
  const [page, setPage] = useState(1);
  const { data, isFetching, error } = useGetFeedQuery(page);
  const loadNextPage = useCallback(() => setPage((p) => p + 1), []);

  return { data, isFetching, error, page, loadNextPage };
};
