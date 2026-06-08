import { getApiErrorMessage } from '@/commonUtils/apiError';

// Normalizes a raw user API object into the form state shape the Profile container uses.
export const parseUserToForm = (user) => ({
  firstName: user.firstName || '',
  lastName: user.lastName || '',
  photoUrl: user.photoUrl || '',
  coverImageUrl: user.coverImageUrl || '',
  bio: user.bio || '',
  githubUrl: user.githubUrl || '',
  linkedinUrl: user.linkedinUrl || '',
  age: user.age || '',
  gender: user.gender || '',
});

export const parseUserSkills = (user) =>
  (user.skills || []).join(', ');

export const parseUserTechStack = (user) =>
  (user.techStack || []).join(', ');

export const parseUserExperience = (user) =>
  (user.experience || []).map((exp) => ({
    title: exp.title || '',
    company: exp.company || '',
    startDate: exp.startDate ? exp.startDate.slice(0, 10) : '',
    endDate: exp.endDate ? exp.endDate.slice(0, 10) : '',
    description: exp.description || '',
  }));

// Serializes the form state back into the PATCH payload the API expects.
export const serializeProfilePayload = ({ form, skillsInput, techStackInput, experience }) => {
  const payload = { ...form };
  if (payload.age) payload.age = Number(payload.age);
  else delete payload.age;
  if (!payload.gender) delete payload.gender;
  if (!payload.photoUrl) delete payload.photoUrl;
  if (!payload.coverImageUrl) delete payload.coverImageUrl;

  payload.skills = skillsInput
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  payload.techStack = techStackInput
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  payload.experience = experience
    .filter((exp) => exp.title.trim() && exp.company.trim() && exp.startDate)
    .map((exp) => ({
      title: exp.title.trim(),
      company: exp.company.trim(),
      startDate: exp.startDate,
      endDate: exp.endDate || null,
      description: exp.description.trim(),
    }));

  return payload;
};

export const parseUpdateError = (result) =>
  getApiErrorMessage(result.error, 'Could not update profile');

export const parseImageUploadError = (result) =>
  getApiErrorMessage(result.error, 'Could not upload image');
