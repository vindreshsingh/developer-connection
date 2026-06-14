# Phase 8 — Developer Social Feed & Notifications

## Problem Statement
Developer Connection covers discovery (swipe), connections, messaging, groups, video calls,
and AI assistance — but there is no reason for a user to open the app once their immediate
networking/chat needs are met. LinkedIn's stickiness comes largely from its content layer: a
feed of posts, reactions, comments, and notifications that bring users back daily. Without
this layer, engagement is purely transactional (swipe occasionally, chat when needed).

## Target User
The same developer audience as the rest of the platform — but specifically the "passive"
majority who have already built up some connections (Phase 2) and want a lightweight way to
stay visible to their network (share progress, ask questions, post code snippets) and
discover developers/content beyond their immediate connections.

## Recommended Direction
Add a **Posts/Feed** feature: users can create posts (text, code snippets, images), and view
a feed of posts either from their network (connections) or a global "Discover" feed. Posts
support likes and comments. A **persistent Notification Center** alerts users in real time
(and on return visits) when someone likes or comments on their post.

This reuses nearly all existing infrastructure — the connection graph (Phase 2), Socket.io
(Phase 3), Cloudinary uploads (Phase 1/4), and the code-snippet rendering already built for
chat (Phase 3) — so it's a content/engagement layer on top of proven plumbing, not a new
subsystem.

## Key Assumptions to Validate
- [ ] A lightweight feed (text/code/image posts + likes/comments) meaningfully increases
      daily return visits compared to the swipe-only + messaging experience — validate by
      comparing DAU/WAU before and after this phase ships
- [ ] The "My Network" vs "Discover" toggle is useful even with a small connection graph per
      user — if "My Network" is empty for most new users, "Discover" may need to become the
      default tab
- [ ] Persistent notifications (vs. toast-only) drive meaningful return visits — validate via
      click-through rate on notification items

## MVP Scope (Phase 8)
**In:**
- Create posts: text (required unless code/images present), optional code snippet (reusing
  `SnippetBlock`/language picker from Phase 3 chat), optional images (up to 4, via existing
  Cloudinary upload pattern)
- Feed with two scopes: "My Network" (connections + self) and "Discover" (all non-blocked
  posts), paginated
- Like (toggle) and flat (non-nested) comments on posts
- Soft-delete own posts; delete own comments, or any comment on your own post
- Persistent Notification Center: bell icon with unread badge, dropdown list, mark
  read / mark-all-read, real-time updates via Socket.io
- Respects existing blocking: blocked users' posts never appear in either feed scope

**Out (this phase):**
- Hashtag following / topic feeds (tags are stored on posts but not yet a discovery
  mechanism)
- Reposts/shares, polls, long-form articles
- Profile-level "who viewed your profile"
- Skill endorsements / written testimonials

## Not Doing (Yet) — Future Roadmap
- **Skill Endorsements & Recommendations** — peer endorsements on `User.skills`/`techStack`,
  written testimonials on profiles
- **"People You May Know"** — proactive connection suggestions beyond swipe, using shared
  tech stack / mutual connections (could combine with Phase 6 AI recommendations)
- **Hashtag/topic following** — personalized feed ranking by followed tags
- **"Open to Collaborate / Hiring / Job Hunting" badges** — profile status flags, premium
  filter target
- **Profile views ("who viewed your profile")** — premium upsell hook
- **Job board / referral posts, events, polls, long-form articles**

## Open Questions
- Should the Notification Center eventually cover non-post events (connection accepted, call
  missed, group invite)? The `Notification` model's `type` enum is designed to be extended,
  but this phase only populates `post_like`/`post_comment`.
- Should "Discover" feed get any ranking beyond reverse-chronological (e.g. boosting posts
  from users with shared tech stack)? Deferred — reverse-chronological is simplest and
  matches existing pagination conventions (Groups, Messages).
- Should premium users get any feed-specific perk (e.g. "boost a post")? Not in this phase —
  flagged for a future Payments RFC addendum if desired.
