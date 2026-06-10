// mounted at /auth
export const AUTH = {
  SIGNUP: '/signup',
  LOGIN: '/login',
  LOGOUT: '/logout',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password/:token',
  VERIFY_EMAIL: '/verify-email/:token',
  RESEND_VERIFICATION: '/resend-verification',
};

// mounted at /profile
export const PROFILE = {
  VIEW: '/',        // GET own profile via token (no userId needed)
  EDIT: '/',        // PATCH own profile via token (no userId needed)
  DELETE: '/',      // DELETE own profile via token (no userId needed)
  VIEW_BY_ID: '/:userId', // GET any user's public profile
  FEED: '/feed',
  PHOTO: '/photo',
  COVER: '/cover',
};

// mounted at /request
export const REQUEST = {
  SEND: '/send/:status/:toUserId',      // status: interested | ignored
  REVIEW: '/review/:status/:requestId', // status: accepted | rejected
  PENDING: '/pending',                  // requests received, awaiting review
  SENT: '/sent',                        // requests sent by logged-in user
  CONNECTIONS: '/connections',          // accepted matches
  BLOCK: '/block/:userId',              // POST: block, DELETE: unblock
  REPORT: '/report/:userId',            // POST: file a report with a reason
};

// mounted at /chat
export const CHAT = {
  CONVERSATIONS: '/conversations',                       // GET: list logged-in user's conversations
  GET_OR_CREATE: '/conversations/:userId',               // POST: get-or-create conversation with an accepted connection
  MESSAGES: '/conversations/:conversationId/messages',   // GET: paginated message history
  READ: '/conversations/:conversationId/read',           // POST: mark conversation as read
};

// mounted at /billing
export const BILLING = {
  STATUS: '/status',     // GET: current plan/status/renewal date
  CHECKOUT: '/checkout', // POST: create a Razorpay subscription, return Checkout.js params
  CANCEL: '/cancel',     // POST: cancel at period end
};

// mounted at /billing/webhook (separate router, raw body for signature verification)
export const BILLING_WEBHOOK = '/';

// mounted at /ai
export const AI = {
  PROFILE_FEEDBACK: '/profile-feedback',  // POST: AI feedback on the caller's own profile
  MATCH_INSIGHT: '/match-insight/:userId', // POST: "why connect" insight for caller + target user
};
