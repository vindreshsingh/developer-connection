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

// mounted at /billing
export const BILLING = {
  PLANS:        '/plans',        // GET    — public list of active plans
  CHECKOUT:     '/checkout',      // POST   — create a Razorpay subscription order
  WEBHOOK:      '/webhook',       // POST   — Razorpay webhook receiver (signature-verified)
  SUBSCRIPTION: '/subscription',  // GET    — logged-in user's current subscription
  CANCEL:       '/cancel',        // POST   — cancel at period end
  HISTORY:      '/history',       // GET    — paginated PaymentEvent history
};

// mounted at /ai
export const AI = {
  RECOMMENDATIONS:         '/recommendations',                // GET  — cached AI match suggestions
  RECOMMENDATIONS_DISMISS: '/recommendations/:userId/dismiss', // POST — hide a suggestion for 14 days
  RESUME_FEEDBACK:         '/resume-feedback',                 // POST multipart, GET paginated history
  INTERVIEW_START:         '/interview/start',                 // POST — { focusArea? } -> { sessionId, question }
  INTERVIEW_RESPOND:       '/interview/:sessionId/respond',    // POST — { answer } -> { feedback, nextQuestion }
  INTERVIEW_END:           '/interview/:sessionId/end',        // POST — mark session completed
  INTERVIEW_LIST:          '/interview',                       // GET  — paginated session summaries
  INTERVIEW_GET:           '/interview/:sessionId',            // GET  — full transcript
};

// mounted at /posts
export const POSTS = {
  LIST:           '/',                          // GET  — paginated feed (?scope=network|public&page=1)
  CREATE:         '/',                          // POST — create a post
  UPLOAD_IMAGE:   '/upload-image',              // POST multipart — upload an image, returns { url }
  GET:            '/:postId',                   // GET  — single post detail
  DELETE:         '/:postId',                   // DELETE — author: soft-delete
  LIKE:           '/:postId/like',              // POST — toggle like
  COMMENTS:       '/:postId/comments',          // GET (paginated) / POST — comments
  DELETE_COMMENT: '/:postId/comments/:commentId', // DELETE — comment author or post author
};

// mounted at /notifications
export const NOTIFICATIONS = {
  LIST:         '/',                  // GET   — paginated notifications
  UNREAD_COUNT: '/unread-count',      // GET   — { count }
  READ:         '/:notificationId/read', // PATCH — mark single notification as read
  READ_ALL:     '/read-all',          // PATCH — mark all as read
};

// mounted at /chat
export const CHAT = {
  CONVERSATIONS: '/conversations',                       // GET: list logged-in user's conversations
  GET_OR_CREATE: '/conversations/:userId',               // POST: get-or-create conversation with an accepted connection
  MESSAGES: '/conversations/:conversationId/messages',   // GET: paginated message history
  READ: '/conversations/:conversationId/read',           // POST: mark conversation as read
};
