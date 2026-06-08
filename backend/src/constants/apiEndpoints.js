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
