import express from 'express';
import mongoose from 'mongoose';
import userAuth from '../middlewares/auth.js';
import { createAiQuotaMiddleware } from '../middlewares/checkAiQuota.js';
import { AI } from '../constants/apiEndpoints.js';
import { PUBLIC_PROFILE_SELECT } from '../constants/profileFields.js';
import { getProfileFeedback, getMatchInsight, streamInterviewPrepReply } from '../services/aiService.js';
import User from '../models/user.js';
import AiConversation from '../models/aiConversation.js';

const router = express.Router();

const HISTORY_PAGE_SIZE = 20;

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

// POST /ai/interview-prep — send a chat message, stream the assistant's reply
// as Server-Sent Events, and persist the exchange to the caller's conversation.
router.post(AI.INTERVIEW_PREP, userAuth, createAiQuotaMiddleware('interview_prep'), async (req, res) => {
  const { message } = req.body;
  if (typeof message !== 'string' || !message.trim())
    return res.status(400).json({ error: 'message is required' });

  let conversation = await AiConversation.findOne({ userId: req.user._id });
  if (!conversation) conversation = new AiConversation({ userId: req.user._id, messages: [] });

  conversation.messages.push({ role: 'user', content: message.trim(), createdAt: new Date() });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    const reply = await streamInterviewPrepReply(conversation.messages, (delta) => {
      res.write(`data: ${JSON.stringify({ delta })}\n\n`);
    });

    conversation.messages.push({ role: 'assistant', content: reply, createdAt: new Date() });
    await conversation.save();

    res.write('data: [DONE]\n\n');
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
  }

  res.end();
});

// GET /ai/interview-prep/history — paginated chat history (newest-first
// pages, oldest-first within page), mirroring routes/chat.js's convention.
router.get(AI.INTERVIEW_PREP_HISTORY, userAuth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const conversation = await AiConversation.findOne({ userId: req.user._id });
    const messages = conversation ? conversation.messages : [];

    const start = Math.max(messages.length - page * HISTORY_PAGE_SIZE, 0);
    const end = messages.length - (page - 1) * HISTORY_PAGE_SIZE;
    const data = end > 0 ? messages.slice(start, end) : [];

    res.status(200).json({
      data,
      pagination: {
        page,
        pageSize: HISTORY_PAGE_SIZE,
        total: messages.length,
        totalPages: Math.max(Math.ceil(messages.length / HISTORY_PAGE_SIZE), 1),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
