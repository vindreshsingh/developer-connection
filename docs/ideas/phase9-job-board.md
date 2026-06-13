# Phase 9 — Job Board & Opportunities

## Problem Statement
The original product vision frames Developer Connection around three overlapping outcomes:
job/collaboration opportunities, peer networking, and community. Phases 1–8 have built out
networking (connections, groups, chat, video, feed) but there is still no way for a user to
post or discover a concrete opportunity — a job opening, a freelance gig, or a "looking for
a co-founder/collaborator" call. Phase 8's feed explicitly called this out as future work
("Job board / referral posts" — `phase8-developer-feed.md`). Without it, users with an
opportunity to share have no structured way to post it, and users looking for one have
nothing to browse beyond informal feed posts.

## Target User
The same developer audience as the rest of the platform, acting in one of two roles on the
same account (no separate "employer" account type, consistent with the platform's
peer-to-peer framing):
- **Posters** — developers/teams/founders with a role, gig, or collaboration opportunity to
  share (could be a hiring manager, a startup founder, or a dev looking for a side-project
  partner)
- **Seekers** — developers browsing opportunities that match their skills/stack/experience
  and applying directly through their existing profile

## Recommended Direction
Add a **Job Board** feature: any user can post an opportunity (job, internship, freelance
gig, or open collaboration), browse/filter postings by tags and required skills, and apply
directly using their existing profile (skills, tech stack, experience, GitHub/LinkedIn —
already captured in Phase 1/4) plus a short cover note. Posters see their applicants and can
update each application's status (reviewing/shortlisted/rejected/accepted).

This reuses existing infrastructure end-to-end:
- The `User` profile model (skills, techStack, experience, links) already captures
  everything needed for an applicant's "resume" — no new upload flow required for MVP.
- The Phase 8 `Notification` model + `notification:new` socket event + `NotificationBell`
  is extended with two new types (`job_application`, `job_application_status`) — no new
  real-time infrastructure.
- Pagination, tag filtering, and soft-delete all follow the `Groups`/`Posts` conventions
  already established (Phase 2/4/8).
- A simple, deterministic **skill-match score** (overlap between `JobPosting.requiredSkills`
  and the viewing user's `skills ∪ techStack`) gives seekers a useful signal without
  depending on the Phase 6 AI assistant — that integration can come later.

## Key Assumptions to Validate
- [ ] Developers will post non-recruiting "collaboration" opportunities (co-founder,
      side-project, open-source contributor wanted), not just formal job openings —
      validate by tracking the distribution of `JobPosting.type` after launch
- [ ] A deterministic skill-match percentage is a useful enough signal without full AI
      ranking — validate by comparing apply-through rate on postings with a high
      (≥50%) vs. low match score
- [ ] Applying with "profile + cover note" (no resume upload) is sufficient for posters to
      make a decision — validate via poster feedback and whether posters request resumes
      out-of-band (e.g. via chat)
- [ ] Posting should remain free in this phase to seed supply — validate demand/volume
      before revisiting premium-gating in a future Payments RFC addendum

## MVP Scope (Phase 9)
**In:**
- Create/edit/soft-delete job postings: title, description, type (full-time, part-time,
  contract, internship, freelance, collaboration), location mode (remote/onsite/hybrid),
  required skills/tags, optional salary range
- Browse postings: paginated list, filter by tags/skills/type, each card shows a
  skill-match % against the viewer's profile
- Apply to a posting: cover note (text) + automatically attaches the applicant's existing
  profile (skills, techStack, experience, links); one application per user per posting
- Poster view: list of applicants for their posting, with skill-match %, update each
  application's status (pending → reviewing → shortlisted/rejected/accepted)
- Seeker view: "My Applications" list showing status of everything they've applied to
- Notifications (extends Phase 8): poster notified on new application
  (`job_application`); applicant notified on status change (`job_application_status`)
- Respects existing blocking: blocked users' postings never appear in browse results

**Out (this phase):**
- Resume upload / attachment on applications (Phase 6's AI resume-feedback flow could
  feed this later)
- AI-powered match ranking or recommendations (Phase 6 AI assistant extension)
- Featured/boosted/paid postings, employer verification, company pages
- Saved jobs, job alerts/digests, external ATS integration or external apply links
- "Open to Work"/"Hiring"/"Open to Collaborate" profile badges

## Not Doing (Yet) — Future Roadmap
- **AI-powered job matching** — feed `JobPosting.requiredSkills` + applicant profile into
  the Phase 6 AI assistant for ranked recommendations and "why you're a fit" summaries
- **Resume-backed applications** — let applicants attach a resume (reusing Phase 6's
  resume upload/feedback pipeline) instead of relying solely on profile data
- **"Open to Work" / "Hiring" profile badges** — surfaced in Discovery (Phase 2) and Feed
  (Phase 8) as filterable signals, originally flagged in Phase 8's roadmap
- **Saved jobs & alerts** — bookmark postings, get notified when new postings match saved
  filters (ties into a future email/push notification phase)
- **Featured/sponsored postings & employer accounts** — monetization angle for a future
  Payments RFC addendum, once posting volume justifies it
- **Referral flow** — let a connection "refer" a seeker to a posting, generating a
  notification to the poster

## Open Questions
- Should job postings be subject to the same `Report`/admin-review gap noted during Phase 8
  planning, or is the existing soft-delete-by-owner + block model sufficient for MVP?
- Should `JobPosting.type` include `collaboration` as a first-class type alongside formal
  job types, or should "collaboration" postings live in a separate model entirely? This doc
  assumes a single model with a `type` enum is simplest and matches the roadmap's framing.
- When (if ever) should posting/applying be premium-gated — e.g. free users limited to N
  active postings or M applications/month, mirroring the Phase 6 premium model for swipes?
- Should a poster be able to close a posting (`status: closed`) and have that automatically
  notify all `pending`/`reviewing` applicants, or is that deferred to a later notification
  type?
