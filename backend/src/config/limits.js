// Free-tier usage caps. Premium subscribers (Subscription.plan === 'premium'
// && status === 'active') bypass these entirely. Tunable via env without a
// code change — see Phase 6 RFC Open Question #2.
export const FREE_DAILY_CONNECTION_REQUESTS =
  Number(process.env.FREE_DAILY_CONNECTION_REQUESTS) || 20;

// Daily AI Assistant call caps, per feature, by plan.
export const AI_DAILY_LIMITS = {
  free: {
    profile_feedback: Number(process.env.AI_FREE_DAILY_PROFILE_FEEDBACK) || 3,
    match_insight: Number(process.env.AI_FREE_DAILY_MATCH_INSIGHT) || 3,
    interview_prep: Number(process.env.AI_FREE_DAILY_INTERVIEW_PREP) || 3,
  },
  premium: {
    profile_feedback: Number(process.env.AI_PREMIUM_DAILY_PROFILE_FEEDBACK) || 25,
    match_insight: Number(process.env.AI_PREMIUM_DAILY_MATCH_INSIGHT) || 25,
    interview_prep: Number(process.env.AI_PREMIUM_DAILY_INTERVIEW_PREP) || 25,
  },
};
