---
description: "Task list for Calendar Month/Year Navigation & Localized Time"
---

# Tasks: Calendar Month/Year Navigation & Localized Time

**Input**: Design documents from `/specs/002-calendar-month-navigation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: INCLUDED — the MedTrack constitution (Principle II) mandates TDD; tests are written and
confirmed failing before implementation.

**Organization**: Tasks are grouped by user story (US1 P1, US2 P2, US3 P2) for independent delivery.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1 / US2 / US3 (setup, foundational, polish tasks have no story label)

## Path Conventions

Single-project React SPA: source in `src/`, tests in `tests/` mirroring `src/`.

⚠️ **Shared-file note**: `src/pages/calendar.tsx` is touched by US1, US2, and US3. Tasks that modify
it are **not** marked `[P]` across stories and must be done sequentially to avoid conflicts. Likewise
`tests/pages/calendar.test.tsx` is extended by US1 and US2.

---

## Phase 1: Setup

**Purpose**: Prepare seed/mock data so navigation and locale behavior can be exercised.

- [X] T001 Ensure `dev:mock` seed data spans multiple months and includes a known noon (12:00) and midnight (00:00) intake log for locale validation in `src/mocks/mock-data.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared test infrastructure both navigation stories (US1, US2) rely on.

**⚠️ CRITICAL**: Complete before US1/US2 navigation tests can pass meaningfully.

- [X] T002 Ensure the mock/MSW intake service returns month-scoped logs for arbitrary `from`/`to` ranges (so navigating to past/future/empty months yields correct data) in `src/mocks/mock-intakelogs-service.ts` and `tests/mocks/server.ts`

**Checkpoint**: Foundation ready — user stories can begin.

---

## Phase 3: User Story 1 - Browse adjacent months (Priority: P1) 🎯 MVP

**Goal**: Step backward/forward one month at a time with correct grid, markers, month/year label,
year rollover, and a "Today" reset.

**Independent Test**: From the current month, step back/forward; confirm grid, label, and markers
update; cross a December→January boundary; click "Today" to return.

### Tests for User Story 1 ⚠️ (write first, confirm FAIL)

- [X] T003 [US1] Add navigation tests to `tests/pages/calendar.test.tsx`: prev/next month updates grid + month/year label + markers (N1, N2); "Today" returns to current month and selects today (N7); December→January and January→December rollover (N5, N6); navigating to a month with no logs shows day-panel empty state and no error (N9); selecting a day then changing month does not show the out-of-month day (N10)

### Implementation for User Story 1

- [X] T004 [US1] In `src/pages/calendar.tsx`, ensure clearly-labeled previous/next month controls and the "Today" control update `viewedMonth` (and re-select today for "Today"), keeping the month/year label accurate across year boundaries
- [X] T005 [US1] In `src/pages/calendar.tsx`, add the out-of-month guard so the day-detail panel renders only when `selectedDate` is within `viewedMonth` (research R4); confirm the month-scoped `useIntakeLogs({ from: startOfMonth, to: endOfMonth })` query refetches on month change and the empty-month state is shown without error

**Checkpoint**: US1 fully functional and independently testable (MVP).

---

## Phase 4: User Story 2 - Jump directly to month and year (Priority: P2)

**Goal**: Choose any month and any year (within a bounded range) directly, without stepping.

**Independent Test**: Open the year dropdown (only currentYear−5..+1 listed), pick a distant year and
a month; confirm the grid jumps directly there with correct markers.

### Tests for User Story 2 ⚠️ (write first, confirm FAIL)

- [X] T006 [US2] Add direct-jump tests to `tests/pages/calendar.test.tsx`: year selector lists only the bounded range `[currentYear−5 .. currentYear+1]` (N8); choosing a different year shows the same month in that year (N3); choosing a different month shows that month in the current year (N4); changing month/year refetches only that month's data (FR-005)

### Implementation for User Story 2

- [X] T007 [P] [US2] Add a bounded view-range constant/helper (`currentYear−5` to `currentYear+1`, e.g. `getCalendarBounds()`) in `src/lib/date-utils.ts` per research R3
- [X] T008 [US2] In `src/pages/calendar.tsx`, switch `DayPicker` to `captionLayout="dropdown"` with `startMonth`/`endMonth` from the bounds helper; theme the month/year dropdowns via `classNames` to meet WCAG AA contrast and ≥44×44 px targets (fallback to shadcn `src/components/ui/select.tsx` if native dropdown styling is insufficient — research R2)
- [X] T009 [US2] Verify navigation controls wrap without horizontal scroll at ~375 px and sit side-by-side with the day panel at ~768 px+ in `src/pages/calendar.tsx` (FR-012, SC-006)

**Checkpoint**: US1 + US2 both work independently.

---

## Phase 5: User Story 3 - Locale-correct intake times (Priority: P2)

**Goal**: Show intake times as 12-hour AM/PM for US locales and 24-hour elsewhere, with locale-aware
date labels, centralized in one utility (removing the existing 12-/24-hour duplication).

**Independent Test**: With `en-US`, day-panel times read `8:30 AM`; with `en-GB`/`de-DE`, `20:30`;
noon/midnight render correctly; date headings follow locale.

### Tests for User Story 3 ⚠️ (write first, confirm FAIL)

- [X] T010 [P] [US3] Unit tests in `tests/lib/date-utils.test.ts` for `resolveLocale`, `formatTime`, and `formatDateLabel` covering the contract acceptance tables (en-US 12-hr AM/PM, en-GB/de-DE 24-hr, noon `12:00 PM`/`12:00`, midnight `12:00 AM`/`00:00`), asserting meaningful parts not byte-exact strings — per `contracts/date-utils.contract.md`
- [X] T011 [P] [US3] Test in `tests/components/intake-log-card.test.tsx` that an intake time renders via the locale-aware formatter (12-hr under en-US, 24-hr under a 24-hr locale)

### Implementation for User Story 3

- [X] T012 [P] [US3] Implement `resolveLocale`, `formatTime`, and `formatDateLabel` in `src/lib/date-utils.ts` using `Intl.DateTimeFormat` per `contracts/date-utils.contract.md` (no `any`; `date-fns` retained for date math and locale-stable `yyyy-MM-dd` keys)
- [X] T013 [US3] Replace the hardcoded `HH:mm` time string in `src/components/intake/intake-log-card.tsx` with `formatTime` (depends on T012)
- [X] T014 [US3] Replace the selected-day heading `format(selectedDate, 'MMMM d, yyyy')` with `formatDateLabel` in `src/pages/calendar.tsx` (depends on T012; sequential with T004/T005/T008 — same file)
- [X] T015 [P] [US3] Align the reminder-time display in `src/components/medications/medication-card.tsx` to the shared `formatTime` helper to remove the duplicated 12-hour logic (depends on T012)

**Checkpoint**: All three stories independently functional; no remaining duplicated time formatting.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T016 [P] Execute the manual validation scenarios in `specs/002-calendar-month-navigation/quickstart.md` (navigation, locale, responsive)
- [X] T017 Run `npm run lint`, `npm run build` (`tsc -b` + Vite), and `npm test` — all pass with zero errors (Definition of Done)
- [X] T018 [P] Verify SC-003 (no mixed 12-/24-hour times on a single screen per locale) and SC-006 accessibility (keyboard focus rings, contrast ≥4.5:1, ≥44 px targets) on the Calendar tab

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup; blocks US1/US2 navigation tests.
- **User Stories (Phase 3–5)**: depend on Foundational. US1 → US2 share `calendar.tsx` and
  `calendar.test.tsx`, so sequence US1 before US2 to avoid file conflicts. US3 is largely independent
  (own util + card) except T014 which edits `calendar.tsx`.
- **Polish (Phase 6)**: after all desired stories complete.

### User Story Dependencies

- **US1 (P1)**: independent; the MVP.
- **US2 (P2)**: independently testable; shares `calendar.tsx`/`calendar.test.tsx` with US1 (sequence after US1).
- **US3 (P2)**: independent except T014 (calendar heading). T013/T014/T015 depend on T012.

### Within Each Story

- Tests first and failing → implementation (constitution II).
- Utility (T012) before its consumers (T013, T014, T015).

### Parallel Opportunities

- US3 is the cleanest parallel target: T010 and T011 [P] together; T012 then T013/T015 [P] (different files).
- T007 [P] (date-utils bounds) can be written alongside US1 work since it's a different file.
- Tasks editing `src/pages/calendar.tsx` (T004, T005, T008, T009, T014) are **sequential** — same file.

---

## Parallel Example: User Story 3

```bash
# Write US3 tests together (different files):
Task: "Unit tests for date-utils in tests/lib/date-utils.test.ts"
Task: "Localized time render test in tests/components/intake-log-card.test.tsx"

# After T012 (formatters) lands, wire consumers in parallel (different files):
Task: "Use formatTime in src/components/intake/intake-log-card.tsx"
Task: "Use formatTime in src/components/medications/medication-card.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → Phase 2 Foundational → Phase 3 US1.
2. **STOP and VALIDATE**: month stepping, rollover, Today, empty month.
3. Demo: a fully navigable calendar across adjacent months.

### Incremental Delivery

1. Setup + Foundational → ready.
2. US1 (MVP) → validate → demo.
3. US2 (direct month/year jump) → validate → demo.
4. US3 (localized time/date) → validate → demo.
5. Polish (lint/build/test gates, quickstart, a11y).

---

## Notes

- [P] = different files, no incomplete-task dependency.
- Confirm each test FAILS before implementing (no trivially-passing assertions — constitution II).
- `src/pages/calendar.tsx` is the main shared file; keep its edits sequential.
- Commit after each task or logical group; stop at any checkpoint to validate a story independently.
