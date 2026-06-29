# Implementation Plan: Calendar Month/Year Navigation & Localized Time

**Branch**: `002-calendar-month-navigation` | **Date**: 2026-06-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-calendar-month-navigation/spec.md`

## Summary

Add month and year navigation to the Calendar tab and make time/date displays locale-aware
(12-hour AM/PM for US locales, 24-hour elsewhere). The calendar already uses `react-day-picker`
with month stepping and a "Today" button; this feature adds **direct month + year selection** via
the dropdown caption layout (bounded year range) and centralizes **locale-aware time formatting**
in a shared utility so the day-detail panel's intake times follow the user's regional convention.
Locale is read from the browser (`Intl`/`navigator.language`) because the Power Apps host context
(`IContext`) does not expose locale or time zone. No Dataverse schema changes; this is a
frontend-only, UI + utility change.

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19

**Primary Dependencies**: Vite 7, react-day-picker 9, date-fns 4, shadcn/ui (Radix) `Select`,
TanStack Query 5, Zustand 5, `@microsoft/power-apps` SDK 1.1.3

**Storage**: Dataverse (`ppa_intakelog`, `ppa_medication`) via PAC-generated services in
`src/generated/` — read-only for this feature; no schema changes

**Testing**: Vitest 4 + Testing Library + happy-dom; tests in `tests/` mirroring `src/`

**Target Platform**: Power Apps Code App (web SPA), runs in browser + Power Apps mobile player;
responsive at ~375 px and ~768 px+

**Project Type**: Single-project web frontend (React SPA)

**Performance Goals**: Month/year change reflects new data within ~1 s (SC-002); initial paint < 2 s
(constitution IV); month-scoped queries with `$select` only

**Constraints**: No locale field from host context → derive from browser; year range bounded to a
usable window; WCAG 2.1 AA; no `any`; remote state via TanStack Query, client state via Zustand

**Scale/Scope**: 1 page (`calendar.tsx`), 1 shared util (`date-utils.ts`), 1 card component
(`intake-log-card.tsx`); ~4 files touched + tests. Single user per session; tens–hundreds of logs/month

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Assessment | Status |
|---|---|---|
| **I. Code Quality & Type Safety** | No `any`; reuse generated `Ppa_intakelogs` type as-is; locale formatter extracted to `src/lib/date-utils.ts` (no duplication — replaces the ad-hoc `HH:mm` in `intake-log-card.tsx` and the hardcoded 12-hour logic in `medication-card.tsx`); intake data still flows through TanStack Query (`useIntakeLogs`). Viewed-month/selected-day remain ephemeral component-local `useState` (not shared across components), consistent with existing `calendar.tsx`; `selectedCalendarDate` continues to sync to the Zustand `ui-store`. | ✅ PASS |
| **II. Testing Standards** | New/updated tests written first (red-green): `tests/lib/date-utils.test.ts` (locale formatting incl. noon/midnight, US vs 24-hr), and additions to `tests/pages/calendar.test.tsx` (prev/next/today, year jump, year rollover, empty month). Intake-log query path exercised via existing MSW handlers, not in-component mocks. No trivially-passing assertions. | ✅ PASS |
| **III. UX Consistency** | Month/year selectors use shadcn `Select` (`src/components/ui/select.tsx`) on Radix; spacing/typography/color from Tailwind tokens in `src/index.css`; responsive at 375/768 px; keyboard-operable with visible focus and ≥44 px targets; no new alert()/console-only feedback (existing Sonner usage unchanged). | ✅ PASS |
| **IV. Performance Requirements** | Intake query stays month-scoped via `startOfMonth`/`endOfMonth` with existing `$select`; bounded year range avoids long lists; no new heavy dependency (date-fns + Intl already available); no main-chunk growth > 50 KB. | ✅ PASS |

**Result**: PASS — no violations, Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/002-calendar-month-navigation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (UI/utility contracts)
│   ├── date-utils.contract.md
│   └── calendar-navigation.contract.md
├── checklists/
│   └── requirements.md  # From /speckit-specify
└── tasks.md             # /speckit-tasks output (NOT created here)
```

### Source Code (repository root)

```text
src/
├── pages/
│   └── calendar.tsx              # MODIFY: add month/year dropdown navigation, wire localized labels
├── components/
│   ├── intake/
│   │   └── intake-log-card.tsx   # MODIFY: replace hardcoded HH:mm with locale-aware time formatter
│   └── medications/
│       └── medication-card.tsx   # MODIFY (optional): use shared formatter for reminder time consistency
└── lib/
    └── date-utils.ts             # MODIFY: add locale resolution + formatTime/formatDateLabel helpers

tests/
├── lib/
│   └── date-utils.test.ts        # ADD: locale formatting unit tests
├── pages/
│   └── calendar.test.tsx         # MODIFY: navigation + rollover + empty-month tests
└── components/
    └── intake-log-card.test.tsx  # ADD: localized time render test (optional)
```

**Structure Decision**: Single-project React SPA. The feature is localized to the Calendar page,
the shared date utility, and the intake-log card. Centralizing time/date formatting in
`src/lib/date-utils.ts` removes the existing duplication between `intake-log-card.tsx` (24-hr) and
`medication-card.tsx` (12-hr), satisfying Principle I's no-duplication rule.

## Complexity Tracking

> No constitution violations. Section intentionally empty.
