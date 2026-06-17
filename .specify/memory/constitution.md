<!--
SYNC IMPACT REPORT
==================
Version change: (template / unratified) → 1.0.0
Rationale: Initial ratification. MAJOR baseline (1.0.0) — first governing principle set
for the MedTrack project. No prior version to compare against.

Modified principles: N/A (initial adoption)
Added sections:
  - Core Principles I–IV (Code Quality & Type Safety; Testing Standards;
    User Experience Consistency; Performance Requirements)
  - Technology Stack Standards
  - Development Workflow & Quality Gates
  - Governance
Removed sections: N/A (template placeholders cleared)

Templates reviewed:
  - .specify/templates/plan-template.md  ✅ reviewed — "Constitution Check" gate is
    generic and derives from this file at plan time; no edits required
  - .specify/templates/spec-template.md  ✅ reviewed — mandatory sections compatible;
    no edits required
  - .specify/templates/tasks-template.md ✅ reviewed — task categories (setup,
    foundational, polish/security) accommodate principle-driven task types; no edits required
  - .specify/templates/checklist-template.md ✅ reviewed — compatible; no edits required

Follow-up TODOs: None. All placeholders resolved.
-->

# MedTrack Constitution

MedTrack is a Power Apps Code App (React + TypeScript + Vite) backed by Dataverse,
helping users manage medication schedules and log intakes. This constitution defines
the non-negotiable standards every feature, screen, and data flow must meet.

## Core Principles

### I. Code Quality & Type Safety

All code MUST be correct, predictable, and maintainable — enforced mechanically,
not by convention.

- TypeScript strict mode MUST remain enabled across the entire codebase. `any` is
  disallowed; exceptions require an inline justification comment.
- Dataverse record shapes from `src/generated/` MUST be used as-is for service calls.
  Wrapper types or mappings MUST extend those generated types, never duplicate them.
- `npm run lint` and `npm run build` (which runs `tsc -b` + Vite) MUST pass with zero
  errors before any change is considered complete. Lint warnings that can be auto-fixed
  MUST be fixed; suppressions require a comment explaining why.
- Components MUST be single-purpose and small. Shared logic MUST be extracted into
  hooks under `src/hooks/` or utilities under `src/lib/` — duplication is disallowed.
- Server/remote state MUST flow exclusively through TanStack Query (`src/providers/query-provider.tsx`).
  Client UI state MUST use Zustand. Ad-hoc fetch-then-setState patterns that bypass
  this layering are disallowed.

**Rationale**: A medication-tracking app cannot afford silent runtime errors or type drift
between generated service contracts and the UI. Mechanical enforcement keeps an AI-assisted
codebase consistent and safe to change.

### II. Testing Standards

Features MUST be verifiable. Test coverage is a delivery requirement, not an afterthought.

- Every user story MUST have at least one independently runnable acceptance test that
  validates the full happy path without mocking Dataverse service calls inside components.
- New Dataverse service interactions (queries, mutations) MUST have integration-level tests
  that exercise the generated service functions against a real or stub Dataverse endpoint —
  not just in-memory mocks.
- Tests MUST be written (and confirmed to fail) before the feature implementation is
  considered in progress. The red-green-refactor cycle is mandatory for all new functionality.
- A test that passes trivially (empty assertion, always-true condition) is treated as no
  test. Any PR adding such tests MUST be sent back for revision.
- Test files MUST live in a `tests/` directory mirroring the `src/` structure (e.g.,
  `tests/pages/home.test.tsx` for `src/pages/home.tsx`).

**Rationale**: Adherence data drives real health decisions; regressions that go undetected
because there are no tests are unacceptable. Tests also define the contract a feature must
satisfy, clarifying intent before code is written.

### III. User Experience Consistency

Every screen MUST look and behave as part of one coherent product.

- All interactive UI MUST use shadcn/ui components (`src/components/ui/`) built on Radix UI
  primitives. Custom HTML equivalents of already-available components are disallowed.
- Visual language MUST be consistent: spacing, typography, and color MUST come from the
  Tailwind design tokens defined in `src/index.css`. Magic pixel values and inline color
  literals are disallowed.
- Every screen MUST be responsive and verified at mobile (~375 px) and tablet (~768 px+)
  breakpoints. Primary tasks MUST be reachable without horizontal scrolling on either size.
- Interactive elements MUST meet WCAG 2.1 AA: keyboard operability, visible focus rings,
  text contrast ≥ 4.5:1 (normal text) / 3:1 (large text), touch targets ≥ 44×44 px.
- Destructive actions (delete medication, remove intake log) MUST require a confirmation
  dialog using the existing `<Dialog>` component before executing.
- User-facing feedback for async operations (loading, success, error) MUST use the Sonner
  toast provider (`src/providers/sonner-provider.tsx`) — no alert() or console-only errors.

**Rationale**: Inconsistent UX creates friction that reduces medication adherence — the
app's core purpose. A shared component and token system also reduces future maintenance cost.

### IV. Performance Requirements

The app MUST remain fast and responsive under realistic usage conditions.

- Initial page load (first meaningful paint) MUST complete in under 2 seconds on a
  standard Power Apps embedded environment with a cold cache.
- Dataverse list queries MUST specify `$select` to limit returned columns to only those
  needed by the view — unbounded `SELECT *`-style queries are disallowed.
- TanStack Query cache MUST be configured with appropriate `staleTime` values per entity
  type: frequently-mutated data (intake logs) MUST use ≤ 30 s; reference data (medications
  list) MAY use up to 5 minutes.
- Route-level code splitting MUST be applied to all pages beyond the initial route so
  that unused page bundles are not loaded on first render.
- recharts components rendering large datasets (calendar history, adherence trends) MUST
  use windowing or pagination rather than rendering all data points at once when the dataset
  exceeds 90 records.
- Bundle size MUST be monitored. A Vite build that increases the main chunk by more than
  50 KB (gzipped) requires explicit justification in the plan's Complexity Tracking.

**Rationale**: MedTrack runs inside Power Apps, which adds embedding overhead. Poor
performance directly undermines user engagement with critical health reminders.

## Technology Stack Standards

The following stack choices are fixed for this project. Deviations require a constitution
amendment.

| Layer | Technology | Notes |
|---|---|---|
| Language | TypeScript 5 (strict) | `tsc -b` must pass |
| Framework | React 19 + Vite | `@vitejs/plugin-react` |
| Styling | Tailwind CSS 4 + shadcn/ui | Radix UI primitives |
| Routing | React Router 7 | Pages in `src/pages/` |
| Remote state | TanStack Query 5 | Via `src/providers/query-provider.tsx` |
| Client state | Zustand 5 | Stores in `src/stores/` (when added) |
| Data tables | TanStack Table 8 | Via `src/components/ui/table.tsx` |
| Charts | Recharts 2 | Via `src/components/ui/chart.tsx` |
| Dates | date-fns 4 | No Moment.js or Day.js |
| Notifications | Sonner 2 | Via `src/providers/sonner-provider.tsx` |
| Icons | Lucide React | No inline SVGs for icons |
| Data layer | Dataverse via PAC-generated services | `src/generated/` — do not hand-author |
| Deployment | Power Apps Vite plugin + `pac code` | Build output in `dist/` |

## Development Workflow & Quality Gates

- **Spec-driven flow**: All features follow the Spec Kit lifecycle:
  `specify` → `clarify` (when needed) → `plan` → `tasks` → `implement`.
- **Constitution Check gate**: `plan.md` MUST explicitly pass the Constitution Check
  before Phase 0 research and again after Phase 1 design. Violations go to Complexity
  Tracking with written justification — unaddressed violations block merge.
- **Definition of done** for any change:
  1. `npm run lint` passes with zero errors.
  2. `npm run build` passes with zero errors.
  3. Acceptance tests pass (or are newly written and passing for new features).
  4. Responsive verification at ≥ 375 px and ≥ 768 px completed.
  5. No new `any` types without inline justification comment.
- **Code review**: Every PR touching data-fetching, Dataverse service calls, or state
  management MUST receive explicit review for Principles I and IV compliance.
- **Incremental delivery**: Work is organized by independently testable user stories
  (P1 → P2 → P3 …). Each story MUST be demonstrable as a working MVP increment before
  the next story begins.

## Governance

This constitution supersedes all other development practices for MedTrack. Where guidance
conflicts, the constitution wins.

- **Amendments**: Proposed via pull request updating this file with rationale and a version
  bump. Material changes MUST update dependent Spec Kit templates in the same PR.
- **Versioning policy** (semantic):
  - **MAJOR**: Backward-incompatible change — removing or redefining a principle.
  - **MINOR**: New principle or section added, or guidance materially expanded.
  - **PATCH**: Clarifications, wording, and non-semantic refinements.
- **Compliance review**: Plans, specs, task lists, and code reviews MUST verify alignment
  with all four principles. Unjustified violations block merge until resolved or recorded
  in Complexity Tracking with a written rationale.
- **Runtime guidance**: Day-to-day contributor and agent guidance lives in `CLAUDE.md` and
  Spec Kit artifacts under `specs/`. Those files MUST stay consistent with this constitution.

**Version**: 1.0.0 | **Ratified**: 2026-06-16 | **Last Amended**: 2026-06-16
