import { useGetMyProfileQuery, useUpdateProfileMutation } from './profileApi';

export const useProfile = () => {
  const { data: user, isLoading } = useGetMyProfileQuery();
  const [updateProfile, { isLoading: saving }] = useUpdateProfileMutation();

  return { user, isLoading, updateProfile, saving };
};
