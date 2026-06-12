import * as Sentry from '@sentry/node';

let enabled = false;

// No-op unless SENTRY_DSN is set — local dev/test never talk to Sentry.
export const initSentry = () => {
  if (!process.env.SENTRY_DSN) return;

  Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV || 'development' });
  enabled = true;
};

export const captureException = (err) => {
  if (enabled) Sentry.captureException(err);
};
