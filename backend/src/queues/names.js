/**
 * Queue name constants — kept in their own module so both producers
 * (src/queues/index.js) and handlers (src/jobs/handlers.js) can import them
 * without a circular dependency.
 */
export const QUEUE = {
  EMAIL: 'email',
  AI_RECOMMENDATIONS: 'ai-recommendations',
};

export const QUEUE_NAMES = Object.values(QUEUE);
