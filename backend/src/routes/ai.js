/**
 * AI Developer Assistant routes — Phase 6, mounted at /ai.
 *
 * All routes require auth + an active premium subscription
 * (`requirePremium('aiAssistant')`). LLM-backed routes additionally consume
 * the daily AI budget (`AIUsageLog` + `checkAIRateLimit` /
 * `isAIRateLimited`); `GET /ai/recommendations` only consumes budget on a
 * cache miss.
 */

import express from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import { PDFParse } from 'pdf-parse';
import userAuth from '../middlewares/auth.js';
import { requirePremium } from '../middlewares/premium.js';
import { checkAIRateLimit, isAIRateLimited } from '../middlewares/aiRateLimit.js';
import { AI } from '../constants/apiEndpoints.js';
import User from '../models/user.js';
import ConnectionRequest from '../models/connectionRequest.js';
import RecommendationCache from '../models/recommendationCache.js';
import ResumeFeedback from '../models/resumeFeedback.js';
import InterviewSession from '../models/interviewSession.js';
import AIUsageLog from '../models/aiUsageLog.js';
import { AIService, AIServiceError } from '../services/AIService.js';
import { uploadRawBuffer } from '../utils/cloudinary.js';

const router = express.Router();

const RECOMMENDATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const DISMISS_EXCLUSION_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const MAX_CANDIDATES = 15;
const MAX_RESUME_SIZE = 5 * 1024 * 1024; // 5MB
const INTERVIEW_TURN_CAP = 10;
const PAGE_SIZE = 10;

const RECOMMENDATION_FIELDS = 'firstName lastName photoUrl bio skills techStack githubUrl linkedinUrl';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_RESUME_SIZE },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'application/pdf') return cb(new Error('Only PDF files are allowed'));
    cb(null, true);
  },
});

const profileContext = (user) => ({
  skills: user.skills,
  techStack: user.techStack,
  experience: user.experience,
});

const buildRecommendationsResponse = (cache) =>
  (cache?.recommendations || [])
    .filter((r) => r.userId)
    .map((r) => ({ user: r.userId, reason: r.reason }));

// Excludes self, accepted/pending connection-request partners (either
// direction), blocked users (either direction), and anyone dismissed within
// the last 14 days — same shape as the profile feed exclusion set.
const buildShortlist = async (me) => {
  const loggedInUserId = me._id;

  const interactions = await ConnectionRequest.find({
    $or: [{ fromUserId: loggedInUserId }, { toUserId: loggedInUserId }],
  }).select('fromUserId toUserId');

  const excludedIds = new Set([loggedInUserId.toString()]);
  for (const r of interactions) {
    excludedIds.add(r.fromUserId.toString());
    excludedIds.add(r.toUserId.toString());
  }

  for (const id of me.blockedUsers) excludedIds.add(id.toString());
  const blockedByOthers = await User.find({ blockedUsers: loggedInUserId }).select('_id');
  for (const u of blockedByOthers) excludedIds.add(u._id.toString());

  const cache = await RecommendationCache.findOne({ userId: loggedInUserId });
  const dismissCutoff = Date.now() - DISMISS_EXCLUSION_MS;
  for (const d of cache?.dismissed || []) {
    if (d.dismissedAt.getTime() > dismissCutoff) excludedIds.add(d.userId.toString());
  }

  const candidates = await User.find({ _id: { $nin: [...excludedIds] } }).select(
    `${RECOMMENDATION_FIELDS} experience`,
  );

  const mySkills = new Set((me.skills || []).map((s) => s.toLowerCase()));
  const myTech = new Set((me.techStack || []).map((s) => s.toLowerCase()));

  return candidates
    .map((c) => {
      const score =
        (c.skills || []).filter((s) => mySkills.has(s.toLowerCase())).length +
        (c.techStack || []).filter((s) => myTech.has(s.toLowerCase())).length;
      return { user: c, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CANDIDATES)
    .map((s) => s.user);
};

router.use(userAuth, requirePremium('aiAssistant'));

// ── GET /ai/recommendations ──────────────────────────────────────────────────
router.get(AI.RECOMMENDATIONS, async (req, res) => {
  try {
    const userId = req.user._id;
    const existing = await RecommendationCache.findOne({ userId });

    if (existing && existing.expiresAt.getTime() > Date.now()) {
      const populated = await existing.populate({ path: 'recommendations.userId', select: RECOMMENDATION_FIELDS });
      return res.status(200).json({ data: buildRecommendationsResponse(populated) });
    }

    if (await isAIRateLimited(userId)) {
      return res.status(429).json({ error: 'AI_RATE_LIMIT_EXCEEDED' });
    }

    const candidates = await buildShortlist(req.user);
    let recommendations = [];

    if (candidates.length > 0) {
      const aiResult = await AIService.generateRecommendationReasons(req.user, candidates);
      recommendations = aiResult
        .filter((r) => candidates[r.index])
        .map((r) => ({ userId: candidates[r.index]._id, reason: r.reason }));

      await AIUsageLog.create({ userId, endpoint: 'recommendations' });
    }

    const cache = await RecommendationCache.findOneAndUpdate(
      { userId },
      { recommendations, expiresAt: new Date(Date.now() + RECOMMENDATION_CACHE_TTL_MS) },
      { upsert: true, new: true },
    ).populate({ path: 'recommendations.userId', select: RECOMMENDATION_FIELDS });

    res.status(200).json({ data: buildRecommendationsResponse(cache) });
  } catch (err) {
    if (err instanceof AIServiceError) return res.status(502).json({ error: 'AI_SERVICE_ERROR' });
    res.status(500).json({ error: err.message });
  }
});

// ── POST /ai/recommendations/:userId/dismiss ─────────────────────────────────
router.post(AI.RECOMMENDATIONS_DISMISS, async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(targetUserId)) {
      return res.status(400).json({ error: 'Invalid user id' });
    }

    const cache = await RecommendationCache.findOne({ userId: req.user._id });
    if (!cache) return res.status(404).json({ error: 'No recommendations found' });

    cache.recommendations = cache.recommendations.filter((r) => r.userId.toString() !== targetUserId);
    cache.dismissed = cache.dismissed.filter((d) => d.userId.toString() !== targetUserId);
    cache.dismissed.push({ userId: targetUserId, dismissedAt: new Date() });
    await cache.save();

    res.status(200).json({ message: 'Recommendation dismissed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /ai/resume-feedback ──────────────────────────────────────────────────
router.post(
  AI.RESUME_FEEDBACK,
  (req, res, next) => {
    upload.single('resume')(req, res, (err) => {
      if (err) return res.status(400).json({ error: err.message });
      next();
    });
  },
  checkAIRateLimit,
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No resume file provided' });

      const parser = new PDFParse({ data: req.file.buffer });
      const parsed = await parser.getText();
      await parser.destroy();

      const extractedText = parsed.text?.trim();
      if (!extractedText) return res.status(400).json({ error: 'Could not extract text from PDF' });

      const uploaded = await uploadRawBuffer(req.file.buffer, 'resumes');
      const feedback = await AIService.getResumeFeedback(extractedText, profileContext(req.user));

      const doc = await ResumeFeedback.create({
        userId: req.user._id,
        resumeUrl: uploaded.secure_url,
        extractedText,
        feedback,
      });

      await AIUsageLog.create({ userId: req.user._id, endpoint: 'resume-feedback' });

      res.status(201).json({ data: doc });
    } catch (err) {
      if (err instanceof AIServiceError) return res.status(502).json({ error: 'AI_SERVICE_ERROR' });
      res.status(500).json({ error: err.message });
    }
  },
);

// ── GET /ai/resume-feedback ────────────────────────────────────────────────────
router.get(AI.RESUME_FEEDBACK, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const filter = { userId: req.user._id };

    const total = await ResumeFeedback.countDocuments(filter);
    const items = await ResumeFeedback.find(filter)
      .select('-extractedText')
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE);

    res.status(200).json({
      data: items,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
        hasNextPage: page * PAGE_SIZE < total,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /ai/interview/start ──────────────────────────────────────────────────
router.post(AI.INTERVIEW_START, checkAIRateLimit, async (req, res) => {
  try {
    const { focusArea } = req.body;
    const result = await AIService.startInterview(focusArea, profileContext(req.user));

    const session = await InterviewSession.create({
      userId: req.user._id,
      focusArea: focusArea || null,
      transcript: [{ role: 'assistant', content: result.question }],
    });

    await AIUsageLog.create({ userId: req.user._id, endpoint: 'interview' });

    res.status(201).json({ data: { sessionId: session._id, question: result.question } });
  } catch (err) {
    if (err instanceof AIServiceError) return res.status(502).json({ error: 'AI_SERVICE_ERROR' });
    res.status(500).json({ error: err.message });
  }
});

// ── POST /ai/interview/:sessionId/respond ─────────────────────────────────────
router.post(AI.INTERVIEW_RESPOND, checkAIRateLimit, async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) return res.status(400).json({ error: 'Invalid session id' });

    const { answer } = req.body;
    if (!answer?.trim()) return res.status(400).json({ error: 'answer is required' });

    const session = await InterviewSession.findOne({ _id: sessionId, userId: req.user._id });
    if (!session) return res.status(404).json({ error: 'Interview session not found' });
    if (session.status === 'completed') return res.status(400).json({ error: 'Interview session already completed' });

    session.transcript.push({ role: 'user', content: answer });
    const turnCount = session.transcript.filter((t) => t.role === 'user').length;

    const result = await AIService.continueInterview(session.transcript, session.focusArea);
    const nextQuestion = turnCount >= INTERVIEW_TURN_CAP ? null : (result.nextQuestion ?? null);

    session.transcript.push({
      role: 'assistant',
      content: nextQuestion ? `${result.feedback}\n\n${nextQuestion}` : result.feedback,
    });

    if (!nextQuestion) {
      session.status = 'completed';
      session.completedAt = new Date();
    }

    await session.save();
    await AIUsageLog.create({ userId: req.user._id, endpoint: 'interview' });

    res.status(200).json({ data: { feedback: result.feedback, nextQuestion, status: session.status } });
  } catch (err) {
    if (err instanceof AIServiceError) return res.status(502).json({ error: 'AI_SERVICE_ERROR' });
    res.status(500).json({ error: err.message });
  }
});

// ── POST /ai/interview/:sessionId/end ─────────────────────────────────────────
router.post(AI.INTERVIEW_END, async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) return res.status(400).json({ error: 'Invalid session id' });

    const session = await InterviewSession.findOne({ _id: sessionId, userId: req.user._id });
    if (!session) return res.status(404).json({ error: 'Interview session not found' });

    session.status = 'completed';
    session.completedAt = new Date();
    await session.save();

    res.status(200).json({ data: session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /ai/interview ──────────────────────────────────────────────────────────
router.get(AI.INTERVIEW_LIST, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const filter = { userId: req.user._id };

    const total = await InterviewSession.countDocuments(filter);
    const items = await InterviewSession.find(filter)
      .select('-transcript')
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE);

    res.status(200).json({
      data: items,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
        hasNextPage: page * PAGE_SIZE < total,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /ai/interview/:sessionId ────────────────────────────────────────────────
router.get(AI.INTERVIEW_GET, async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) return res.status(400).json({ error: 'Invalid session id' });

    const session = await InterviewSession.findOne({ _id: sessionId, userId: req.user._id });
    if (!session) return res.status(404).json({ error: 'Interview session not found' });

    res.status(200).json({ data: session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
