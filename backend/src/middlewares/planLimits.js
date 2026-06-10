import ConnectionRequest from '../models/connectionRequest.js';
import { getSubscriptionPlan } from '../services/subscriptionService.js';
import { FREE_DAILY_CONNECTION_REQUESTS } from '../config/limits.js';

// Factory so tests can build a limiter with a low threshold without
// creating FREE_DAILY_CONNECTION_REQUESTS users to trip it (mirrors
// createAuthRateLimiter in rateLimiter.js).
export const createConnectionRequestLimiter = (limit) => async (req, res, next) => {
  try {
    const plan = await getSubscriptionPlan(req.user._id);
    if (plan === 'premium') return next();

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const sentToday = await ConnectionRequest.countDocuments({
      fromUserId: req.user._id,
      createdAt: { $gte: startOfDay },
    });

    if (sentToday >= limit) {
      return res.status(429).json({
        error: `Daily connection request limit reached (${limit}/day on the free plan). Upgrade to Premium for unlimited requests.`,
      });
    }

    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const connectionRequestLimiter = createConnectionRequestLimiter(FREE_DAILY_CONNECTION_REQUESTS);
