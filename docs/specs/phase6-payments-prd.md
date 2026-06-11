# Phase 6 PRD — Premium Subscriptions & Payments

## Problem Statement

Phases 1–5 built the full social loop (profiles, discovery, connections, chat, groups,
video calling) but the platform has no revenue mechanism. The original product idea
(`docs/ideas/dev-connect-tinder-for-developers.md`) flagged a ₹100/month premium tier as
an unvalidated assumption. Phase 6 introduces a paid tier so the assumption can be
tested with real users, and gates a small set of high-value features (already partially
built in earlier phases, e.g. discovery feed limits, advanced filters, paid meeting
rooms) behind it.

## Goals

| Goal | Metric |
|---|---|
| Validate willingness to pay | ≥ 2 % of monthly active users convert to a paid plan within 60 days of launch |
| Reliable, low-maintenance billing | < 1 % of webhook events fail to reconcile (manual intervention) per month |
| No disruption to free-tier experience | Free-tier usage of existing features (chat, calls, groups) unchanged — only newly-introduced limits apply |
| Enable future monetized features | Premium entitlement check is a single reusable gate other Phase 6+ features (AI assistant, paid meeting rooms) can depend on |

## Non-Goals (deferred)

- Stripe / international payment methods (Razorpay only for this phase — see Locked Decisions)
- Team / organization billing (multi-seat plans)
- Coupons, referral credits, and promotional pricing
- In-app currency or credit packs
- Tax invoicing / GST compliance automation (manual for now)
- Dunning email sequences beyond a single "payment failed" notification
- Annual billing (monthly only for v1)

---

## User Stories

### Plans & Checkout
1. **As a free user**, I can view a pricing page describing what Premium unlocks and its price.
2. **As a free user**, I can subscribe to Premium via Razorpay Checkout (UPI, cards, netbanking) without leaving the app.
3. **As a new subscriber**, I see my Premium status reflected immediately in my profile/account settings after successful payment.
4. **As a subscriber**, I can view my current plan, renewal date, and payment history in account settings.
5. **As a subscriber**, I can cancel my subscription; I retain Premium access until the end of the current billing period.

### Entitlements & Gating
6. **As a free user**, I'm limited to a fixed number of discovery "swipes" (connection requests sent) per day; I see a friendly upsell when I hit the limit.
7. **As a free user**, basic discovery filters (skills, tech stack) work, but advanced filters (experience level, location radius, availability) are visible but locked with an "Upgrade to Premium" prompt.
8. **As a Premium user**, I have unlimited daily swipes and full access to advanced filters.
9. **As a Premium user**, I can create "priority" group video call rooms with no participant cap beyond the technical (LiveKit) limit, while free users keep the existing 8-participant cap.

### Billing Lifecycle
10. **As a subscriber**, if my renewal payment fails, I receive an in-app notification and have a grace period before Premium access is revoked.
11. **As a user**, all payment events (success, failure, refund, cancellation) are recorded so support can investigate billing issues.

---

## Acceptance Criteria

### Plans & Subscriptions
- `GET /billing/plans` — returns active `Plan` documents (id, name, price, interval, features)
- `POST /billing/checkout` — creates a Razorpay order/subscription for the logged-in user and returns data needed to open Razorpay Checkout
- `POST /billing/webhook` — Razorpay webhook endpoint; verifies signature, updates `Subscription` status idempotently
- `GET /billing/subscription` — returns the logged-in user's current subscription (plan, status, `currentPeriodEnd`, `cancelAtPeriodEnd`)
- `POST /billing/cancel` — marks `cancelAtPeriodEnd = true`; subscription remains `active` until period end, then transitions to `expired`
- `GET /billing/history` — paginated list of the user's payment events

### Entitlements
- `requirePremium` middleware returns 403 with a machine-readable `{ error: 'PREMIUM_REQUIRED', feature: <name> }` body for gated routes
- Free users: discovery feed `GET /profile/feed` enforces a daily cap on `interested` requests sent (existing `Request` model); cap value is configurable via `Plan.features.dailySwipeLimit`
- Free users: advanced filter query params on `/profile/feed` (e.g. `experienceLevel`, `locationRadius`, `availability`) are ignored/stripped server-side if the user is not Premium
- Premium users: no swipe cap; advanced filters applied
- Group call participant cap remains 8 for free; Premium-created group calls (`CallSession.isPriority`) raise the LiveKit room limit (configurable, default 25)

### Frontend
- `/pricing` page: plan cards, feature comparison table, "Subscribe" CTA
- Razorpay Checkout opened via their JS SDK (`Razorpay` global) using the order returned from `/billing/checkout`
- Account settings → "Billing" tab: current plan, renewal date, cancel button, payment history table
- Upsell modal/banner shown when a free user hits the swipe limit or taps a locked advanced filter
- Subscription status surfaced via a `Subscriptions` RTK Query tag so UI updates immediately after checkout completes

---

## Data Model

```js
// Plan
{
  key:      { type: String, enum: ['free', 'premium'], required: true, unique: true },
  name:     String,                 // "Premium"
  price:    Number,                 // in smallest currency unit (paise)
  currency: { type: String, default: 'INR' },
  interval: { type: String, enum: ['month'], default: 'month' },
  razorpayPlanId: String,           // Razorpay plan_id for 'premium'
  features: {
    dailySwipeLimit:        Number,  // null = unlimited
    advancedFilters:        Boolean,
    priorityGroupCalls:     Boolean,
    aiAssistant:            Boolean, // ties into Phase 6 AI Assistant track
    groupCallParticipantCap: Number,
  },
  isActive: Boolean,
}

// Subscription
{
  userId:   { type: ObjectId, ref: 'User', required: true, index: true },
  planId:   { type: ObjectId, ref: 'Plan', required: true },
  status:   { type: String, enum: ['active', 'past_due', 'cancelled', 'expired'], default: 'active' },
  razorpaySubscriptionId: String,
  razorpayCustomerId:     String,
  currentPeriodStart: Date,
  currentPeriodEnd:   Date,
  cancelAtPeriodEnd:  { type: Boolean, default: false },
}

// PaymentEvent
{
  userId:        { type: ObjectId, ref: 'User', required: true, index: true },
  subscriptionId: { type: ObjectId, ref: 'Subscription' },
  razorpayEventId: { type: String, unique: true, sparse: true }, // dedupe webhooks
  type:          { type: String, enum: ['payment.captured', 'payment.failed', 'subscription.activated', 'subscription.cancelled', 'subscription.charged'] },
  amount:        Number,
  currency:      String,
  rawPayload:    mongoose.Schema.Types.Mixed,
}
```

`User` model gains a denormalized `isPremium: Boolean` (default `false`), kept in sync
by the webhook handler so existing routes can do a cheap check without joining
`Subscription`.

---

## Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Payment provider | Razorpay | Idea doc targets ₹/India pricing; Razorpay Subscriptions API natively supports recurring billing in INR with UPI/cards/netbanking; Stripe deferred |
| Billing model | Recurring subscription (Razorpay Subscriptions), not one-off orders | Premium is ongoing access, not a single purchase |
| Source of truth for entitlement | `Subscription.status` + `User.isPremium` denormalized flag, updated only by webhook handler | Webhooks are the authoritative event source; client-confirmed payment is only used for optimistic UI |
| Webhook idempotency | `PaymentEvent.razorpayEventId` unique index | Razorpay may redeliver webhooks; must not double-apply state changes |
| Plan storage | `Plan` collection seeded via migration/script, not hardcoded | Allows price changes without redeploying gating logic |
| Grace period on payment failure | 3 days (`status: past_due`) before `isPremium` flips to false | Avoids hard cutoff on a single failed renewal attempt (e.g. expired card) |

---

## Risks

| Risk | Mitigation |
|---|---|
| Webhook signature verification bypass | Use Razorpay SDK's `validateWebhookSignature`; reject any request that fails verification with 400 before touching the DB |
| Duplicate webhook delivery causing double-credit | `PaymentEvent.razorpayEventId` unique index; handler is a no-op if event already recorded |
| `User.isPremium` drifts from `Subscription.status` | Single code path (webhook handler) writes both fields in the same transaction/update |
| Razorpay outage blocks checkout | Checkout failures show a clear error; no partial `Subscription` records created until webhook confirms |
| Users gaming the daily swipe limit (multiple accounts) | Out of scope for v1 — existing account creation has no additional anti-abuse beyond email verification |
| Local dev/testing without real Razorpay account | `RAZORPAY_KEY_ID`/`SECRET` optional in dev; checkout route returns a clear error if unset, webhook route can be exercised with Razorpay's test mode signatures |

---

## Out of Scope (Phase 6 — Payments)

- Stripe / non-Razorpay providers
- Annual plans, coupons, multi-seat/org billing
- Refund initiation from the app (handled manually via Razorpay dashboard for v1)
- Tax/invoice PDF generation
- Currency localization (INR only)
