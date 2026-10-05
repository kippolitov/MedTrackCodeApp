# Contract: Schedule Section on the Medication Card

What the user sees at the bottom of each card on the Medications page. Covers FR-001 to
FR-013 and User Story 1. The rules that decide each value are in
[schedule-rules.contract.md](./schedule-rules.contract.md).

## Placement

- Rendered by `MedicationSchedule`, the last block inside `MedicationCard`, below the
  Active switch and divided from it by a `Separator`.
- Nothing above it changes: name, dosage, frequency badge, scheduled-day badge, method
  badge, Reminder Time, instructions, edit, delete and the Active switch keep their
  position and behaviour. The Active and Inactive sections and the alphabetical order of
  cards are unchanged.
- The section is a labelled region (`aria-label="Schedule for <medication name>"`).

## Content

Two rows, each a label and a value.

### Row 1 — Last taken

| Situation | Value |
|---|---|
| A Taken log exists, non-injection | `<date>, <time>` — for example "Sun, Oct 4, 8:30 AM" |
| A Taken log exists, Injection, site recorded | `<date>, <time> · <site>` — for example "Mon, Sep 28, 9:00 PM · Left Hip" |
| A Taken log exists, Injection, no site recorded | `<date>, <time>` |
| No Taken log | "Not yet taken" |

This row is shown for every Medication, including Inactive and As-Needed ones.

### Row 2 — Next intake

| Kind / status | Value | Marker (icon + text, never colour alone) |
|---|---|---|
| upcoming | `<date>` — for example "Wed, Oct 7" | none |
| due-today | `<date>` | Badge "Due today" with a calendar-check icon |
| overdue, fixed schedule | `<next scheduled date>` | Destructive badge "Overdue · was due `<date>`" with a warning icon |
| overdue, rolling schedule | no date | Destructive badge "Overdue · was due `<date>`" with a warning icon |
| as-needed | "As needed" | none |
| unscheduled | "Not scheduled" | none |
| inactive | "Reminders off" with a bell-off icon | none |

For a rolling-schedule Medication the row also carries the hint "Counted from last dose".

### Formatting

- Dates: `formatDateLabel(date, { weekday: 'short', month: 'short', day: 'numeric' })`.
  The year is added only when it differs from the current year.
- Times: `formatTime(date)`, so 12-hour or 24-hour follows the user's locale.
- Sites: `getSiteLabel(site)`.
- All values are in the browser's local time zone.

## States

| State | Card | Schedule section |
|---|---|---|
| Medications loading | existing behaviour | not rendered |
| Intake history loading | fully rendered | two `Skeleton` rows, `aria-busy="true"` |
| Loaded | fully rendered | rows above |
| Intake history failed | fully rendered | "Couldn't load schedule." and a "Retry" `Button`. Never "Not yet taken" |
| No Medications | existing empty state | — |

Retry re-runs only that card's failed queries. A failure on one card does not affect others.

## Behaviour

- **Active switch**: turning a Medication Inactive replaces Row 2 with "Reminders off" as
  soon as the update succeeds and the card moves to the Inactive section; turning it
  Active restores the next intake date. No reload.
- **Freshness**: values are recalculated whenever the Medications page is shown. A log
  created, edited or deleted anywhere in the app is reflected on the next visit without a
  manual refresh.
- **Read-only**: the section has no actions other than Retry in the error state.
- **Day rollover**: the section uses the date at the time the page is rendered. A page
  left open across midnight updates on its next data refresh.

## Layout and accessibility

- Usable at 375 px and 768 px with no horizontal scroll. Each row wraps: label above
  value on narrow widths, side by side from the `sm` breakpoint.
- Text contrast ≥ 4.5:1 using existing design tokens only. No inline colour literals.
- Icons are decorative (`aria-hidden`); the badge text carries the meaning.
- The Retry button has a touch target of at least 44×44 px and a visible focus ring.

## Data the section depends on

| Query | Service call | Key |
|---|---|---|
| Latest Taken log | `Ppa_intakelogsService.getAll` — select `ppa_intakelogid`, `ppa_loggedat`, `ppa_status`, `ppa_injectionsite`, `_ppa_medication_value`; filter by Medication, status Taken, `ppa_loggedat le <now>`; `orderBy ['ppa_loggedat desc']`; `top 1` | `['intakelogs', 'latest', medicationId, 'taken']` |
| Latest Skipped log | same, status Skipped | `['intakelogs', 'latest', medicationId, 'skipped']` |

Both return arrays (zero or one item) and use `staleTime` 30 s.

## Acceptance mapping

| Spec scenario (User Story 1) | Verified by |
|---|---|
| 1, 3, 4, 8, 9, 11, 12 | `tests/components/medication-schedule.test.tsx` |
| 2 (injection site) | `tests/components/medication-schedule.test.tsx` |
| 5, 6, 7 (rolling vs fixed dates) | `tests/lib/schedule.test.ts` rows S10, S19, S28 |
| 10 (switch to Active) | `tests/pages/medications.test.tsx` |
| 13 (reflects a new log) | `tests/hooks/use-medication-schedule.test.tsx` |
| Loading and error states | `tests/components/medication-schedule.test.tsx` |
| 375 px and 768 px | manual check in quickstart.md |
