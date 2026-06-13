import express from 'express';
import mongoose from 'mongoose';
import userAuth from '../middlewares/auth.js';
import { REQUEST } from '../constants/apiEndpoints.js';
import ConnectionRequest from '../models/connectionRequest.js';
import Report from '../models/report.js';
import User from '../models/user.js';

const router = express.Router();

router.post(REQUEST.SEND, userAuth, async (req, res) => {
  try {
    const fromUserId = req.user._id;
    const { status, toUserId } = req.params;

    // 1. Only 'interested' or 'ignored' allowed when sending a request
    const ALLOWED_STATUS = ['interested', 'ignored'];
    if (!ALLOWED_STATUS.includes(status))
      return res.status(400).json({ error: 'Invalid status. Use interested or ignored' });

    // 2. Validate toUserId format
    if (!mongoose.Types.ObjectId.isValid(toUserId))
      return res.status(400).json({ error: 'Invalid user id' });

    // 3. Check if toUser exists and is active
    const toUser = await User.findById(toUserId);
    if (!toUser) return res.status(404).json({ error: 'User not found' });

    // 5. Check if a request already exists between these two users (in either direction)
    const existingRequest = await ConnectionRequest.findOne({
      $or: [
        { fromUserId, toUserId },
        { fromUserId: toUserId, toUserId: fromUserId },
      ],
    });
    if (existingRequest)
      return res.status(400).json({ error: 'Connection request already exists' });

    // 6. Create and save the request
    const request = new ConnectionRequest({ fromUserId, toUserId, status });
    await request.save();

    res.status(201).json({ message: `Request ${status} sent to ${toUser.firstName}`, request });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(REQUEST.REVIEW, userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user._id;
    const { status, requestId } = req.params;

    // 1. Only 'accepted' or 'rejected' allowed when reviewing
    const ALLOWED_STATUS = ['accepted', 'rejected'];
    if (!ALLOWED_STATUS.includes(status))
      return res.status(400).json({ error: 'Invalid status. Use accepted or rejected' });

    // 2. Validate requestId format
    if (!mongoose.Types.ObjectId.isValid(requestId))
      return res.status(400).json({ error: 'Invalid request id' });

    // 3. Find the request — must be sent TO the logged-in user and in 'interested' state
    //    (only interested requests need review, ignored ones don't appear to the other user)
    const connectionRequest = await ConnectionRequest.findOne({
      _id: requestId,
      toUserId: loggedInUser,
      status: 'interested',
    });

    if (!connectionRequest)
      return res.status(404).json({ error: 'Connection request not found' });

    // 4. Update status to accepted or rejected
    connectionRequest.status = status;
    await connectionRequest.save();

    res.status(200).json({ message: `Request ${status}`, connectionRequest });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get(REQUEST.PENDING, userAuth, async (req, res) => {
  try {
    const pendingRequests = await ConnectionRequest.find({
      toUserId: req.user._id,
      status: 'interested',
    }).populate('fromUserId', 'firstName lastName photoUrl bio skills');

    res.status(200).json({ count: pendingRequests.length, data: pendingRequests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get(REQUEST.SENT, userAuth, async (req, res) => {
  try {
    const sentRequests = await ConnectionRequest.find({
      fromUserId: req.user._id,
    }).populate('toUserId', 'firstName lastName photoUrl bio skills');

    res.status(200).json({ count: sentRequests.length, data: sentRequests });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get(REQUEST.CONNECTIONS, userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user._id;

    // Find all accepted requests where logged-in user is either sender or receiver
    const connections = await ConnectionRequest.find({
      $or: [
        { fromUserId: loggedInUser, status: 'accepted' },
        { toUserId: loggedInUser, status: 'accepted' },
      ],
    })
      .populate('fromUserId', 'firstName lastName photoUrl bio skills')
      .populate('toUserId', 'firstName lastName photoUrl bio skills');

    // Return the other user's data (not the logged-in user)
    const data = connections.map((conn) => {
      return conn.fromUserId._id.equals(loggedInUser) ? conn.toUserId : conn.fromUserId;
    });

    res.status(200).json({ count: data.length, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get(REQUEST.BLOCKED, userAuth, async (req, res) => {
  try {
    await req.user.populate('blockedUsers', 'firstName lastName photoUrl bio skills');

    // Soft-deleted users are filtered out by User's pre-find hook, leaving nulls in the populated array
    const data = req.user.blockedUsers.filter(Boolean);

    res.status(200).json({ count: data.length, data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(REQUEST.BLOCK, userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ error: 'Invalid user id' });
    if (loggedInUser._id.equals(userId))
      return res.status(400).json({ error: 'Cannot block yourself' });

    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    if (!loggedInUser.blockedUsers.some((id) => id.equals(userId))) {
      loggedInUser.blockedUsers.push(userId);
      await loggedInUser.save();
    }

    // Blocking ends any existing connection/request between the two users so
    // a blocked user disappears from connections, requests, and the feed.
    await ConnectionRequest.deleteMany({
      $or: [
        { fromUserId: loggedInUser._id, toUserId: userId },
        { fromUserId: userId, toUserId: loggedInUser._id },
      ],
    });

    res.status(200).json({ message: `${targetUser.firstName} has been blocked` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete(REQUEST.BLOCK, userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user;
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ error: 'Invalid user id' });

    loggedInUser.blockedUsers = loggedInUser.blockedUsers.filter((id) => !id.equals(userId));
    await loggedInUser.save();

    res.status(200).json({ message: 'User unblocked' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(REQUEST.REPORT, userAuth, async (req, res) => {
  try {
    const loggedInUser = req.user._id;
    const { userId } = req.params;
    const { reason } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ error: 'Invalid user id' });
    if (!reason || !reason.trim())
      return res.status(400).json({ error: 'A reason is required to file a report' });

    const targetUser = await User.findById(userId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    const report = new Report({ reporterId: loggedInUser, reportedUserId: userId, reason: reason.trim() });
    await report.save();

    res.status(201).json({ message: `${targetUser.firstName} has been reported`, report });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
