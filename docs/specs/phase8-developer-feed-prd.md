# Phase 8 PRD — Developer Social Feed & Notifications

## Problem Statement

The platform has profiles, connections, messaging, groups, calls, and an AI assistant
(Phases 1–6), plus security/observability hardening (Phase 7) — but nothing that gives
users a reason to open the app *daily* beyond checking messages. The original product idea
(`docs/ideas/dev-connect-tinder-for-developers.md`) and the Phase 8 idea doc
(`docs/ideas/phase8-developer-feed.md`) identify a content/engagement layer — posts, likes,
comments, and notifications — as the missing piece, directly modeled on what makes LinkedIn
sticky. This PRD scopes the first version of that layer.

## Goals

| Goal | Metric |
|---|---|
| Increase return visits | DAU/WAU increases after launch (baseline: current swipe + messaging engagement) |
| Give users a lightweight way to stay visible to their network | ≥ X% of users with ≥ 1 accepted connection create at least one post within 30 days |
| Drive re-engagement via notifications | ≥ Y% of notification items are clicked within 24h of creation |
| Reuse existing infra | No new database technology, no new auth system, no new real-time transport — built on existing Mongoose models, Socket.io rooms, RTK Query, and Cloudinary uploads |

## Non-Goals (deferred)

- Hashtag-based discovery/following (tags stored, not yet used for ranking/discovery)
- Reposts/shares, polls, long-form articles
- Skill endorsements, written testimonials, "people you may know" beyond existing AI
  recommendations
- Profile view tracking
- Nested/threaded comments
- Notification types beyond `post_like` / `post_comment` (model is extensible for later
  phases — e.g. connection-accepted, call-missed — but those are out of scope here)

---

## User Stories

### Posting
1. **As a logged-in user**, I can create a post with text, an optional code snippet
   (with language), and/or up to 4 images.
2. **As a logged-in user**, I can add tags (e.g. `react`, `golang`) to my post for future
   discoverability.
3. **As a logged-in user**, I can delete my own posts (soft delete — content removed from
   feeds, record retained for audit like other moderation data).

### Feed
4. **As a logged-in user**, I can view a "My Network" feed showing posts from my accepted
   connections and myself, newest first, paginated.
5. **As a logged-in user**, I can switch to a "Discover" feed showing posts from all users
   (excluding anyone I've blocked or who has blocked me), newest first, paginated.
6. **As a logged-in user**, posts from users I've blocked (or who've blocked me) never
   appear in either feed, consistent with existing blocking behavior (Phase 2).

### Engagement
7. **As a logged-in user**, I can like (and unlike) any post visible to me; I see the
   current like count and whether I've liked it.
8. **As a logged-in user**, I can add a comment to any post visible to me, and view existing
   comments (paginated).
9. **As a logged-in user**, I can delete my own comment, or any comment on a post I authored.

### Notifications
10. **As a logged-in user**, when someone likes or comments on my post, I receive a
    real-time notification (if online) and a persistent entry in my Notification Center
    (if offline, visible on next login).
11. **As a logged-in user**, I can see an unread-count badge on the notification bell, open
    a dropdown of recent notifications, and mark individual or all notifications as read.
12. **As a logged-in user**, I do not receive a notification for liking/commenting on my
    own post.

---

## Acceptance Criteria

### Posts API
- `POST /posts` — creates a post; requires at least one of `content` (trimmed,
  non-empty), `codeSnippet.code`, or `images` (non-empty array)
- `POST /posts/upload-image` — multipart upload (reuses Cloudinary `uploadImageBuffer`,
  5MB limit, image MIME types only), returns `{ url }`
- `GET /posts?scope=network|public&page=1` — paginated feed; `network` = posts by the
  user + accepted connections; `public` (Discover) = all posts; both exclude blocked/blocking
  users; response includes `likedByMe` and `likeCount`/`commentCount` per post, author
  populated with `firstName lastName photoUrl`
- `GET /posts/:postId` — single post detail
- `DELETE /posts/:postId` — soft-delete; author-only; returns 403 otherwise
- `POST /posts/:postId/like` — toggles like; returns `{ liked, likeCount }`; creates a
  `post_like` notification for the post author (skipped if author === actor)
- `GET /posts/:postId/comments?page=1` — paginated, oldest-first
- `POST /posts/:postId/comments` — adds a comment (non-empty, ≤ 1000 chars); increments
  `commentCount`; creates a `post_comment` notification for the post author (skipped if
  author === actor)
- `DELETE /posts/:postId/comments/:commentId` — comment author or post author only;
  decrements `commentCount`

### Notifications API
- `GET /notifications?page=1` — paginated, newest-first, actor populated with
  `firstName lastName photoUrl`
- `GET /notifications/unread-count` — `{ count }`
- `PATCH /notifications/:notificationId/read` — marks one notification read (scoped to
  `recipientId === req.user._id`, 404 otherwise)
- `PATCH /notifications/read-all` — marks all of the user's unread notifications read

### Real-time
- On `post_like`/`post_comment` creation, the backend emits `notification:new` to
  `user:<recipientId>` via the existing Socket.io room convention (`io.to('user:<id>')`)
- Frontend Notification Center listens for `notification:new` and refreshes unread
  count / list without requiring a page reload

### Frontend
- New `/posts` route ("Feed") added to NavBar, distinct from the existing swipe-based
  "Discover" page at `/`
- Feed page has a "My Network" / "Discover" tab toggle, a post-composer
  (`CreatePostBox`), and a paginated list of `PostCard`s
- `PostCard` renders text, code snippet (via existing `SnippetBlock`), images, tags,
  like/comment buttons + counts, and an expandable comment thread with inline comment
  composer
- `CreatePostBox` supports text, a code-snippet toggle (language picker, reusing
  `SUPPORTED_LANGUAGES`), and up to 4 image uploads with previews/removal
- NavBar gains a notification bell with unread badge and dropdown panel

---

## Data Model (high-level — see RFC for full schemas)

- **Post** — `authorId`, `content`, `codeSnippet { code, language }`, `images[]`, `tags[]`,
  `likes[]` (user refs), `likeCount`, `commentCount`, `deletedAt`, timestamps
- **PostComment** — `postId`, `authorId`, `content`, `deletedAt`, timestamps
- **Notification** — `recipientId`, `actorId`, `type` (`post_like`|`post_comment`),
  `postId`, `read`, timestamps

---

## Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Feed visibility | Both "My Network" (connection graph) and "Discover" (public), via a tab toggle, defaulting to "My Network" | Drives engagement even with a small graph (Discover) while keeping a connection-based feed as the primary LinkedIn-style experience |
| Post content types | Text + code snippets + images (v1) | Differentiates from generic social feeds (code snippets) while images make the feed visually engaging; reuses existing Cloudinary + SnippetBlock infra |
| Notifications | Persistent Notification Center (bell + dropdown + unread badge), backed by a `Notification` collection, with real-time push via existing Socket.io rooms | Closest to the LinkedIn experience; toast-only would lose notifications for offline users |
| Comments | Flat (non-nested) | Keeps schema and UI simple; nesting can be added later without a breaking migration (just add `parentCommentId`) |
| Moderation | Soft delete (`deletedAt`), reuse existing blocking for feed filtering; no new reporting flow for posts in v1 | Consistent with Group/Message soft-delete pattern; post-specific reporting can extend the existing `Report` model later if needed |

---

## Risks

| Risk | Mitigation |
|---|---|
| Empty "My Network" feed for new users with few connections | Default tab is "My Network" but "Discover" is one click away and pagination/empty-state messaging nudges users there |
| Feed query performance as posts grow | Indexes on `(authorId, createdAt)` and `(deletedAt, createdAt)`; offset pagination matches existing Groups convention (acceptable at current scale, revisit with cursor pagination if needed) |
| Notification spam from popular posts | Out of scope for v1 (no rate limiting on notification creation) — flagged as an open question for a future phase if a post goes viral within the platform |
| Image upload abuse (size/type) | Reuses existing 5MB/image-MIME-type multer config from profile photo uploads; capped at 4 images per post |
| Socket connection proliferation (NavBar + Messages each open a socket) | Accepted for v1 per existing `useSocket` hook's documented limitation; revisit lifting to a shared connection in `AuthProvider` in a future hardening pass |

---

## Out of Scope (Phase 8)

- Hashtag/topic-based feed ranking or following
- Reposts/shares, polls, long-form articles
- Skill endorsements, testimonials, "who viewed your profile"
- Nested/threaded comments
- Notification types beyond `post_like`/`post_comment`
- Post-specific reporting/moderation queue (existing user-level `Report` model is
  unaffected)
- Rate limiting on post creation or notification volume
