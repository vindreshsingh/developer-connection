import express from 'express';
import mongoose from 'mongoose';
import User from '../models/user.js';
import ConnectionRequest from '../models/connectionRequest.js';
import userAuth from '../middlewares/auth.js';
import { PROFILE } from '../constants/apiEndpoints.js';

const router = express.Router();

const ALLOWED_UPDATES = [
  'firstName',
  'lastName',
  'password',
  'photoUrl',
  'coverImageUrl',
  'bio',
  'skills',
  'techStack',
  'experience',
  'githubUrl',
  'linkedinUrl',
  'age',
  'gender',
];

router.get(PROFILE.VIEW, userAuth, (req, res) => {
  res.status(200).json(req.user);
});

router.patch(PROFILE.EDIT, userAuth, async (req, res) => {
  try {
    const invalidFields = Object.keys(req.body).filter((k) => !ALLOWED_UPDATES.includes(k));
    if (invalidFields.length > 0)
      return res.status(400).json({ error: `Invalid fields: ${invalidFields.join(', ')}` });

    const user = await User.findByIdAndUpdate(req.user._id, req.body, { new: true, runValidators: true });
    res.status(200).json({ message: 'Profile updated successfully', user });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete(PROFILE.DELETE, userAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isActive: false, deletedAt: new Date() });
    res.clearCookie('token');
    res.status(200).json({ message: 'Account deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const FEED_PAGE_SIZE = 20;
const PUBLIC_PROFILE_FIELDS = 'firstName lastName photoUrl bio skills githubUrl linkedinUrl age gender';

router.get(PROFILE.VIEW_BY_ID, userAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(userId))
      return res.status(400).json({ error: 'Invalid user id' });

    const user = await User.findById(userId).select(PUBLIC_PROFILE_FIELDS);
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get(PROFILE.FEED, userAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const loggedInUserId = req.user._id;

    const interactions = await ConnectionRequest.find({
      $or: [{ fromUserId: loggedInUserId }, { toUserId: loggedInUserId }],
    }).select('fromUserId toUserId');

    const excludedIds = new Set([loggedInUserId.toString()]);
    for (const r of interactions) {
      excludedIds.add(r.fromUserId.toString());
      excludedIds.add(r.toUserId.toString());
    }

    const total = await User.countDocuments({ _id: { $nin: [...excludedIds] } });
    const users = await User.find({ _id: { $nin: [...excludedIds] } })
      .select(PUBLIC_PROFILE_FIELDS)
      .skip((page - 1) * FEED_PAGE_SIZE)
      .limit(FEED_PAGE_SIZE);

    res.status(200).json({
      data: users,
      pagination: {
        page,
        pageSize: FEED_PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / FEED_PAGE_SIZE),
        hasNextPage: page * FEED_PAGE_SIZE < total,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
