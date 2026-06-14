# Phase 8 RFC — Developer Social Feed & Notifications

## Stack Decision

No new stack — this phase extends the existing system:
- **Backend:** Express 5 + Mongoose (new `Post`, `PostComment`, `Notification` models;
  new `posts.js`/`notifications.js` routers, same conventions as `groups.js`)
- **Real-time:** existing Socket.io instance (`app.get('io')`, `user:<id>` rooms)
- **Images:** existing Cloudinary `uploadImageBuffer` + multer memory-storage pattern
  (from `routes/profile.js`)
- **Frontend:** React + RTK Query (`api.injectEndpoints`), Tailwind/SCSS per existing
  widget conventions, `socket.io-client` via the existing `useSocket` hook

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Create Post                                                                │
│                                                                             │
│  (optional, per image) POST /posts/upload-image (multipart)               │
│       └── multer (memory) → uploadImageBuffer(buf, 'posts') → { url }     │
│                                                                             │
│  POST /posts  { content, codeSnippet?, images?: [url], tags? }            │
│       ├── validate: content || codeSnippet.code || images.length          │
│       ├── images.length <= 4                                              │
│       └── Post.create({ authorId: req.user._id, ... })                    │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│ Feed                                                                       │
│                                                                             │
│  GET /posts?scope=network|public&page=1                                   │
│       ├── excludedIds = req.user.blockedUsers + users who blocked me      │
│       ├── scope=network → authorId in {self, ...acceptedConnectionIds}    │
│       │     (ConnectionRequest, same query shape as REQUEST.CONNECTIONS)  │
│       ├── scope=public  → authorId not in excludedIds                     │
│       ├── filter: deletedAt = null                                        │
│       └── Post.find(filter).sort({createdAt:-1}).skip/limit               │
│             .populate('authorId', 'firstName lastName photoUrl')          │
│             → per-post: likedByMe = likes.includes(req.user._id);         │
│               strip raw `likes` array from response                       │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│ Like / Comment → Notification                                              │
│                                                                             │
│  POST /posts/:id/like                                                      │
│       ├── toggle membership in post.likes[], adjust likeCount             │
│       └── if newly-liked && actor != post.authorId:                       │
│             Notification.create({recipientId: authorId, actorId, type:    │
│               'post_like', postId})                                       │
│             io.to(`user:${authorId}`).emit('notification:new', notif)     │
│                                                                             │
│  POST /posts/:id/comments  { content }                                    │
│       ├── PostComment.create(...); post.commentCount += 1                │
│       └── if actor != post.authorId:                                      │
│             Notification.create({..., type: 'post_comment'})              │
│             io.to(`user:${authorId}`).emit('notification:new', notif)     │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│ Notification Center                                                        │
│                                                                             │
│  GET /notifications/unread-count → bell badge (polled via RTK Query)      │
│  GET /notifications?page=1       → dropdown list (fetched on open)        │
│  PATCH /notifications/:id/read   → mark single read                       │
│  PATCH /notifications/read-all   → mark all read                          │
│                                                                             │
│  socket 'notification:new' → dispatch(api.util.invalidateTags             │
│    (['Notifications'])) → re-fetches unread-count + open list             │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Data Models

```js
// backend/src/models/post.js
import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

const postSchema = new mongoose.Schema(
  {
    authorId: { type: ObjectId, ref: 'User', required: true },
    content:  { type: String, trim: true, maxlength: 3000, default: '' },
    codeSnippet: {
      code:     { type: String, default: null, maxlength: 10000 },
      language: { type: String, default: null, trim: true, maxlength: 32 },
    },
    images: { type: [String], default: [] },
    tags: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: 30 }],
      default: [],
    },
    likes:    { type: [{ type: ObjectId, ref: 'User' }], default: [] },
    likeCount:    { type: Number, default: 0, min: 0 },
    commentCount: { type: Number, default: 0, min: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

postSchema.index({ authorId: 1, createdAt: -1 });
postSchema.index({ deletedAt: 1, createdAt: -1 });
postSchema.index({ tags: 1 });

postSchema.methods.isLikedBy = function (userId) {
  return this.likes.some((id) => id.equals(userId));
};

export default mongoose.model('Post', postSchema);
```

```js
// backend/src/models/postComment.js
import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

const postCommentSchema = new mongoose.Schema(
  {
    postId:   { type: ObjectId, ref: 'Post', required: true },
    authorId: { type: ObjectId, ref: 'User', required: true },
    content:  { type: String, required: true, trim: true, maxlength: 1000 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

postCommentSchema.index({ postId: 1, createdAt: 1 });

export default mongoose.model('PostComment', postCommentSchema);
```

```js
// backend/src/models/notification.js
import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

const notificationSchema = new mongoose.Schema(
  {
    recipientId: { type: ObjectId, ref: 'User', required: true },
    actorId:     { type: ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      required: true,
      enum: ['post_like', 'post_comment'], // extensible in later phases
    },
    postId: { type: ObjectId, ref: 'Post', default: null },
    read:   { type: Boolean, default: false },
  },
  { timestamps: true },
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, read: 1 });

export default mongoose.model('Notification', notificationSchema);
```

---

## API Contracts

```
mounted at /posts
POST   /posts                         create a post
POST   /posts/upload-image            multipart upload, returns { url }
GET    /posts?scope=&page=            paginated feed (scope: network|public, default network)
GET    /posts/:postId                 single post detail
DELETE /posts/:postId                 soft-delete (author only)
POST   /posts/:postId/like            toggle like → { liked, likeCount }
GET    /posts/:postId/comments?page=  paginated comments (oldest first)
POST   /posts/:postId/comments        add comment { content }
DELETE /posts/:postId/comments/:commentId   delete comment (comment author or post author)

mounted at /notifications
GET    /notifications?page=           paginated, newest first
GET    /notifications/unread-count    { count }
PATCH  /notifications/:notificationId/read
PATCH  /notifications/read-all
```

New constants added to `backend/src/constants/apiEndpoints.js`:

```js
// mounted at /posts
export const POSTS = {
  LIST:           '/',
  CREATE:         '/',
  UPLOAD_IMAGE:   '/upload-image',
  GET:            '/:postId',
  DELETE:         '/:postId',
  LIKE:           '/:postId/like',
  COMMENTS:       '/:postId/comments',
  DELETE_COMMENT: '/:postId/comments/:commentId',
};

// mounted at /notifications
export const NOTIFICATIONS = {
  LIST:         '/',
  UNREAD_COUNT: '/unread-count',
  READ:         '/:notificationId/read',
  READ_ALL:     '/read-all',
};
```

### Feed query helper

```js
// connections = accepted ConnectionRequest where req.user is either side
const getConnectionIds = async (userId) => {
  const connections = await ConnectionRequest.find({
    $or: [
      { fromUserId: userId, status: 'accepted' },
      { toUserId: userId, status: 'accepted' },
    ],
  }).select('fromUserId toUserId');
  return connections.map((c) => (c.fromUserId.equals(userId) ? c.toUserId : c.fromUserId));
};
```

`excludedIds = req.user.blockedUsers + (await User.find({ blockedUsers: req.user._id }).select('_id'))`
applied to `authorId: { $nin: excludedIds }` in both scopes (network scope additionally
constrains `authorId: { $in: [self, ...connectionIds] }`).

### Pagination

Offset-based, identical shape to Groups (`page`, `pageSize`, `total`, `totalPages`,
`hasNextPage`). Posts feed: `PAGE_SIZE = 10`. Comments: `COMMENT_PAGE_SIZE = 20`.
Notifications: `PAGE_SIZE = 20`.

---

## Socket Events

- `notification:new` — emitted server→client to `user:<recipientId>` on `post_like` /
  `post_comment` creation. Payload: the populated `Notification` document
  (`actorId` populated with `firstName lastName photoUrl`).
- No new client→server events. Reuses the existing `initSockets` registration — no
  changes needed to `sockets/index.js` itself; emission happens from REST route handlers
  via `req.app.get('io')`, same as `calls.js`.

---

## Frontend Architecture

```
frontend/src/
├── pages/Posts/Posts.jsx                 # /posts route
├── containers/Posts/
│   ├── index.jsx                         # tab toggle, CreatePostBox, PostCard list, pagination
│   └── Posts.scss
├── widgets/CreatePostBox/
│   ├── CreatePostBox.jsx                 # text/snippet/image/tags composer
│   └── CreatePostBox.scss
├── widgets/PostCard/
│   ├── PostCard.jsx                      # post body + like/comment actions + inline comments
│   └── PostCard.scss
├── widgets/NotificationBell/
│   ├── NotificationBell.jsx              # bell + badge + dropdown, in NavBar
│   └── NotificationBell.scss
├── hooks/posts/postApi.js                # RTK Query endpoints for /posts
└── hooks/notifications/notificationApi.js # RTK Query endpoints for /notifications
```

### `postApi.js` (RTK Query)

```js
const postApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getFeed: builder.query({
      query: ({ scope = 'network', page = 1 } = {}) => `/posts?scope=${scope}&page=${page}`,
      providesTags: (result) => [
        ...(result?.data ?? []).map((post) => ({ type: 'Posts', id: post._id })),
        { type: 'Posts', id: 'LIST' },
      ],
    }),
    createPost: builder.mutation({
      query: (body) => ({ url: '/posts', method: 'POST', body }),
      invalidatesTags: [{ type: 'Posts', id: 'LIST' }],
    }),
    uploadPostImage: builder.mutation({
      query: (file) => {
        const formData = new FormData();
        formData.append('image', file);
        return { url: '/posts/upload-image', method: 'POST', body: formData };
      },
    }),
    likePost: builder.mutation({
      query: (postId) => ({ url: `/posts/${postId}/like`, method: 'POST' }),
      invalidatesTags: (result, error, postId) => [{ type: 'Posts', id: postId }],
    }),
    deletePost: builder.mutation({
      query: (postId) => ({ url: `/posts/${postId}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Posts', id: 'LIST' }],
    }),
    getComments: builder.query({
      query: ({ postId, page = 1 }) => `/posts/${postId}/comments?page=${page}`,
      providesTags: (result, error, { postId }) => [{ type: 'PostComments', id: postId }],
    }),
    addComment: builder.mutation({
      query: ({ postId, content }) => ({ url: `/posts/${postId}/comments`, method: 'POST', body: { content } }),
      invalidatesTags: (result, error, { postId }) => [
        { type: 'PostComments', id: postId }, { type: 'Posts', id: postId },
      ],
    }),
    deleteComment: builder.mutation({
      query: ({ postId, commentId }) => ({ url: `/posts/${postId}/comments/${commentId}`, method: 'DELETE' }),
      invalidatesTags: (result, error, { postId }) => [
        { type: 'PostComments', id: postId }, { type: 'Posts', id: postId },
      ],
    }),
  }),
});
```

### `notificationApi.js` (RTK Query)

```js
const notificationApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getNotifications: builder.query({
      query: ({ page = 1 } = {}) => `/notifications?page=${page}`,
      providesTags: ['Notifications'],
    }),
    getUnreadNotificationCount: builder.query({
      query: () => '/notifications/unread-count',
      providesTags: ['Notifications'],
    }),
    markNotificationRead: builder.mutation({
      query: (id) => ({ url: `/notifications/${id}/read`, method: 'PATCH' }),
      invalidatesTags: ['Notifications'],
    }),
    markAllNotificationsRead: builder.mutation({
      query: () => ({ url: '/notifications/read-all', method: 'PATCH' }),
      invalidatesTags: ['Notifications'],
    }),
  }),
});
```

`store/api.js` `tagTypes` gains: `'Posts'`, `'PostComments'`, `'Notifications'`.

### Routing / NavBar

- `frontend/src/routes/index.js`: add `{ path: '/posts', Page: PostsPage, guard: 'protected' }`
- `frontend/src/widgets/NavBar/NavBar.jsx`: add `{ to: '/posts', label: 'Feed' }` to `LINKS`
  (existing `/` route remains "Discover" — the swipe UI); render `<NotificationBell />`
  next to the logout button

### Real-time

`NotificationBell` uses the existing `useSocket()` hook (per-component Socket.io
connection, consistent with the Messages container's current pattern — see Risks in PRD).
On `notification:new`, dispatch `api.util.invalidateTags(['Notifications'])` to refresh the
unread-count query and, if the dropdown is open, the notification list.

---

## Existing Code Impact

| File | Change |
|---|---|
| `backend/src/models/post.js`, `postComment.js`, `notification.js` (new) | New collections |
| `backend/src/routes/posts.js` (new) | All `/posts/*` routes |
| `backend/src/routes/notifications.js` (new) | All `/notifications/*` routes |
| `backend/src/constants/apiEndpoints.js` | add `POSTS`, `NOTIFICATIONS` |
| `backend/src/app.js` | mount `/posts`, `/notifications` |
| `frontend/src/hooks/posts/postApi.js`, `hooks/notifications/notificationApi.js` (new) | RTK Query endpoints |
| `frontend/src/store/api.js` | add `'Posts'`, `'PostComments'`, `'Notifications'` tags |
| `frontend/src/pages/Posts/Posts.jsx`, `containers/Posts/*` (new) | `/posts` page |
| `frontend/src/widgets/CreatePostBox/*`, `widgets/PostCard/*`, `widgets/NotificationBell/*` (new) | UI widgets |
| `frontend/src/routes/index.js` | add `/posts` route |
| `frontend/src/widgets/NavBar/NavBar.jsx` | add "Feed" link + `NotificationBell` |

No changes to `sockets/index.js`, auth, billing, or any Phase 1–7 models.

---

## Authorization Matrix

| Endpoint | Auth | Extra checks |
|---|---|---|
| `POST /posts` | Yes | content/snippet/images non-empty; images.length ≤ 4 |
| `POST /posts/upload-image` | Yes | image MIME type, ≤ 5MB |
| `GET /posts` | Yes | excludes blocked/blocking users |
| `GET /posts/:postId` | Yes | 404 if soft-deleted |
| `DELETE /posts/:postId` | Yes | author only (403 otherwise) |
| `POST /posts/:postId/like` | Yes | 404 if soft-deleted |
| `GET/POST /posts/:postId/comments` | Yes | 404 if post soft-deleted; content non-empty |
| `DELETE /posts/:postId/comments/:commentId` | Yes | comment author OR post author (403 otherwise) |
| `GET /notifications*`, `PATCH /notifications/*` | Yes | scoped to `recipientId === req.user._id` (404 if not found/owned) |

---

## Testing Strategy

- **Models:** `Post.isLikedBy`, index presence (smoke test via query plans not required)
- **Posts routes:**
  - create: rejects empty post (no content/snippet/images), rejects >4 images
  - feed: `network` scope returns only self + accepted connections; `public` excludes
    blocked/blocking users; soft-deleted posts never returned; pagination shape matches
    Groups convention
  - like: toggling twice returns to original `likeCount`; notification created only on
    like (not unlike) and only when actor != author
  - comments: create/delete adjusts `commentCount`; delete authorization (comment author
    vs. post author vs. neither → 403)
- **Notifications routes:**
  - unread-count reflects `read: false` documents only
  - mark-read / mark-all-read scoped to `recipientId`; cross-user access returns 404
- **Socket:** emitting `notification:new` reaches the correct `user:<id>` room (mirrors
  existing `call_incoming` test pattern if one exists)
- **Frontend:** tab toggle switches `scope` query arg; CreatePostBox disables submit when
  empty; PostCard like button reflects `likedByMe` and updates count on click; comment
  delete button only shown when authorized

---

## Open Questions

- Should `GET /posts/upload-image` validate image dimensions/aspect ratio, or leave that to
  the frontend `ImagePreview`? v1 leaves it unvalidated (consistent with profile photo
  upload).
- `PAGE_SIZE` for the feed (proposed 10) vs. Groups' 20 — smaller because post cards are
  visually heavier (images/snippets); revisit based on real usage.
- Should liking/commenting on a post by a *blocked* user (edge case: block happens after a
  like) retroactively hide that like/comment? v1 does not retroactively clean up — blocking
  only affects future feed visibility, consistent with how Phase 2 blocking handles existing
  connections (deleted) vs. messages (hidden, not deleted).
