# Phase 9 RFC — Job Board & Opportunities

## Stack Decision

No new stack — this phase extends the existing system:
- **Backend:** Express 5 + Mongoose (new `JobPosting`, `JobApplication` models; new
  `jobs.js` router, same conventions as `groups.js`/`posts.js`); extends the existing
  `Notification` model with two new `type` values and an optional `jobId` field
- **Real-time:** existing Socket.io instance (`app.get('io')`, `user:<id>` rooms), reusing
  the `emitNotification` helper pattern from `routes/posts.js`
- **Matching:** deterministic skill-overlap score computed in the route handler — no new
  service, no AI call
- **Frontend:** React + RTK Query (`api.injectEndpoints`), styled with Tailwind utility
  classes directly (no new `.scss` files, per the project's SCSS→Tailwind migration),
  `socket.io-client` via the existing `useSocket` hook (already wired into
  `NotificationBell`)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Create / Edit / Close Posting                                              │
│                                                                             │
│  POST /jobs  { title, description, type, locationMode, location?,        │
│                requiredSkills?, salaryRange? }                            │
│       ├── validate: title/description non-empty; type ∈ enum;            │
│       │   locationMode ∈ enum                                             │
│       └── JobPosting.create({ postedBy: req.user._id, ... })              │
│                                                                             │
│  PATCH /jobs/:jobId   — author only; editable fields incl. status         │
│                          (open|closed)                                     │
│  DELETE /jobs/:jobId  — author only; sets deletedAt                       │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│ Browse                                                                     │
│                                                                             │
│  GET /jobs?skills=&type=&page=1                                           │
│       ├── excludedIds = req.user.blockedUsers + users who blocked me     │
│       │     (reuse getExcludedUserIds from routes/posts.js)              │
│       ├── filter: status: 'open', deletedAt: null,                       │
│       │   postedBy: { $nin: excludedIds }                                 │
│       ├── optional: type === filter.type;                                │
│       │   skills (comma-separated) → requiredSkills: { $in: skillList }  │
│       └── JobPosting.find(filter).sort({createdAt:-1}).skip/limit        │
│             .populate('postedBy', 'firstName lastName photoUrl')         │
│             → per-posting: skillMatchScore =                             │
│                 computeSkillMatchScore(posting.requiredSkills, req.user) │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│ Apply → Notification                                                       │
│                                                                             │
│  POST /jobs/:jobId/apply  { coverNote? }                                  │
│       ├── 404 if job missing/soft-deleted; 400 if status === 'closed'    │
│       ├── 400 if job.postedBy.equals(req.user._id) (no self-apply)       │
│       ├── JobApplication.create({ jobId, applicantId, coverNote })       │
│       │     → 409 if duplicate (jobId, applicantId)                      │
│       ├── JobPosting.applicationCount += 1                               │
│       └── Notification.create({ recipientId: job.postedBy,               │
│             actorId: req.user._id, type: 'job_application', jobId })     │
│             emitNotification(req, notification)                          │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│ Applicant Management → Notification                                       │
│                                                                             │
│  GET /jobs/:jobId/applications?page=1   — poster only                    │
│       └── JobApplication.find({ jobId })                                 │
│             .populate('applicantId', 'firstName lastName photoUrl        │
│               skills techStack experience githubUrl linkedinUrl')        │
│             → per-application: skillMatchScore =                         │
│                 computeSkillMatchScore(job.requiredSkills,                │
│                   application.applicantId)                               │
│                                                                             │
│  PATCH /jobs/:jobId/applications/:applicationId  { status }              │
│       ├── poster only; status ∈ {reviewing, shortlisted, rejected,       │
│       │   accepted}                                                       │
│       ├── JobApplication.findByIdAndUpdate(...)                          │
│       └── Notification.create({ recipientId: application.applicantId,   │
│             actorId: req.user._id, type: 'job_application_status',       │
│             jobId })                                                      │
│             emitNotification(req, notification)                          │
└──────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│ My Applications                                                            │
│                                                                             │
│  GET /jobs/applications/mine?page=1                                      │
│       └── JobApplication.find({ applicantId: req.user._id })            │
│             .populate('jobId', 'title company type status')             │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Data Models

```js
// backend/src/models/jobPosting.js
import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

const jobPostingSchema = new mongoose.Schema(
  {
    postedBy:    { type: ObjectId, ref: 'User', required: true },
    title:       { type: String, required: true, trim: true, maxlength: 120 },
    company:     { type: String, trim: true, maxlength: 100, default: '' },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    type: {
      type: String,
      required: true,
      enum: ['full-time', 'part-time', 'contract', 'internship', 'freelance', 'collaboration'],
    },
    locationMode: {
      type: String,
      required: true,
      enum: ['remote', 'onsite', 'hybrid'],
      default: 'remote',
    },
    location: { type: String, trim: true, maxlength: 100, default: '' },
    requiredSkills: {
      type: [{ type: String, trim: true, lowercase: true, maxlength: 30 }],
      default: [],
    },
    salaryRange: {
      min:      { type: Number, default: null, min: 0 },
      max:      { type: Number, default: null, min: 0 },
      currency: { type: String, default: 'USD', trim: true, maxlength: 10 },
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
    },
    applicationCount: { type: Number, default: 0, min: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

jobPostingSchema.index({ status: 1, createdAt: -1 });
jobPostingSchema.index({ deletedAt: 1, createdAt: -1 });
jobPostingSchema.index({ requiredSkills: 1 });
jobPostingSchema.index({ postedBy: 1 });

export default mongoose.model('JobPosting', jobPostingSchema);
```

```js
// backend/src/models/jobApplication.js
import mongoose from 'mongoose';
const { ObjectId } = mongoose.Schema.Types;

const jobApplicationSchema = new mongoose.Schema(
  {
    jobId:       { type: ObjectId, ref: 'JobPosting', required: true },
    applicantId: { type: ObjectId, ref: 'User', required: true },
    coverNote:   { type: String, trim: true, maxlength: 1000, default: '' },
    status: {
      type: String,
      enum: ['pending', 'reviewing', 'shortlisted', 'rejected', 'accepted'],
      default: 'pending',
    },
  },
  { timestamps: true },
);

// One application per user per posting.
jobApplicationSchema.index({ jobId: 1, applicantId: 1 }, { unique: true });
jobApplicationSchema.index({ jobId: 1, createdAt: -1 });
jobApplicationSchema.index({ applicantId: 1, createdAt: -1 });

export default mongoose.model('JobApplication', jobApplicationSchema);
```

```js
// backend/src/models/notification.js — extend existing enum + add jobId
const notificationSchema = new mongoose.Schema(
  {
    recipientId: { type: ObjectId, ref: 'User', required: true },
    actorId:     { type: ObjectId, ref: 'User', required: true },
    type: {
      type: String,
      required: true,
      enum: [
        'post_like', 'post_comment',
        'job_application', 'job_application_status', // Phase 9
      ],
    },
    postId: { type: ObjectId, ref: 'Post', default: null },
    jobId:  { type: ObjectId, ref: 'JobPosting', default: null }, // Phase 9
    read:   { type: Boolean, default: false },
  },
  { timestamps: true },
);
```

---

## API Contracts

```
mounted at /jobs
POST   /jobs                                  create a posting
GET    /jobs?skills=&type=&page=              paginated browse (status: open, skillMatchScore per item)
GET    /jobs/applications/mine?page=          logged-in user's own applications
                                               (registered BEFORE /:jobId — see note)
GET    /jobs/:jobId                           single posting detail (skillMatchScore + myApplication)
PATCH  /jobs/:jobId                           update (author only, incl. status open|closed)
DELETE /jobs/:jobId                           soft-delete (author only)
POST   /jobs/:jobId/apply                     apply { coverNote? }
GET    /jobs/:jobId/applications?page=        list applicants (poster only)
PATCH  /jobs/:jobId/applications/:applicationId  update application status (poster only)
```

> **Route ordering note:** `GET /jobs/applications/mine` must be registered *before*
> `GET /jobs/:jobId` (same pattern as `PROFILE.LINKED_ACCOUNTS` etc. being registered
> before `PROFILE.VIEW_BY_ID` in `routes/profile.js`), otherwise Express would match
> `/jobs/applications/mine` against `:jobId = 'applications'`.

New constants added to `backend/src/constants/apiEndpoints.js`:

```js
// mounted at /jobs
export const JOBS = {
  LIST:                '/',
  CREATE:              '/',
  MY_APPLICATIONS:     '/applications/mine', // must be registered before GET
  GET:                 '/:jobId',
  UPDATE:              '/:jobId',
  DELETE:              '/:jobId',
  APPLY:               '/:jobId/apply',
  APPLICATIONS:        '/:jobId/applications',
  APPLICATION_STATUS:  '/:jobId/applications/:applicationId',
};
```

`backend/src/constants/apiEndpoints.js`'s `NOTIFICATIONS` constant is unchanged — the new
notification types reuse the existing `LIST`/`UNREAD_COUNT`/`READ`/`READ_ALL` routes.

### Skill-match score helper

```js
// backend/src/routes/jobs.js
const normalizeSkills = (arr) =>
  new Set((arr ?? []).map((s) => s.toLowerCase().trim()).filter(Boolean));

/** Returns 0-100: % of a posting's requiredSkills present in the user's skills ∪ techStack. */
const computeSkillMatchScore = (requiredSkills, user) => {
  const required = normalizeSkills(requiredSkills);
  if (required.size === 0) return 0;

  const userSkills = normalizeSkills([...(user.skills ?? []), ...(user.techStack ?? [])]);
  const overlap = [...required].filter((skill) => userSkills.has(skill));
  return Math.round((overlap.length / required.size) * 100);
};
```

`getExcludedUserIds(user)` is imported/reused as-is from `routes/posts.js` (extract to a
shared helper module if that's cleaner, but no behavior change).

### `myApplication` on `GET /jobs/:jobId`

For requests where `req.user._id` is not `posting.postedBy`, the response includes:

```js
myApplication: application
  ? { _id: application._id, status: application.status }
  : null
```

where `application = await JobApplication.findOne({ jobId, applicantId: req.user._id })`.
This lets the frontend show an "Apply" form when `null`, or an application-status banner
when present — without a separate round-trip. Omitted (or `undefined`) when the requester
is the poster.

### Pagination

Offset-based, identical shape to Groups/Posts (`page`, `pageSize`, `total`, `totalPages`,
`hasNextPage`). Jobs list: `PAGE_SIZE = 20` (mirrors Groups — posting cards are lighter
than post cards). Applications (both `/:jobId/applications` and `/applications/mine`):
`APPLICATION_PAGE_SIZE = 20`.

---

## Socket Events

- `notification:new` — emitted server→client to `user:<recipientId>` on `job_application`
  / `job_application_status` creation, via the existing `emitNotification` helper
  (extended to also populate `jobId` when present). Payload: the populated `Notification`
  document.
- No new client→server events, no changes to `sockets/index.js` — identical reuse of the
  Phase 8 mechanism.

---

## Frontend Architecture

```
frontend/src/
├── pages/Jobs/Jobs.jsx                   # /jobs route
├── pages/JobDetail/JobDetail.jsx         # /jobs/:jobId route
├── containers/Jobs/index.jsx             # filter bar (type/skills), JobPostForm toggle,
│                                          #   paginated JobCard list, "Browse" / "My Postings"
│                                          #   / "My Applications" tabs
├── containers/JobDetail/index.jsx        # posting detail, apply form (non-owner,
│                                          #   not-yet-applied), applicants list + status
│                                          #   controls (poster), application status banner
│                                          #   (applicant)
├── widgets/JobCard/JobCard.jsx           # posting summary card + skill-match badge
├── widgets/JobPostForm/JobPostForm.jsx   # create/edit posting form
└── hooks/jobs/jobApi.js                  # RTK Query endpoints for /jobs
```

All new components are styled with Tailwind utility classes directly (no `.scss` files),
following the conventions already used across `Groups`/`GroupDetail`/`Posts`.

### `jobApi.js` (RTK Query)

```js
const jobApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getJobs: builder.query({
      query: ({ skills, type, page = 1 } = {}) => {
        const params = new URLSearchParams({ page });
        if (skills) params.set('skills', skills);
        if (type) params.set('type', type);
        return `/jobs?${params.toString()}`;
      },
      providesTags: (result) => [
        ...(result?.data ?? []).map((job) => ({ type: 'Jobs', id: job._id })),
        { type: 'Jobs', id: 'LIST' },
      ],
    }),
    getJob: builder.query({
      query: (jobId) => `/jobs/${jobId}`,
      providesTags: (result, error, jobId) => [{ type: 'Jobs', id: jobId }],
    }),
    createJob: builder.mutation({
      query: (body) => ({ url: '/jobs', method: 'POST', body }),
      invalidatesTags: [{ type: 'Jobs', id: 'LIST' }],
    }),
    updateJob: builder.mutation({
      query: ({ jobId, ...body }) => ({ url: `/jobs/${jobId}`, method: 'PATCH', body }),
      invalidatesTags: (result, error, { jobId }) => [
        { type: 'Jobs', id: jobId }, { type: 'Jobs', id: 'LIST' },
      ],
    }),
    deleteJob: builder.mutation({
      query: (jobId) => ({ url: `/jobs/${jobId}`, method: 'DELETE' }),
      invalidatesTags: [{ type: 'Jobs', id: 'LIST' }],
    }),
    applyToJob: builder.mutation({
      query: ({ jobId, coverNote }) => ({ url: `/jobs/${jobId}/apply`, method: 'POST', body: { coverNote } }),
      invalidatesTags: (result, error, { jobId }) => [
        { type: 'Jobs', id: jobId }, { type: 'JobApplications', id: 'MINE' },
      ],
    }),
    getJobApplications: builder.query({
      query: ({ jobId, page = 1 }) => `/jobs/${jobId}/applications?page=${page}`,
      providesTags: (result, error, { jobId }) => [{ type: 'JobApplications', id: jobId }],
    }),
    updateApplicationStatus: builder.mutation({
      query: ({ jobId, applicationId, status }) => ({
        url: `/jobs/${jobId}/applications/${applicationId}`, method: 'PATCH', body: { status },
      }),
      invalidatesTags: (result, error, { jobId }) => [{ type: 'JobApplications', id: jobId }],
    }),
    getMyApplications: builder.query({
      query: ({ page = 1 } = {}) => `/jobs/applications/mine?page=${page}`,
      providesTags: [{ type: 'JobApplications', id: 'MINE' }],
    }),
  }),
});
```

`store/api.js` `tagTypes` gains: `'Jobs'`, `'JobApplications'`.

### Routing / NavBar

- `frontend/src/routes/index.js`: add `{ path: '/jobs', Page: JobsPage, guard: 'protected' }`
  and `{ path: '/jobs/:jobId', Page: JobDetailPage, guard: 'protected' }`
- `frontend/src/widgets/NavBar/NavBar.jsx`: add `{ to: '/jobs', label: 'Jobs' }` to `LINKS`

### `NotificationBell` updates

- `NOTIFICATION_TEXT` map gains:
  ```js
  job_application:        'applied to your job posting',
  job_application_status: 'updated your application status',
  ```
- Link target becomes type-dependent instead of hardcoded `/posts`:
  `notification.jobId ? `/jobs/${notification.jobId}` : '/posts'`

---

## Existing Code Impact

| File | Change |
|---|---|
| `backend/src/models/jobPosting.js`, `jobApplication.js` (new) | New collections |
| `backend/src/models/notification.js` | extend `type` enum with `job_application`, `job_application_status`; add `jobId` field |
| `backend/src/routes/jobs.js` (new) | All `/jobs/*` routes |
| `backend/src/routes/posts.js` | export/share `getExcludedUserIds` + `emitNotification` (or extract to a shared util) for reuse by `jobs.js` |
| `backend/src/constants/apiEndpoints.js` | add `JOBS` |
| `backend/src/app.js` | mount `/jobs` |
| `frontend/src/hooks/jobs/jobApi.js` (new) | RTK Query endpoints |
| `frontend/src/store/api.js` | add `'Jobs'`, `'JobApplications'` tags |
| `frontend/src/pages/Jobs/Jobs.jsx`, `pages/JobDetail/JobDetail.jsx`, `containers/Jobs/*`, `containers/JobDetail/*` (new) | `/jobs` and `/jobs/:jobId` pages |
| `frontend/src/widgets/JobCard/*`, `widgets/JobPostForm/*` (new) | UI widgets |
| `frontend/src/widgets/NotificationBell/NotificationBell.jsx` | new `NOTIFICATION_TEXT` entries + type-dependent link |
| `frontend/src/routes/index.js` | add `/jobs`, `/jobs/:jobId` routes |
| `frontend/src/widgets/NavBar/NavBar.jsx` | add "Jobs" link |

No changes to `sockets/index.js`, auth, billing, or any Phase 1–8 models other than
`Notification`.

---

## Authorization Matrix

| Endpoint | Auth | Extra checks |
|---|---|---|
| `POST /jobs` | Yes | title/description non-empty; `type`/`locationMode` ∈ enum |
| `GET /jobs` | Yes | excludes blocked/blocking users; `status: open`, `deletedAt: null` |
| `GET /jobs/:jobId` | Yes | 404 if soft-deleted |
| `PATCH /jobs/:jobId` | Yes | author only (403 otherwise) |
| `DELETE /jobs/:jobId` | Yes | author only (403 otherwise) |
| `POST /jobs/:jobId/apply` | Yes | 404 if soft-deleted; 400 if `status: closed`; 400 if self-apply; 409 if duplicate application |
| `GET /jobs/:jobId/applications` | Yes | poster only (403 otherwise) |
| `PATCH /jobs/:jobId/applications/:applicationId` | Yes | poster only (403 otherwise); `status` ∈ {reviewing, shortlisted, rejected, accepted} |
| `GET /jobs/applications/mine` | Yes | scoped to `applicantId === req.user._id` |

---

## Testing Strategy

- **Models:** unique `(jobId, applicantId)` index enforced (duplicate apply → 409, not 500)
- **Jobs routes:**
  - create: rejects empty title/description, invalid `type`/`locationMode`
  - browse: excludes soft-deleted, `closed`, and blocked/blocking users; `type`/`skills`
    filters narrow results; `skillMatchScore` matches expected overlap % for a seeded user
  - update/delete: author-only (403 for non-authors); `PATCH` can transition
    `status: open → closed`
- **Applications routes:**
  - apply: rejects self-apply (400), apply-to-closed (400), duplicate apply (409); creates
    a `job_application` notification only when applicant != poster (always true here, but
    assert it's created and targeted at `postedBy`)
  - applications list: poster-only (403 for non-posters); includes `skillMatchScore` per
    applicant
  - status update: poster-only (403 otherwise); invalid `status` value rejected; creates a
    `job_application_status` notification targeted at the applicant
  - "my applications": scoped to `req.user._id`, populates posting summary
- **Socket:** `job_application`/`job_application_status` creation results in
  `io.to('user:<id>').emit('notification:new', ...)` (mirrors A3/B2 test pattern from
  Phase 8)
- **Frontend:** `JobCard` renders skill-match badge from `skillMatchScore`; `JobPostForm`
  disables submit on empty title/description; apply form hidden for the posting's own
  author and for users who've already applied; applicant status `<select>` only rendered
  for the poster

---

## Open Questions

- Should `requiredSkills` being empty hide the skill-match badge entirely (vs. showing
  "0%")? This RFC computes `0` for empty `requiredSkills`, but the UI may choose to omit
  the badge in that case — a frontend-only decision, not an API contract change.
- Should closing a posting (`status: closed`) automatically notify `pending`/`reviewing`
  applicants (a third notification type, e.g. `job_closed`)? Deferred — v1 only notifies on
  new applications and explicit status changes.
- Should `JobPosting.company` default to the poster's name/`User.linkedin.company` (Phase 4
  enrichment) when left blank, to reduce friction for "collaboration" postings? v1 leaves it
  as a free-text optional field with no default.
- `getExcludedUserIds`/`emitNotification` currently live in `routes/posts.js` — should they
  be extracted into a shared `utils/` module now that two routers need them, or is
  duplicating ~10 lines acceptable to avoid a cross-router dependency? Recommend extracting
  to `backend/src/utils/notifications.js` (for `emitNotification`) and
  `backend/src/utils/blocking.js` (for `getExcludedUserIds`) during implementation — flagged
  here so the plan's Task A1 can include it.
