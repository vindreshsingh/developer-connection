/**
 * requirePremium — Phase 6 entitlement gate.
 *
 * Mounted after userAuth. Blocks non-premium users with a machine-readable
 * 403 so the frontend can show the shared UpsellModal. Also performs a lazy
 * grace-period check: a `past_due` subscription stays "premium" for
 * GRACE_PERIOD_MS after `currentPeriodEnd` before flipping `isPremium` to
 * false (Razorpay's own retry/dunning already stopped trying to charge by
 * then — this just catches up our local state on the user's next request).
 */

import Subscription from '../models/subscription.js';
import User from '../models/user.js';

const GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

export const requirePremium = (featureName) => async (req, res, next) => {
  const user = req.user;

  if (user.isPremium) {
    const pastDue = await Subscription.findOne({ userId: user._id, status: 'past_due' });
    if (pastDue?.currentPeriodEnd && Date.now() > pastDue.currentPeriodEnd.getTime() + GRACE_PERIOD_MS) {
      pastDue.status = 'expired';
      await pastDue.save();
      await User.findByIdAndUpdate(user._id, { isPremium: false });
      user.isPremium = false;
    }
  }

  if (!user.isPremium) {
    return res.status(403).json({ error: 'PREMIUM_REQUIRED', feature: featureName });
  }

  next();
};
