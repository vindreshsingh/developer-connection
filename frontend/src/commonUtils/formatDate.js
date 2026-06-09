const MONTH_FORMATTER = new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' });
const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

// Renders an ISO date string (or Date) as a local time, e.g. "3:45 PM" — used
// for message timestamps in chat threads.
export const formatTime = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return TIME_FORMATTER.format(date);
};

// Renders an ISO date string (or Date) as "Jan 2024"; returns a fallback for ongoing entries.
export const formatMonthYear = (value, fallback = 'Present') => {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return MONTH_FORMATTER.format(date);
};

// Converts an ISO date string (or Date) to "YYYY-MM-DD" for <input type="date"> values.
export const toDateInputValue = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};
