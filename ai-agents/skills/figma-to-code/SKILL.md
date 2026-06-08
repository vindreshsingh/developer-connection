---
name: figma-to-code
description: Reads a Figma design via the Figma MCP server and implements it as UI code in the framework chosen by the project's RFC. Use when the user has a Figma file/URL and wants it turned into working frontend components.
---

# Figma to Code

## Overview
Translates an existing Figma design into framework-specific UI code, using the Figma MCP tools to extract design context (layout, tokens, components) and the project's RFC `## Stack Decision` section to determine which framework to target.

## When to Use
- User shares a figma.com URL or says "implement this design", "build the UI from Figma"
- A Figma design already exists for the feature (if not, that's a design task, not this skill)
- NOT for designing from scratch in Figma — that's `use_figma` / `/figma-generate-design`

## Process
1. **Find the stack decision first** — read `docs/specs/<feature>-rfc.md` `## Stack Decision` section. Never guess the framework.
2. **Load the Figma skill** — `/figma-use` is mandatory before calling `use_figma`/design-context tools per Figma MCP server instructions
3. **Extract design context**: `get_design_context` (layout, components, text), `get_variable_defs` (design tokens — colors, spacing, typography), `get_screenshot` for visual reference
4. **Map to existing components first** — check `get_code_connect_map` / `get_code_connect_suggestions` so you reuse existing mapped components instead of regenerating them
5. **Generate components** in the chosen framework, matching:
   - Layout and spacing from the design context
   - Design tokens → theme/CSS variables (don't hardcode hex values pulled from the design)
6. **Wire to backend** — connect generated components to the API contract defined in the RFC (use `api-and-interface-design` for the data-fetching layer)
7. Hand off to `frontend-ui-engineering` for component structure/state conventions and to `browser-testing-with-devtools` for visual verification against the Figma screenshot

## Common Rationalizations
| Rationalization | Reality |
|---|---|
| "I can tell the framework from the file extensions in the repo" | The RFC is the source of truth — a repo may be mid-migration or have multiple frontends |
| "Close enough visually, no need to check tokens" | Hardcoded values drift from the design system on the next design update; use `get_variable_defs` |

## Red Flags
- Generating UI code without having read the RFC's stack decision
- Hardcoded colors/spacing instead of design tokens
- Skipping `get_code_connect_map` and duplicating components that already exist in code

## Verification
- [ ] Framework matches RFC `## Stack Decision`
- [ ] Components use design tokens, not hardcoded values
- [ ] Screenshot comparison (Figma vs rendered) done via browser-testing-with-devtools
- [ ] Existing mapped components reused where available
