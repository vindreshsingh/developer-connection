import { useCallback, useState } from 'react';
import { useGetFeedQuery } from './feedApi';

// page and skills live in one state object so changing the filter resets
// pagination atomically — no effect needed to "react" to the filter changing.
export const useFeed = () => {
  const [{ page, skills }, setQuery] = useState({ page: 1, skills: '' });
  const { data, isFetching, error } = useGetFeedQuery({ page, skills });

  const loadNextPage = useCallback(() => setQuery((q) => ({ ...q, page: q.page + 1 })), []);
  const setSkillsFilter = useCallback((nextSkills) => setQuery({ page: 1, skills: nextSkills }), []);

  return { data, isFetching, error, page, skills, loadNextPage, setSkillsFilter };
};
