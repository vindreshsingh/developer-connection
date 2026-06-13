import * as Sentry from '@sentry/react';

// No-op unless VITE_SENTRY_DSN is set — local dev never talks to Sentry.
export const initSentry = () => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({ dsn, environment: import.meta.env.MODE });
};

export const SentryErrorBoundary = Sentry.ErrorBoundary;

export const isSentryEnabled = () => Boolean(import.meta.env.VITE_SENTRY_DSN);
