# Dev Connect — "Tinder for Developers"

## Problem Statement
How might we help developers find and build genuine working relationships — collaborators, mentors, co-founders, networking contacts — through an interface as frictionless as swiping, but built around technical compatibility (skills, stack, availability) rather than looks?

## Target User
Developers seeking three overlapping outcomes: job/collaboration opportunities, peer networking, and community — i.e., a general-purpose professional-developer matching and connection platform (not narrowly hiring-only or hobby-only).

## Recommended Direction
Build the full vision described (auth, profiles, swipe/discovery, connections, real-time chat, video calling, groups, AI assistant, premium subscriptions/payments, production-grade observability/security/scaling) — but as a sequence of independently shippable, production-grade vertical slices rather than one big-bang build. This avoids redesigning shared real-time infrastructure (chat presence, WebRTC signaling, swipe-matching) multiple times, and means there's always a working, testable product at each milestone.

The existing repo already has an Express + MongoDB backend scaffold and a React (Vite) frontend scaffold (see [README.md](../../README.md), models for `user` and `connectionRequest`), so Phase 1 builds directly on that foundation rather than starting from scratch.

## Key Assumptions to Validate
- [ ] Developers will engage with a swipe-based discovery mechanic for professional/technical matching (not just dating) — validate by shipping Phase 2 and watching engagement on the swipe feed
- [ ] Real-time chat is the actual retention driver, not the swipe mechanic — validate once Phase 3 ships by comparing chat session frequency vs. swipe session frequency
- [ ] Users will pay ₹100/month for premium features (unlimited swipes, advanced filters, AI insights) — validate via a waitlist/interest signal before building Razorpay/Stripe integration in Phase 6
- [ ] GitHub/LinkedIn integration meaningfully improves match quality over manually-entered profile data — validate by comparing connection-acceptance rates for OAuth-linked vs. manual profiles after Phase 4

## MVP Scope (Phase 1 — Foundation)
**In:**
- Email/password Authentication: signup, login, logout, email verification, forgot/reset password (JWT-based, building on existing `user` model)
- Developer Profile: create/edit, profile picture, cover image, bio, skills, experience, tech stack
- Baseline production concerns built in from day one: input validation, password hashing, rate limiting, structured logging/error handling, basic test coverage, CI pipeline

**Out (deferred to later phases — see below):**
- OAuth providers, resume upload, portfolio links, GitHub/LinkedIn data sync

## Not Doing (Yet) — Phased Roadmap
- **OAuth (Google/GitHub/LinkedIn)** — deferred to Phase 4: needs the core profile model stable first so OAuth data has somewhere correct to land
- **Discovery Feed & Connections (swipe, filters, requests, block/report)** — Phase 2: the core "Tinder" loop, built once auth/profile are solid
- **Real-time Chat (messaging, presence, typing, receipts, reactions, file sharing)** — Phase 3: establishes the websocket/pub-sub infrastructure that video calls will later reuse, so it must come before video
- **Groups & Communities, file/code snippet sharing** — Phase 4: extends the social graph and chat infra once both are proven
- **Video Calling (1:1, group, screen share, recording via WebRTC)** — Phase 5: the heaviest infra lift; reuses real-time signaling from Phase 3, so sequenced after chat
- **Premium Subscription & Payments (Razorpay/Stripe)** — Phase 6: monetization makes sense once there's a user base and proven feature value to charge for
- **AI Developer Assistant (LLM-based recommendations, resume feedback, interview prep)** — Phase 6: needs profile + connection + chat data to be useful; building it earlier means it has nothing to reason over
- **Cross-cutting hardening (load testing, security audit, full observability stack, cloud deployment pipeline)** — Phase 7 as a dedicated pass, though baseline security/observability/logging is built into every phase from Phase 1 onward, not bolted on at the end

## Open Questions
- Which OAuth providers are highest priority for the target audience — is GitHub alone sufficient for an initial cut, or do LinkedIn/Google matter equally for this user base?
- Should the swipe-matching algorithm in Phase 2 be purely filter-based (skills/location/availability) or incorporate any "smart" ranking — and if smart ranking, does that pull AI-assistant work earlier than Phase 6?
- What's the target cloud environment for deployment (AWS/GCP/Azure/other) — this affects infrastructure decisions made as early as Phase 1's CI/CD setup?
