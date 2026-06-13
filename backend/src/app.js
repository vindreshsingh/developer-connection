import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import passport from 'passport';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { logger } from './utils/logger.js';
import healthRouter from './routes/health.js';
import authRouter from './routes/auth.js';
import oauthRouter from './routes/oauth.js';
import profileRouter from './routes/profile.js';
import connectionRouter from './routes/connection.js';
import chatRouter from './routes/chat.js';
import groupsRouter from './routes/groups.js';
import callsRouter from './routes/calls.js';
import billingRouter from './routes/billing.js';
import aiRouter from './routes/ai.js';
import notificationsRouter from './routes/notifications.js';
import { configurePassport } from './middlewares/passport.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { globalRateLimiter } from './middlewares/rateLimiter.js';

// Register Passport strategies once at startup (reads env vars at call time,
// so this must run after dotenv has loaded in server.js).
configurePassport();

const app = express();

// Security headers (X-Content-Type-Options, HSTS, frame-ancestors, etc.).
// CSP is report-only for now — this is a JSON API so most directives have
// limited effect on it directly, but report-only documents the intended
// allowlist for when the frontend (served separately) adopts a matching
// policy, and covers any HTML responses (e.g. OAuth error redirects).
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      reportOnly: true,
      directives: {
        connectSrc: [
          "'self'",
          'https://api.razorpay.com',
          'https://res.cloudinary.com',
          'ws://localhost:7880',
          'wss://*.livekit.cloud',
        ],
        imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
        frameSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
        scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
      },
    },
  })
);

app.use(
  pinoHttp({
    logger,
    customLogLevel: (req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  })
);

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

// Mounted before the global rate limiter so load-balancer health checks are
// never throttled.
app.use('/health', healthRouter);

app.use(globalRateLimiter);

app.use('/auth', authRouter);
app.use('/auth', oauthRouter); // /auth/oauth/:provider  +  /auth/oauth/:provider/callback
app.use('/profile', profileRouter);
app.use('/request', connectionRouter);
app.use('/chat', chatRouter);
app.use('/groups', groupsRouter);
app.use('/calls', callsRouter);
app.use('/billing', billingRouter);
app.use('/ai', aiRouter);
app.use('/notifications', notificationsRouter);

app.use(errorHandler);

export default app;
