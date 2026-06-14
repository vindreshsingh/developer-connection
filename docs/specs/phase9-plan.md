# Implementation Plan — Phase 9 (Job Board & Opportunities)

Two backend tracks and two frontend tracks. As with Phase 8, the RFC's API contract is the
seam between backend and frontend, so frontend tracks can start as soon as the contract is
locked (it already is, in `phase9-job-board-rfc.md`) — they don't need to wait for backend
code to merge, only for the contract to stay stable.

## Dependency Graph

```
Track A — Backend: Job Postings          Track B — Backend: Applications
─────────────────────────────           ──────────────────────────────
Task A1: JobPosting model +              Task B1: JobApplication model +
  JOBS constants                            Notification extension
    │                                          (job_application,
Task A2: Jobs routes — create,                 job_application_status, jobId)
  browse (filters + skillMatchScore),          + utils/notifications.js
  get (+ myApplication), update, delete        (emitNotification, extracted
    │  (extracts utils/blocking.js,            from posts.js)
    │   used by posts.js too)                       │
    └──────────────┬───────────────────────────────┘
                    │
              Task B2: Application routes — apply, applicants list,
              status update, my-applications (creates Notification docs
              via B1's model + utils/notifications.js, emits
              notification:new)


Track C — Frontend: Browse & Post         Track D — Frontend: Detail & Applications
─────────────────────────────           ──────────────────────────────────────
Task C1: jobApi.js + tag types           Task D1: JobDetail page/container —
    │                                       apply flow + applicants management
Task C2: JobCard + JobPostForm                 │  (needs C1 + B2's myApplication/
  widgets                                      │   applications endpoints)
    │                                     Task D2: "My Applications" view +
Task C3: Jobs page/container,                  NotificationBell updates (new
  routing, NavBar "Jobs" link                  types, jobId link)
```

`A1 → A2 → B2` is the backend critical path (`B2` needs `A2`'s posting/status checks and
`B1`'s model + extracted notification helper). `B1` itself has no dependency on Track A and
can be built in parallel with `A1`/`A2` (it only touches `Notification` and adds a new
model/util). Track C (`C1 → C2 → C3`) can proceed against the documented contract; Track D
(`D1 → D2`) depends on `C1` for the API hooks and, for the real end-to-end flow, on `B2`.

---

## Track A — Backend: Job Postings

---

### Task A1 — `JobPosting` model + `JOBS` constants

**Description:**
Add the new `JobPosting` Mongoose model and the `JOBS` route-path constants, per the RFC's
exact schema (fields, enums, indexes).

**Acceptance criteria:**
- `backend/src/models/jobPosting.js` matches RFC schema: `postedBy`, `title`, `company`,
  `description`, `type` (enum), `locationMode` (enum), `location`, `requiredSkills[]`,
  `salaryRange { min, max, currency }`, `status` (enum `open|closed`),
  `applicationCount`, `deletedAt`, timestamps; indexes on `(status, createdAt)`,
  `(deletedAt, createdAt)`, `requiredSkills`, `postedBy`
- `backend/src/constants/apiEndpoints.js` gains `JOBS` (`LIST`, `CREATE`,
  `MY_APPLICATIONS`, `GET`, `UPDATE`, `DELETE`, `APPLY`, `APPLICATIONS`,
  `APPLICATION_STATUS`)
- `npm test` (backend) passes — no existing tests broken by the new model

**Files:**
- `backend/src/models/jobPosting.js` (new)
- `backend/src/constants/apiEndpoints.js`

**Estimated scope:** XS

---

### Task A2 — Jobs routes: create, browse, get, update, delete

**Description:**
New `backend/src/routes/jobs.js`, mounted at `/jobs` in `app.js`. Implements posting
creation, the browse query (type/skills filters, blocked-user exclusion, skill-match
score), single posting fetch (including `myApplication` for non-owners — `null` until
Track B's `JobApplication` model exists, see note below), and author-only update/delete.
As part of this task, extract `getExcludedUserIds` out of `routes/posts.js` into
`backend/src/utils/blocking.js` so both routers can use it (no behavior change to
`posts.js`).

**Acceptance criteria:**
- `POST /jobs` — 400 if `title`/`description` empty, or `type`/`locationMode` not in their
  enums; populates `postedBy` (`firstName lastName photoUrl`) on response
- `GET /jobs?skills=&type=&page=1` — `status: 'open'`, `deletedAt: null`,
  `postedBy: { $nin: excludedIds }` (reuse `getExcludedUserIds`); optional `type` exact
  match and `skills` (comma-separated) → `requiredSkills: { $in: skillList }`; each item
  includes `skillMatchScore` (per RFC helper); pagination shape matches Groups
  (`page`, `pageSize`, `total`, `totalPages`, `hasNextPage`), `PAGE_SIZE = 20`
- `GET /jobs/:jobId` — 404 if missing/soft-deleted; includes `skillMatchScore`; includes
  `myApplication: null` for non-owners (full lookup wired in B2, once
  `JobApplication` exists — A2 can ship this as `null` and B2 fills it in, or A2 can be
  sequenced after B1 if preferred; either order works since B1 has no dependency on A1/A2)
- `PATCH /jobs/:jobId` — author-only (403 otherwise); updates `title`, `company`,
  `description`, `type`, `locationMode`, `location`, `requiredSkills`, `salaryRange`,
  `status` (`open`|`closed`)
- `DELETE /jobs/:jobId` — sets `deletedAt`; 403 if `req.user._id` isn't `postedBy`; 404 if
  already deleted/missing
- `backend/src/utils/blocking.js` exports `getExcludedUserIds(user)`; `routes/posts.js`
  imports it from there with no behavior change (existing `posts.test.js` still passes)
- `backend/src/app.js` mounts `app.use('/jobs', jobsRouter)`
- New test file covers: empty-posting rejection, invalid `type`/`locationMode` rejection,
  browse filters (`type`, `skills`, blocked-user exclusion, `status: closed` excluded),
  `skillMatchScore` calculation against a seeded user profile, update/delete authorization
  (author vs. non-author), 404s for soft-deleted postings
- `npm test` passes

**Files:**
- `backend/src/routes/jobs.js` (new)
- `backend/src/routes/posts.js`
- `backend/src/utils/blocking.js` (new)
- `backend/src/app.js`
- `backend/src/__tests__/jobs.test.js` (new)

**Estimated scope:** M

---

## Track B — Backend: Applications

---

### Task B1 — `JobApplication` model + `Notification` extension + shared notification util

**Description:**
New `JobApplication` model, independent of Track A's posting routes (only references
`JobPosting`/`User` by ObjectId). Extends the existing `Notification` model's `type` enum
with `job_application` and `job_application_status`, and adds an optional `jobId` field.
Extracts `emitNotification` out of `routes/posts.js` into
`backend/src/utils/notifications.js` so it can populate either `postId` or `jobId` and be
shared by both routers.

**Acceptance criteria:**
- `backend/src/models/jobApplication.js` matches RFC schema: `jobId`, `applicantId`,
  `coverNote`, `status` (enum `pending|reviewing|shortlisted|rejected|accepted`),
  timestamps; **unique** index on `(jobId, applicantId)`; indexes on
  `(jobId, createdAt)` and `(applicantId, createdAt)`
- `backend/src/models/notification.js` `type` enum extended with `job_application`,
  `job_application_status`; new `jobId` field (`ObjectId`, ref `JobPosting`,
  default `null`)
- `backend/src/utils/notifications.js` exports `emitNotification(req, notification)` —
  populates `actorId` (`firstName lastName photoUrl`) and emits
  `io.to('user:<recipientId>').emit('notification:new', populated)`, guarded by
  `if (!io) return`, identical behavior to the current `posts.js` helper
- `routes/posts.js` imports `emitNotification` from the new util with no behavior change
  (existing `posts.test.js` still passes)
- `npm test` passes

**Files:**
- `backend/src/models/jobApplication.js` (new)
- `backend/src/models/notification.js`
- `backend/src/utils/notifications.js` (new)
- `backend/src/routes/posts.js`

**Estimated scope:** S

---

### Task B2 — Application routes: apply, applicants list, status update, my applications

**Description:**
Extend `jobs.js` with the application endpoints. Creates `Notification` documents via
B1's model + `utils/notifications.js`. Also wires the `myApplication` field on
`GET /jobs/:jobId` (left as `null` by A2 until this task adds the real lookup).

**Acceptance criteria:**
- `POST /jobs/:jobId/apply` — 404 if job missing/soft-deleted; 400 if `status: 'closed'`;
  400 if `job.postedBy.equals(req.user._id)` (no self-apply); creates `JobApplication`
  (`coverNote` ≤ 1000 chars); 409 on duplicate `(jobId, applicantId)`; increments
  `job.applicationCount`; on success, creates a `Notification`
  (`type: 'job_application'`, `recipientId: job.postedBy`, `jobId`) and calls
  `emitNotification`
- `GET /jobs/:jobId/applications?page=1` — poster-only (403 otherwise); paginated
  (`APPLICATION_PAGE_SIZE = 20`), newest-first, `applicantId` populated with
  `firstName lastName photoUrl skills techStack experience githubUrl linkedinUrl`; each
  item includes `skillMatchScore` (job's `requiredSkills` vs. that applicant's profile)
- `PATCH /jobs/:jobId/applications/:applicationId` — poster-only (403 otherwise); 400 if
  `status` not in `{reviewing, shortlisted, rejected, accepted}`; updates the
  `JobApplication`; creates a `Notification` (`type: 'job_application_status'`,
  `recipientId: application.applicantId`, `jobId`) and calls `emitNotification`
- `GET /jobs/applications/mine?page=1` — scoped to `applicantId: req.user._id`, paginated,
  newest-first, `jobId` populated with `title company type status`; **registered before**
  `GET /jobs/:jobId`
- `GET /jobs/:jobId` (from A2) now returns a real `myApplication: { _id, status } | null`
  for non-owners
- Test file covers: apply success + notification emission, self-apply (400), apply to
  closed posting (400), duplicate apply (409); applicants-list authorization (403 for
  non-poster) and `skillMatchScore` per applicant; status-update authorization (403 for
  non-poster), invalid status (400), notification emission; my-applications scoping
  (`applicantId === req.user._id`)
- `npm test` passes

**Files:**
- `backend/src/routes/jobs.js`
- `backend/src/__tests__/jobs.test.js`

**Estimated scope:** M

---

## Track C — Frontend: Browse & Post

---

### Task C1 — `jobApi.js` + cache tags

**Description:**
RTK Query endpoint definitions for all `/jobs/*` routes, per the RFC, plus new tag types
in `store/api.js`.

**Acceptance criteria:**
- `frontend/src/store/api.js` `tagTypes` gains `'Jobs'`, `'JobApplications'`
- `frontend/src/hooks/jobs/jobApi.js` exports: `useGetJobsQuery`, `useGetJobQuery`,
  `useCreateJobMutation`, `useUpdateJobMutation`, `useDeleteJobMutation`,
  `useApplyToJobMutation`, `useGetJobApplicationsQuery`,
  `useUpdateApplicationStatusMutation`, `useGetMyApplicationsQuery` — query/cache-tag
  shapes exactly as specified in the RFC
- `npm run lint` (frontend) passes

**Files:**
- `frontend/src/store/api.js`
- `frontend/src/hooks/jobs/jobApi.js` (new)

**Estimated scope:** XS

---

### Task C2 — `JobCard` + `JobPostForm` widgets

**Description:**
`JobCard` renders a posting summary: title, company, type badge, location
mode/location, `requiredSkills` tags (reusing the
`rounded-full bg-violet-100 px-[0.55rem] py-[0.1rem] text-xs text-violet-800` tag-pill
class from Groups/GroupDetail), salary range if present, `applicationCount`, status, and a
skill-match % badge. `JobPostForm` is a create/edit form (title, company, description,
`type` `<select>`, `locationMode` `<select>`, location, comma-separated `requiredSkills`,
optional salary min/max/currency), following `Groups`'s create-form pattern (`FormInput`,
`getApiErrorMessage`).

**Acceptance criteria:**
- `JobCard` shows the skill-match badge only when `requiredSkills` is non-empty (hides it
  rather than showing "0%", per the RFC's open question)
- `JobPostForm` submit button disabled when `title`/`description` are empty or while
  posting; on success, form resets and `{ type: 'Jobs', id: 'LIST' }` is invalidated
- Errors surfaced via `getApiErrorMessage`, consistent with `Groups`'s create-form error
  display
- Tailwind styling only (no `.scss` files)
- `npm run lint` passes

**Files:**
- `frontend/src/widgets/JobCard/JobCard.jsx` (new)
- `frontend/src/widgets/JobPostForm/JobPostForm.jsx` (new)

**Estimated scope:** M

---

### Task C3 — `/jobs` page, container, routing, NavBar link

**Description:**
Wires C2 together into the Jobs page: a type/skills filter bar (mirroring `Groups`'s tag
filter), a "+ Post a Job" toggle showing `JobPostForm`, a paginated `JobCard` list (each
card links to `/jobs/:jobId`), and Prev/Next pagination mirroring `Groups`'s container.
Registers the `/jobs` route and adds a "Jobs" link to `NavBar`.

**Acceptance criteria:**
- `frontend/src/pages/Jobs/Jobs.jsx` → `frontend/src/containers/Jobs/index.jsx` following
  the Groups page/container split
- Filter bar (`type` select + `skills` text input) updates query params passed to
  `useGetJobsQuery` and resets `page` to 1
- Prev/Next pagination disabled appropriately at bounds and while `isFetching`
- `frontend/src/routes/index.js` adds `{ path: '/jobs', Page: JobsPage, guard:
  'protected' }`
- `frontend/src/widgets/NavBar/NavBar.jsx` `LINKS` gains `{ to: '/jobs', label: 'Jobs' }`
- `npm run lint` and `npm run build` (frontend) pass

**Files:**
- `frontend/src/pages/Jobs/Jobs.jsx` (new)
- `frontend/src/containers/Jobs/index.jsx` (new)
- `frontend/src/routes/index.js`
- `frontend/src/widgets/NavBar/NavBar.jsx`

**Estimated scope:** S

---

## Track D — Frontend: Detail & Applications

---

### Task D1 — `/jobs/:jobId` detail page: apply flow + applicants management

**Description:**
`JobDetail` container shows the full posting detail (reusing `JobCard`'s tag/skill-match
presentation at larger scale, or a dedicated layout). For non-owners with
`myApplication === null`, shows an apply form (cover note textarea +
`useApplyToJobMutation`). For non-owners with `myApplication` set, shows an
application-status banner instead. For the poster, shows the applicants list
(`useGetJobApplicationsQuery`) — each row with applicant profile summary, skill-match %,
and a status `<select>` (`useUpdateApplicationStatusMutation`). Registers the
`/jobs/:jobId` route.

**Acceptance criteria:**
- Apply form is hidden (replaced by the status banner) once `myApplication` is non-null,
  and hidden entirely for the posting's own author
- Submitting the apply form invalidates `{ type: 'Jobs', id: jobId }` and
  `{ type: 'JobApplications', id: 'MINE' }` so the detail view and "My Applications" stay
  in sync
- Applicants list is rendered only for the poster (`postedBy._id === user._id`); status
  `<select>` only offers `reviewing|shortlisted|rejected|accepted`
- `frontend/src/routes/index.js` adds `{ path: '/jobs/:jobId', Page: JobDetailPage, guard:
  'protected' }`
- Errors surfaced via `getApiErrorMessage`
- `npm run lint` passes

**Files:**
- `frontend/src/pages/JobDetail/JobDetail.jsx` (new)
- `frontend/src/containers/JobDetail/index.jsx` (new)
- `frontend/src/routes/index.js`

**Estimated scope:** M

---

### Task D2 — "My Applications" view + `NotificationBell` updates

**Description:**
A "My Applications" tab (on `/jobs` or as part of `containers/Jobs`) lists the logged-in
user's applications via `useGetMyApplicationsQuery`, showing the posting summary and
current `status`, linking to `/jobs/:jobId`. Updates `NotificationBell` to handle the two
new notification types and route to the right page.

**Acceptance criteria:**
- "My Applications" tab shows posting title/company/type and the application's `status`
  badge, paginated, linking to `/jobs/:jobId`
- `NotificationBell`'s `NOTIFICATION_TEXT` map gains `job_application: 'applied to your
  job posting'` and `job_application_status: 'updated your application status'`
- `NotificationBell`'s link target is type-dependent:
  `notification.jobId ? `/jobs/${notification.jobId}` : '/posts'`
- On a `notification:new` event of either new type, the existing
  `dispatch(api.util.invalidateTags(['Notifications']))` continues to refresh the badge —
  no new socket wiring needed
- `npm run lint` and `npm run build` (frontend) pass

**Files:**
- `frontend/src/containers/Jobs/index.jsx` (or a new `containers/MyApplications/index.jsx`
  if the tab is large enough to warrant its own container)
- `frontend/src/widgets/NotificationBell/NotificationBell.jsx`

**Estimated scope:** S

---

## Checkpoints

### Checkpoint 1 — After A1 + B1
- [ ] `JobPosting`, `JobApplication` models exist with RFC-specified schemas/indexes
- [ ] `Notification.type` enum includes `job_application`/`job_application_status`;
  `jobId` field added
- [ ] `JOBS` route constants added; `utils/notifications.js` (`emitNotification`) extracted
  and used by `posts.js` with no regressions

### Checkpoint 2 — After A2 + B2
- [ ] Full `/jobs/*` API working: create, browse (filters + `skillMatchScore`, blocking
  respected), get (incl. `myApplication`), update/close, delete, apply, applicants list +
  status update, my-applications
- [ ] Applying to, or updating the status of, an application creates a `Notification` and
  emits `notification:new` to the correct `user:<id>` room; self-apply and duplicate
  applications are rejected
- [ ] `npm test` (backend) green

### Checkpoint 3 — After C1
- [ ] `jobApi.js` compiles and matches the live backend contract (manual smoke test
  against a running backend)
- [ ] `store/api.js` tag types updated; no RTK Query console warnings about unknown tags

### Checkpoint 4 — FEATURE COMPLETE (after C2–C3 + D1–D2)
- [ ] `/jobs` page reachable via NavBar "Jobs" link; browse/filter/post all work
  end-to-end against the real backend
- [ ] `/jobs/:jobId` detail page: apply flow works for seekers, applicants management
  works for posters, skill-match % displays correctly
- [ ] "My Applications" view reflects status changes made by the poster
- [ ] Notification bell shows live updates for `job_application` /
  `job_application_status`, with correct link targets, via a second account
- [ ] `npm run lint` and `npm run build` (frontend) green; `npm test` (backend) green

---

## Parallelisation Notes

- `A1` and `B1` have no cross-dependency — build in parallel.
- `A2` depends on `A1` (model + constants) and performs the `utils/blocking.js`
  extraction; `B2` depends on both `A2` (posting status/ownership checks) and `B1`
  (`JobApplication` model + `utils/notifications.js`).
- `C1` (API hook scaffolding) can start immediately against the documented contract, in
  parallel with Track A/B — stub/mock responses for local UI dev until the real backend is
  ready.
- `C2` and `C3` are sequential (`C3` consumes `C2`'s widgets); `D1`/`D2` depend on `C1` for
  hooks and, for end-to-end testing of the real-time pieces, on `B2`.
- `D1` and `D2` are largely independent of each other (different files) and can be built
  in parallel once `C1` lands.
- Recommended single-implementer order: `A1` → `B1` → `A2` → `B2` → `C1` → `C2` → `C3` →
  `D1` → `D2`.
