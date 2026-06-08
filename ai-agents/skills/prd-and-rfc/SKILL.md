---
name: prd-and-rfc
description: Converts a refined idea into a PRD (product requirements) and an RFC/HLD (technical design including framework/stack decisions). Use when the user has a validated idea or one-pager and needs it turned into a product spec and a technical design doc before any code is written.
---

# PRD and RFC

## Overview
Bridges product thinking and engineering by turning a refined idea (e.g. output of `idea-refine`) into two artifacts: a **PRD** (what to build, for whom, why) and an **RFC/HLD** (how to build it — architecture, data model, API shape, and crucially the **framework/stack decision** that downstream skills like `figma-to-code` and `frontend-ui-engineering` will rely on).

## When to Use
- After `idea-refine` produces a one-pager, before any design or code work starts
- When the user says "write a PRD", "draft an RFC", "design doc", "HLD", or "what stack should we use"
- NOT for small bug fixes or one-line changes — use `planning-and-task-breakdown` instead

## Process

### Phase 1: PRD
1. Restate the problem and target user from the idea one-pager
2. Define goals, non-goals, and success metrics
3. List user stories / core flows (e.g. signup, profile, send connection request)
4. Mark MVP scope vs later phases

### Phase 2: RFC / HLD
1. Propose system architecture (frontend, backend, DB, integrations) — use ASCII diagram
2. **Decide and document the framework/stack explicitly** in a `## Stack Decision` section, e.g.:
   - Frontend: React + Vite + TailwindCSS (reason: matches Figma design tokens, fast iteration)
   - Backend: Express + MongoDB/Mongoose (reason: matches existing `backend/` setup)
   - This section is the contract that `figma-to-code` and `frontend-ui-engineering` must follow — don't leave it ambiguous
3. Define data models / schema sketch
4. Define API contract (routes, request/response shapes) — hand off to `api-and-interface-design` for details
5. Call out risks, open questions, and alternatives considered (and why rejected)

## Output
Save as `docs/specs/<feature>-prd.md` and `docs/specs/<feature>-rfc.md`. Confirm with the user before writing.

## Common Rationalizations
| Rationalization | Reality |
|---|---|
| "Stack is obvious, no need to write it down" | Downstream skills (figma-to-code, frontend build) need an explicit, unambiguous decision to act on |
| "PRD and RFC can be merged into one doc" | Mixing product *why* with technical *how* makes both harder to review and reuse independently |

## Red Flags
- RFC has no explicit "Stack Decision" section
- PRD lists features without success criteria or MVP boundary

## Verification
- [ ] PRD has goals, non-goals, user stories, MVP scope
- [ ] RFC has architecture diagram, explicit stack decision, data model, API sketch
- [ ] Both docs saved and confirmed with user
