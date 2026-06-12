# Phase 7 RFC — Cross-Cutting Hardening

## Scope

Phase 7 is the dedicated hardening pass called out in the original roadmap
([dev-connect-tinder-for-developers.md](../ideas/dev-connect-tinder-for-developers.md)):
security audit, observability, and a cloud deployment pipeline. Three tracks:

1. **Security Audit & Hardening**
2. **Observability** (structured logging, error tracking, health checks)
3. **CI/CD & Deployment** (GitHub Actions + AWS, per the Phase 1 cloud-target decision)

**Explicitly out of scope for this phase:** load testing / performance benchmarking.
Can be revisited as its own pass once the observability stack from Track 2 exists to
make load-test results actionable.

This phase touches no product features — no new user-facing routes or models. It's
infrastructure and middleware around the existing surface.

---

## Track 1 — Security Audit & Hardening

### Current state (as of Phase 6)

- `authRateLimiter` ([rateLimiter.js](../../backend/src/middlewares/rateLimiter.js))
  is applied only to `/auth/*` routes; no global rate limiting elsewhere
  (`/profile/feed`, `/request/send/*`, `/ai/*` rely on `checkAIRateLimit` only for AI
  routes)
- No `helmet` — no `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`,
  HSTS, etc.
- `tokenVersion` invalidation exists ([user.js:143](../../backend/src/models/user.js))
  and is checked in both HTTP (`middlewares/auth.js`) and socket (`sockets/authMiddleware.js`)
  auth — already solid, no change needed
- CORS is a single `origin: process.env.FRONTEND_URL` ([app.js:23](../../backend/src/app.js)) — fine for single-environment, needs revisiting once
  staging/production are separate origins (Track 3)
- Razorpay webhook signature verification already implemented (Phase 6) — model for
  any future webhook consumers
- File uploads (`multer`, resume PDFs, profile photos via Cloudinary) — size/type
  limits exist per-route but haven't been audited centrally
- No automated dependency vulnerability scanning (`npm audit` / Dependabot)
- `.env.example` is reasonably complete but has never been audited against what's
  actually `process.env.*`-referenced in code (drift risk)

### Proposed changes

#### 1.1 — `helmet` middleware
Add `helmet()` to `app.js` with a CSP tuned for the frontend's needs (allow Cloudinary
image URLs, Razorpay checkout script/iframe, LiveKit WebSocket/HTTPS endpoints,
Anthropic is server-side only so no CSP impact). Ship in **report-only** mode first if
CSP risk of breaking the SPA is high, then tighten.

#### 1.2 — Expand rate limiting
Generalize `createAuthRateLimiter` into a reusable factory (it already is one) and
apply tiered limiters:
- Global baseline limiter on all `/api/*`-equivalent routes (generous, e.g. 100
  req/min) — catches scraping/abuse broadly
- Keep the existing tighter `authRateLimiter` on `/auth/*`
- Add a moderate limiter to `/request/send/*` (swipe actions) — currently only gated
  by `requirePremium`'s `dailySwipeLimit`, not by request *rate*
- Add a moderate limiter to `/billing/checkout` — payment-initiation endpoints are a
  common abuse target

#### 1.3 — Dependency audit automation
- `npm audit --omit=dev` (or `audit-ci`) as a CI step (Track 3) that fails the build
  on `high`/`critical` advisories
- Enable Dependabot (or Renovate) for `backend/package.json` and
  `frontend/package.json` — weekly grouped PRs

#### 1.4 — `.env.example` audit
Script or manual pass: grep all `process.env.X` usages across `backend/src`, diff
against `.env.example` keys, flag any drift (missing docs or stale unused vars).

#### 1.5 — CORS review for multi-environment
Once Track 3 introduces staging vs. production, `FRONTEND_URL` becomes
environment-specific — confirm the `cors()` config and cookie `sameSite`/`secure`
flags (`backend/src/middlewares/auth.js` cookie-setting logic) are correct for an
HTTPS-only deployed environment (currently likely tuned for local dev).

#### 1.6 — Manual security review checklist
A one-time pass over auth, file upload, and payment/webhook code paths against the
OWASP Top 10 (injection, broken auth, sensitive data exposure, SSRF on any
server-side fetches, etc.). Output: a findings doc + follow-up tasks, not necessarily
all fixed within Phase 7.

---

## Track 2 — Observability

### Current state

- `console.log` / `console.error` scattered across `server.js`, `database.js`,
  `oauth.js`, `seedPlans.js` — no structured logging, no log levels, nothing shippable
  to a log aggregator
- No error tracking (Sentry connector is configured at the MCP/tooling level but not
  wired into the app)
- No `/health` or `/ready` endpoint for load balancers / container orchestration
  (needed by Track 3's ECS deployment regardless of monitoring maturity)
- No request logging (no `morgan`/`pino-http`)

### Proposed changes

#### 2.1 — Structured logging (`pino`)
Replace `console.*` with `pino` (lightweight, fast, good AWS CloudWatch fit via JSON
stdout). Add `pino-http` for request logging (method, path, status, duration,
`userId` if authenticated). Centralize as `backend/src/utils/logger.js`.

#### 2.2 — Error tracking (Sentry)
- Backend: `@sentry/node` initialized in `server.js`, capturing unhandled
  exceptions/rejections and Express errors (via error-handling middleware — note:
  there currently isn't a centralized Express error handler; this is a prerequisite)
- Frontend: `@sentry/react` for unhandled JS errors and failed API calls
- Both gated behind `SENTRY_DSN` env var — no-op if unset (so local dev isn't forced
  to configure Sentry)

#### 2.3 — Centralized Express error handler
Currently errors are handled ad-hoc per-route (try/catch + `res.status().json()`).
Add a final error-handling middleware in `app.js` that: logs via `pino`, reports to
Sentry, and returns a consistent `{ error: '...' }` shape for unhandled exceptions —
without changing existing intentional error responses.

#### 2.4 — Health check endpoint
`GET /health` — checks Mongo connection state (`mongoose.connection.readyState`),
returns 200/503. Required by Track 3's ECS task health checks and ALB target group.

---

## Track 3 — CI/CD & Deployment

### Current state

- No `.github/workflows/`
- No `Dockerfile` for backend or frontend (only `docker-compose.livekit.yml` /
  `livekit.dev.yaml` for the LiveKit dev dependency)
- Phase 1 RFC already decided the cloud target: **AWS — EC2/ECS + S3 + CloudFront +
  MongoDB Atlas/DocumentDB** ([phase1-auth-profile-rfc.md:79](../specs/phase1-auth-profile-rfc.md))
- Cloudinary used for media (decided in Phase 1, revisit only if cost becomes an
  issue — not blocking for Phase 7)

### Proposed changes

#### 3.1 — CI pipeline (GitHub Actions)
`.github/workflows/ci.yml`, triggered on PR + push to `master`:
- Backend: `npm ci`, `npm run lint` (if a lint script exists — confirm/add one),
  `npm test`, `npm audit --omit=dev` (from 1.3)
- Frontend: `npm ci`, `npm run lint`, `npm run build`
- Run as a required status check before merge

#### 3.2 — Dockerfiles
- `backend/Dockerfile` — multi-stage Node build, runs `node src/server.js`
- `frontend/Dockerfile` — multi-stage build (Vite build → static assets), served via
  nginx or pushed to S3/CloudFront (3.4 decides which)

#### 3.3 — CD pipeline (GitHub Actions → AWS)
`.github/workflows/deploy.yml`, triggered on push to `master` after CI passes:
- Build + push backend Docker image to ECR
- Deploy to ECS (rolling update on the existing service/task definition)
- Frontend: build static assets, sync to S3, invalidate CloudFront distribution
- Secrets (AWS credentials, `JWT_SECRET`, API keys, etc.) via GitHub Actions secrets
  + ECS task definition environment / Secrets Manager — **not** committed to the repo

#### 3.4 — Environments
Single production environment to start (matches "always a working, testable product"
philosophy from the roadmap) — staging environment is a stretch goal / open question
below, not a blocker for Phase 7 completion.

---

## Decisions Locked

- **Load testing excluded** from this phase per explicit scope cut — revisit as a
  follow-up once Track 2's observability stack can measure the results
- **Cloud target**: AWS, per Phase 1 decision (ECS for backend, S3 + CloudFront for
  frontend, MongoDB Atlas for the database)
- **Logging library**: `pino` (JSON structured logs, low overhead, CloudWatch-friendly)
- **Error tracking**: Sentry, gated behind `SENTRY_DSN` (no-op if unset)

---

## Open Questions

- **Staging environment**: do we provision a separate staging ECS service /
  CloudFront distribution / Atlas cluster now, or deploy straight to production with
  feature flags / careful PR review as the safety net? Affects 3.4 and CORS config
  (1.5).
- **CSP strictness**: should `helmet`'s CSP start in `report-only` mode (safer rollout,
  but doesn't actually block anything until tightened) or enforced from day one with a
  pre-audited allowlist (Cloudinary, Razorpay, LiveKit, Google/GitHub/LinkedIn OAuth
  redirect domains)?
- **Dependabot vs. Renovate**: Dependabot is zero-config on GitHub; Renovate offers
  more grouping/scheduling control. Either is fine — default to Dependabot unless
  there's a reason to prefer Renovate.
- **MongoDB Atlas migration**: is the current dev/local MongoDB instance already
  pointed at Atlas, or does Phase 7's deployment work include the actual migration to
  Atlas/DocumentDB? If the latter, that's a meaningful addition to Track 3's scope
  (data migration + connection string + IP allowlisting).
- **Centralized error handler scope** (2.3): does this risk changing response shapes
  for routes that currently return custom error bodies on thrown exceptions? Needs an
  audit of existing `catch` blocks before landing — likely should only catch what
  *isn't* already handled, not replace existing per-route error responses.
