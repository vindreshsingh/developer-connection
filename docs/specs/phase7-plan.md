# Implementation Plan — Phase 7

Three tracks, mostly independent. Track C (CI/CD) is the one with internal sequencing —
Dockerfiles depend on the app being runnable cleanly, and the deploy job depends on
`/health` (Track B) existing for ECS health checks. Tracks A (Security) and B
(Observability) can be built in parallel with each other and with most of Track C.

## Dependency Graph

```
Track A — Security                  Track B — Observability
────────────────────                ──────────────────────
Task A1: helmet + CSP                Task B1: pino logger +
    │                                         pino-http
Task A2: expand rate limiting             │
    │                                Task B2: centralized Express
Task A3: npm audit + Dependabot              error handler
    │                                     │
Task A4: .env.example audit          Task B3: Sentry (backend + frontend)
                                           │
                                      Task B4: /health endpoint
                                           │
Track C — CI/CD                           │
────────────────                          │
Task C1: backend eslint config            │
    │                                      │
Task C2: CI workflow (lint/test/build/audit) ◄── needs A3 (audit step), C1
    │                                      │
Task C3: Dockerfiles (backend + frontend)  │
    │                                      │
Task C4: CD workflow → AWS  ◄──────────────┘ (needs B4 for ECS health check)
```

`C2` needs `A3`'s audit step and `C1`'s lint config to be meaningful. `C4` needs `C3`
(images to deploy) and `B4` (`/health` for the ECS task definition health check).
Everything else is independently buildable.

---

## Track A — Security Audit & Hardening

---

### Task A1 — `helmet` middleware + CSP

**Description:**
Add `helmet()` to the Express app with a CSP allowlist covering Cloudinary (images),
Razorpay checkout (script + frame), LiveKit (wss/https), and the OAuth provider
redirect domains (Google/GitHub/LinkedIn). Start in CSP report-only mode.

**Acceptance criteria:**
- `helmet()` applied in `app.js` before route mounting
- Response headers include `Content-Security-Policy-Report-Only`,
  `X-Content-Type-Options`, `X-Frame-Options` (or CSP `frame-ancestors`), and HSTS
- CSP allowlist explicitly includes: `res.cloudinary.com`, `checkout.razorpay.com`,
  `api.razorpay.com`, the configured LiveKit URL's origin, and OAuth callback
  domains
- Existing tests (`npm test`) still pass — no route behavior changes
- App still loads correctly in dev (Vite dev server origin allowed for `connect-src`
  in non-production)

**Files:**
- `backend/src/app.js`
- `backend/package.json` (add `helmet`)
- `backend/.env.example` (document any new CSP-related env vars if origins become
  configurable, e.g. `LIVEKIT_URL`)

**Estimated scope:** S

---

### Task A2 — Expand rate limiting

**Description:**
Generalize `createAuthRateLimiter` into a shared `createRateLimiter` factory, add a
global baseline limiter for all routes, and apply a moderate limiter to
`/request/send/*` and `/billing/checkout`.

**Acceptance criteria:**
- `createRateLimiter(max, windowMs)` factory in `rateLimiter.js` (rename/generalize
  existing factory; `createAuthRateLimiter` becomes a thin wrapper or is replaced with
  a named export using the general factory)
- Global limiter (generous, e.g. 300 req / 5 min per IP) applied in `app.js` ahead of
  all routes
- `authRateLimiter` on `/auth/*` unchanged (existing tests must still pass)
- New moderate limiter on `/request/send/*` (e.g. 60 req / 5 min) and
  `/billing/checkout` (e.g. 10 req / 15 min)
- Test-mode thresholds remain high (per existing `NODE_ENV === 'test'` pattern) so the
  existing test suite isn't tripped
- `npm test` passes

**Files:**
- `backend/src/middlewares/rateLimiter.js`
- `backend/src/app.js`
- `backend/src/routes/request.js` (mount limiter)
- `backend/src/routes/billing.js` (mount limiter)
- `backend/src/__tests__/rateLimiter.test.js` (new or extend existing)

**Estimated scope:** S

---

### Task A3 — Dependency audit automation

**Description:**
Add an `npm audit` check that can run in CI, plus Dependabot config for both
`backend` and `frontend`.

**Acceptance criteria:**
- `npm audit --omit=dev --audit-level=high` exits non-zero on `high`/`critical`
  advisories in both `backend` and `frontend` (run locally to confirm current state is
  clean, or document/triage any existing findings)
- `.github/dependabot.yml` configured for `npm` ecosystem on `/backend` and
  `/frontend`, weekly schedule, grouped minor/patch updates

**Files:**
- `.github/dependabot.yml`
- (no app code changes — this is config only; the audit command itself is wired into
  CI in Task C2)

**Estimated scope:** XS

---

### Task A4 — `.env.example` audit

**Description:**
Grep all `process.env.X` references in `backend/src`, diff against
`backend/.env.example`, and reconcile — document any missing keys, remove/flag any
stale ones.

**Acceptance criteria:**
- Every `process.env.*` key referenced in `backend/src` (excluding `NODE_ENV`) appears
  in `.env.example` with a comment
- Any `.env.example` keys not referenced anywhere in code are either removed or
  annotated as forward-looking (e.g. for Track C deploy secrets)
- No code changes beyond `.env.example` itself

**Files:**
- `backend/.env.example`

**Estimated scope:** XS

---

## Track B — Observability

---

### Task B1 — Structured logging (`pino`)

**Description:**
Add `pino` + `pino-http`, replace `console.*` calls in `server.js`, `database.js`,
`oauth.js`, and `seedPlans.js` with the new logger, and add request logging.

**Acceptance criteria:**
- `backend/src/utils/logger.js` exports a configured `pino` instance (pretty-print in
  dev via `pino-pretty`, JSON in production)
- `pino-http` mounted in `app.js`, logs method/path/status/duration and `req.user.id`
  when authenticated
- All `console.log`/`console.error` in `backend/src` (non-test) replaced with
  `logger.info`/`logger.error`
- `npm test` passes (logger should be silent or low-noise in `NODE_ENV === 'test'`)

**Files:**
- `backend/src/utils/logger.js`
- `backend/src/app.js`
- `backend/src/server.js`
- `backend/src/config/database.js`
- `backend/src/routes/oauth.js`
- `backend/src/scripts/seedPlans.js`
- `backend/package.json` (add `pino`, `pino-http`, `pino-pretty`)

**Estimated scope:** S

---

### Task B2 — Centralized Express error handler

**Description:**
Add a final error-handling middleware in `app.js` that logs unhandled errors via
`pino` and returns a consistent `{ error: 'Internal server error' }` 500 response,
without changing any existing route's intentional error responses.

**Acceptance criteria:**
- New `backend/src/middlewares/errorHandler.js` — a 4-arg Express error middleware,
  mounted last in `app.js`
- Audit confirms existing routes' `try/catch` blocks that already send their own
  error responses are unaffected (this only catches what currently falls through to
  Express's default handler / unhandled promise rejections in route handlers)
- A deliberately-thrown unhandled error in a test route (or existing uncovered path)
  returns 500 `{ error: 'Internal server error' }` and is logged, not leaked as a
  stack trace to the client
- `npm test` passes (all existing error-path tests still get their original response
  shapes)

**Files:**
- `backend/src/middlewares/errorHandler.js`
- `backend/src/app.js`
- `backend/src/__tests__/errorHandler.test.js`

**Estimated scope:** S

---

### Task B3 — Sentry (backend + frontend)

**Description:**
Wire `@sentry/node` into the backend (capturing unhandled exceptions, integrated with
B2's error handler) and `@sentry/react` into the frontend. Both no-op if `SENTRY_DSN`
/ `VITE_SENTRY_DSN` are unset.

**Acceptance criteria:**
- Backend: Sentry initialized in `server.js` only if `process.env.SENTRY_DSN` is set;
  `errorHandler.js` (B2) reports caught errors to Sentry
- Frontend: Sentry initialized in `main.jsx`/entry point only if
  `import.meta.env.VITE_SENTRY_DSN` is set; wrapped with React error boundary
- With no DSN configured (default dev/test), app behavior is unchanged and no Sentry
  network calls are made
- `npm test` passes; `npm run build && npm run lint` (frontend) passes

**Files:**
- `backend/src/server.js`
- `backend/src/middlewares/errorHandler.js`
- `backend/package.json` (add `@sentry/node`)
- `backend/.env.example` (add `SENTRY_DSN`)
- `frontend/src/main.jsx` (or app entry point)
- `frontend/package.json` (add `@sentry/react`)
- `frontend/.env.example` (add `VITE_SENTRY_DSN`, create file if it doesn't exist)

**Estimated scope:** M

---

### Task B4 — `/health` endpoint

**Description:**
`GET /health` returns 200 if Mongo is connected, 503 otherwise. Unauthenticated, no
rate limiting (so load balancer health checks aren't throttled).

**Acceptance criteria:**
- `GET /health` → `{ status: 'ok', mongo: 'connected' }` with 200 when
  `mongoose.connection.readyState === 1`
- `GET /health` → 503 `{ status: 'error', mongo: 'disconnected' }` otherwise
- Route is excluded from the global rate limiter added in A2
- `npm test -- health.test.js` passes

**Files:**
- `backend/src/routes/health.js`
- `backend/src/app.js` (mount `/health`, before global rate limiter or explicitly
  excluded)
- `backend/src/__tests__/health.test.js`

**Estimated scope:** XS

---

## Track C — CI/CD & Deployment

---

### Task C1 — Backend ESLint config

**Description:**
The frontend has `eslint.config.js` + a `lint` script; the backend has neither. Add a
matching ESLint setup for `backend/src` (ESM, Node environment) so Task C2's CI lint
step has something to run.

**Acceptance criteria:**
- `backend/eslint.config.js` (flat config, consistent with frontend's style/version)
- `backend/package.json` gains a `"lint": "eslint ."` script
- `npm run lint` passes on current `backend/src` (fix any trivial violations surfaced;
  do not mass-reformat unrelated code — scope fixes to what the linter flags)

**Files:**
- `backend/eslint.config.js`
- `backend/package.json`
- `backend/.eslintignore` if needed (or `ignores` in flat config)

**Estimated scope:** S

---

### Task C2 — CI workflow (GitHub Actions)

**Description:**
`.github/workflows/ci.yml` running on PR + push to `master`: backend lint/test/audit,
frontend lint/build.

**Acceptance criteria:**
- Two jobs (or matrix): `backend` (`npm ci`, `npm run lint`, `npm test`,
  `npm audit --omit=dev --audit-level=high`) and `frontend` (`npm ci`,
  `npm run lint`, `npm run build`)
- Workflow runs on `pull_request` and `push` to `master`
- Set up as a required status check (documented in PR description / repo settings —
  actual branch protection toggle is a repo-admin action outside this task's file
  changes)
- A test PR (or this phase's own PR) shows the workflow running green

**Files:**
- `.github/workflows/ci.yml`

**Estimated scope:** S

---

### Task C3 — Dockerfiles

**Description:**
Multi-stage `Dockerfile` for backend (Node, runs `node src/server.js`) and frontend
(Vite build → static assets served via nginx).

**Acceptance criteria:**
- `backend/Dockerfile` builds and runs; `docker run` against a reachable Mongo +
  required env vars serves traffic and `/health` (B4) returns 200
- `frontend/Dockerfile` multi-stage: build stage runs `npm run build`, final stage
  serves `dist/` via nginx (with SPA fallback routing to `index.html`)
- `.dockerignore` for both (excludes `node_modules`, `.env`, etc.)
- Images build successfully in CI (can be a non-blocking job in C2, or deferred to
  C4's deploy workflow build step)

**Files:**
- `backend/Dockerfile`
- `backend/.dockerignore`
- `frontend/Dockerfile`
- `frontend/.dockerignore`
- `frontend/nginx.conf` (SPA fallback config)

**Estimated scope:** M

---

### Task C4 — CD workflow → AWS

**Description:**
`.github/workflows/deploy.yml`, triggered on push to `master` after CI passes:
build + push backend image to ECR, deploy to ECS; build frontend, sync to S3, invalidate
CloudFront.

**Acceptance criteria:**
- Backend: builds `backend/Dockerfile` image, pushes to ECR, updates the ECS service
  (new task definition revision pointing at the new image tag)
- ECS task definition includes a health check pointing at `/health` (B4)
- Frontend: `npm run build`, `aws s3 sync dist/ s3://<bucket>` , CloudFront
  invalidation for `/*`
- AWS credentials supplied via GitHub Actions OIDC role (preferred) or repo secrets —
  no long-lived keys committed
- Workflow documented with required repo secrets/variables in a comment header (ECR
  repo name, ECS cluster/service names, S3 bucket, CloudFront distribution ID)

**Files:**
- `.github/workflows/deploy.yml`

**Estimated scope:** M

**Note:** This task assumes the underlying AWS resources (ECR repo, ECS
cluster/service/task definition, S3 bucket, CloudFront distribution, MongoDB
Atlas cluster) already exist or are provisioned out-of-band (Terraform/console) —
provisioning that infrastructure is not itself a file-change task and is called out as
an open question in the RFC.

---

## Checkpoints

### Checkpoint 1 — After A1 + A2 + B1 + B2 + B4
- [x] `helmet` headers present on responses; CSP report-only doesn't break the SPA in
  dev
- [x] Global + route-specific rate limiters active; existing tests still pass
- [x] All `console.*` replaced with `pino` logger; request logging visible in dev
  output
- [x] Unhandled errors return consistent `{ error: ... }` 500 without leaking stack
  traces
- [x] `GET /health` reflects Mongo connection state

### Checkpoint 2 — After A3 + A4 + B3
- [x] `npm audit` clean (or findings triaged/documented) for backend + frontend
- [x] Dependabot config merged
- [x] `.env.example` fully reconciled with `process.env.*` usage
- [x] Sentry wired but inert without `SENTRY_DSN`; verified locally with a test DSN
  that errors are captured

### Checkpoint 3 — After C1 + C2
- [x] `backend` has a working `lint` script; `npm run lint` clean
- [x] CI workflow green on a test PR (lint, test, audit, build all pass)

### Checkpoint 4 — FEATURE COMPLETE (after C3 + C4)
- [x] Both Dockerfiles build and run locally against a real Mongo instance
- [x] Deploy workflow runs end-to-end against AWS (or is verified up to the point
  where it would require live AWS resources, with the remainder documented as an open
  question)
- [x] Full backend test suite passes (`npm test`); frontend `lint`/`build` green

---

## New Dependencies

### Backend
```
helmet        # HTTP security headers + CSP
pino          # structured logging
pino-http     # request logging middleware
pino-pretty   # dev-only pretty printing
@sentry/node  # error tracking
eslint        # (+ flat config) — backend currently has no linter
```

### Frontend
```
@sentry/react # error tracking
```

---

## Parallelisation Notes

- Track A (A1–A4) and Track B (B1–B4) have no cross-dependencies and can be built
  fully in parallel
- Within Track B: B1 → B2 → B3 should be sequential (B2 needs B1's logger, B3's
  backend half needs B2's error handler to report through); B4 is independent and can
  be done any time
- Within Track C: C1 → C2 sequential (lint config before CI references it); C3 is
  independent of C1/C2 but C4 needs both C3 (images) and B4 (health check)
- A3's Dependabot config is independent but its audit *command* is referenced by C2 —
  do A3 before or alongside C2
- Recommended single-implementer order: B1 → B4 → B2 → A1 → A2 → B3 → A3 → A4 → C1 →
  C2 → C3 → C4
