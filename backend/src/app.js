import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRouter from './routes/auth.js';
import profileRouter from './routes/profile.js';
import connectionRouter from './routes/connection.js';
import chatRouter from './routes/chat.js';
import billingRouter from './routes/billing.js';
import billingWebhookRouter from './routes/billingWebhook.js';
import aiRouter from './routes/ai.js';

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);

// Mounted before express.json() — Razorpay webhook signature verification
// needs the raw request body, not the parsed JSON.
app.use('/billing/webhook', express.raw({ type: 'application/json' }), billingWebhookRouter);

app.use(express.json());
app.use(cookieParser());

app.use('/auth', authRouter);
app.use('/profile', profileRouter);
app.use('/request', connectionRouter);
app.use('/chat', chatRouter);
app.use('/billing', billingRouter);
app.use('/ai', aiRouter);

export default app;
