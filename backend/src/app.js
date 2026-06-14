/**
 * Legacy monolith HTTP shell — all domain routes now live in microservices
 * behind the API gateway (developer-connection-microservices). This process
 * only exposes /health for ALB checks and gateway fallthrough during cutover.
 *
 * Socket.IO has moved to realtime-gateway (M5).
 * Auth/profile moved to identity-service + profile-service (M6).
 */

import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { logger } from './utils/logger.js';
import healthRouter from './routes/health.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

app.use(
  pinoHttp({
    logger,
    customLogLevel: (req, res, err) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  }),
);

app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
  }),
);

app.use('/health', healthRouter);

app.use((_req, res) => {
  res.status(404).json({
    error: 'This route has moved to the API gateway microservices stack.',
  });
});

app.use(errorHandler);

export default app;
