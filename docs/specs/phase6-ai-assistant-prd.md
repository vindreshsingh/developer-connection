# Phase 6 PRD — AI Developer Assistant

## Problem Statement

The platform now has rich structured data about each user — profile, skills, tech
stack, experience, GitHub/LinkedIn enrichment (Phase 4), connection graph (Phase 2),
and chat history (Phase 3) — but none of it is used to actively help users get more
value from the platform or grow professionally. The original product idea
(`docs/ideas/dev-connect-tinder-for-developers.md`) called out an "AI Developer
Assistant" (smart recommendations, resume feedback, interview prep) as a Phase 6
feature, explicitly sequenced after profile/connection/chat data exists so the AI has
something meaningful to reason over. This PRD scopes the first version of that
assistant.

## Goals

| Goal | Metric |
|---|---|
| Increase connection quality / acceptance rate | Connection-request acceptance rate for AI-recommended matches ≥ baseline acceptance rate (Phase 2 metric) |
| Provide tangible career value (retention driver) | ≥ 30 % of Premium subscribers use at least one AI Assistant feature within their first 7 days |
| Keep AI cost predictable | Per-user AI spend stays within a fixed monthly budget via rate limiting (see Locked Decisions) |
| Reuse existing infra | No new database technology, no new auth system; AI Assistant is just new routes + a service behind the existing `userAuth` + `requirePremium` gates |

## Non-Goals (deferred)

- Fine-tuning or hosting our own models (use a hosted LLM API)
- Real-time voice-based interview prep (text chat only for v1)
- AI-generated profile bios / auto-fill (separate feature, not requested in idea doc)
- Multi-turn memory across sessions beyond a single conversation (no long-term AI
  "memory" of past interview-prep sessions)
- Group/community AI features (e.g. AI moderation) — out of scope
- Resume *generation* (only feedback on an uploaded resume)

---

## User Stories

### Smart Match Recommendations
1. **As a Premium user**, I can view an "AI Recommendations" section on the discovery
   page showing 3–5 suggested connections with a short natural-language explanation of
   why each match is relevant (shared tech stack, complementary experience, etc.).
2. **As a Premium user**, I can dismiss a recommendation; it won't be suggested again
   for a configurable cooldown period.
3. **As a Premium user**, recommendations refresh periodically (not on every page load)
   to control cost.

### Resume Feedback
4. **As a Premium user**, I can upload my resume (PDF) and receive AI-generated
   feedback: structure, clarity, and suggestions tailored to my stated tech stack /
   target role.
5. **As a Premium user**, I can see my feedback history (previous uploads + feedback)
   in the AI Assistant section.

### Interview Prep
6. **As a Premium user**, I can start an "Interview Prep" chat session, optionally
   specifying a focus area (e.g. "React", "System Design", "Behavioral").
7. **As a Premium user**, the assistant asks me interview-style questions one at a
   time, and gives feedback on my answers before moving to the next question.
8. **As a Premium user**, I can end a session at any time; the session and transcript
   are saved to my history.

### Cross-Cutting
9. **As a free user**, I see the AI Assistant section with a locked/preview state and
   an upsell to Premium (reuses Phase 6 Payments `UpsellModal`).
10. **As any user**, my data sent to the LLM provider is limited to what's necessary
    (profile fields, resume text, conversation turns) — no other users' private data
    (e.g. their chat messages) is ever included in a prompt.

---

## Acceptance Criteria

### Recommendations
- `GET /ai/recommendations` — Premium-only; returns up to 5 suggested user profiles
  with a `reason` string per suggestion
- Recommendations are computed from: shared `skills`/`techStack` overlap, complementary
  `experience`, and exclude existing connections, pending requests, and blocked users
  (reuses Phase 2 connection-graph queries)
- Results are cached per-user for a configurable TTL (default 24h) in a
  `RecommendationCache` collection to avoid recomputation + LLM calls on every request
- `POST /ai/recommendations/:userId/dismiss` — hides a specific recommendation for the
  cooldown period (default 14 days)

### Resume Feedback
- `POST /ai/resume-feedback` — Premium-only; accepts a PDF upload (reuse existing
  Cloudinary upload pattern from profile photo/cover image), extracts text, sends to
  LLM with the user's profile context, returns structured feedback (sections: strengths,
  improvements, ATS-friendliness notes)
- Feedback + a reference to the uploaded resume are persisted in `ResumeFeedback`
- `GET /ai/resume-feedback` — paginated history for the logged-in user
- Resume file size capped (e.g. 5 MB); non-PDF uploads rejected with 400

### Interview Prep
- `POST /ai/interview/start` — Premium-only; body `{ focusArea?: string }`; creates an
  `InterviewSession`, returns the first AI question
- `POST /ai/interview/:sessionId/respond` — body `{ answer: string }`; appends the
  user's answer + AI's feedback/next-question to the session transcript
- `POST /ai/interview/:sessionId/end` — marks session `completed`
- `GET /ai/interview` — paginated session history (summary: focus area, date, # of
  questions, status)
- `GET /ai/interview/:sessionId` — full transcript for one session

### Gating & Rate Limiting
- All `/ai/*` routes require `requirePremium('aiAssistant')` (Phase 6 Payments RFC)
- Per-user rate limit: max N AI requests per day (configurable; default 20) across all
  `/ai/*` endpoints combined, returning 429 `{ error: 'AI_RATE_LIMIT_EXCEEDED' }` when
  exceeded
- All LLM calls go through a single `AIService` abstraction (see RFC) so provider,
  model, and rate-limit logic live in one place

### Frontend
- `/ai-assistant` page with three tabs: Recommendations, Resume Feedback, Interview Prep
- Discovery page shows an "AI Recommendations" widget (Premium) or locked-state teaser
  (free)
- Interview Prep renders as a chat UI (reuses `MessageBubble`-style components from
  Phase 3 chat where practical)
- Resume upload reuses the existing file-upload component pattern (profile photo/cover)

---

## Data Model (high-level — see RFC for full schemas)

- `RecommendationCache` — per-user cached list of `{ userId, reason, createdAt }`,
  plus `dismissed: [{ userId, dismissedAt }]`
- `ResumeFeedback` — `{ userId, resumeUrl, extractedText, feedback (structured), createdAt }`
- `InterviewSession` — `{ userId, focusArea, status, transcript: [{ role, content, createdAt }], createdAt, completedAt }`
- `AIUsageLog` — `{ userId, endpoint, tokensUsed, createdAt }` (used for rate limiting + cost monitoring)

---

## Locked Decisions

| Decision | Choice | Rationale |
|---|---|---|
| LLM provider | Anthropic API (Claude), via a thin `AIService` abstraction | Project is built with Claude Code / Anthropic ecosystem already; abstraction allows swapping providers later without touching route code |
| Gating | All AI features require `isPremium` (`Plan.features.aiAssistant`) | Directly ties AI cost to paying users — addresses cost-predictability goal |
| Recommendation compute strategy | Hybrid: deterministic candidate shortlist (DB query on skills/techStack overlap) + LLM only generates the `reason` text for the shortlist | Avoids sending the entire user base to the LLM; keeps cost bounded and results explainable |
| Resume parsing | Extract text server-side (e.g. `pdf-parse`) before sending to LLM | LLM receives plain text, not binary; keeps prompt size predictable and avoids multi-modal API costs |
| Interview session length | Capped at 10 question/answer turns per session | Bounds per-session cost and keeps sessions focused |
| Rate limiting | Per-user daily cap across all AI endpoints, tracked via `AIUsageLog` | Single, simple mechanism; reuses existing Mongo, no new infra (e.g. Redis) for v1 |

---

## Risks

| Risk | Mitigation |
|---|---|
| LLM API cost overrun | Hard per-user daily rate limit; recommendation caching (24h TTL); session turn cap |
| LLM hallucination in resume feedback / interview feedback | Frontend labels all AI output as "AI-generated suggestions — use your judgment"; no automated actions taken on AI output |
| Prompt injection via resume text or chat input | User-provided text is only ever placed in a clearly-delimited "user content" section of the prompt; system prompt instructs the model to treat user content as data, not instructions; no AI output is ever executed as code or used to construct further prompts/queries |
| PII leakage to LLM provider | Only the requesting user's own profile/resume/chat-turn data is sent — never other users' private data; documented in PRD story 10 |
| LLM API outage | `/ai/*` endpoints return 503 with a friendly error if the provider call fails/times out; no partial `InterviewSession`/`ResumeFeedback` records on failure |
| Recommendation staleness (24h cache) hides new users | Acceptable for v1; cache TTL configurable, can be shortened later |

---

## Out of Scope (Phase 6 — AI Assistant)

- Voice-based interview practice
- AI-written profile bios / auto-fill
- Cross-session AI memory ("remember my last interview prep session")
- Resume generation (only feedback)
- Group/community AI moderation features
- Non-Anthropic providers
