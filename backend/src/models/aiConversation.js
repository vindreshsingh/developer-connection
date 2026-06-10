import mongoose from 'mongoose';

const aiMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const aiConversationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    messages: { type: [aiMessageSchema], default: [] },
  },
  { timestamps: true }
);

const AiConversation = mongoose.model('AiConversation', aiConversationSchema);

export default AiConversation;
