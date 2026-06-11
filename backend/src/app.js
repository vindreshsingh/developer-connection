import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import passport from 'passport';
import authRouter from './routes/auth.js';
import oauthRouter from './routes/oauth.js';
import profileRouter from './routes/profile.js';
import connectionRouter from './routes/connection.js';
import chatRouter from './routes/chat.js';
import groupsRouter from './routes/groups.js';
import callsRouter from './routes/calls.js';
import billingRouter from './routes/billing.js';
import aiRouter from './routes/ai.js';
import { configurePassport } from './middlewares/passport.js';

// Register Passport strategies once at startup (reads env vars at call time,
// so this must run after dotenv has loaded in server.js).
configurePassport();

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  })
);
// Razorpay webhook signature verification needs the exact raw bytes of the
// request body, so this path is excluded from express.json() below (body-
// parser middlewares skip a request whose body has already been parsed).
app.use('/billing/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize()); // required for passport; no session middleware needed

app.use('/auth', authRouter);
app.use('/auth', oauthRouter); // /auth/oauth/:provider  +  /auth/oauth/:provider/callback
app.use('/profile', profileRouter);
app.use('/request', connectionRouter);
app.use('/chat', chatRouter);
app.use('/groups', groupsRouter);
app.use('/calls', callsRouter);
app.use('/billing', billingRouter);
app.use('/ai', aiRouter);

export default app;
