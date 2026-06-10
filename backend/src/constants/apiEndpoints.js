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
  // Phase 4 — linked accounts & enrichment
  // IMPORTANT: all must be registered before /:userId to avoid misrouting.
  LINKED_ACCOUNTS:     '/linked-accounts',
  GITHUB_SYNC:         '/github/sync',
  GITHUB_DISCONNECT:   '/github/disconnect',
  LINKEDIN_SYNC:       '/linkedin/sync',
  LINKEDIN_DISCONNECT: '/linkedin/disconnect',
};

// mounted at /request
export const REQUEST = {
  SEND: '/send/:status/:toUserId',      // status: interested | ignored
  REVIEW: '/review/:status/:requestId', // status: accepted | rejected
  PENDING: '/pending',                  // requests received, awaiting review
  SENT: '/sent',                        // requests sent by logged-in user
  CONNECTIONS: '/connections',          // accepted matches
  BLOCKED: '/blocked',                  // GET: list users the logged-in user has blocked
  BLOCK: '/block/:userId',              // POST: block, DELETE: unblock
  REPORT: '/report/:userId',            // POST: file a report with a reason
};

// mounted at /auth  (OAuth sub-routes under /auth/oauth)
export const OAUTH = {
  INITIATE: '/oauth/:provider',           // GET  — redirect to provider
  CALLBACK: '/oauth/:provider/callback',  // GET  — provider redirects back here
};

// mounted at /groups
export const GROUPS = {
  LIST:         '/',                        // GET  — paginated public groups
  CREATE:       '/',                        // POST — create a group
  GET:          '/:groupId',                // GET  — group detail + member list
  UPDATE:       '/:groupId',                // PATCH — admin: update name/desc/tags
  DELETE:       '/:groupId',                // DELETE — admin: soft-delete
  JOIN:         '/:groupId/join',           // POST — join a public group
  LEAVE:        '/:groupId/leave',          // DELETE — leave a group
  ADD_MEMBER:   '/:groupId/members/:userId',// POST — admin: invite member
  REMOVE_MEMBER:'/:groupId/members/:userId',// DELETE — admin: remove member
  MESSAGES:     '/:groupId/messages',       // GET  — paginated group messages
};

// mounted at /calls
export const CALLS = {
  INITIATE:     '/',                  // POST  — start a 1:1 or group call
  HISTORY:      '/',                  // GET   — paginated call history
  GET:          '/:callId',           // GET   — single call metadata
  ACCEPT:       '/:callId/accept',    // POST  — callee accepts
  DECLINE:      '/:callId/decline',   // POST  — callee declines
  END:          '/:callId/end',       // POST  — either participant ends
  GROUP_TOKEN:  '/group-token',       // POST  — get LiveKit room token (Phase 5 B1)
};

// mounted at /chat
export const CHAT = {
  CONVERSATIONS: '/conversations',                       // GET: list logged-in user's conversations
  GET_OR_CREATE: '/conversations/:userId',               // POST: get-or-create conversation with an accepted connection
  MESSAGES: '/conversations/:conversationId/messages',   // GET: paginated message history
  READ: '/conversations/:conversationId/read',           // POST: mark conversation as read
};
