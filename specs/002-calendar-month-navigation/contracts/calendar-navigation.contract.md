# Contract: Calendar Tab Month/Year Navigation (UI)

**Component**: `src/pages/calendar.tsx` | **Feature**: 002-calendar-month-navigation

Describes the observable UI contract of the Calendar tab after this feature. Phrased as
behaviors/affordances so it is testable via Testing Library (constitution II).

---

## Navigation affordances (MUST exist)

1. **Previous month** — arrow button that moves `viewedMonth` back one month; disabled at the lower bound.
2. **Next month** — arrow button that moves `viewedMonth` forward one month; disabled at the upper bound.
3. **Month label button** — shows the viewed month (e.g. "June"); opens the **month overlay**.
4. **Year label button** — shows the viewed year (e.g. "2026"); opens the **year overlay**.
5. **Month overlay** (`MonthYearPicker mode="month"`, a Popover anchored beneath the month label) — a
   grid of **12 month pills** (Jan–Dec, no paging). Selecting a pill updates `viewedMonth` and **auto-closes**.
6. **Year overlay** (`MonthYearPicker mode="year"`, a Popover anchored beneath the year label) — a grid of **12 year pills per page**
   within the bounded range `[currentYear−20 .. currentYear+3]`, with top **‹ / › paging arrows**
   ("Previous years" / "Next years") that move by 12-year blocks and disable at the range edges. The page
   containing the viewed year is shown first. Selecting a pill updates `viewedMonth` and **auto-closes**.
7. **Today** — single control that sets `viewedMonth` to the current month and `selectedDate` to today.

All controls MUST be keyboard-operable with visible focus and ≥44×44 px touch targets (FR-012, Principle III).
Overlay pills are toggle `<button>`s (`aria-pressed` for selection) inside a `role="group"` labeled "Month" or "Year".

## Behavioral contract

| ID | Given | When | Then |
|---|---|---|---|
| N1 | Viewing month M | activate "previous month" | grid + markers + month/year label show M−1; intake query refetched for M−1 (FR-001, FR-004, FR-005) |
| N2 | Viewing month M | activate "next month" | grid shows M+1 with that month's markers/label |
| N3 | Year overlay open | choose year Y pill | grid shows same month in year Y; overlay auto-closes (FR-003) |
| N4 | Month overlay open | choose month pill | grid shows chosen month in current year; overlay auto-closes (FR-002) |
| N5 | Viewing December YYYY | activate "next month" | grid shows January YYYY+1; year label = YYYY+1 (FR-007) |
| N6 | Viewing January YYYY | activate "previous month" | grid shows December YYYY−1; year label = YYYY−1 (FR-007) |
| N7 | Viewing any non-current month | activate "Today" | grid shows current month; today is selected (FR-006) |
| N8 | Year overlay open | inspect year pills | ≤12 pills shown, all within `[currentYear−20 .. currentYear+3]`; paging arrows disable at the range edges (FR-008) |
| N9 | Navigate to month with no logs | month renders | grid has no markers; day panel shows empty state, no error (FR-013, SC-005) |
| N10 | Month changes while a day outside the new month was selected | month renders | day-detail panel does not show the out-of-month day (research R4) |

## Data-loading contract

- On `viewedMonth` change, `useIntakeLogs({ from: startOfMonth(viewedMonth), to: endOfMonth(viewedMonth) })`
  is the only intake fetch; no unbounded/all-history query (FR-005, Principle IV).
- Existing `$select`-scoped query is reused unchanged.

## Localized display contract

- The selected-day panel heading uses `formatDateLabel` (FR-010).
- Each intake time in the day panel (via `IntakeLogCard`) uses `formatTime` (FR-009, FR-011) — see
  `date-utils.contract.md`.

## Responsiveness (FR-012, SC-006)

- At ~375 px: navigation controls wrap without horizontal scroll; calendar and day panel stack.
- At ~768 px+: calendar and day panel sit side-by-side as today.
