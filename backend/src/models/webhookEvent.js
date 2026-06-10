import mongoose from 'mongoose';

// Dedupe record for inbound webhooks: Razorpay retries deliveries with the
// same payload, so we hash the raw body and skip anything we've already
// processed (see Phase 6 RFC API contract).
const webhookEventSchema = new mongoose.Schema(
  {
    source: {
      type: String,
      required: true,
    },
    hash: {
      type: String,
      required: true,
      unique: true,
    },
  },
  { timestamps: true }
);

const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);

export default WebhookEvent;
