import AiUsage from '../models/aiUsage.js';
import { getSubscriptionPlan } from '../services/subscriptionService.js';
import { AI_DAILY_LIMITS } from '../config/limits.js';

const todayUTC = () => new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

// Factory so tests can exercise both the free and premium caps without
// waiting on real calendar days (mirrors createConnectionRequestLimiter).
export const createAiQuotaMiddleware = (feature) => async (req, res, next) => {
  try {
    const plan = await getSubscriptionPlan(req.user._id);
    const limit = AI_DAILY_LIMITS[plan][feature];
    const date = todayUTC();

    const usage = await AiUsage.findOne({ userId: req.user._id, feature, date });
    if (usage && usage.count >= limit) {
      return res.status(429).json({
        error: `Daily AI usage limit reached (${limit}/day for ${feature} on the ${plan} plan).`,
      });
    }

    await AiUsage.findOneAndUpdate(
      { userId: req.user._id, feature, date },
      { $inc: { count: 1 } },
      { upsert: true }
    );

    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
