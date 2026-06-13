/**
 * Calls REST API — mounted at /calls in app.js.
 *
 * Manages CallSession lifecycle for both 1:1 and group video calls.
 * Socket signaling (offer/answer/ICE) is handled separately in
 * sockets/callHandlers.js (Task A2).
 *
 * Authorization matrix:
 *   POST   /                 logged in; target must be an accepted connection (1:1)
 *                            or a group member (group)
 *   GET    /                 logged in — own call history
 *   GET    /:callId          logged in + participant
 *   POST   /:callId/accept   logged in + callee participant
 *   POST   /:callId/decline  logged in + callee participant
 *   POST   /:callId/end      logged in + any participant
 */

import express from 'express';
import mongoose from 'mongoose';
import userAuth from '../middlewares/auth.js';
import { CALLS } from '../constants/apiEndpoints.js';
import CallSession from '../models/callSession.js';
import Plan from '../models/plan.js';
import { canUsersChat } from '../utils/chatAuthorization.js';
import { canUserAccessGroup } from '../utils/groupAuthorization.js';
import { generateRoomToken } from '../services/LiveKitService.js';
import { createCallSummaryMessage } from '../utils/callSummaryUtils.js';

const router = express.Router();
const PAGE_SIZE = 20;

const validObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ── POST / — Initiate a call ──────────────────────────────────────────────────

router.post(CALLS.INITIATE, userAuth, async (req, res) => {
  try {
    const { type, targetUserId, groupId } = req.body;
    const callerId = req.user._id;

    if (!['1:1', 'group'].includes(type)) {
      return res.status(400).json({ error: 'type must be "1:1" or "group".' });
    }

    // ── 1:1 call authorization ────────────────────────────────────────────────
    if (type === '1:1') {
      if (!targetUserId) {
        return res.status(400).json({ error: 'targetUserId is required for 1:1 calls.' });
      }
      if (!validObjectId(targetUserId)) {
        return res.status(400).json({ error: 'Invalid targetUserId.' });
      }
      if (callerId.equals(targetUserId)) {
        return res.status(400).json({ error: 'You cannot call yourself.' });
      }

      const auth = await canUsersChat(callerId, targetUserId);
      if (!auth.allowed) {
        return res.status(403).json({ error: auth.reason });
      }

      // Prevent double-calling: reject if an active/ringing call already exists between them
      const existing = await CallSession.findOne({
        type: '1:1',
        status: { $in: ['ringing', 'active'] },
        'participants.userId': targetUserId,
        initiatorId: callerId,
      });
      if (existing) {
        return res.status(409).json({ error: 'A call is already in progress with this user.', callId: existing._id });
      }

      const callSession = await CallSession.create({
        type: '1:1',
        initiatorId: callerId,
        participants: [
          { userId: callerId,     joinedAt: new Date() },
          { userId: targetUserId, joinedAt: null },
        ],
      });

      // Notify callee in real time via Socket.IO
      const io = req.app.get('io');
      if (io) {
        const callerName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ');
        io.to(`user:${targetUserId}`).emit('call_incoming', {
          callId:          callSession._id,
          callerId:        callerId.toString(),
          callerName,
          callerPhotoUrl:  req.user.photoUrl ?? null,
          type:            '1:1',
        });
      }

      return res.status(201).json({ message: 'Call initiated.', callId: callSession._id });
    }

    // ── Group call authorization ───────────────────────────────────────────────
    if (!groupId || !validObjectId(groupId)) {
      return res.status(400).json({ error: 'groupId is required for group calls.' });
    }

    const groupAuth = await canUserAccessGroup(callerId, groupId);
    if (!groupAuth.allowed) {
      return res.status(403).json({ error: groupAuth.reason });
    }

    // Only one active group call per group at a time
    const existingGroup = await CallSession.findOne({
      type: 'group',
      groupId,
      status: { $in: ['ringing', 'active'] },
    });
    if (existingGroup) {
      return res.status(409).json({
        error: 'A group call is already active.',
        callId: existingGroup._id,
      });
    }

    const callSession = await CallSession.create({
      type: 'group',
      initiatorId: callerId,
      groupId,
      participants: [{ userId: callerId, joinedAt: new Date() }],
      status: 'active',
      startedAt: new Date(),
      isPriority: req.user.isPremium, // Phase 6: raises the group call participant cap
    });

    // Notify group members
    const io = req.app.get('io');
    if (io) {
      const callerName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ');
      io.to(`group:${groupId}`).emit('group_call_started', {
        callId:    callSession._id,
        groupId,
        startedBy: callerName,
      });
    }

    return res.status(201).json({ message: 'Group call started.', callId: callSession._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET / — Call history ──────────────────────────────────────────────────────

router.get(CALLS.HISTORY, userAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const userId = req.user._id;

    const filter = {
      $or: [
        { initiatorId: userId },
        { 'participants.userId': userId },
      ],
    };

    const total = await CallSession.countDocuments(filter);
    const calls = await CallSession.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .populate('participants.userId', 'firstName lastName photoUrl')
      .populate('initiatorId', 'firstName lastName photoUrl');

    res.status(200).json({
      data: calls,
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

// ── GET /:callId — Call metadata ──────────────────────────────────────────────

router.get(CALLS.GET, userAuth, async (req, res) => {
  try {
    const { callId } = req.params;
    if (!validObjectId(callId)) return res.status(400).json({ error: 'Invalid call ID.' });

    const call = await CallSession.findById(callId)
      .populate('participants.userId', 'firstName lastName photoUrl')
      .populate('initiatorId', 'firstName lastName photoUrl');

    if (!call) return res.status(404).json({ error: 'Call not found.' });

    if (!call.isParticipant(req.user._id)) {
      return res.status(403).json({ error: 'You are not a participant in this call.' });
    }

    res.status(200).json({ call });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /:callId/accept ──────────────────────────────────────────────────────

router.post(CALLS.ACCEPT, userAuth, async (req, res) => {
  try {
    const { callId } = req.params;
    if (!validObjectId(callId)) return res.status(400).json({ error: 'Invalid call ID.' });

    const call = await CallSession.findById(callId);
    if (!call) return res.status(404).json({ error: 'Call not found.' });

    if (!call.isParticipant(req.user._id)) {
      return res.status(403).json({ error: 'You are not a participant in this call.' });
    }
    if (call.status !== 'ringing') {
      return res.status(400).json({ error: `Cannot accept a call with status "${call.status}".` });
    }

    call.status = 'active';
    call.startedAt = new Date();

    // Mark callee's joinedAt
    const participant = call.participants.find((p) => p.userId.equals(req.user._id));
    if (participant) participant.joinedAt = new Date();

    await call.save();
    res.status(200).json({ message: 'Call accepted.', call });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /:callId/decline ─────────────────────────────────────────────────────

router.post(CALLS.DECLINE, userAuth, async (req, res) => {
  try {
    const { callId } = req.params;
    if (!validObjectId(callId)) return res.status(400).json({ error: 'Invalid call ID.' });

    const call = await CallSession.findById(callId);
    if (!call) return res.status(404).json({ error: 'Call not found.' });

    if (!call.isParticipant(req.user._id)) {
      return res.status(403).json({ error: 'You are not a participant in this call.' });
    }
    if (call.status !== 'ringing') {
      return res.status(400).json({ error: `Cannot decline a call with status "${call.status}".` });
    }

    call.status = 'declined';
    call.endedAt = new Date();
    await call.save();

    // Notify caller
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${call.initiatorId}`).emit('call_rejected', { callId: call._id });
    }

    res.status(200).json({ message: 'Call declined.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /:callId/end ─────────────────────────────────────────────────────────

router.post(CALLS.END, userAuth, async (req, res) => {
  try {
    const { callId } = req.params;
    if (!validObjectId(callId)) return res.status(400).json({ error: 'Invalid call ID.' });

    const call = await CallSession.findById(callId);
    if (!call) return res.status(404).json({ error: 'Call not found.' });

    if (!call.isParticipant(req.user._id)) {
      return res.status(403).json({ error: 'You are not a participant in this call.' });
    }
    if (['ended', 'declined', 'missed'].includes(call.status)) {
      return res.status(400).json({ error: `Call is already ${call.status}.` });
    }

    const now = new Date();
    call.status = 'ended';
    call.endedAt = now;
    call.duration = call.startedAt
      ? Math.round((now - call.startedAt) / 1000)
      : 0;

    // Mark this participant's leftAt
    const participant = call.participants.find((p) => p.userId.equals(req.user._id));
    if (participant) participant.leftAt = now;

    await call.save();

    const io = req.app.get('io');

    // Broadcast call_ended to all participants
    if (io) {
      call.participants.forEach((p) => {
        io.to(`user:${p.userId}`).emit('call_ended', {
          callId:   call._id,
          endedBy:  req.user._id.toString(),
          duration: call.duration,
        });
      });
    }

    // Post a call_summary system message into the chat thread (idempotent upsert)
    createCallSummaryMessage(io, call).catch(() => {});

    res.status(200).json({ message: 'Call ended.', duration: call.duration });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /group-token — Issue LiveKit room token ──────────────────────────────
//
// Must be defined BEFORE /:callId routes so Express doesn't treat "group-token"
// as a callId. (It's already first in CALLS constant — double-confirmed here.)

router.post(CALLS.GROUP_TOKEN, userAuth, async (req, res) => {
  try {
    const { callId } = req.body;

    if (!callId || !validObjectId(callId)) {
      return res.status(400).json({ error: 'callId is required and must be a valid ID.' });
    }

    const call = await CallSession.findById(callId);
    if (!call) return res.status(404).json({ error: 'Call not found.' });

    // Only participants of an active (or ringing) group call may get a token
    if (call.type !== 'group') {
      return res.status(400).json({ error: 'Tokens are only issued for group calls.' });
    }
    if (!call.isParticipant(req.user._id)) {
      return res.status(403).json({ error: 'You are not a participant in this call.' });
    }
    if (!['active', 'ringing'].includes(call.status)) {
      return res.status(400).json({ error: `Cannot join a call with status "${call.status}".` });
    }

    const displayName = [req.user.firstName, req.user.lastName].filter(Boolean).join(' ');
    const token = await generateRoomToken({
      callId:      callId.toString(),
      userId:      req.user._id.toString(),
      displayName: displayName || undefined,
    });

    // Phase 6: surface the participant cap so the frontend's ParticipantGrid
    // knows when to switch overflow participants to audio-only.
    const planKey = call.isPriority ? 'premium' : 'free';
    const plan = await Plan.findOne({ key: planKey });
    const maxParticipants = plan?.features?.groupCallParticipantCap ?? 8;

    res.status(200).json({ token, room: `call:${callId}`, maxParticipants });
  } catch (err) {
    // Distinguish config errors (503) from runtime errors (500)
    if (err.message.includes('LIVEKIT_API_KEY')) {
      return res.status(503).json({ error: 'Video service is not configured.' });
    }
    res.status(500).json({ error: err.message });
  }
});

export default router;
