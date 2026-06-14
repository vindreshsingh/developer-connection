import mongoose from 'mongoose';

const { ObjectId } = mongoose.Schema.Types;

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type:     ObjectId,
      ref:      'User',
      required: true,
    },
    actorId: {
      type:     ObjectId,
      ref:      'User',
      required: true,
    },
    type: {
      type:     String,
      required: true,
      enum: {
        values: [
          'post_like', 'post_comment',
          'job_application', 'job_application_status', // Phase 9
        ],
        message: '{VALUE} is not a valid notification type',
      },
    },
    postId: {
      type:    ObjectId,
      ref:     'Post',
      default: null,
    },
    jobId: {
      type:    ObjectId,
      ref:     'JobPosting',
      default: null,
    },
    read: {
      type:    Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, read: 1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
