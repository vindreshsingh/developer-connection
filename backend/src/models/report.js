import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reporterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reportedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 500,
    },
    status: {
      type: String,
      required: true,
      enum: {
        values: ['pending', 'reviewed'],
        message: '{VALUE} is not a valid status',
      },
      default: 'pending',
    },
  },
  { timestamps: true }
);

reportSchema.index({ reporterId: 1, reportedUserId: 1 });

reportSchema.pre('save', function () {
  if (this.reporterId.equals(this.reportedUserId))
    throw new Error('Cannot report yourself');
});

const Report = mongoose.model('Report', reportSchema);

export default Report;
