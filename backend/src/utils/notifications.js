import Notification from '../models/notification.js';

/** Emits `notification:new` to the recipient's socket room, if Socket.io is attached. */
export const emitNotification = async (req, notification) => {
  const io = req.app.get('io');
  if (!io) return;

  const populated = await Notification.findById(notification._id)
    .populate('actorId', 'firstName lastName photoUrl');
  io.to(`user:${notification.recipientId}`).emit('notification:new', populated);
};
