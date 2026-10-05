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
| past-due, fixed schedule | `<next scheduled date>` | Destructive badge "Past Due · was due `<date>`" with a warning icon |
| past-due, rolling schedule | no date | Destructive badge "Past Due · was due `<date>`" with a warning icon |
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
| Intake history failed | fully rendered | "Couldn't load schedule." and a "Retry" `Button`. Never "Not yet taken". Also one Sonner error toast, "Couldn't load schedule for some medications.", with the fixed id `schedule-load-error` |
| No Medications | existing empty state | — |

Retry re-runs only that card's failed queries. A failure on one card does not affect others.
The toast uses one fixed id, so any number of failing cards shows a single toast; the
in-card message is what tells the user which Medication is affected.

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
| Loading and error states, single error toast | `tests/components/medication-schedule.test.tsx` |
| Queries honoured by real Dataverse (`orderBy`, `top`, `select`) | live check in quickstart.md section C |
| 375 px and 768 px | manual check in quickstart.md |

## Visual QA record (tasks.md T049, 2026-10-05)

Run with the `visual-qa` skill against `npm run dev:mock`, driven by Playwright. Each state
was produced by switching the in-memory mock data or the mock intake-log service at page
load, not by changing application code. Evidence is 14 full-page screenshots and measured
values (kept locally under `.playwright-mcp/qa-004/`, which is not committed). No GIF was
recorded and no Gemini review was run: the browser tool used here offers neither.

| Check | Result |
|---|---|
| Content of all eight mock cards (upcoming, due today, Past Due fixed and rolling, as needed, "Reminders off", "Not yet taken", injection site, "Counted from last dose") | Pass |
| 375 px and 768 px, no horizontal scroll, nothing outside its card | Pass |
| Rows: label above value at 375 px, side by side at 768 px | Pass |
| Dark theme (the app default) and light theme | Pass |
| Text contrast, lowest value measured in a schedule section | Pass — 6.47:1 dark, 4.74:1 light |
| Icons hidden from assistive technology; section labelled "Schedule for `<name>`" | Pass |
| Intake history loading: card fully rendered, two skeleton rows, `aria-busy="true"`, no text | Pass |
| Intake history failed for one Medication: "Couldn't load schedule." and Retry on that card only, never "Not yet taken", the other seven cards unaffected, one toast | Pass |
| Intake history failed for every Medication: eight in-card messages, still one toast | Pass |
| Retry: 69×44 px, visible focus ring from the keyboard, re-runs only that card's two queries, recovers when the service does | Pass |
| No Medications: existing empty state, no schedule section | Pass |
| Active switch: "Reminders off" appears and the next intake date returns, with no reload | Pass |
| Long Medication name with spaces (100 characters) | Pass — wraps |
| Long Medication name with no spaces (135 characters) | **Failed, fixed** — see below |

**Finding (medium), fixed**: a name with no break opportunity ran out of the card and
pushed the Edit and Delete buttons out of reach at both widths. This was in the card header,
which predates this feature. `MedicationCard` now lets the name break anywhere and keeps the
buttons from shrinking; re-checked at 375 px and 768 px with the same name.

Not checked here: the queries against a real Dataverse endpoint (tasks.md T020).
