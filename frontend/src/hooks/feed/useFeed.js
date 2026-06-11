import { useCallback, useState } from 'react';
import { useGetFeedQuery } from './feedApi';

// page, skills, and experienceLevel live in one state object so changing a
// filter resets pagination atomically — no effect needed to "react" to the
// filter changing.
export const useFeed = () => {
  const [{ page, skills, experienceLevel }, setQuery] = useState({ page: 1, skills: '', experienceLevel: '' });
  const { data, isFetching, error } = useGetFeedQuery({ page, skills, experienceLevel });

  const loadNextPage = useCallback(() => setQuery((q) => ({ ...q, page: q.page + 1 })), []);
  const setSkillsFilter = useCallback((nextSkills) => setQuery((q) => ({ ...q, page: 1, skills: nextSkills })), []);
  const setExperienceLevelFilter = useCallback(
    (nextLevel) => setQuery((q) => ({ ...q, page: 1, experienceLevel: nextLevel })),
    [],
  );

  return { data, isFetching, error, page, skills, experienceLevel, loadNextPage, setSkillsFilter, setExperienceLevelFilter };
};
