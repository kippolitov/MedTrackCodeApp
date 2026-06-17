# Implementation Plan: MedTrack — Medication Reminder & Intake Logger

**Branch**: `001-medtrack-app` | **Date**: 2026-06-17 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/001-medtrack-app/spec.md`

---

## Summary

MedTrack is a React 19 + TypeScript Power Apps Code App that lets authenticated users manage
their medication schedules and log dose events. The app surfaces a daily dashboard with adherence
stats and overdue reminders, a month calendar with intake history, and analytics charts with CSV
export. All data is persisted to Dataverse via two generated service classes
(`Ppa_medicationsService`, `Ppa_intakelogsService`) and surfaces through TanStack Query.
Zustand manages ephemeral UI state (open dialogs, selected dates, draft log forms). All UI is
built exclusively with shadcn/ui + Tailwind CSS 4 tokens.

**Delivery order (independent user stories):**
US1 (Medication Management) → US2 (Dashboard) → US3 (Intake Logging) → US4 (Calendar) → US5 (Analytics)

---

## Technical Context

**Language/Version**: TypeScript 5.9, strict mode enabled (`tsconfig.app.json`)

**Primary Dependencies**:
- React 19.1, React Router 7.9, TanStack Query 5.90, Zustand 5.0
- shadcn/ui (Radix UI primitives), Tailwind CSS 4.1, Lucide React 0.546
- Recharts 2.15, date-fns 4.1, react-day-picker 9.11, Sonner 2.0
- `@microsoft/power-apps` 1.1 (Dataverse client), `@microsoft/power-apps-vite` 1.0

**Storage**: Microsoft Dataverse via `@microsoft/power-apps` client — entities `ppa_medications`
(logicalName `ppa_medication`) and `ppa_intakelogs` (logicalName `ppa_intakelog`). Generated
service layer in `src/generated/` is the only permitted data access path.

**Testing**: Vitest 2 + @testing-library/react 16 + jsdom (must be added as devDependencies
before Phase 1 implementation; see `research.md` § Testing Setup). Tests run via `npm run test`.
Test files live in `tests/` mirroring the `src/` directory structure.

**Target Platform**: Power Apps embedded web app (pac code); verified at 375 px and 768 px
viewports. Deployed via `npm run build` + `pac code push`.

**Project Type**: Single-page web application (SPA), embedded in Power Apps.

**Performance Goals**:
- Dashboard load (first meaningful paint): < 2 s (SC-002)
- Calendar month navigation: < 1 s (SC-006)
- CSV export (1-year / 3-medication dataset): < 5 s (SC-007)
- First-use task (add medication + log intake): < 3 min (SC-001)

**Constraints**:
- No `any` types; all Dataverse access must use generated services from `src/generated/`
- `$select` required on all list queries — no unbounded column retrieval
- Route-level code splitting via `React.lazy()` for non-home pages
- Bundle growth > 50 KB gzipped per major chunk requires written justification

**Scale/Scope**: Single authenticated user per session; typical dataset — 5–20 active medications,
up to ~1,000 intake logs over a 1-year analytics window. 5 screens, ~15 major components.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

### Principle I — Code Quality & Type Safety

| Check | Status | Notes |
|-------|--------|-------|
| TypeScript strict mode | ✅ Pass | `tsconfig.app.json` uses strict |
| Generated service types used | ✅ Pass | `Ppa_medicationsService`, `Ppa_intakelogsService` are the only data access path |
| `npm run lint` gate | ✅ Pass | ESLint 9 configured; enforced before merge |
| `npm run build` gate | ✅ Pass | `tsc -b && vite build` in CI |
| Single-purpose components | ✅ Pass | Feature components live in `src/components/<feature>/`; shared logic in `src/hooks/` and `src/lib/` |
| TanStack Query for server state | ✅ Pass | `src/providers/query-provider.tsx` is the sole fetch provider |
| Zustand for client state | ✅ Pass | Stores in `src/stores/` (to be added) |
| No `any` | ✅ Pass | Enforced by constitution; violations require inline comment |
| Dataverse schema | ✅ Pass | No new columns required; all needed fields exist in generated types |

### Principle II — Testing Standards

| Check | Status | Notes |
|-------|--------|-------|
| Test runner installed | ⚠️ Pre-condition | Vitest not yet installed — must be added in US1 setup task |
| Red-green-refactor | ✅ Required | Failing tests must exist before feature code is written |
| Acceptance test per user story | ✅ Required | One end-to-end acceptance test per US (US1–US5) |
| Integration tests for Dataverse calls | ✅ Required | useQuery hooks tested against MSW stubs |
| `tests/` mirrors `src/` | ✅ Required | e.g., `tests/pages/medications.test.tsx` for `src/pages/medications.tsx` |

### Principle III — UX Consistency

| Check | Status | Notes |
|-------|--------|-------|
| shadcn/ui only | ✅ Pass | All interactive UI uses existing `src/components/ui/` components |
| Tailwind design tokens | ✅ Pass | No magic pixel values or inline color literals |
| Mobile + tablet responsive | ✅ Required | Verified at 375 px and 768 px before each story is marked done |
| WCAG 2.1 AA | ✅ Required | Touch targets ≥ 44×44 px; contrast ≥ 4.5:1; keyboard operable |
| Destructive confirmation | ✅ Pass | `<Dialog>` component available and required for delete actions |
| Sonner toasts | ✅ Pass | `src/providers/sonner-provider.tsx` wired in App.tsx |

### Principle IV — Performance

| Check | Status | Notes |
|-------|--------|-------|
| `$select` on list queries | ✅ Required | `IGetAllOptions.select` passed on every `getAll()` call |
| staleTime ≤ 30 s (intake logs) | ✅ Required | Configured per-query |
| staleTime ≤ 5 min (medications) | ✅ Required | Medications change infrequently |
| Route-level code splitting | ✅ Required | `React.lazy()` + `Suspense` for medications, calendar, analytics pages |
| Recharts data windowing | ✅ Pass | Calendar = max ~31 records/month; analytics filtered to selected window |
| Bundle size monitoring | ✅ Required | Checked after each page addition during build |

---

## Project Structure

### Documentation (this feature)

```text
specs/001-medtrack-app/
├── plan.md              # This file (/speckit-plan output)
├── research.md          # Phase 0: testing, injection sites, adherence, CSV, overdue
├── data-model.md        # Phase 1: Dataverse types + app-layer types
├── quickstart.md        # Phase 1: validation scenarios per user story
├── contracts/
│   └── ui-contracts.md  # Phase 1: component prop + route contracts
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
src/
├── App.tsx                          # Providers + RouterProvider (exists)
├── router.tsx                       # BrowserRouter with lazy-loaded pages (extend)
├── index.css                        # Tailwind 4 tokens (exists)
├── main.tsx                         # Entry point (exists)
├── assets/                          # Static assets (exists)
│
├── components/
│   ├── ui/                          # shadcn/ui primitives (exists — DO NOT EDIT)
│   ├── medications/
│   │   ├── medication-card.tsx      # Card showing one medication in list
│   │   ├── medication-form.tsx      # Add/Edit modal dialog (identical field set)
│   │   └── medication-list.tsx      # Grouped Active/Inactive list with counts
│   ├── intake/
│   │   ├── log-intake-dialog.tsx    # Multi-entry-point log dialog
│   │   ├── body-map.tsx             # Injection site map + chip selector
│   │   └── intake-log-card.tsx      # Single log entry in calendar panel
│   ├── dashboard/
│   │   ├── stats-bar.tsx            # 4 adherence stats
│   │   ├── schedule-list.tsx        # Today's scheduled doses
│   │   └── overdue-banner.tsx       # Persistent overdue reminder banner
│   └── analytics/
│       └── adherence-chart.tsx      # Recharts line/bar + time-window selector
│
├── pages/
│   ├── _layout.tsx                  # Root layout with nav (exists — extend with nav)
│   ├── home.tsx                     # Dashboard page (replace placeholder content)
│   ├── medications.tsx              # Medication management page (new)
│   ├── calendar.tsx                 # Calendar + day detail panel page (new)
│   ├── analytics.tsx                # Analytics + export page (new)
│   └── not-found.tsx               # 404 (exists)
│
├── hooks/
│   ├── use-theme.ts                 # Dark/light theme (exists)
│   ├── use-medications.ts           # TanStack Query hooks for ppa_medications
│   ├── use-intake-logs.ts           # TanStack Query hooks for ppa_intakelogs
│   ├── use-adherence.ts             # Derived adherence stats from intake logs
│   └── use-overdue.ts               # Derived overdue medications from current time
│
├── stores/
│   ├── ui-store.ts                  # Zustand: open dialogs, selected date, active tab
│   └── log-intake-store.ts          # Zustand: draft LogIntake form pre-population state
│
├── lib/
│   ├── utils.ts                     # cn() helper (exists)
│   ├── adherence.ts                 # Pure adherence calculation functions
│   ├── csv-export.ts               # CSV string builder + browser download trigger
│   ├── injection-sites.ts           # Site label helpers + recently-used detection
│   └── date-utils.ts               # date-fns wrappers for schedule/calendar logic
│
└── generated/                       # Dataverse generated types (DO NOT HAND-EDIT)
    ├── index.ts
    ├── models/
    │   ├── CommonModels.ts
    │   ├── Ppa_medicationsModel.ts
    │   └── Ppa_intakelogsModel.ts
    └── services/
        ├── Ppa_medicationsService.ts
        └── Ppa_intakelogsService.ts

tests/                               # Mirrors src/ structure (Vitest)
├── lib/
│   ├── adherence.test.ts
│   ├── csv-export.test.ts
│   └── injection-sites.test.ts
├── hooks/
│   ├── use-medications.test.ts
│   ├── use-intake-logs.test.ts
│   └── use-adherence.test.ts
├── components/
│   ├── medication-form.test.tsx
│   ├── log-intake-dialog.test.tsx
│   └── body-map.test.tsx
└── pages/
    ├── home.test.tsx                # US2 acceptance test
    ├── medications.test.tsx         # US1 acceptance test
    ├── calendar.test.tsx            # US4 acceptance test
    └── analytics.test.tsx          # US5 acceptance test
```

**Structure Decision**: Single React SPA (src/ + tests/). No backend/frontend split — Dataverse
is the data layer accessed via generated service classes. All computation (adherence, overdue
detection, CSV building) is client-side pure functions in `src/lib/`.

---

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Vitest devDependency addition | Constitution Principle II mandates tests before code; no test runner is currently installed | Cannot use existing eslint/tsc alone for behaviour verification; Vitest integrates with Vite natively with zero config duplication |
