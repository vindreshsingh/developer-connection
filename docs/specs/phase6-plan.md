# Implementation Plan — Phase 6

Two tracks. Track A (Payments) must land first because Track B (AI Assistant) depends
on `requirePremium` and `User.isPremium` from Track A. Track C is cross-cutting wiring
that depends on both.

## Dependency Graph

```
Track A — Payments & Subscriptions       Track B — AI Assistant
───────────────────────────────────       ──────────────────────
Task A1: Plan/Subscription/PaymentEvent
         models + User.isPremium +
         seed script
    │
Task A2: PaymentService (Razorpay) +
         checkout/cancel routes
    │
Task A3: Webhook handler
         (BillingEventHandler)
    │
Task A4: requirePremium middleware +      Task B1: AI models +
         feed swipe-limit / advanced               AIService (Anthropic)
         filter gating + group call cap        │
    │                                      Task B2: Recommendations routes
Task A5: Frontend — Pricing page,              │
         Billing settings tab,            Task B3: Resume feedback routes
         useRazorpayCheckout, UpsellModal      │
    │                                      Task B4: Interview prep routes
    │                                          │
    └──────────────┬─────────────────────  Task B5: AI Assistant frontend
                    │                              (page + Feed widget)
                    │                          │
             Task C1: Wire UpsellModal + AI Picks
                      widget into Feed; final env/deps
```

`Task A4` is the dependency boundary: Track B cannot start until `requirePremium` and
`User.isPremium` exist (B1's `AIService` itself has no dependency on Track A and *can*
be built in parallel, but B2–B4 routes import `requirePremium`).

---

## Track A — Payments & Subscriptions

---

### Task A1 — Plan / Subscription / PaymentEvent models + seed script

**Description:**
Mongoose models for `Plan`, `Subscription`, `PaymentEvent`; add `isPremium` to `User`;
a one-off seed script that creates the `free` and `premium` `Plan` documents.

**Acceptance criteria:**
- `Plan` schema matches RFC (key, name, price, currency, interval, razorpayPlanId, features, isActive)
- `Subscription` schema matches RFC (status enum, razorpay ids, period dates, cancelAtPeriodEnd)
- `PaymentEvent` schema matches RFC, with unique sparse index on `razorpayEventId`
- `User` model gains `isPremium: { type: Boolean, default: false }`
- `node backend/src/scripts/seedPlans.js` creates/upserts `free` and `premium` plans (idempotent — safe to re-run)
- `npm test -- models` (or equivalent new test file) passes

**Files:**
- `backend/src/models/plan.js`
- `backend/src/models/subscription.js`
- `backend/src/models/paymentEvent.js`
- `backend/src/models/user.js` (add `isPremium`)
- `backend/src/scripts/seedPlans.js`
- `backend/src/__tests__/plan.test.js`

**Estimated scope:** S

---

### Task A2 — `PaymentService` + checkout/cancel routes

**Description:**
Razorpay SDK wrapper (`PaymentService`) and the `/billing/checkout`,
`/billing/subscription`, `/billing/cancel`, `/billing/history`, `/billing/plans` routes
(everything except the webhook, which is A3).

**Acceptance criteria:**
- `GET /billing/plans` returns active plans (no auth)
- `POST /billing/checkout` — 400 if user already has an `active`/`created` subscription;
  otherwise creates Razorpay customer + subscription via `PaymentService`, persists
  `Subscription` (status `created`), returns `{ subscriptionId, razorpaySubscriptionId, razorpayKeyId }`
- `GET /billing/subscription` returns `{ plan: 'free', subscription: null }` if none exists, else current subscription + plan
- `POST /billing/cancel` — 404 if no active subscription; else calls `PaymentService.cancelSubscription` and sets `cancelAtPeriodEnd = true`
- `GET /billing/history` returns paginated `PaymentEvent`s for `req.user._id`
- `PaymentService` tests mock `razorpay` SDK — no live calls
- `npm test -- billing.test.js` passes

**Files:**
- `backend/src/services/PaymentService.js`
- `backend/src/routes/billing.js`
- `backend/src/constants/apiEndpoints.js` (add `BILLING`)
- `backend/src/app.js` (mount `/billing`)
- `backend/.env.example` (add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`)
- `backend/package.json` (add `razorpay`)
- `backend/src/__tests__/billing.test.js`

**Estimated scope:** M

---

### Task A3 — Webhook handler (`BillingEventHandler`)

**Description:**
`POST /billing/webhook` with raw-body signature verification, idempotent event
processing via `PaymentEvent.razorpayEventId`, and the state transitions for
`Subscription`/`User.isPremium` per the RFC's event table.

**Acceptance criteria:**
- Invalid signature → 400, no DB writes
- Valid signature, new `razorpayEventId` → processed, `PaymentEvent` recorded
- Valid signature, duplicate `razorpayEventId` → 200, no-op (idempotent)
- `subscription.activated` → `Subscription.status = 'active'`, `currentPeriodStart/End` set, `User.isPremium = true`
- `subscription.charged` → period extended, status stays `active`
- `payment.failed` → `Subscription.status = 'past_due'`, `isPremium` unchanged
- `subscription.cancelled` / `.expired` / `.completed` → status updated, `User.isPremium = false`
- `PaymentEvent` create + `Subscription`/`User` update happen in a single transaction
- `npm test -- webhook.test.js` passes (constructs valid HMAC signatures with a test secret)

**Files:**
- `backend/src/routes/billing.js` (add webhook route + raw body parser)
- `backend/src/services/BillingEventHandler.js`
- `backend/src/__tests__/webhook.test.js`

**Estimated scope:** M

---

### Task A4 — `requirePremium` middleware + entitlement gating

**Description:**
`requirePremium(featureName)` middleware (with lazy grace-period expiry check), plus
the graduated gating changes to the discovery feed (swipe limit, advanced filters) and
group call participant cap.

**Acceptance criteria:**
- `requirePremium('x')` → 403 `{ error: 'PREMIUM_REQUIRED', feature: 'x' }` for non-premium users; passes through for premium
- A `past_due` subscription whose `currentPeriodEnd + 3d` has passed flips `isPremium = false` on next request through `requirePremium`
- `GET /profile/feed`: advanced filter params (`experienceLevel`, `locationRadius`, `availability`) ignored for non-premium users
- `POST /request/send/interested/:toUserId` returns 403 `{ error: 'SWIPE_LIMIT_REACHED' }` once a free user has sent `Plan.free.features.dailySwipeLimit` `interested` requests today; premium users unaffected
- `POST /calls/initiate` (type `group`) sets `CallSession.isPriority = req.user.isPremium`; `LiveKitService` passes `maxParticipants` accordingly (8 free / 25 premium)
- `npm test` passes (all existing + new tests)

**Files:**
- `backend/src/middlewares/premium.js`
- `backend/src/routes/profile.js` (feed handler)
- `backend/src/routes/request.js` (swipe limit check)
- `backend/src/routes/calls.js` (isPriority)
- `backend/src/models/callSession.js` (add `isPriority: Boolean`)
- `backend/src/services/LiveKitService.js` (accept `maxParticipants`)
- `backend/src/__tests__/premiumGating.test.js`

**Estimated scope:** M

---

### Task A5 — Frontend: Pricing, Billing settings, Checkout, UpsellModal

**Description:**
`/pricing` page, account settings "Billing" tab, `useRazorpayCheckout` hook, and the
shared `UpsellModal` used for `PREMIUM_REQUIRED` / `SWIPE_LIMIT_REACHED` responses.

**Acceptance criteria:**
- `/pricing` renders plan cards from `GET /billing/plans` with a feature comparison table
- "Subscribe" opens Razorpay Checkout via `useRazorpayCheckout`; on `handler` callback, refetches `GET /billing/subscription`
- Settings → Billing tab shows current plan, renewal date, cancel button (confirms before calling `POST /billing/cancel`), and a payment history table
- `UpsellModal` renders on any RTK Query error with `error.data.error === 'PREMIUM_REQUIRED'` or `'SWIPE_LIMIT_REACHED'`, with a CTA linking to `/pricing`
- Locked advanced filters on the Feed page show a lock icon and open `UpsellModal` on click for non-premium users
- `npm run build` passes; `npm run lint` passes

**Files:**
- `frontend/src/containers/Pricing/index.jsx` + `.scss`
- `frontend/src/containers/Settings/BillingTab.jsx` (+ wire into existing Settings container)
- `frontend/src/widgets/PlanCard/PlanCard.jsx` + `.scss`
- `frontend/src/widgets/UpsellModal/UpsellModal.jsx` + `.scss`
- `frontend/src/hooks/billing/billingApi.js`
- `frontend/src/hooks/billing/useRazorpayCheckout.js`
- `frontend/src/store/api.js` (add `'Subscriptions'` tag)
- `frontend/index.html` (Razorpay checkout.js script tag)
- `frontend/src/App.jsx` / routes (add `/pricing`)
- `frontend/src/containers/Feed/*` (lock advanced filters for free users)

**Estimated scope:** L

---

## Track B — AI Developer Assistant

(Blocked by Task A4 for B2–B4; `AIService` itself in B1 has no Track A dependency.)

---

### Task B1 — AI models + `AIService` (Anthropic)

**Description:**
`RecommendationCache`, `ResumeFeedback`, `InterviewSession`, `AIUsageLog` models;
`AIService` wrapping `@anthropic-ai/sdk` with the four methods from the RFC and
`parseJSONResponse`/`AIServiceError`.

**Acceptance criteria:**
- All four models match RFC schemas
- `AIService.generateRecommendationReasons`, `getResumeFeedback`, `startInterview`, `continueInterview` implemented
- `parseJSONResponse` throws `AIServiceError` on non-JSON / malformed response
- Tests mock `@anthropic-ai/sdk`'s `messages.create` for both well-formed and malformed responses
- `npm test -- aiService.test.js` passes

**Files:**
- `backend/src/models/recommendationCache.js`
- `backend/src/models/resumeFeedback.js`
- `backend/src/models/interviewSession.js`
- `backend/src/models/aiUsageLog.js`
- `backend/src/services/AIService.js`
- `backend/.env.example` (add `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `AI_DAILY_LIMIT`)
- `backend/package.json` (add `@anthropic-ai/sdk`, `pdf-parse`)
- `backend/src/__tests__/aiService.test.js`

**Estimated scope:** M

---

### Task B2 — Recommendations routes

**Description:**
`GET /ai/recommendations` and `POST /ai/recommendations/:userId/dismiss`, including the
deterministic shortlist query (skills/techStack overlap, excluding connections/requests/
blocked, capped at top 15 by overlap score before the LLM call) and the
`checkAIRateLimit` middleware.

**Acceptance criteria:**
- `checkAIRateLimit` middleware: 21st `/ai/*` call in a day → 429 `AI_RATE_LIMIT_EXCEEDED` (limit configurable via `AI_DAILY_LIMIT`)
- Cache hit (`RecommendationCache` not expired) returns without calling `AIService` and without incrementing `AIUsageLog`
- Cache miss: shortlist excludes existing connections, pending requests (either direction), blocked users (both directions), and users in `dismissed` within 14 days; calls `AIService.generateRecommendationReasons`; persists cache with `expiresAt: +24h`; logs `AIUsageLog`
- `POST /ai/recommendations/:userId/dismiss` adds `{ userId, dismissedAt }` to `dismissed`
- `npm test -- recommendations.test.js` passes

**Files:**
- `backend/src/routes/ai.js`
- `backend/src/middlewares/aiRateLimit.js`
- `backend/src/constants/apiEndpoints.js` (add `AI`)
- `backend/src/app.js` (mount `/ai`)
- `backend/src/__tests__/recommendations.test.js`

**Estimated scope:** M

---

### Task B3 — Resume feedback routes

**Description:**
`POST /ai/resume-feedback` (multipart PDF upload, Cloudinary + `pdf-parse` +
`AIService.getResumeFeedback`) and `GET /ai/resume-feedback` history.

**Acceptance criteria:**
- Non-PDF upload → 400; file > 5MB → 400
- Happy path: uploads to Cloudinary, extracts text via `pdf-parse`, calls `AIService.getResumeFeedback`, persists `ResumeFeedback`, logs `AIUsageLog`
- `AIService` failure → 503, no `ResumeFeedback` record created
- `GET /ai/resume-feedback` returns paginated history for `req.user._id` only
- `npm test -- resumeFeedback.test.js` passes

**Files:**
- `backend/src/routes/ai.js` (add resume-feedback routes)
- `backend/src/__tests__/resumeFeedback.test.js`

**Estimated scope:** M

---

### Task B4 — Interview prep routes

**Description:**
`POST /ai/interview/start`, `POST /ai/interview/:sessionId/respond`,
`POST /ai/interview/:sessionId/end`, `GET /ai/interview`, `GET /ai/interview/:sessionId`.

**Acceptance criteria:**
- `start` creates `InterviewSession` (status `active`), calls `AIService.startInterview`, returns `{ sessionId, question }`
- `respond` appends user answer + assistant feedback/next-question to transcript; at 10 turns, auto-sets status `completed` and `nextQuestion: null`
- `respond`/`end` on a `completed` session → 400
- Cross-user access to `:sessionId` → 404 (not 403)
- `GET /ai/interview` returns paginated summaries (focusArea, status, turn count, createdAt)
- `npm test -- interview.test.js` passes

**Files:**
- `backend/src/routes/ai.js` (add interview routes)
- `backend/src/__tests__/interview.test.js`

**Estimated scope:** M

---

### Task B5 — AI Assistant frontend

**Description:**
`/ai-assistant` page with three tabs (Recommendations, Resume Feedback, Interview Prep)
plus the "AI Picks" widget on the Feed page.

**Acceptance criteria:**
- `/ai-assistant` route renders three tabs; free users see locked-state teaser + `UpsellModal` on interaction
- Recommendations tab: cards with `reason` text, dismiss button
- Resume Feedback tab: file upload (PDF), renders structured feedback (strengths/improvements/atsNotes), history list
- Interview Prep tab: chat UI — start session (optional focus area input), submit answers, renders feedback + next question turn-by-turn, end session button
- 429 `AI_RATE_LIMIT_EXCEEDED` shows a toast: "You've reached today's AI Assistant limit — try again tomorrow."
- Feed page shows "AI Picks" widget (premium) or locked teaser (free)
- `npm run build` passes; `npm run lint` passes

**Files:**
- `frontend/src/containers/AIAssistant/index.jsx` + `RecommendationsTab.jsx` + `ResumeFeedbackTab.jsx` + `InterviewPrepTab.jsx` + `.scss`
- `frontend/src/widgets/RecommendationCard/RecommendationCard.jsx` + `.scss`
- `frontend/src/widgets/AIChatBubble/AIChatBubble.jsx` + `.scss`
- `frontend/src/hooks/ai/aiApi.js`
- `frontend/src/hooks/ai/useInterviewSession.js`
- `frontend/src/store/api.js` (add `'Recommendations'`, `'ResumeFeedback'` tags)
- `frontend/src/App.jsx` / routes (add `/ai-assistant`)
- `frontend/src/containers/Feed/*` (AI Picks widget)

**Estimated scope:** L

---

## Track C — Cross-Cutting Wiring

---

### Task C1 — Final integration pass

**Description:**
Anything left dangling once A and B land: shared `UpsellModal` reused consistently for
both `PREMIUM_REQUIRED` (AI) and `PREMIUM_REQUIRED`/`SWIPE_LIMIT_REACHED` (billing);
nav links to `/pricing` and `/ai-assistant`; `.env.example` fully consolidated; full
test suite + build/lint green.

**Acceptance criteria:**
- Nav/sidebar includes links to "Pricing" (all users) and "AI Assistant" (highlighted for premium)
- `UpsellModal` triggered consistently from both Track A and Track B error responses via one shared RTK Query error matcher
- `backend/.env.example` contains all new vars from A2/B1 with comments
- `npm test` (backend, full suite) passes
- `npm run build && npm run lint` (frontend) passes

**Files:**
- `frontend/src/components/Navbar/*` (or equivalent nav component)
- `frontend/src/store/api.js` (shared error matcher / middleware)
- `backend/.env.example`

**Estimated scope:** S

---

## Checkpoints

### Checkpoint 1 — After A1 + A2
- [ ] `GET /billing/plans` returns seeded `free`/`premium` plans
- [ ] `POST /billing/checkout` creates a `Subscription` (status `created`) and returns Razorpay order data (mocked SDK in tests)
- [ ] All new + existing backend tests pass

### Checkpoint 2 — After A3 + A4
- [ ] Webhook test suite covers signature validation, idempotency, and all status transitions
- [ ] Free user hits swipe limit → 403 `SWIPE_LIMIT_REACHED`; premium user does not
- [ ] Advanced filters ignored for free users
- [ ] Group call `maxParticipants` reflects `isPriority`

### Checkpoint 3 — After A5
- [ ] `/pricing` renders and Razorpay Checkout opens (can be verified with Razorpay test mode keys or a stubbed `window.Razorpay`)
- [ ] Billing tab shows subscription state and cancel works
- [ ] Frontend lint + build green

### Checkpoint 4 — After B1 + B2 + B3 + B4
- [ ] `AIService` tests pass with mocked Anthropic client
- [ ] Recommendations cache hit/miss behavior correct; rate limit enforced
- [ ] Resume feedback happy path + validation errors covered
- [ ] Interview session lifecycle (start/respond/end/cap) covered
- [ ] All backend tests pass

### Checkpoint 5 — FEATURE COMPLETE (after B5 + C1)
- [ ] `/ai-assistant` page fully functional for a premium test user; locked for free
- [ ] AI Picks widget on Feed page
- [ ] Nav links present; shared upsell flow works for both billing and AI 403s
- [ ] Full backend test suite passes (`npm test`)
- [ ] Frontend lint + build green

---

## New Dependencies

### Backend
```
razorpay              # Razorpay Subscriptions API client
@anthropic-ai/sdk     # Claude API client
pdf-parse             # Extract text from uploaded resume PDFs
```

### Frontend
```
(none — Razorpay Checkout loaded via <script> tag in index.html, not an npm package)
```

---

## Parallelisation Notes

- A1 → A2 → A3 → A4 → A5 must be sequential within Track A (each builds on the previous DB/route surface)
- B1 has no Track A dependency and **can be built in parallel with Track A**
- B2, B3, B4 each depend on B1 (`AIService`, models) **and** A4 (`requirePremium`,
  `User.isPremium`) — cannot start until both are done
- B2, B3, B4 are otherwise independent of each other (different routes/models) and can
  be parallelized once their dependencies land
- B5 depends on B2–B4 (needs the API surface) and A5 (shares `UpsellModal`)
- C1 is last — depends on everything
- Recommended sequencing for a single implementer: A1 → A2 → A3 → A4 → (A5 parallel
  with B1) → B2/B3/B4 → B5 → C1
