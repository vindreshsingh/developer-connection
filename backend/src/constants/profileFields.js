// Fields safe to expose about a user to other users (feed, public profile
// view, and AI prompts that reference another user's profile).
export const PUBLIC_PROFILE_FIELDS = ['firstName', 'lastName', 'photoUrl', 'bio', 'skills', 'githubUrl', 'linkedinUrl', 'age', 'gender'];

export const PUBLIC_PROFILE_SELECT = PUBLIC_PROFILE_FIELDS.join(' ');
