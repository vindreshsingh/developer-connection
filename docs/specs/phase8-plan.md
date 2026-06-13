# Implementation Plan — Phase 8 (Developer Social Feed & Notifications)

Two backend tracks and two frontend tracks. The RFC's API contract is the seam between
backend and frontend, so frontend tracks can start as soon as the contract is locked
(it already is, in `phase8-developer-feed-rfc.md`) — they don't need to wait for backend
code to merge, only for the contract to stay stable.

## Dependency Graph

```
Track A — Backend: Posts                Track B — Backend: Notifications
─────────────────────────              ──────────────────────────────
Task A1: Post + PostComment models      Task B1: Notification model +
  + POSTS endpoint constants                /notifications routes +
    │                                        NOTIFICATIONS constants
Task A2: Posts routes — create,             │
  upload-image, feed, get, delete            │
    │                                        │
Task A3: Like + Comments routes  ◄───────────┘ (creates Notification docs)
    │                                        │
    └──────────────┬─────────────────────────┘
                    │
              Task B2: Socket emission (`notification:new`)
              wired into A3's like/comment handlers


Track C — Frontend: Feed                Track D — Frontend: Notifications
─────────────────────────              ──────────────────────────────
Task C1: postApi.js + tag types         Task D1: notificationApi.js + tag types
    │                                        │
Task C2: CreatePostBox widget           Task D2: NotificationBell widget +
    │                                        NavBar integration + socket listener
Task C3: PostCard widget                     │  (real-time portion needs B2)
  (incl. inline comments)
    │
Task C4: Posts page/container,
  routing, NavBar "Feed" link
```

`A1 → A2 → A3 → B2` is the backend critical path (B2 needs both A3's like/comment hooks
and B1's `Notification` model + emit helper). `B1` itself has no dependency on Track A and
can be built in parallel with A1/A2. Track C (`C1 → C2/C3 → C4`) and Track D
(`D1 → D2`) can each proceed against the documented contract; D2's real-time piece should
land after B2 to be testable end-to-end, but the polling/dropdown UI doesn't strictly need
it.

---

## Track A — Backend: Posts

---

### Task A1 — `Post` + `PostComment` models, `POSTS` constants

**Description:**
Add the two new Mongoose models and the `POSTS` route-path constants, per the RFC's exact
schemas (indexes, `isLikedBy` helper, soft-delete `deletedAt`).

**Acceptance criteria:**
- `backend/src/models/post.js` matches RFC schema: `authorId`, `content`, `codeSnippet
  {code, language}`, `images[]`, `tags[]`, `likes[]`, `likeCount`, `commentCount`,
  `deletedAt`, timestamps; indexes on `(authorId, createdAt)`, `(deletedAt, createdAt)`,
  `tags`; `isLikedBy(userId)` method
- `backend/src/models/postComment.js` matches RFC schema; index on `(postId, createdAt)`
- `backend/src/constants/apiEndpoints.js` gains `POSTS` (LIST, CREATE, UPLOAD_IMAGE, GET,
  DELETE, LIKE, COMMENTS, DELETE_COMMENT)
- `npm test` (backend) passes — no existing tests broken by new models

**Files:**
- `backend/src/models/post.js` (new)
- `backend/src/models/postComment.js` (new)
- `backend/src/constants/apiEndpoints.js`

**Estimated scope:** XS

---

### Task A2 — Posts routes: create, upload-image, feed, get, delete

**Description:**
New `backend/src/routes/posts.js`, mounted at `/posts` in `app.js`. Implements post
creation (with validation), image upload (multer + Cloudinary, mirroring
`routes/profile.js`'s `handleImageUpload` pattern), the network/public feed query
(including the blocked-user exclusion and `getConnectionIds` helper from the RFC), single
post fetch, and author-only soft-delete.

**Acceptance criteria:**
- `POST /posts` — 400 if `content`, `codeSnippet.code`, and `images` are all empty; 400 if
  `images.length > 4`; populates `authorId` (`firstName lastName photoUrl`) on response
- `POST /posts/upload-image` — multer memory storage, 5MB limit, image MIME types only
  (same limits as profile photo upload); returns `{ url }` from `uploadImageBuffer`
- `GET /posts?scope=network|public&page=1` — `network` (default) = self +
  `getConnectionIds(req.user._id)`; `public` = all; both apply
  `authorId: { $nin: excludedIds }` where `excludedIds` = `req.user.blockedUsers` ∪ users
  who blocked `req.user`; `deletedAt: null`; response includes `likedByMe` per post and
  omits raw `likes[]`; pagination shape matches Groups (`page`, `pageSize`, `total`,
  `totalPages`, `hasNextPage`), `PAGE_SIZE = 10`
- `GET /posts/:postId` — 404 if missing or soft-deleted; same shape as feed item
- `DELETE /posts/:postId` — sets `deletedAt`; 403 if `req.user._id` isn't `authorId`; 404
  if already deleted/missing
- `backend/src/app.js` mounts `app.use('/posts', postsRouter)`
- New test file covers: empty-post rejection, >4 images rejection, network vs. public
  feed filtering (including a blocked-user case), soft-delete authorization, 404s for
  soft-deleted posts
- `npm test` passes

**Files:**
- `backend/src/routes/posts.js` (new)
- `backend/src/app.js`
- `backend/src/__tests__/posts.test.js` (new)

**Estimated scope:** M

---

### Task A3 — Like + Comments routes

**Description:**
Extend `posts.js` with toggle-like and flat-comment endpoints. This task creates
`Notification` documents (depends on B1's model existing) but the socket emission itself
is Task B2 — A3 can use a no-op/stub emit helper if landed before B1, or simply be
sequenced after B1.

**Acceptance criteria:**
- `POST /posts/:postId/like` — toggles membership in `post.likes[]`, adjusts `likeCount`
  (never below 0); returns `{ liked, likeCount }`; 404 if post missing/soft-deleted; on a
  *new* like where `actor != post.authorId`, creates a `Notification`
  (`type: 'post_like'`)
- `GET /posts/:postId/comments?page=1` — oldest-first, `COMMENT_PAGE_SIZE = 20`,
  `authorId` populated; same pagination shape
- `POST /posts/:postId/comments` — 400 on empty/oversized (`>1000` chars) content;
  creates `PostComment`, increments `post.commentCount`; on success where
  `actor != post.authorId`, creates a `Notification` (`type: 'post_comment'`)
- `DELETE /posts/:postId/comments/:commentId` — soft-deletes comment, decrements
  `post.commentCount` (never below 0); 403 unless requester is the comment author or the
  post author; 404 if comment/post missing
- Test file covers: like toggling (like → unlike returns `likeCount` to original), no
  notification on self-like, comment create/delete adjusts `commentCount`, delete
  authorization matrix (comment author / post author / neither)
- `npm test` passes

**Files:**
- `backend/src/routes/posts.js`
- `backend/src/__tests__/posts.test.js`

**Estimated scope:** M

---

## Track B — Backend: Notifications

---

### Task B1 — `Notification` model + `/notifications` routes

**Description:**
New model and router, independent of Track A's post logic (only references `Post` by
ObjectId, no populated joins required for the list/unread-count endpoints).

**Acceptance criteria:**
- `backend/src/models/notification.js` matches RFC schema: `recipientId`, `actorId`,
  `type` (enum `['post_like', 'post_comment']`), `postId`, `read`, timestamps; indexes on
  `(recipientId, createdAt)` and `(recipientId, read)`
- `backend/src/constants/apiEndpoints.js` gains `NOTIFICATIONS` (LIST, UNREAD_COUNT, READ,
  READ_ALL)
- `GET /notifications?page=1` — newest-first, `actorId` populated
  (`firstName lastName photoUrl`), `PAGE_SIZE = 20`, same pagination shape
- `GET /notifications/unread-count` — `{ count }` where `read: false`
- `PATCH /notifications/:notificationId/read` — scoped to `recipientId === req.user._id`
  (404 otherwise); sets `read: true`
- `PATCH /notifications/read-all` — bulk-updates all of the user's unread notifications
- `backend/src/app.js` mounts `app.use('/notifications', notificationsRouter)`
- New test file covers: pagination, unread-count accuracy, read/read-all scoping
  (cross-user access returns 404)
- `npm test` passes

**Files:**
- `backend/src/models/notification.js` (new)
- `backend/src/routes/notifications.js` (new)
- `backend/src/constants/apiEndpoints.js`
- `backend/src/app.js`
- `backend/src/__tests__/notifications.test.js` (new)

**Estimated scope:** S

---

### Task B2 — Socket emission for `notification:new`

**Description:**
Add a small emit helper and call it from A3's like/comment handlers when a `Notification`
is created. No changes to `sockets/index.js` — reuses the existing `io.to('user:<id>')`
room convention (`req.app.get('io')`), same as `routes/calls.js`.

**Acceptance criteria:**
- Helper (e.g. `emitNotification(req, notification)` in `posts.js` or a small shared
  util) populates `actorId` (`firstName lastName photoUrl`) and emits
  `io.to('user:' + notification.recipientId).emit('notification:new', notification)`
- Called from both the like and comment handlers, only when a `Notification` was created
  (i.e. not on self-like/self-comment)
- If `req.app.get('io')` is undefined (e.g. in some test setups), emission is skipped
  without throwing — mirrors `calls.js`'s `if (io) { ... }` guard
- Test (or extension of A3's tests) verifies a notification-creating action results in an
  `io.to(...).emit(...)` call (mock/spy on `io`, consistent with any existing socket-emit
  test pattern for calls)
- `npm test` passes

**Files:**
- `backend/src/routes/posts.js`
- `backend/src/__tests__/posts.test.js`

**Estimated scope:** XS

---

## Track C — Frontend: Feed

---

### Task C1 — `postApi.js` + cache tags

**Description:**
RTK Query endpoint definitions for all `/posts/*` routes, per the RFC, plus new tag types
in `store/api.js`.

**Acceptance criteria:**
- `frontend/src/store/api.js` `tagTypes` gains `'Posts'`, `'PostComments'`
- `frontend/src/hooks/posts/postApi.js` exports: `useGetFeedQuery`,
  `useCreatePostMutation`, `useUploadPostImageMutation`, `useLikePostMutation`,
  `useDeletePostMutation`, `useGetCommentsQuery`, `useAddCommentMutation`,
  `useDeleteCommentMutation` — query/cache-tag shapes exactly as specified in the RFC
- `npm run lint` (frontend) passes

**Files:**
- `frontend/src/store/api.js`
- `frontend/src/hooks/posts/postApi.js` (new)

**Estimated scope:** XS

---

### Task C2 — `CreatePostBox` widget

**Description:**
Post composer: text area, code-snippet toggle (reusing `SUPPORTED_LANGUAGES` from
`SnippetBlock/snippetLanguages.js`, following `MessageComposer`'s toggle pattern), image
upload (up to 4, via `useUploadPostImageMutation` + `FileInput`/`ImagePreview`,
following `ImageUploadPanel`'s pattern), and a comma-separated tags input (following
`Groups`'s tag-input pattern). Submits via `useCreatePostMutation`.

**Acceptance criteria:**
- Submit button disabled when content, code, and images are all empty, or while posting
- Snippet toggle shows a language `<select>` + textarea; submitted `codeSnippet` is
  `undefined` when toggle is off
- Each selected image is uploaded immediately on selection; previews shown with a remove
  (×) control; upload disabled at 4 images with a counter hint
- On successful submit, form resets (content, code, tags, images) and the feed list
  (`{ type: 'Posts', id: 'LIST' }`) is invalidated
- Errors surfaced via `getApiErrorMessage`, consistent with `Groups`'s create-form error
  display
- `npm run lint` passes

**Files:**
- `frontend/src/widgets/CreatePostBox/CreatePostBox.jsx` (new)
- `frontend/src/widgets/CreatePostBox/CreatePostBox.scss` (new)

**Estimated scope:** M

---

### Task C3 — `PostCard` widget (incl. inline comments)

**Description:**
Renders a single post: author header (avatar, name, timestamp, link to `/users/:id`),
content text, `SnippetBlock` for `codeSnippet`, image grid, tags, like/comment action bar,
and an expandable inline comment thread (list + add/delete + pagination via
`useGetCommentsQuery`, skipped until expanded).

**Acceptance criteria:**
- Like button toggles via `useLikePostMutation`, reflects `post.likedByMe`/`likeCount`
  immediately after the round-trip (tag invalidation per C1)
- Comment button toggles an inline panel; `useGetCommentsQuery({ postId })` is `skip`ped
  until first expanded
- Comment composer adds via `useAddCommentMutation`; each comment shows a delete (×) if
  `req.user` is the comment author or the post author (`useDeleteCommentMutation`)
- Delete-post control (e.g. 🗑) shown only when `post.authorId._id === user._id`, calls
  `useDeletePostMutation` after a confirm
- Images render via `ImagePreview`; code snippets via existing `SnippetBlock` (language +
  syntax highlighting reused as-is)
- `npm run lint` passes

**Files:**
- `frontend/src/widgets/PostCard/PostCard.jsx` (new)
- `frontend/src/widgets/PostCard/PostCard.scss` (new)

**Estimated scope:** M

---

### Task C4 — `/posts` page, container, routing, NavBar link

**Description:**
Wires C2/C3 together into the Feed page: a "My Network" / "Discover" tab toggle
(`scope` state → `useGetFeedQuery`), `CreatePostBox` at top, paginated `PostCard` list,
Prev/Next pagination (mirroring `Groups`'s container). Registers the `/posts` route and
adds a "Feed" link to `NavBar`.

**Acceptance criteria:**
- `frontend/src/pages/Posts/Posts.jsx` → `frontend/src/containers/Posts/index.jsx`
  following the Groups page/container split
- Tab toggle switches `scope` (`network`|`public`) and resets `page` to 1; empty-state
  copy differs by scope (per RFC/PRD: nudge toward Discover when Network is empty)
- Prev/Next pagination disabled appropriately at bounds and while `isFetching`
- `frontend/src/routes/index.js` adds `{ path: '/posts', Page: PostsPage, guard:
  'protected' }`
- `frontend/src/widgets/NavBar/NavBar.jsx` `LINKS` gains `{ to: '/posts', label: 'Feed' }`
  (existing `/` "Discover" swipe page is unchanged)
- `npm run lint` and `npm run build` (frontend) pass

**Files:**
- `frontend/src/pages/Posts/Posts.jsx` (new)
- `frontend/src/containers/Posts/index.jsx` (new)
- `frontend/src/containers/Posts/Posts.scss` (new)
- `frontend/src/routes/index.js`
- `frontend/src/widgets/NavBar/NavBar.jsx`

**Estimated scope:** S

---

## Track D — Frontend: Notifications

---

### Task D1 — `notificationApi.js` + cache tags

**Description:**
RTK Query endpoint definitions for all `/notifications/*` routes.

**Acceptance criteria:**
- `frontend/src/store/api.js` `tagTypes` gains `'Notifications'`
- `frontend/src/hooks/notifications/notificationApi.js` exports:
  `useGetNotificationsQuery`, `useGetUnreadNotificationCountQuery`,
  `useMarkNotificationReadMutation`, `useMarkAllNotificationsReadMutation` — shapes per
  RFC
- `npm run lint` passes

**Files:**
- `frontend/src/store/api.js`
- `frontend/src/hooks/notifications/notificationApi.js` (new)

**Estimated scope:** XS

---

### Task D2 — `NotificationBell` widget + NavBar integration + real-time

**Description:**
Bell icon with unread-count badge (`useGetUnreadNotificationCountQuery`), click-to-open
dropdown (`useGetNotificationsQuery`, fetched only while open), mark-read on item click,
mark-all-read button. Listens for `notification:new` via the existing `useSocket` hook and
invalidates the `'Notifications'` tag to refresh.

**Acceptance criteria:**
- Badge shows unread count (capped display, e.g. `9+`), hidden when zero
- Dropdown lists notifications newest-first with actor avatar/name and a type-specific
  message (`post_like` → "liked your post", `post_comment` → "commented on your post"),
  linking to `/posts`
- Clicking an unread item calls `markNotificationRead`; "Mark all read" calls
  `markAllNotificationsRead`
- Closes on outside click
- On `notification:new` socket event, dispatches `api.util.invalidateTags(['Notifications'])`
- Rendered in `NavBar` next to the logout button, only when `user` is present
- `npm run lint` and `npm run build` pass

**Files:**
- `frontend/src/widgets/NotificationBell/NotificationBell.jsx` (new)
- `frontend/src/widgets/NotificationBell/NotificationBell.scss` (new)
- `frontend/src/widgets/NavBar/NavBar.jsx`

**Estimated scope:** S

---

## Checkpoints

### Checkpoint 1 — After A1 + B1
- [ ] `Post`, `PostComment`, `Notification` models exist with RFC-specified schemas/indexes
- [ ] `POSTS` and `NOTIFICATIONS` route constants added
- [ ] `/notifications/*` routes fully working and tested in isolation (seed data via
  direct model creation)

### Checkpoint 2 — After A2 + A3 + B2
- [ ] Full `/posts/*` API working: create (incl. image upload), feed (both scopes,
  blocking respected), like, comments (add/delete), soft-delete
- [ ] Liking/commenting on another user's post creates a `Notification` and emits
  `notification:new` to their `user:<id>` room; self-actions do not
- [ ] `npm test` (backend) green

### Checkpoint 3 — After C1 + D1
- [ ] `postApi.js` / `notificationApi.js` compile and match the live backend contract
  (manual smoke test against a running backend)
- [ ] `store/api.js` tag types updated; no RTK Query console warnings about unknown tags

### Checkpoint 4 — FEATURE COMPLETE (after C2–C4 + D2)
- [ ] `/posts` page reachable via NavBar "Feed" link; create/like/comment/delete all work
  end-to-end against the real backend
- [ ] "My Network" vs "Discover" toggle changes results correctly
- [ ] Notification bell shows live unread badge, dropdown lists items, mark-read /
  mark-all-read work, and a like/comment from a second account triggers a real-time badge
  update without refresh
- [ ] `npm run lint` and `npm run build` (frontend) green; `npm test` (backend) green

---

## Parallelisation Notes

- `A1` and `B1` have no cross-dependency — build in parallel.
- `A2 → A3 → B2` is sequential within the backend (B2 needs A3's like/comment handlers
  and B1's model).
- `C1`/`D1` (API hook scaffolding) can start immediately against the documented contract,
  in parallel with Track A/B — just stub/mock responses for local UI dev until the real
  backend is ready.
- `C2` and `C3` are independent of each other and can be built in parallel; `C4` depends
  on both.
- `D2`'s non-real-time parts (badge, dropdown, mark-read) depend only on `D1` + `B1`; the
  real-time refresh depends additionally on `B2`.
- Recommended single-implementer order: `A1` → `B1` → `A2` → `A3` → `B2` → `C1` → `D1` →
  `C2` → `C3` → `C4` → `D2`.
