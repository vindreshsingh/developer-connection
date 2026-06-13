import { logger } from '../utils/logger.js';
import { captureException } from '../utils/sentry.js';

// Final error-handling middleware — catches anything that falls through
// route-level try/catch blocks (including Express 5's automatic rejection
// of async handler promises, and body-parser errors like malformed JSON).
// Status codes < 500 keep their original message (e.g. body-parser's
// "invalid JSON" 400); 5xx errors are masked so stack traces never reach
// the client.
export const errorHandler = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || err.statusCode || 500;

  logger.error({ err, method: req.method, path: req.path }, err.message);
  if (status >= 500) captureException(err);

  res.status(status).json({ error: status < 500 ? err.message : 'Internal server error' });
};
