/**
 * Notifications REST API — mounted at /notifications in app.js.
 *
 * Authorization matrix (from RFC):
 *   GET   /                  logged in — own notifications, paginated
 *   GET   /unread-count      logged in — own unread count
 *   PATCH /:notificationId/read  logged in — must own the notification (404 otherwise)
 *   PATCH /read-all          logged in — marks all of the user's unread notifications as read
 */

import express from 'express';
import mongoose from 'mongoose';
import userAuth from '../middlewares/auth.js';
import { NOTIFICATIONS } from '../constants/apiEndpoints.js';
import Notification from '../models/notification.js';

const router = express.Router();
const PAGE_SIZE = 20;

const validObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ── GET / — List paginated notifications, newest-first ────────────────────────

router.get(NOTIFICATIONS.LIST, userAuth, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);

    const filter = { recipientId: req.user._id };

    const total = await Notification.countDocuments(filter);
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .populate('actorId', 'firstName lastName photoUrl');

    res.status(200).json({
      data: notifications,
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

// ── GET /unread-count ──────────────────────────────────────────────────────────

router.get(NOTIFICATIONS.UNREAD_COUNT, userAuth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      recipientId: req.user._id,
      read: false,
    });

    res.status(200).json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /:notificationId/read ────────────────────────────────────────────────

router.patch(NOTIFICATIONS.READ, userAuth, async (req, res) => {
  try {
    const { notificationId } = req.params;
    if (!validObjectId(notificationId))
      return res.status(404).json({ error: 'Notification not found.' });

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, recipientId: req.user._id },
      { read: true },
      { new: true },
    );

    if (!notification) return res.status(404).json({ error: 'Notification not found.' });

    res.status(200).json({ notification });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /read-all ──────────────────────────────────────────────────────────────

router.patch(NOTIFICATIONS.READ_ALL, userAuth, async (req, res) => {
  try {
    await Notification.updateMany(
      { recipientId: req.user._id, read: false },
      { read: true },
    );

    res.status(200).json({ message: 'All notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
