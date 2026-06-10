import express from 'express';
import userAuth from '../middlewares/auth.js';
import { createAiQuotaMiddleware } from '../middlewares/checkAiQuota.js';
import { AI } from '../constants/apiEndpoints.js';
import { getProfileFeedback } from '../services/aiService.js';

const router = express.Router();

router.post(AI.PROFILE_FEEDBACK, userAuth, createAiQuotaMiddleware('profile_feedback'), async (req, res) => {
  try {
    const feedback = await getProfileFeedback(req.user);
    res.status(200).json({ data: { feedback } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
