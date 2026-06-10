import express from 'express';
import mongoose from 'mongoose';
import userAuth from '../middlewares/auth.js';
import { createAiQuotaMiddleware } from '../middlewares/checkAiQuota.js';
import { AI } from '../constants/apiEndpoints.js';
import { PUBLIC_PROFILE_SELECT } from '../constants/profileFields.js';
import { getProfileFeedback, getMatchInsight } from '../services/aiService.js';
import User from '../models/user.js';

const router = express.Router();

router.post(AI.PROFILE_FEEDBACK, userAuth, createAiQuotaMiddleware('profile_feedback'), async (req, res) => {
  try {
    const feedback = await getProfileFeedback(req.user);
    res.status(200).json({ data: { feedback } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(AI.MATCH_INSIGHT, userAuth, createAiQuotaMiddleware('match_insight'), async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId)) return res.status(400).json({ error: 'Invalid user id' });
    if (userId === req.user._id.toString())
      return res.status(400).json({ error: 'Cannot generate a match insight for your own profile' });

    const targetUser = await User.findById(userId).select(PUBLIC_PROFILE_SELECT);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const insight = await getMatchInsight(req.user, targetUser);
    res.status(200).json({ data: { insight } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
