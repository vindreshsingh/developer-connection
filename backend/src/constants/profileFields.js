// Fields safe to expose about a user to other users (feed, public profile
// view, and AI prompts that reference another user's profile).
export const PUBLIC_PROFILE_FIELDS = [
  'firstName',
  'lastName',
  'photoUrl',
  'bio',
  'skills',
  'githubUrl',
  'linkedinUrl',
  'age',
  'gender',
  'github.username',
  'github.profileUrl',
  'github.topRepos',
  'github.topLanguages',
  'linkedin.headline',
  'linkedin.company',
  'linkedin.jobTitle',
  'linkedin.profileUrl',
];

export const PUBLIC_PROFILE_SELECT = PUBLIC_PROFILE_FIELDS.join(' ');
