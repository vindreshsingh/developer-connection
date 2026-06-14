export const JOB_TYPES = ['full-time', 'part-time', 'contract', 'internship', 'freelance', 'collaboration'];
export const LOCATION_MODES = ['remote', 'onsite', 'hybrid'];
export const APPLICATION_STATUSES = ['pending', 'reviewing', 'shortlisted', 'rejected', 'accepted'];

export const JOB_TYPE_LABELS = {
  'full-time': 'Full-time',
  'part-time': 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
  freelance: 'Freelance',
  collaboration: 'Collaboration',
};

/** Formats a { min, max, currency } salary range as a human-readable string, or null if both bounds are unset. */
export const formatSalaryRange = (salaryRange) => {
  if (!salaryRange || (salaryRange.min == null && salaryRange.max == null)) return null;

  const { min, max, currency } = salaryRange;
  if (min != null && max != null) return `${currency} ${min.toLocaleString()} – ${max.toLocaleString()}`;
  if (min != null) return `${currency} ${min.toLocaleString()}+`;
  return `Up to ${currency} ${max.toLocaleString()}`;
};
