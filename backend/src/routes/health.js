import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// Unauthenticated, unrate-limited — used by load balancer / container health checks.
router.get('/', (req, res) => {
  const mongoConnected = mongoose.connection.readyState === 1;

  if (!mongoConnected) {
    return res.status(503).json({ status: 'error', mongo: 'disconnected' });
  }

  res.status(200).json({ status: 'ok', mongo: 'connected' });
});

export default router;
