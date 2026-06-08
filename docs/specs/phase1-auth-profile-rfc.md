# Phase 1: Auth & Developer Profile — RFC / HLD

## Architecture

```
┌─────────────────┐        HTTPS/JSON         ┌──────────────────┐        ┌──────────────┐
│  React (Vite)   │ ───────────────────────▶ │  Express API     │ ─────▶ │  MongoDB     │
│  Frontend       │ ◀─────────────────────── │  (backend/src)   │ ◀───── │  (Mongoose)  │
│  Redux Toolkit  │      JWT (httpOnly        │  - routes        │        └──────────────┘
│  Tailwind CSS   │       cookie)             │  - middlewares   │
└─────────────────┘                           │  - models        │        ┌──────────────┐
                                               └────────┬─────────┘ ─────▶ │  Nodemailer  │
                                                        │                   │  (SMTP)      │
                                                        ▼                   └──────────────┘
                                               ┌──────────────────┐
                                               │  Image storage   │
                                               │  (TBD — see      │
                                               │  Open Questions) │
                                               └──────────────────┘
```

## Stack Decision
- **Frontend**: React 19 + Vite + Redux Toolkit + TailwindCSS v4 (reason: matches existing `frontend/` scaffold and installed dependencies — no migration cost)
- **Backend**: Express 5 + Mongoose/MongoDB (reason: matches existing `backend/src` scaffold, models, and middleware structure)
- **Auth**: JWT (`jsonwebtoken`) signed tokens delivered via httpOnly cookies (`cookie-parser`), passwords hashed with `bcrypt` — all already in `backend/package.json`
- **Validation**: `validator` (already present) for email/URL checks at the model layer
- **Email delivery**: `nodemailer` (already present) for verification and password-reset emails
- **Routing**: `react-router-dom` v7 (already present) for frontend pages
- **State**: `@reduxjs/toolkit` + `react-redux` (already present) for auth/profile state

This section is the binding contract — no new frameworks are introduced in this phase; we build entirely on the existing scaffold.

## Data Model Changes

`User` model ([backend/src/models/user.js](../../backend/src/models/user.js)) already has most needed fields (email, password, bio, skills, photoUrl, githubUrl, linkedinUrl, passwordResetToken/Expiry). Additions needed for this phase:

```js
// Add to userSchema:
isEmailVerified:   { type: Boolean, default: false },
emailVerifyToken:  { type: String, default: null },
emailVerifyExpiry: { type: Date, default: null },
coverImageUrl:     { type: String, default: null },
techStack:         { type: [String], default: [] },
experience: [{
  title:       String,
  company:     String,
  startDate:   Date,
  endDate:     Date,   // null = current
  description: String,
}],
```

No new collections required for this phase — `ConnectionRequest` is untouched (Phase 2 concern).

## API Contract (sketch — detailed shapes deferred to `api-and-interface-design`)

| Method | Route | Auth? | Purpose |
|---|---|---|---|
| POST | `/api/auth/signup` | No | Create account, send verification email |
| GET | `/api/auth/verify-email/:token` | No | Activate account |
| POST | `/api/auth/login` | No | Authenticate, set JWT cookie |
| POST | `/api/auth/logout` | Yes | Clear JWT cookie |
| POST | `/api/auth/forgot-password` | No | Send password-reset email |
| POST | `/api/auth/reset-password/:token` | No | Set new password |
| GET | `/api/profile/me` | Yes | Fetch own profile |
| PATCH | `/api/profile/me` | Yes | Update profile fields (bio, skills, techStack, experience) |
| POST | `/api/profile/me/photo` | Yes | Upload/replace profile photo |
| POST | `/api/profile/me/cover` | Yes | Upload/replace cover image |

## Risks, Open Questions, Alternatives Considered

- **Image storage**: **Decided — Cloudinary**. Minimal setup, free tier, built-in resizing/transforms for profile photos and cover images. Revisit at Phase 7 (hardening/scale) only if cost becomes a factor.
- **Session invalidation on logout**: JWTs are stateless; "logout" typically just clears the cookie client-side. For true invalidation (e.g., on password reset), we'll add a `tokenVersion` field to `User` and embed it in the JWT payload — bump it to invalidate all existing tokens. This is a small addition to the existing `getJWT` method.
- **Rate limiting**: not yet in `package.json`. Recommend adding `express-rate-limit` scoped to `/api/auth/*` routes to prevent brute-force/credential-stuffing — small, focused dependency addition.
- **Alternative considered — session-based auth (express-session + Redis)**: rejected because it adds infrastructure (Redis) this phase doesn't otherwise need; JWT fits the existing scaffold and Phase 1 scope better. Can revisit if Phase 3 (real-time chat) needs shared session state anyway.

## Decisions Locked
- **Image storage**: Cloudinary
- **Cloud target**: AWS (EC2/ECS + S3 + CloudFront + MongoDB Atlas or DocumentDB) — full CI/CD pipeline design deferred to Phase 7, but this direction informs early choices (e.g., env var conventions, IAM-friendly secrets handling) so we don't need to retrofit later.
