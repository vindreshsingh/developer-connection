# Implementation Plan: Phase 1 Gap-Closing (Auth & Profile)

## Overview
Most of Phase 1's user stories (signup, login, logout, password reset, profile CRUD, feed, even Phase 2's connections) already exist in `backend/src/routes/` and `frontend/src/pages/`. This plan covers only the **gaps** between what exists and the [Phase 1 RFC](phase1-auth-profile-rfc.md): email verification, new profile fields, image upload via Cloudinary, auth hardening (rate limiting, session invalidation), and test coverage.

## Architecture Decisions
- Build directly on existing `User` model and `routes/auth.js` / `routes/profile.js` — no restructuring (per scope discipline)
- Email verification reuses the same hashed-token pattern already used for password reset (`crypto.createHash('sha256')`, expiry field) for consistency
- Cloudinary upload goes through a small `utils/cloudinary.js` helper + `multer` middleware for multipart handling (new dependency)
- Tests use the project's existing stack conventions (Express + Mongoose) — recommend `jest` + `supertest` + `mongodb-memory-server` (none currently installed; first test task sets this up)

## Task List

### Phase A: Test Infrastructure (foundation — needed before "done" means anything)
- [ ] **Task 1: Set up backend test infrastructure**
  - **Description:** Install and configure `jest`, `supertest`, `mongodb-memory-server`; add `npm test` script; write one smoke test against an existing endpoint (e.g., `POST /auth/login`) to prove the harness works.
  - **Acceptance criteria:**
    - [ ] `npm test` runs and passes against a real endpoint using an in-memory MongoDB
    - [ ] Test config isolated from dev `.env` (no risk of touching real DB)
  - **Verification:** `npm test` exits 0; CI-ready (no external DB dependency)
  - **Dependencies:** None
  - **Files likely touched:** `backend/package.json`, `backend/jest.config.js`, `backend/src/__tests__/auth.test.js`
  - **Estimated scope:** S

### Checkpoint: Test Infra
- [ ] `npm test` runs cleanly and is wired to a throwaway in-memory DB
- [ ] Review with human before proceeding

### Phase B: Email Verification (highest-risk gap — touches signup flow)
- [ ] **Task 2: Add email verification fields + signup flow update**
  - **Description:** Add `isEmailVerified`, `emailVerifyToken`, `emailVerifyExpiry` to `User` schema; update `POST /auth/signup` to generate a hashed verify-token, save it, and send a verification email via the existing `nodemailer` transporter pattern (mirror the forgot-password email code in `routes/auth.js`).
  - **Acceptance criteria:**
    - [ ] New signups have `isEmailVerified: false` and receive an email with a verification link
    - [ ] Existing signup validation/sanitization untouched
  - **Verification:** Test asserts a new user document has `isEmailVerified: false` and a hashed token after signup
  - **Dependencies:** Task 1
  - **Files likely touched:** `backend/src/models/user.js`, `backend/src/routes/auth.js`, `backend/src/constants/apiEndpoints.js`
  - **Estimated scope:** S

- [ ] **Task 3: Add verify-email endpoint + gate login on verification**
  - **Description:** Add `GET /auth/verify-email/:token` that hashes the incoming token, finds a matching unexpired user, sets `isEmailVerified: true`, clears the token fields. Update `POST /auth/login` to reject (403) unverified accounts with a clear error message.
  - **Acceptance criteria:**
    - [ ] Valid token activates the account; invalid/expired token returns 400
    - [ ] Login for an unverified account returns 403 with `{ error: "Please verify your email before logging in" }`
    - [ ] Login for a verified account is unaffected
  - **Verification:** Tests cover: valid verify, expired/invalid token, login-blocked-when-unverified, login-allowed-when-verified
  - **Dependencies:** Task 2
  - **Files likely touched:** `backend/src/routes/auth.js`, `backend/src/constants/apiEndpoints.js`, `backend/src/__tests__/auth.test.js`
  - **Estimated scope:** S

- [ ] **Task 4: Frontend — verification banner + verify-email page**
  - **Description:** Add a route/page that handles `/verify-email/:token` (calls the backend endpoint, shows success/error state, links to login). Add a banner on `Login`/`Profile` pages prompting unverified users to check their email, with a "resend" action (reuses the signup email-send logic via a new lightweight `POST /auth/resend-verification` endpoint).
  - **Acceptance criteria:**
    - [ ] Visiting `/verify-email/:token` with a valid token shows success and links to login
    - [ ] Unverified logged-out users attempting login see the verification prompt (not a generic error)
  - **Verification:** Manual check: full signup → email link → verify → login flow works end-to-end in the browser
  - **Dependencies:** Task 3
  - **Files likely touched:** `frontend/src/pages/VerifyEmail.jsx` (new), `frontend/src/App.jsx`, `frontend/src/pages/Login.jsx`, `backend/src/routes/auth.js`
  - **Estimated scope:** M

### Checkpoint: Email Verification
- [ ] Full signup → verify → login loop works end-to-end (manual + automated)
- [ ] All Phase B tests pass
- [ ] Review with human before proceeding

### Phase C: Extended Profile Fields & Image Upload
- [ ] **Task 5: Add `coverImageUrl`, `techStack`, `experience` to User schema + allow in profile edit**
  - **Description:** Add the three fields per the RFC's data model section to `userSchema`; add `techStack` and `experience` (and `coverImageUrl`) to `ALLOWED_UPDATES` in `routes/profile.js`.
  - **Acceptance criteria:**
    - [ ] `PATCH /profile` accepts and persists `techStack` (array of strings) and `experience` (array of `{title, company, startDate, endDate, description}`)
    - [ ] Existing allowed fields still work; disallowed fields still rejected
  - **Verification:** Test: PATCH with new fields persists and returns them; PATCH with disallowed field still 400s
  - **Dependencies:** Task 1
  - **Files likely touched:** `backend/src/models/user.js`, `backend/src/routes/profile.js`, `backend/src/__tests__/profile.test.js`
  - **Estimated scope:** S

- [ ] **Task 6: Cloudinary image upload for profile photo & cover image**
  - **Description:** Add `cloudinary` + `multer` deps; create `utils/cloudinary.js` upload helper; add `POST /profile/photo` and `POST /profile/cover` endpoints (multipart) that upload to Cloudinary and save the returned URL to `photoUrl`/`coverImageUrl`.
  - **Acceptance criteria:**
    - [ ] Uploading an image returns 200 with the new Cloudinary URL persisted on the user
    - [ ] Non-image files / oversized files rejected with a clear 400
    - [ ] Cloudinary credentials read from env vars (never hardcoded)
  - **Verification:** Test mocks Cloudinary upload call and asserts URL persistence + rejection of bad input
  - **Dependencies:** Task 5
  - **Files likely touched:** `backend/src/utils/cloudinary.js` (new), `backend/src/routes/profile.js`, `backend/src/constants/apiEndpoints.js`, `backend/.env.example`
  - **Estimated scope:** M

- [ ] **Task 7: Frontend — extended profile edit UI (tech stack, experience, image upload)**
  - **Description:** Extend `frontend/src/pages/Profile.jsx` with tag-input for `techStack`, a repeatable form section for `experience` entries, and file-upload controls for profile photo / cover image wired to the new endpoints.
  - **Acceptance criteria:**
    - [ ] User can add/remove tech stack tags and experience entries, and they persist after reload
    - [ ] User can upload a new photo/cover image and see it reflected immediately
  - **Verification:** Manual check in browser: edit each new field, reload, confirm persistence
  - **Dependencies:** Task 6
  - **Files likely touched:** `frontend/src/pages/Profile.jsx`, `frontend/src/store/api.js`
  - **Estimated scope:** M

### Checkpoint: Extended Profile
- [ ] User can fully build out a developer profile (bio, skills, tech stack, experience, photo, cover) end-to-end
- [ ] All Phase C tests pass
- [ ] Review with human before proceeding

### Phase D: Auth Hardening
- [ ] **Task 8: Rate limiting on auth routes**
  - **Description:** Add `express-rate-limit`; apply a scoped limiter to `/auth/signup`, `/auth/login`, `/auth/forgot-password`, `/auth/reset-password/:token` (e.g., 5 requests / 15 min per IP).
  - **Acceptance criteria:**
    - [ ] Exceeding the limit returns 429 with a clear message
    - [ ] Limits don't interfere with normal usage in tests (test config uses higher/disabled limits)
  - **Verification:** Test simulates rapid requests and asserts 429 after threshold
  - **Dependencies:** Task 1
  - **Files likely touched:** `backend/src/routes/auth.js`, `backend/src/middlewares/rateLimiter.js` (new)
  - **Estimated scope:** S

- [ ] **Task 9: Session invalidation via `tokenVersion`**
  - **Description:** Add `tokenVersion` (Number, default 0) to `User`; embed it in JWT payload in `getJWT()`; update `userAuth` middleware to reject tokens whose version doesn't match the current user record; bump `tokenVersion` on password reset (and optionally logout-everywhere).
  - **Acceptance criteria:**
    - [ ] Resetting a password invalidates all previously issued tokens (old token returns 401 on protected routes)
    - [ ] Normal login/logout flow unaffected
  - **Verification:** Test: login → reset password → old token now rejected on `GET /profile`
  - **Dependencies:** Task 1
  - **Files likely touched:** `backend/src/models/user.js`, `backend/src/middlewares/auth.js`, `backend/src/routes/auth.js`, tests
  - **Estimated scope:** S

### Checkpoint: Hardening — Phase 1 Complete
- [ ] All tasks 1–9 verified and tests passing
- [ ] Full flow manually walked through: signup → verify email → login → build profile (incl. images, tech stack, experience) → logout → forgot/reset password (old sessions invalidated)
- [ ] Ready for `code-review-and-quality` pass before moving to Phase 2 polish / Phase 3 planning

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| No existing tests means regressions in untouched routes go unnoticed | Medium | Task 1 sets up infra early; each subsequent task adds tests for the code it touches (not full retroactive coverage — stays in scope) |
| Cloudinary credentials/setup friction | Low | Document required env vars in `.env.example`; mock Cloudinary in tests so CI doesn't need real credentials |
| `tokenVersion` change could break existing logged-in sessions during rollout | Low (dev env, no real users yet) | Acceptable — flag to the user before merging Task 9 |

## Open Questions
- None blocking — all Phase 1 RFC decisions are locked. Ready to begin Task 1.
