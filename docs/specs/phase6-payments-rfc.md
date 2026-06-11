# Phase 6 RFC — Premium Subscriptions & Payments

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          Checkout Flow                                      │
│                                                                              │
│  Browser ──► GET /billing/plans  ──► returns [free, premium] Plan docs     │
│                                                                              │
│  User clicks "Subscribe"                                                    │
│       │                                                                     │
│       ├── POST /billing/checkout ──► PaymentService.createSubscription()   │
│       │         │                                                           │
│       │         └── Razorpay API: subscriptions.create({ plan_id, ... })   │
│       │                  returns { id: razorpaySubscriptionId, ... }       │
│       │                                                                     │
│       │   Server creates Subscription doc (status: 'created')              │
│       │   Returns { subscriptionId, razorpayKeyId } to browser             │
│       │                                                                     │
│       └── Browser opens Razorpay Checkout (JS SDK) with subscription_id    │
│                                                                              │
│  User completes payment in Razorpay-hosted UI                              │
│       │                                                                     │
│       └── Razorpay sends webhook ──► POST /billing/webhook                 │
│                  │                                                          │
│                  ├── verify signature (HMAC SHA256, RAZORPAY_WEBHOOK_SECRET)│
│                  ├── dedupe via PaymentEvent.razorpayEventId                │
│                  ├── update Subscription.status → 'active'                 │
│                  ├── set currentPeriodStart/End from payload                │
│                  └── set User.isPremium = true                             │
│                                                                              │
│  Browser polls/refetches GET /billing/subscription (RTK 'Subscriptions' tag)│
│  after Checkout's `handler` callback fires → UI shows Premium badge        │
└──────────────────────────────────────────────────────────────────────────-─┘

┌────────────────────────────────────────────────────────────────────────────┐
│                  Recurring Charge / Cancellation Flow                       │
│                                                                              │
│  Razorpay auto-charges on renewal date                                      │
│       │                                                                     │
│       ├── success ──► webhook 'subscription.charged'                       │
│       │       └── Subscription.currentPeriodEnd extended; status stays     │
│       │           'active'; PaymentEvent recorded                          │
│       │                                                                     │
│       └── failure ──► webhook 'payment.failed'                             │
│               └── Subscription.status = 'past_due'                        │
│                   User.isPremium stays true for grace period (3 days)      │
│                   A scheduled check (cron / on-login lazy check) flips      │
│                   isPremium = false once currentPeriodEnd + grace < now     │
│                                                                              │
│  User clicks "Cancel" ──► POST /billing/cancel                              │
│       └── Razorpay subscriptions.cancel(id, { cancel_at_cycle_end: true }) │
│           Subscription.cancelAtPeriodEnd = true                            │
│           webhook 'subscription.cancelled' (at period end)                 │
│               └── Subscription.status = 'cancelled'; User.isPremium = false│
└──────────────────────────────────────────────────────────────────────────-─┘
```

---

## Data Model

### Plan

```js
// backend/src/models/plan.js
const planSchema = new mongoose.Schema({
  key:      { type: String, enum: ['free', 'premium'], required: true, unique: true },
  name:     { type: String, required: true },
  price:    { type: Number, required: true },        // paise (e.g. 10000 = ₹100)
  currency: { type: String, default: 'INR' },
  interval: { type: String, enum: ['month'], default: 'month' },
  razorpayPlanId: { type: String, default: null },    // null for 'free'
  features: {
    dailySwipeLimit:         { type: Number, default: null },  // null = unlimited
    advancedFilters:         { type: Boolean, default: false },
    priorityGroupCalls:      { type: Boolean, default: false },
    aiAssistant:             { type: Boolean, default: false },
    groupCallParticipantCap: { type: Number, default: 8 },
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });
```

Seeded once via `backend/src/scripts/seedPlans.js` (run manually / on deploy):
`free` (price 0, dailySwipeLimit 20) and `premium` (price 10000, all features true,
`groupCallParticipantCap: 25`).

### Subscription

```js
// backend/src/models/subscription.js
const subscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  planId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plan', required: true },
  status: {
    type: String,
    enum: ['created', 'active', 'past_due', 'cancelled', 'expired'],
    default: 'created',
  },
  razorpaySubscriptionId: { type: String, default: null, index: true },
  razorpayCustomerId:     { type: String, default: null },
  currentPeriodStart: { type: Date, default: null },
  currentPeriodEnd:   { type: Date, default: null },
  cancelAtPeriodEnd:  { type: Boolean, default: false },
}, { timestamps: true });

// One active/created subscription per user at a time
subscriptionSchema.index({ userId: 1, status: 1 });
```

### PaymentEvent

```js
// backend/src/models/paymentEvent.js
const paymentEventSchema = new mongoose.Schema({
  userId:         { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subscriptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subscription', default: null },
  razorpayEventId: { type: String, unique: true, sparse: true },
  type:    { type: String, required: true }, // raw Razorpay event name, e.g. 'subscription.charged'
  amount:  { type: Number, default: null },
  currency: { type: String, default: 'INR' },
  rawPayload: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: true });
```

### User model addition

```js
// backend/src/models/user.js — add to schema
isPremium: { type: Boolean, default: false },
```

`isPremium` is the single field every other route checks (`req.user.isPremium`). It is
written **only** by `webhookHandler` and the lazy grace-period check in `requirePremium`
— never set directly from a client request.

---

## Razorpay Integration — `PaymentService`

```js
// backend/src/services/PaymentService.js
import Razorpay from 'razorpay';
import crypto from 'crypto';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const PaymentService = {
  // Creates (or reuses) a Razorpay customer for the user, then a subscription
  async createSubscription({ user, plan }) {
    const customer = await razorpay.customers.create({
      name: `${user.firstName} ${user.lastName ?? ''}`.trim(),
      email: user.email ?? undefined,
      fail_existing: 0, // reuse if email already has a customer
    });

    const rzpSub = await razorpay.subscriptions.create({
      plan_id: plan.razorpayPlanId,
      customer_notify: 1,
      total_count: 120, // 10 years of monthly cycles; effectively "until cancelled"
      notes: { userId: user._id.toString() },
    });

    return { razorpaySubscriptionId: rzpSub.id, razorpayCustomerId: customer.id };
  },

  async cancelSubscription(razorpaySubscriptionId) {
    return razorpay.subscriptions.cancel(razorpaySubscriptionId, { cancel_at_cycle_end: 1 });
  },

  // HMAC verification per Razorpay webhook docs
  verifyWebhookSignature(rawBody, signature) {
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    return expected === signature;
  },
};
```

**Note on `customer_notify` and `notes.userId`**: the webhook payload for
`subscription.*` events includes `subscription.entity.notes.userId`, which is how the
webhook handler maps a Razorpay event back to our `User`/`Subscription` without relying
on the (optional) email field.

### Why Razorpay Subscriptions API (not manual recurring orders)

Razorpay Subscriptions handles the recurring auto-debit (UPI AutoPay / card mandate)
lifecycle natively, including retries on failure. Building this ourselves with one-off
Orders + a cron job to re-charge would duplicate functionality Razorpay already provides
and is a much larger surface for bugs around retry/grace-period logic.

---

## Webhook Handling

```js
// backend/src/routes/billing.js
router.post(
  BILLING.WEBHOOK,
  express.raw({ type: 'application/json' }), // raw body required for signature check
  async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    if (!PaymentService.verifyWebhookSignature(req.body, signature)) {
      return res.status(400).json({ error: 'Invalid signature' });
    }

    const payload = JSON.parse(req.body);
    const eventId = req.headers['x-razorpay-event-id'] ?? payload.id;

    // Idempotency: ignore already-processed events
    const existing = await PaymentEvent.findOne({ razorpayEventId: eventId });
    if (existing) return res.status(200).json({ ok: true });

    await BillingEventHandler.handle(payload, eventId);
    res.status(200).json({ ok: true });
  }
);
```

`express.raw()` is scoped to this single route (mounted before the global
`express.json()` body parser for this path) because signature verification requires the
exact raw bytes Razorpay signed.

### `BillingEventHandler.handle(payload, eventId)`

| Razorpay event | Handler action |
|---|---|
| `subscription.activated` | `Subscription.status = 'active'`, set `currentPeriodStart/End`, `User.isPremium = true` |
| `subscription.charged` | extend `currentPeriodEnd` to next cycle, ensure `status = 'active'`, record `PaymentEvent` |
| `payment.failed` | `Subscription.status = 'past_due'` (grace period; `isPremium` unchanged) |
| `subscription.cancelled` | `Subscription.status = 'cancelled'`, `User.isPremium = false` |
| `subscription.completed` / `subscription.expired` | `Subscription.status = 'expired'`, `User.isPremium = false` |

Every branch writes a `PaymentEvent` document (with `razorpayEventId`) first, inside the
same handler call, so a crash mid-update can be safely retried by Razorpay's webhook
redelivery without double effects (the dedupe check at the route level catches replays
of fully-processed events; if the process crashes between the `PaymentEvent.create` and
the `Subscription` update, the `findOne` dedupe would incorrectly short-circuit — to
avoid this, `PaymentEvent.create` and the `Subscription`/`User` updates happen in a
single Mongoose transaction).

---

## Entitlement / Gating Middleware

```js
// backend/src/middlewares/premium.js
export const requirePremium = (featureName) => async (req, res, next) => {
  const user = req.user;

  // Lazy grace-period expiry check
  if (user.isPremium) {
    const sub = await Subscription.findOne({ userId: user._id, status: 'past_due' });
    if (sub && Date.now() > sub.currentPeriodEnd.getTime() + GRACE_PERIOD_MS) {
      sub.status = 'expired';
      await sub.save();
      user.isPremium = false;
      await user.save();
    }
  }

  if (!user.isPremium) {
    return res.status(403).json({ error: 'PREMIUM_REQUIRED', feature: featureName });
  }
  next();
};
```

Used to fully gate routes that are Premium-only (e.g. the AI Assistant routes in the
companion RFC). For routes that are usable by everyone but have *graduated* behavior
(discovery feed swipe limits, advanced filters), the route itself reads
`req.user.isPremium` and `Plan.features` rather than hard-blocking — see below.

### Discovery Feed Changes (`GET /profile/feed`)

- Advanced filter query params (`experienceLevel`, `locationRadius`, `availability`)
  are stripped from the query before building the Mongo filter unless
  `req.user.isPremium`.
- Before returning results, count today's `Request` documents where
  `fromUserId = req.user._id` and `status = 'interested'` and `createdAt >= startOfDay`.
  If `count >= freePlan.features.dailySwipeLimit` and `!req.user.isPremium`, the feed
  endpoint still returns profiles (browsing is free) but `POST /request/send/interested/:toUserId`
  returns `403 { error: 'SWIPE_LIMIT_REACHED' }` for the rest of the day.

### Group Call Cap (`backend/src/services/LiveKitService.js`)

- `CallSession` gains `isPriority: Boolean` (default `false`), set to
  `req.user.isPremium` at `POST /calls/initiate` time for `type: 'group'`.
- LiveKit room creation passes `maxParticipants: isPriority ? premiumPlan.features.groupCallParticipantCap : 8`.

---

## API Contracts

```
GET    /billing/plans            Public (no auth) — list active plans
POST   /billing/checkout         Auth — body: { planKey: 'premium' } → { subscriptionId, razorpayKeyId, razorpaySubscriptionId }
POST   /billing/webhook          No user auth (signature-verified) — Razorpay webhook receiver
GET    /billing/subscription     Auth — current user's subscription + plan
POST   /billing/cancel           Auth — sets cancelAtPeriodEnd
GET    /billing/history          Auth — paginated PaymentEvent list for current user
```

Mounted in `app.js` as `app.use('/billing', billingRouter)`. The webhook route must be
registered with `express.raw()` *before* the app-wide `express.json()` middleware
applies to `/billing` — achieved by mounting a small raw-body router for just
`/billing/webhook` ahead of the main router, or by ordering middleware per-route as
shown above (Express applies route-specific body parsers in registration order).

---

## Frontend Architecture

```
frontend/src/
├── containers/Pricing/index.jsx          # /pricing page
│   └── Pricing.scss
├── containers/Settings/BillingTab.jsx    # account settings → Billing
├── widgets/PlanCard/PlanCard.jsx + .scss
├── widgets/UpsellModal/UpsellModal.jsx + .scss   # shown on swipe-limit / locked filter
├── hooks/billing/billingApi.js           # RTK Query endpoints
└── hooks/billing/useRazorpayCheckout.js  # loads Razorpay JS SDK, opens Checkout
```

```js
// frontend/src/hooks/billing/billingApi.js
const billingApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getPlans: builder.query({ query: () => '/billing/plans' }),
    getSubscription: builder.query({ query: () => '/billing/subscription', providesTags: ['Subscriptions'] }),
    createCheckout: builder.mutation({
      query: (body) => ({ url: '/billing/checkout', method: 'POST', body }),
    }),
    cancelSubscription: builder.mutation({
      query: () => ({ url: '/billing/cancel', method: 'POST' }),
      invalidatesTags: ['Subscriptions'],
    }),
    getBillingHistory: builder.query({ query: (page = 1) => `/billing/history?page=${page}` }),
  }),
});
```

```js
// frontend/src/hooks/billing/useRazorpayCheckout.js
export const useRazorpayCheckout = () => {
  const [createCheckout] = useCreateCheckoutMutation();
  const [refetchSub] = useLazyGetSubscriptionQuery();

  const subscribe = async (planKey) => {
    const { razorpayKeyId, razorpaySubscriptionId } = await createCheckout({ planKey }).unwrap();
    const rzp = new window.Razorpay({
      key: razorpayKeyId,
      subscription_id: razorpaySubscriptionId,
      name: 'Developer Connection — Premium',
      handler: () => refetchSub(), // webhook updates DB; we just refetch our cached state
      theme: { color: '#6366f1' },
    });
    rzp.open();
  };

  return { subscribe };
};
```

The Razorpay Checkout `<script src="https://checkout.razorpay.com/v1/checkout.js">` is
loaded once via a `<script>` tag in `index.html` (consistent with how third-party SDKs
that must be globally available are typically loaded — avoids bundler issues with
Razorpay's UMD build).

`api.js` gains `'Subscriptions'` to `tagTypes`.

---

## Existing Code Impact

| File | Change |
|---|---|
| `backend/src/models/user.js` | add `isPremium: Boolean` |
| `backend/src/app.js` | mount `/billing` router; raw-body parser ordering for webhook |
| `backend/src/constants/apiEndpoints.js` | add `BILLING` constant |
| `backend/src/routes/profile.js` (feed handler) | strip advanced filter params + enforce swipe limit for non-premium |
| `backend/src/routes/calls.js` | set `CallSession.isPriority` from `req.user.isPremium` on group call initiate |
| `backend/src/services/LiveKitService.js` | accept `maxParticipants` param |
| `backend/.env.example` | add `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` |
| `frontend/src/store/api.js` | add `'Subscriptions'` tag |
| `frontend/index.html` | add Razorpay Checkout `<script>` tag |
| `frontend/src/App.jsx` / routes | add `/pricing` route |

---

## Authorization Matrix

| Endpoint | Auth required | Additional check |
|---|---|---|
| `GET /billing/plans` | No | — |
| `POST /billing/checkout` | Yes | Reject if user already has an `active` subscription |
| `POST /billing/webhook` | No (signature) | Razorpay HMAC signature on raw body |
| `GET /billing/subscription` | Yes | Returns 404-shaped `{ plan: 'free', subscription: null }` if none exists (not an error) |
| `POST /billing/cancel` | Yes | 404 if no active subscription |
| `GET /billing/history` | Yes | Filtered to `userId = req.user._id` |

---

## Testing Strategy

- `PaymentService` tests mock the `razorpay` SDK client (no live API calls)
- Webhook tests construct payloads + compute valid HMAC signatures using a test
  `RAZORPAY_WEBHOOK_SECRET`, covering: valid signature/processed, invalid signature/400,
  duplicate `razorpayEventId`/no-op
- `requirePremium` middleware unit tests: premium user passes, free user gets 403 with
  `PREMIUM_REQUIRED`, past-due user past grace period flips to free
- Discovery feed tests: free user hits `dailySwipeLimit` → 403 `SWIPE_LIMIT_REACHED`;
  premium user unaffected; advanced filter params ignored for free users
- Frontend: `Pricing` page renders plan cards from `getPlans`; `UpsellModal` triggers on
  403 `SWIPE_LIMIT_REACHED` / `PREMIUM_REQUIRED` responses (handled in a shared RTK Query
  `onQueryStarted`/error matcher)

---

## Open Questions

- Should `isPremium` grace-period expiry be checked lazily (as designed here, on next
  authenticated request) or via a scheduled job? Lazy check is simpler and avoids adding
  a job runner, but a user who doesn't make requests stays "premium" indefinitely after
  expiry (harmless — they just don't get re-billed since Razorpay already stopped).
- Pricing page copy / exact feature comparison table — product/marketing decision, not
  blocking for implementation (placeholder copy ships first).
- Do we need a `GET /billing/invoice/:paymentEventId` endpoint for downloadable receipts
  in v1, or is the history table sufficient? Deferred — Razorpay's hosted dashboard
  already emails receipts to the customer.
