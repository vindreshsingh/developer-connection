# Phase 6: Premium Subscriptions & AI Developer Assistant — PRD

## Problem & Target User
(From [the parent idea doc](../ideas/dev-connect-tinder-for-developers.md))
By Phase 6, Dev Connect has profiles, swipe-style discovery, connections, real-time chat, groups, and video calling (Phases 1–5) — but no monetization and no AI capabilities. Phase 6 introduces (a) a premium subscription tier (₹100/month via Razorpay) that converts engaged users into paying ones by lifting usage caps and unlocking advanced features, and (b) an AI Developer Assistant that uses the profile/connection/chat data accumulated in earlier phases to give users tangible career value (profile feedback, match insights, interview prep) — a feature explicitly sequenced last because it "needs profile + connection + chat data to be useful."

## Goals
- Free users get a usable but capped experience; Premium users (₹100/month) get materially more value, creating a clear upgrade incentive
- Razorpay handles recurring billing end-to-end — checkout, recurring charges, renewal, cancellation, and failed-payment handling — without the app ever storing card data
- The AI Developer Assistant gives every user (within usage caps) at least one of: profile/resume feedback, "why you might connect" match insights, and interview prep — built entirely on top of existing profile/connection data, no new data collection required
- Subscription status is the single gate for premium features (`Subscription.plan === 'premium' && status === 'active'`), checked server-side on every gated endpoint — not just hidden in the UI

## Non-Goals (this phase)
- Stripe / international payment methods — Razorpay only, INR only (see RFC Stack Decision)
- One-time purchases, credits, or à la carte add-ons — a single recurring "Premium" plan only
- AI features beyond profile feedback, match insights, and interview prep (e.g. AI-written outreach messages, AI-moderated chat, AI-driven match ranking) — explicitly deferred to avoid conflating this phase with Phase 2's matching algorithm
- Team/org billing, invoices, or GST-compliant tax handling beyond what Razorpay provides out of the box
- Fine-tuning or self-hosting an LLM — calls a hosted API only
- Multi-instance AI cost dashboards/queues — single-instance, per-user quota counters only (see RFC Open Questions)

## Success Metrics
- A user can go from "free" to an active Razorpay subscription and back to "premium" feature access within a single webhook round trip — no manual reconciliation
- 100% of premium-gated routes (connection-request cap, AI Assistant) enforce the gate server-side, with automated tests for both free and premium paths
- The free-tier daily connection-request cap is enforced and clearly communicated in the UI — directly validates the idea doc's "will users pay for unlimited swipes?" assumption
- AI Assistant responses feel responsive for a chat-like UX (target: first streamed token within ~2s for interview prep)
- Zero leakage of another user's private profile data into AI prompts beyond the fields already exposed via the existing public feed/profile APIs

## User Stories / Core Flows
1. **Hit the free-tier cap**: a free user who has sent their daily limit of connection requests sees a "daily limit reached — upgrade to Premium" prompt instead of the send action
2. **Upgrade to Premium**: user goes to `/billing`, clicks "Upgrade", completes Razorpay Checkout (UPI/card/netbanking) → a webhook activates their `Subscription` → the UI immediately reflects unlimited requests and AI access
3. **Manage subscription**: user views their plan, status, and renewal date, and can cancel (effective at period end) from `/billing`
4. **Subscription lapses**: a renewal payment fails and Razorpay halts the subscription → a webhook marks `status: cancelled`/`past_due` → the user reverts to free-tier limits, with an in-app notice
5. **Get profile feedback**: from the Profile page, a user requests AI feedback on their own bio/skills/experience/tech stack and receives concrete improvement suggestions
6. **Get a match insight**: while browsing the Feed, a user can request "Why connect?" on a candidate card and receive a short blurb on shared/complementary skills and tech stack — using only the public profile fields the feed already returns
7. **Interview prep chat**: user opens an AI Assistant chat scoped to their tech stack/role and has a multi-turn mock-interview conversation, with history persisted per user
8. **Quota enforcement**: free users get a small daily AI-usage allowance per feature; Premium users get a materially higher allowance — enforced server-side, per feature, per day

## MVP Scope
**In:** stories 1–8 above; Razorpay Subscriptions (checkout + webhooks + cancel); a free-tier daily connection-request cap; AI profile feedback, match insight, and interview-prep chat, all quota-gated by plan
**Out:** Stripe, one-time payments, AI-written outreach messages, AI-driven match ranking, self-hosted LLM, org billing

## Decisions Locked (see RFC for detail)
- Payments: **Razorpay Subscriptions** (recurring, INR, ₹100/month) — webhook-driven status sync, no card data stored by the app
- AI provider: **Anthropic Claude API** — `claude-haiku-4-5` for high-frequency/low-latency match insights, `claude-sonnet-4-6` for profile feedback and interview prep where response quality matters more
- Feature gating: a single `Subscription` document per user (`plan`, `status`) is the source of truth, re-checked per request server-side
- AI usage is capped per-user/per-feature/per-day via an `AiUsage` counter collection — caps differ by plan, not a separate billing meter
