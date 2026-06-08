// Transforms a raw feed user object into the shape SwipeCard expects.
export const parseFeedProfile = (user) => ({
  _id: user._id,
  fullName: `${user.firstName} ${user.lastName}`.trim(),
  initials: `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase(),
  photoUrl: user.photoUrl || '',
  age: user.age || null,
  bio: user.bio || '',
  topSkills: (user.skills || []).slice(0, 4),
});

// Returns only profiles that haven't been dismissed yet.
export const parseFeedPage = (data, dismissed) => {
  const profiles = data?.data || [];
  return profiles
    .filter((p) => !dismissed.includes(p._id))
    .map(parseFeedProfile);
};
