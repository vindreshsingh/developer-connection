import pino from 'pino';

// Silent in tests so existing test output stays clean; pretty-printed in dev;
// plain JSON (CloudWatch-friendly) in production.
const level = process.env.NODE_ENV === 'test' ? 'silent' : process.env.LOG_LEVEL || 'info';

const transport =
  process.env.NODE_ENV === 'production'
    ? undefined
    : {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
      };

export const logger = pino({ level, transport });
