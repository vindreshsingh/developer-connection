# Phase 6: Premium Subscriptions & AI Developer Assistant — RFC / HLD

## Architecture

```
┌─────────────────┐   HTTPS/JSON              ┌──────────────────┐        ┌───────────────────┐
│  React (Vite)   │ ─────────────────────────▶│  Express API     │ ─────▶ │  MongoDB           │
│  Frontend       │                           │  (backend/src)   │ ◀───── │  (Mongoose)        │
│  RTK Query      │  Razorpay Checkout.js     │  - routes/billing│        │  - subscriptions   │
│  /billing page, │  (loaded client-side,     │  - routes/ai     │        │  - aiUsage         │
│  AI widgets     │   hosted by Razorpay)     │  - services/     │        │  - aiConversations │
└────────┬────────┘                           │    razorpayService│       └────────────────────┘
         │                                     │    aiService     │
         │ Razorpay Checkout redirect/popup    └────┬─────────┬───┘
         ▼                                          │         │
┌─────────────────┐   signed webhooks              │         │
│   Razorpay       │ ──────────────────────────────▶         │
│  (subscriptions, │   POST /billing/webhook                  │
│   payments)      │   (raw body + HMAC signature)            │
└─────────────────┘                                           ▼
                                                      ┌────────────────────┐
                                                      │ Anthropic Claude API│
                                                      │ (hosted LLM,        │
                                                      │  claude-haiku-4-5 / │
                                                      │  claude-sonnet-4-6) │
                                                      └────────────────────┘
```

Both new surfaces hang off the existing Express app (`backend/src/server.js`) as new route modules — no new servers or processes. Razorpay and Anthropic are the only new external dependencies, both accessed via thin service modules (`razorpayService.js`, `aiService.js`) so routes stay free of vendor SDK details.

## Stack Decision
- **Payments**: **Razorpay** (`razorpay` Node SDK on the backend, Checkout.js loaded client-side) — reason: the idea doc's validation target is ₹100/month INR pricing for an India-first developer audience; Razorpay natively supports UPI/cards/netbanking and has a first-class Subscriptions API for recurring billing. Stripe is rejected as the primary rail (no native UPI — see Alternatives).
- **Webhook handling**: Razorpay webhooks are signature-verified via HMAC-SHA256 (`RAZORPAY_WEBHOOK_SECRET`). The `/billing/webhook` route is mounted with `express.raw({ type: 'application/json' })` **before** the global JSON body-parser, since signature verification requires the raw request body.
- **AI provider**: **Anthropic Claude API** via `@anthropic-ai/sdk` —
  - `claude-haiku-4-5` for **match insights** (called frequently while browsing the feed, latency-sensitive, short output)
  - `claude-sonnet-4-6` for **profile feedback** and **interview prep** (lower call volume, longer/higher-quality output matters more)
  - Reason: a hosted API needs no new infra, has strong reasoning quality for career-advice use cases, and the project's existing tooling (`ai-agents/`) is already Claude-centric, so credentials/conventions are familiar.
- **Persistence**: MongoDB/Mongoose (existing) — three new collections: `Subscription`, `AiUsage`, `AiConversation`. No new database.
- **Backend**: Express 5 + Mongoose, unchanged — new `routes/billing.js`, `routes/ai.js`, `services/razorpayService.js`, `services/aiService.js`, `middleware/requirePremium.js`, `middleware/checkAiQuota.js`
- **Frontend**: React + Redux Toolkit (RTK Query) + TailwindCSS, unchanged — new `billingApi`/`aiApi` RTK Query slices, a `/billing` page (`containers/Billing`), and `AiFeedbackPanel` / `MatchInsight` / `InterviewPrepChat` widgets following the existing layered-architecture pattern (components/widgets/containers/pages)

This section is the binding contract: **Razorpay** (not Stripe) for payments, **Anthropic Claude API** (not OpenAI or a self-hosted model) for AI, gating via a single `Subscription` document plus `AiUsage` daily counters.

## Data Model

```js
// New: Subscription — one document per user
{
  userId:               ObjectId,  // ref User, unique index
  plan:                 'free' | 'premium',
  status:               'none' | 'active' | 'past_due' | 'cancelled',
  razorpayCustomerId:   String | null,
  razorpaySubscriptionId: String | null,
  currentPeriodEnd:     Date | null,
  cancelAtPeriodEnd:    Boolean,
  createdAt, updatedAt
}

// New: AiUsage — per user, per feature, per UTC day (rate-limit counter)
{
  userId:  ObjectId,
  feature: 'profile_feedback' | 'match_insight' | 'interview_prep',
  date:    String,   // 'YYYY-MM-DD', UTC
  count:   Number,
}
// Compound unique index on (userId, feature, date); incremented via upsert per call

// New: AiConversation — interview-prep chat history
{
  userId: ObjectId,
  messages: [{ role: 'user' | 'assistant', content: String, createdAt: Date }],
  createdAt, updatedAt
}
```

`User` (untouched) remains the profile source of truth. `Subscription.userId` and `ConnectionRequest` (Phase 2) are the only cross-references — no changes to existing models.

## API & Event Contract (sketch — detailed shapes deferred to `api-and-interface-design`)

**Billing** (`/billing`, mounted alongside `/auth`, `/profile`, `/chat`):
| Method | Route | Purpose |
|---|---|---|
| GET | `/billing/status` | Return the caller's plan, status, and renewal date |
| POST | `/billing/checkout` | Create (or reuse) a Razorpay customer + subscription; return checkout params for Checkout.js |
| POST | `/billing/webhook` | Razorpay webhook receiver — signature-verified, raw body, no auth cookie |
| POST | `/billing/cancel` | Cancel at period end (`cancelAtPeriodEnd = true`) |

Webhook events handled: `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `subscription.halted` → mapped to `Subscription.status`/`plan`. Idempotency: each processed Razorpay `event.id` is recorded so retried webhook deliveries are no-ops.

**AI Assistant** (`/ai`), all routes behind `userAuth` + `checkAiQuota(feature)`:
| Method | Route | Purpose |
|---|---|---|
| POST | `/ai/profile-feedback` | Analyze the caller's own profile; return feedback text |
| POST | `/ai/match-insight/:userId` | "Why connect?" blurb using both users' **public** profile fields only |
| POST | `/ai/interview-prep` | Send a message in the interview-prep chat; streamed response (SSE) |
| GET | `/ai/interview-prep/history` | Paginated chat history for the caller |

`checkAiQuota(feature)` reads/increments `AiUsage` for `(userId, feature, today)`; the limit is looked up from `Subscription.plan` against a config map (e.g. free: 3/day, premium: 25/day per feature — exact numbers are a product decision, see Open Questions).

**Connection-request cap**: the existing `REQUEST.SEND` route in `routes/connection.js` gains the same plan-based check — free tier capped per day. This extends the existing endpoint rather than adding a new one.

## Risks, Open Questions & Alternatives Considered

**Alternatives rejected:**
- **Stripe** as the payments rail — rejected: no native UPI support, weaker fit for ₹100/month INR pricing aimed at the idea doc's India-first target audience. Could be added later as a second provider behind the same `Subscription` abstraction for international users, without changing the data model.
- **OpenAI / self-hosted LLM** (e.g. Llama via vLLM) — rejected: OpenAI would be a second AI vendor with no clear quality/cost advantage here; self-hosting is the kind of heavy infra lift the idea doc explicitly defers to a later hardening phase.
- **Per-request AI billing/credits** — rejected in favor of plan-based daily quotas: avoids building a second metering/billing system alongside Razorpay.

**Open Questions:**
1. **Pricing validation** — the idea doc flags "validate via a waitlist before building Razorpay" as an open assumption. Should Phase 6 ship behind a feature flag (`PREMIUM_ENABLED`) to a subset of users, or fully launch? **Recommendation: ship behind an env-driven feature flag** so it can be toggled without a deploy if validation signal is weak.
2. **Free-tier cap values** — exact numbers (daily connection-request limit; AI quota per feature per plan) are product decisions, not technical ones. **Recommendation:** start conservative (e.g. 20 connection requests/day free, unlimited premium; 3 AI calls/feature/day free, 25 premium) and make these config-driven (`config/limits.js`) so they're tunable without a code change.
3. **Grace period on payment failure** — how long does a user keep premium access after a failed renewal before reverting to free? **Recommendation:** revert immediately on `subscription.halted`/`cancelled`, since Razorpay already retries failed charges before halting a subscription — avoids a second grace-period timer in our system.
4. **Match-insight data exposure** — the AI prompt for `/ai/match-insight/:userId` must only ever include fields already returned by the existing feed (`PUBLIC_PROFILE_FIELDS` in `routes/profile.js`), never private fields (email, `blockedUsers`, etc.). **Recommendation:** reuse that same field-projection constant when building the prompt context, rather than maintaining a second allowlist.
5. **Streaming infra for interview prep** — should the streamed AI response reuse the Phase 3 Socket.IO connection, or be a separate channel? **Recommendation: Server-Sent Events (SSE) on the `/ai/interview-prep` POST route** — simpler than adding AI events to the chat socket namespace, and AI chat is logically separate from user-to-user messaging.
