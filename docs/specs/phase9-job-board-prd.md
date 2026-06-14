# Phase 9 PRD — Job Board & Opportunities

## Problem Statement

The original product idea (`docs/ideas/dev-connect-tinder-for-developers.md`) frames the
platform around three overlapping outcomes for developers: job/collaboration opportunities,
peer networking, and community. Phases 1–8 built the networking and community layers
(profiles, connections, chat, groups, video, feed/notifications) but there is still no
structured way to post or discover a concrete opportunity. The Phase 8 idea doc
(`docs/ideas/phase8-developer-feed.md`) explicitly flags "Job board / referral posts" as
deferred future work. This PRD scopes the first version of that job board.

## Goals

| Goal | Metric |
|---|---|
| Give posters a structured way to share opportunities | ≥ X active job postings created within 30 days of launch |
| Give seekers a way to discover and apply to relevant opportunities | ≥ Y applications submitted within 30 days of launch |
| Make matching useful without new AI infrastructure | ≥ Z% of applications are on postings where the applicant's skill-match score is ≥ 50% |
| Keep posters and applicants informed in real time | Application/status notifications delivered via existing `notification:new` socket event, same latency as Phase 8 |
| Reuse existing infra | No new database technology, no new auth system, no resume-upload pipeline — built on existing `User` profile fields, `Notification` model, Socket.io rooms, and RTK Query |

## Non-Goals (deferred)

- AI-ranked recommendations / "why you're a fit" summaries (Phase 6 AI assistant extension)
- Resume upload or attachment on applications (Phase 6 resume-feedback pipeline could feed
  this later)
- Featured/boosted/paid postings, employer verification, company pages
- Saved jobs, job alerts/digests, external ATS integration or external "Apply" links
- "Open to Work" / "Hiring" / "Open to Collaborate" profile badges
- Posting/application rate limits beyond the existing global rate limiter
- Admin moderation queue for postings (existing `Report` model / soft-delete-by-owner is
  the only moderation mechanism in v1)

---

## User Stories

### Posting
1. **As a logged-in user**, I can create a job posting with a title, description, type
   (full-time/part-time/contract/internship/freelance/collaboration), location mode
   (remote/onsite/hybrid), required skills/tags, and an optional salary range.
2. **As a logged-in user**, I can edit my own postings (e.g. update description, close it
   once filled).
3. **As a logged-in user**, I can delete (soft-delete) my own postings.

### Browsing
4. **As a logged-in user**, I can view a paginated list of open job postings, newest first.
5. **As a logged-in user**, I can filter postings by tags/required skills and by type.
6. **As a logged-in user**, each posting shows a skill-match % computed against my own
   profile's `skills ∪ techStack`.
7. **As a logged-in user**, postings from users I've blocked (or who've blocked me) never
   appear in browse results, consistent with existing blocking behavior (Phase 2).

### Applying
8. **As a logged-in user**, I can apply to an open posting with an optional cover note; my
   existing profile (skills, techStack, experience, GitHub/LinkedIn links) is attached
   automatically.
9. **As a logged-in user**, I cannot apply to the same posting twice, and cannot apply to my
   own posting.
10. **As a logged-in user**, I can view a "My Applications" list showing every posting I've
    applied to and its current status.

### Managing Applications (poster)
11. **As the poster**, I can view the list of applicants to my posting, each with their
    profile summary and skill-match %.
12. **As the poster**, I can update an application's status
    (pending → reviewing → shortlisted/rejected/accepted).

### Notifications
13. **As a poster**, when someone applies to my posting, I receive a real-time notification
    (`job_application`) and a persistent entry in my Notification Center.
14. **As an applicant**, when the poster changes my application's status, I receive a
    real-time notification (`job_application_status`).
15. **As a logged-in user**, I do not receive a notification for applying to my own posting
    (prevented at the application layer — you cannot apply to your own posting at all).

---

## Acceptance Criteria

### Jobs API
- `POST /jobs` — creates a posting; requires non-empty `title`, `description`, valid
  `type` and `locationMode` enum values; `requiredSkills`/`tags` optional arrays
- `GET /jobs?tags=&type=&page=1` — paginated, newest-first, `status: 'open'`,
  `deletedAt: null`; excludes postings by blocked/blocking users; each item includes a
  `skillMatchScore` (0–100) computed against `req.user`'s `skills ∪ techStack`
- `GET /jobs/:jobId` — single posting detail, including `skillMatchScore`; 404 if
  missing/soft-deleted; for non-owners, includes `myApplication: { _id, status } | null`
  so the frontend can show "Apply" vs. an application-status banner
- `PATCH /jobs/:jobId` — author-only; updates editable fields, including `status`
  (`open`|`closed`); 403 otherwise
- `DELETE /jobs/:jobId` — author-only soft-delete; 403/404 otherwise

### Applications API
- `POST /jobs/:jobId/apply` — creates a `JobApplication`; 400 if posting is the
  requester's own, 400 if posting is `closed`/soft-deleted, 409 if an application from
  this user already exists for this posting; creates a `job_application` notification for
  the poster
- `GET /jobs/:jobId/applications?page=1` — poster-only (403 otherwise), paginated,
  newest-first, each item includes the applicant's profile summary
  (`firstName lastName photoUrl skills techStack experience githubUrl linkedinUrl`) and
  `skillMatchScore`
- `PATCH /jobs/:jobId/applications/:applicationId` — poster-only; updates `status` to one
  of `reviewing|shortlisted|rejected|accepted`; creates a `job_application_status`
  notification for the applicant
- `GET /jobs/applications/mine?page=1` — logged-in user's own applications, newest-first,
  each item includes the posting summary (`title`, `company` if present, `type`, `status`)

### Notifications API (extends Phase 8)
- `Notification.type` enum extended with `job_application`, `job_application_status`
- `Notification` schema gains an optional `jobId` field (parallel to the existing
  `postId`), populated for these two new types
- `GET /notifications` response and `NotificationBell` link target both account for the
  new types (link to `/jobs/:jobId` instead of `/posts`)

### Real-time
- On `job_application`/`job_application_status` creation, the backend emits
  `notification:new` to `user:<recipientId>` via the existing Socket.io room convention,
  reusing the `emitNotification` helper from Phase 8
- Frontend `NotificationBell` already listens for `notification:new` and invalidates the
  `Notifications` tag — no new socket wiring needed, only new `type` → message/link
  mappings

### Frontend
- New `/jobs` route ("Jobs") added to NavBar
- Jobs page has a tag/type filter bar, a "Post a Job" form (`JobPostForm`), and a
  paginated list of `JobCard`s (each showing skill-match %)
- `/jobs/:jobId` detail page: full posting detail, an "Apply" form (cover note) for
  non-owners who haven't applied, and (for the poster) an applicants list with status
  controls
- `/jobs/mine` (or a tab on `/jobs`) shows the logged-in user's own postings and their
  "My Applications" list

---

## Data Model (high-level — see RFC for full schemas)

- **JobPosting** — `postedBy`, `title`, `company`, `description`, `type`
  (`full-time|part-time|contract|internship|freelance|collaboration`), `locationMode`
  (`remote|onsite|hybrid`), `requiredSkills[]`, `tags[]`, `salaryRange { min, max,
  currency }`, `status` (`open|closed`), `applicationCount`, `deletedAt`, timestamps
- **JobApplication** — `jobId`, `applicantId`, `coverNote`, `status`
  (`pending|reviewing|shortlisted|rejected|accepted`), timestamps
- **Notification** (extended) — `type` enum gains `job_application`,
  `job_application_status`; new optional `jobId` field

---

## Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Posting model | Single `JobPosting` model with a `type` enum including `collaboration` | Matches the roadmap's "job/collaboration opportunities" framing without a second model; mirrors `Group`'s single-model + enum pattern |
| Posting visibility | Public to all logged-in users (no employer-only gating), `status: open|closed` | Consistent with the platform's peer-to-peer framing; any user can post or browse |
| Posting cost | Free for all users in v1 | Seed supply before considering premium-gating in a future Payments RFC addendum |
| Application artifact | Cover note (text, ≤ 1000 chars) + the applicant's existing `User` profile fields (skills, techStack, experience, links) — no file upload | Profile data already covers what a resume would show; avoids building an upload pipeline before Phase 6 ties in |
| Skill-match score | Deterministic overlap %: `\|requiredSkills ∩ (skills ∪ techStack)\| / \|requiredSkills\|`, computed at read time, 0 if `requiredSkills` is empty | No AI cost, immediately useful, doesn't block on Phase 6 AI infra; true AI ranking can replace/augment this later |
| Application status workflow | Linear: `pending → reviewing → shortlisted/rejected/accepted`, poster-only transitions | Mirrors the simple state-machine pattern of `ConnectionRequest.status` |
| One application per user per posting | Enforced via a unique index on `(jobId, applicantId)` | Prevents duplicate-application spam; mirrors `ConnectionRequest`'s unique `(fromUserId, toUserId)` index |
| Notifications | Extend the existing `Notification.type` enum + add optional `jobId` field, reuse `emitNotification`/`notification:new` | Reuses Phase 8 infra directly; no new real-time transport |
| Moderation | Soft delete (`deletedAt`) by the posting's author only; existing blocking applies to browse results; no new reporting flow for postings in v1 | Consistent with Phase 8's Post moderation decision; posting-specific reporting can extend the existing `Report` model later if needed |

---

## Risks

| Risk | Mitigation |
|---|---|
| Low-quality / spam postings | Soft delete by author; existing global rate limiter applies to `POST /jobs`; no new reporting flow in v1 but the existing `Report` model can be extended later |
| Skill-match score gives false confidence (it's overlap, not fit) | Label it clearly as "skill match" in the UI, not a guarantee; flagged as a candidate for AI-assisted ranking in a future phase |
| `requiredSkills`/`User.skills` free-text mismatch (e.g. "React" vs "react") reduces match accuracy | Normalize both sides to lowercase/trimmed before comparison, consistent with how `Group.tags` and `User.skills` are already normalized |
| Notification volume from popular postings | Reuses Phase 8's read/unread + mark-all-read patterns; no new noise channel introduced |
| Browse feed performance as postings grow | Indexes on `(status, createdAt)`, `(deletedAt, createdAt)`, and `tags`/`requiredSkills`; offset pagination matches existing Groups/Posts convention |
| One-application-per-posting enforced only at the DB layer could surface as a generic 500 | Catch the duplicate-key error explicitly and return 409 with a clear message |

---

## Out of Scope (Phase 9)

- AI-ranked recommendations or AI-generated "fit" summaries
- Resume upload/attachment on applications
- Featured/boosted/paid postings, employer verification, company pages
- Saved jobs, job alerts/digests, external ATS integration
- "Open to Work"/"Hiring"/"Open to Collaborate" profile badges
- Posting/application-specific rate limiting beyond the existing global limiter
- Admin moderation queue for postings
