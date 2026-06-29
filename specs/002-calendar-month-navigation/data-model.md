# Phase 1 Data Model: Calendar Month/Year Navigation & Localized Time

**Feature**: 002-calendar-month-navigation | **Date**: 2026-06-25

This feature introduces **no new persisted entities and no Dataverse schema changes**. It reuses the
existing `ppa_intakelog` data read through `useIntakeLogs`. The "entities" below are UI/runtime state and
derived values only.

## Runtime / UI State

### ViewedMonth (component-local)
- **Type**: `Date` (any day within the displayed month; normalized via `startOfMonth`/`endOfMonth` for queries)
- **Owner**: `calendar.tsx` `useState` (existing `viewedMonth`)
- **Drives**: the `useIntakeLogs({ from: startOfMonth, to: endOfMonth })` query and the rendered grid/markers
- **Lifecycle**: initialized to `new Date()`; updated by prev/next arrows, month dropdown, year dropdown, and
  "Today"; not persisted across sessions
- **Constraints**: bounded to `[currentYear − 5 .. currentYear + 1]` (see research R3)

### SelectedDay (component-local + mirrored to store)
- **Type**: `Date | null`
- **Owner**: `calendar.tsx` `useState` (existing `selectedDate`); mirrored to Zustand `ui-store.selectedCalendarDate`
- **Drives**: the day-detail panel contents (`selectedDayLogs`)
- **Constraints**: panel renders only when `selectedDay` is within `ViewedMonth`; "Today" sets it to the current day
- **Lifecycle**: set on day click; preserved on month change but panel is guarded against out-of-month display (research R4)

### ResolvedLocale (derived, not stored)
- **Type**: `string` (BCP-47 tag, e.g., `en-US`, `de-DE`)
- **Source**: `Intl.DateTimeFormat().resolvedOptions().locale` → `navigator.language` → `'en-US'`
- **Drives**: `formatTime` (12-hr vs 24-hr) and `formatDateLabel` output

## Derived Values (existing, unchanged)

- **Day markers** (`hasTakenDays`, `hasMissedDays`, `hasSkippedDays`, `mixedDays`): computed in `calendar.tsx`
  `useMemo` from the month's logs. Internal date keys use locale-independent `yyyy-MM-dd` (must NOT be localized).
- **selectedDayLogs**: logs filtered to `SelectedDay` via `isSameLocalDay`.

## Reused Persisted Entity (read-only)

### Ppa_intakelogs (existing — `src/generated/models/Ppa_intakelogsModel`)
Relevant fields consumed by this feature (no changes):
- `ppa_loggedat` (datetime) — the timestamp rendered via `formatTime` in the user's locale/time zone
- `ppa_status` (choice: 894250000 taken / 894250001 skipped / 894250002 missed) — drives markers
- `ppa_intakelogid`, `ppa_logname`, `_ppa_medication_value`, `ppa_injectionsite`, `ppa_notes` — passed to the card

**Validation/format rules**:
- Display time MUST be locale-formatted (FR-009) and in the user's local time zone (FR-011).
- Internal grouping keys MUST remain locale-/timezone-stable (`yyyy-MM-dd` via `date-fns`), independent of display format.
