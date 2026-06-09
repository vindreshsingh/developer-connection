# Phase 1: Auth & Developer Profile — PRD

## Problem & Target User
(From [docs/ideas/dev-connect-tinder-for-developers.md](../ideas/dev-connect-tinder-for-developers.md))
Developers need a secure account and a rich profile (skills, tech stack, bio, experience) before any matching/connection feature can work — this phase lays that foundation on the existing Express + MongoDB + React scaffold.

## Goals
- A developer can create an account, verify their email, log in/out, and recover a forgotten password
- A developer can build out a profile that represents them technically (bio, skills, tech stack, experience, photo, cover image)
- All of the above is secure (hashed passwords, validated input, rate-limited auth endpoints) and observable (structured logs, error tracking) from day one

## Non-Goals (this phase)
- OAuth login (Google/GitHub/LinkedIn) — Phase 4
- Resume upload, portfolio links — later phase (bundled with profile extensions)
- Discovery feed, swiping, connections — Phase 2
- Any chat, video, groups, AI, or payments functionality

## Success Metrics
- A new user can go from landing page → verified, logged-in account → completed profile in under 3 minutes
- 100% of auth endpoints covered by automated tests (signup, login, logout, forgot/reset password, email verify)
- Zero plaintext password storage; all auth tokens expire and are invalidated on logout/reset

## User Stories / Core Flows
1. **Signup**: visitor enters name/email/password → account created (inactive until verified) → verification email sent
2. **Email verification**: user clicks link from email → account activated → redirected to login
3. **Login**: user enters email/password → receives JWT (httpOnly cookie) → redirected to profile/dashboard
4. **Logout**: user clicks logout → JWT cookie cleared/invalidated
5. **Forgot password**: user requests reset → reset email sent with time-limited token
6. **Reset password**: user submits new password with valid token → password updated, old sessions invalidated
7. **Create/edit profile**: logged-in user fills out bio, skills (multi-select/tag input), tech stack, experience, uploads profile photo and cover image
8. **View own profile**: user sees their profile as others would see it (preview mode)

## MVP Scope
**In:** stories 1–8 above, on web (responsive — desktop + mobile browser)
**Out:** OAuth, resume/portfolio, native mobile apps, profile analytics

## Decisions Locked (see RFC for detail)
- Image storage: Cloudinary
- Cloud target: AWS
