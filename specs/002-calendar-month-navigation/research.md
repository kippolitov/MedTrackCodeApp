# Phase 0 Research: Calendar Month/Year Navigation & Localized Time

**Feature**: 002-calendar-month-navigation | **Date**: 2026-06-25

This document resolves the open questions from the spec's Assumptions and the plan's Technical
Context. All items are resolved — no remaining NEEDS CLARIFICATION.

---

## R1. Source of user locale and time zone

**Decision**: Derive locale from the **browser** via `Intl.DateTimeFormat().resolvedOptions().locale`
(falling back to `navigator.language`, then a hardcoded `'en-US'`). Time zone uses the browser's
local zone implicitly (JS `Date` already renders in local time). The "use AM/PM vs 24-hour" choice
is delegated to `Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' })`, which picks
`hour12` automatically per locale.

**Rationale**: The Power Apps SDK `IContext` (`node_modules/@microsoft/power-apps/dist/app/App.Types.d.ts`)
exposes only `app`, `host.sessionId`, and `user` identity fields (`fullName`, `objectId`, `tenantId`,
`userPrincipalName`). **There is no locale or time-zone field**, so the host cannot be the locale
source. The browser locale is already authoritative for a web SPA and requires no extra round-trip.
Letting `Intl` decide `hour12` avoids hand-maintaining a list of which countries use AM/PM.

**Alternatives considered**:
- *Power Apps host context* — rejected: field does not exist in the SDK type.
- *A user-facing locale setting in the app* — rejected: spec assumption states no new locale-selection
  UI; over-engineered for this increment.
- *Hand-rolled country→format map (e.g., only `en-US`/`en-CA`/... = 12-hour)* — rejected: `Intl`
  already encodes this correctly and stays current; a manual map would drift.

**Ambiguous-locale fallback**: When `Intl` cannot resolve a locale, fall back to `'en-US'`. The spec
allows a single defined default; `Intl`'s own per-locale `hour12` resolution is preferred over a blanket
24-hour rule, but the documented default remains deterministic.

---

## R2. Month + year navigation control

**Decision (updated twice after UX review)**: Use a **custom header** — previous/next month arrow
buttons flanking **two separate label buttons** (month and year). The `react-day-picker` grid is kept
(with `hideNavigation` and its built-in caption hidden via `month_caption: 'hidden'`); navigation drives
the existing `month` / `onMonthChange` controlled state. The arrows step one month (date-fns
`addMonths`/`subMonths`) and disable at the bounded range edges.

Tapping the **month** label opens a month picker overlay; tapping the **year** label opens a year picker
overlay (`MonthYearPicker` with a `mode` prop, built on the shadcn `Popover` and **anchored directly
beneath the clicked label**). Each overlay renders a grid of **12 pills** (no bullets, no scrollbar) and
**auto-closes** on selection:
- *Month overlay*: 12 month pills (Jan–Dec), no paging (the full set fits).
- *Year overlay*: 12 year pills per page with **top ‹ / › paging arrows** that move through 12-year
  blocks within the bounded range; the page containing the viewed year is shown first.

The standalone "Today" button is retained.

**Rationale (this iteration)**: The maker preferred separate, self-contained month and year choosers
(each auto-closing) over a single side-by-side panel, and pills + paging arrows over bullet lists with a
scrollbar. Paged pills keep each overlay compact regardless of how wide the year range is.

**Rationale**: An earlier iteration used react-day-picker's `captionLayout="dropdown"`, but the maker
found the native dropdowns visually unsatisfactory and wanted arrow-based stepping with a richer
selection surface. A custom header + anchored Popover overlays give full control over styling (Tailwind
tokens, WCAG AA contrast, ≥44 px targets), keep a single calendar library (Principle IV), and reuse the
existing shadcn `Popover` (Principle III). It still satisfies FR-001/002/003, FR-007 (rollover handled
by date-fns arithmetic), and FR-008 (bounded year list).

**Alternatives considered**:
- *react-day-picker `captionLayout="dropdown"`* — implemented first; rejected on UX grounds (native
  `<select>` styling, and a rendering quirk where the value doubled when the select was themed opaque).
- *Custom shadcn `Select` dropdowns* — viable but still a dropdown UX; the bullet overlay was preferred.
- *Prev/next year arrows only* — rejected: fails "jump directly to any year" (FR-003) and SC-001.

**Accessibility note**: Each overlay is a `role="group"` (labeled "Month"/"Year") of toggle `<button>`
pills using `aria-pressed` for the selected state — buttons are natively Tab-focusable and Enter/Space
operable. (An earlier `role="listbox"`/`role="option"` version was dropped because it implied roving
arrow-key focus that wasn't implemented.) The Popover is non-modal, so the rest of the page stays
accessible while it is open (tests query pills by `group`/`button`, not a dialog role).

---

## R3. Bounded year range

**Decision (updated)**: Offer years from **(currentYear − 20)** to **(currentYear + 3)**, computed at
render time via `getCalendarBounds()`. This 24-year window also bounds the header month-stepping arrows.

**Rationale**: The year picker now pages through 12-year blocks, so a slightly wider window is desirable
to make paging meaningful (24 years = two full pages) while staying bounded (FR-008). Twenty years of
history comfortably covers any realistic adherence record; three years forward covers planning. The
window is two named constants (`YEARS_BACK`, `YEARS_FORWARD`) so it can be tuned without touching logic.
(The earlier 7-year window — currentYear−5..+1 — was widened when the year chooser became a paged grid.)

**Alternatives considered**:
- *Anchor lower bound to the earliest intake-log date* — more precise, but requires an extra query/derivation
  and the earliest log isn't loaded up front; deferred as a possible future enhancement.
- *Unbounded range* — rejected by FR-008 and the spec edge case.

---

## R4. Selected-day behavior when the month changes

**Decision**: When the viewed month changes (via dropdown, arrows, or "Today"), **do not auto-select** an
out-of-month day. The day-detail panel only renders when `selectedDate` falls within the viewed month;
otherwise it shows the empty state. "Today" explicitly re-selects the current day (FR-006). This keeps the
existing `selectedDate` state but guards the panel against showing a day outside the grid.

**Rationale**: Matches the spec edge case "Selected day persistence" — predictable and consistent: changing
months never shows stale out-of-month detail. Avoids surprising auto-jumps of selection.

**Alternatives considered**:
- *Auto-select the 1st of the newly viewed month* — rejected: implies a logged selection the user didn't make.
- *Clear selection on every month change* — acceptable but slightly more disruptive than guarding the panel;
  guarding preserves selection when navigating back to the original month within the session.

---

## R5. Localized time/date formatting implementation

**Decision**: Add to `src/lib/date-utils.ts`:
- `resolveLocale(): string` — browser locale with `'en-US'` fallback.
- `formatTime(date: Date, locale?: string): string` — `Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' })`.
- `formatDateLabel(date: Date, opts, locale?): string` — locale-aware date headings (replaces hardcoded
  `date-fns` format strings for user-visible labels where localization is required).

Replace the manual `HH:mm` in `intake-log-card.tsx` and align `medication-card.tsx`'s reminder-time display
to the same helper.

**Rationale**: `Intl.DateTimeFormat` is the correct, dependency-free primitive for locale-aware time and
correctly handles noon (`12:00 PM` / `12:00`) and midnight (`12:00 AM` / `00:00`) edge cases (spec edge case
"Midnight / noon edge times"). Centralizing in `date-utils.ts` removes the existing 12-hr/24-hr duplication
(Principle I, no-duplication). `date-fns` is retained for date math (`startOfMonth`, etc.) and for
non-localized internal keys (e.g., `yyyy-MM-dd` map keys), which must stay locale-independent.

**Alternatives considered**:
- *`date-fns` `format` with locale objects (`date-fns/locale`)* — rejected for time format: would require
  importing and selecting locale bundles and still relies on per-locale format tokens; `Intl` is lighter and
  picks `hour12` automatically. `date-fns` remains for date arithmetic.
- *Keep formatting inline in each component* — rejected: re-creates the current duplication/inconsistency.

---

## Testing approach (Phase 0 confirmation)

- **Locale unit tests** (`tests/lib/date-utils.test.ts`): exercise `formatTime` by passing explicit `locale`
  args (`'en-US'` → AM/PM, `'en-GB'`/`'de-DE'` → 24-hr) rather than mutating global `navigator`, keeping tests
  deterministic. Include noon and midnight cases.
- **Navigation tests** (`tests/pages/calendar.test.tsx`): render the page with MSW-backed `useIntakeLogs`,
  assert prev/next/today behavior, year selection, December→January rollover, and the empty-month state.
- No trivially-passing assertions (Principle II).
