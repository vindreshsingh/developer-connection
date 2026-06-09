import mongoose from 'mongoose';

const connectionRequestSchema = new mongoose.Schema(
  {
    fromUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    toUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ['interested', 'ignored', 'accepted', 'rejected'],
        message: '{VALUE} is not a valid status',
      },
    },
  },
  { timestamps: true }
);

// Index for fast lookup and to prevent duplicate requests
connectionRequestSchema.index({ fromUserId: 1, toUserId: 1 }, { unique: true });

connectionRequestSchema.pre('save', function () {
  if (this.fromUserId.equals(this.toUserId))
    throw new Error('Cannot send connection request to yourself');
});

const ConnectionRequest = mongoose.model('ConnectionRequest', connectionRequestSchema);

export default ConnectionRequest;
