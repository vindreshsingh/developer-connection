import { getApiErrorMessage } from '@/commonUtils/apiError';

export const parseUser = (data) => {
  if (!data) return null;

  return {
    _id: data._id,
    fullName: `${data.firstName} ${data.lastName ?? ''}`.trim(),
    initials: `${data.firstName?.[0] ?? ''}${data.lastName?.[0] ?? ''}`.toUpperCase(),
    photoUrl: data.photoUrl || '',
    bio: data.bio || '',
    skills: data.skills || [],
    age: data.age,
    gender: data.gender,
    githubUrl: data.githubUrl,
    linkedinUrl: data.linkedinUrl,
    github: data.github,
    linkedin: data.linkedin,
  };
};

export const parseUserError = (error) => getApiErrorMessage(error, 'Could not load this profile');
