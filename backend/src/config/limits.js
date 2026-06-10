// Free-tier usage caps. Premium subscribers (Subscription.plan === 'premium'
// && status === 'active') bypass these entirely. Tunable via env without a
// code change — see Phase 6 RFC Open Question #2.
export const FREE_DAILY_CONNECTION_REQUESTS =
  Number(process.env.FREE_DAILY_CONNECTION_REQUESTS) || 20;
