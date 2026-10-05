# Contract: Schedule Rules

The single definition of when a Medication is next due, when an intake is missed, and when
a follow-up is owed. `src/lib/schedule.ts` and the "MedTrack – Daily Reminder" flow must
both produce the outcomes in the decision table below. Covers FR-003 to FR-009, FR-015 to
FR-017, FR-022 to FR-024, FR-026.

## Terms

| Term | Definition |
|---|---|
| `today` | The current calendar date in the owner's local time zone |
| local day of a log | The calendar date of its `ppa_loggedat` in the same time zone |
| `interval` | Daily 1 day, Weekly 7 days, Biweekly 14 days |
| `lastTaken` | Latest log with status Taken and `ppa_loggedat` not in the future |
| `lastSkipped` | Latest log with status Skipped and `ppa_loggedat` not in the future |
| `lastResolved` | The later of `lastTaken` and `lastSkipped` |
| `anchor` | Local day of `ppa_startdate`, or of `createdon` when no start date is set |

Logs with status Missed are ignored by every rule.

## Step 1 — Kind (first match wins)

1. `ppa_isactive` is false → **inactive**
2. Frequency is As-Needed → **as-needed**
3. Method is Injection and `lastResolved` exists → **rolling**
4. Weekly with no scheduled day; or Biweekly with neither a scheduled day nor an anchor → **unscheduled**
5. Otherwise → **fixed**

Inactive, as-needed and unscheduled Medications have no next intake date, are never
Overdue, and are never emailed.

## Step 2 — Rolling schedule (Injection)

`due = localDay(lastResolved) + interval`

| Condition | Status | Next intake | Missed due date |
|---|---|---|---|
| `due > today` | upcoming | `due` | — |
| `due = today` | due-today | `today` | — |
| `due < today` | overdue | none shown | `due` |

## Step 3 — Fixed schedule (everything else)

`isScheduledOn(medication, d)`:

| Frequency | Scheduled on `d` when |
|---|---|
| Daily | always |
| Weekly | weekday of `d` equals the scheduled day |
| Biweekly | `d ≥ anchor`, **and** `floor((d − anchor) / 7 days)` is even, **and** weekday of `d` equals the scheduled day (or the anchor's weekday when none is set) |

Then:

- **Due today** when `isScheduledOn(today)` and there is no `lastResolved` on `today`.
- **Next intake** is `today` when due today; otherwise the first scheduled date after `today`.
- **Previous due date** is the most recent scheduled date before `today` that is not
  earlier than `anchor`.
- **Missed** when a previous due date exists and there is no `lastResolved` on or after it.
- **Status**: due-today wins; otherwise overdue when missed; otherwise upcoming.

## Step 4 — Follow-up

`daysOverdue = today − missed due date`, in whole days.

A follow-up is owed when status is **overdue** and `daysOverdue` is **1, 3, 5 or 7**.
No follow-up is owed on any other day, and none after day 7.

A Medication that is due today is listed as due today and never as a follow-up.

## Decision table

`today` is **Monday 5 October 2026**. Unless a row says otherwise the Medication is Active,
was created on 1 September 2026, and has no Skipped or Missed logs.
"Email" is what the daily check does with the Medication on this day.

### Fixed schedule

| # | Medication | Logs | Status | Next intake | Missed due · days | Email |
|---|---|---|---|---|---|---|
| S01 | Daily pill | Taken 4 Oct | due-today | 5 Oct | — | Due |
| S02 | Daily pill | Taken 5 Oct 07:00 | upcoming | 6 Oct | — | — |
| S03 | Daily pill | none | due-today | 5 Oct | — | Due |
| S04 | Weekly pill, Monday | Taken 28 Sep | due-today | 5 Oct | — | Due |
| S05 | Weekly pill, Wednesday | Taken 30 Sep | upcoming | 7 Oct | — | — |
| S06 | Weekly pill, Sunday | Taken 27 Sep | overdue | 11 Oct | 4 Oct · 1 | Follow-up |
| S07 | Weekly pill, Saturday | Taken 26 Sep | overdue | 10 Oct | 3 Oct · 2 | — |
| S08 | Weekly pill, Friday | Taken 25 Sep | overdue | 9 Oct | 2 Oct · 3 | Follow-up |
| S09 | Weekly pill, Wednesday | Taken 23 Sep | overdue | 7 Oct | 30 Sep · 5 | Follow-up |
| S10 | Weekly pill, Wednesday | Taken Fri 2 Oct (late) | upcoming | 7 Oct | — | — |
| S11 | Weekly pill, Sunday | Taken 27 Sep, Skipped 4 Oct | upcoming | 11 Oct | — | — |
| S12 | Biweekly pill, Monday, start 21 Sep | Taken 21 Sep | due-today | 5 Oct | — | Due |
| S13 | Biweekly pill, Monday, start 28 Sep | none | overdue | 12 Oct | 28 Sep · 7 | Follow-up |
| S14 | Biweekly pill, Sunday, start 27 Sep | none | overdue | 11 Oct | 27 Sep · 8 | — |
| S15 | Biweekly pill, Thursday, start 28 Sep | none | overdue | 15 Oct | 1 Oct · 4 | — |
| S16 | Weekly pill, Sunday, created 5 Oct | none | upcoming | 11 Oct | — | — |
| S17 | Daily pill | Taken 4 Oct, Taken 6 Oct (future-dated) | due-today | 5 Oct | — | Due |

### Rolling schedule (Injection with at least one Taken or Skipped log)

| # | Medication | Logs | Status | Next intake | Missed due · days | Email |
|---|---|---|---|---|---|---|
| S18 | Weekly injection | Taken 28 Sep | due-today | 5 Oct | — | Due |
| S19 | Weekly injection | Taken Fri 2 Oct | upcoming | 9 Oct | — | — |
| S20 | Weekly injection | Taken Sat 3 Oct (early) | upcoming | 10 Oct | — | — |
| S21 | Biweekly injection | Taken 20 Sep | overdue | none | 4 Oct · 1 | Follow-up |
| S22 | Weekly injection | Taken 26 Sep | overdue | none | 3 Oct · 2 | — |
| S23 | Weekly injection | Taken 21 Sep | overdue | none | 28 Sep · 7 | Follow-up |
| S24 | Weekly injection | Taken 20 Sep | overdue | none | 27 Sep · 8 | — |
| S25 | Weekly injection | Taken 14 Sep, Skipped 28 Sep | due-today | 5 Oct | — | Due |
| S26 | Weekly injection | Taken 21 Sep, Missed 28 Sep | overdue | none | 28 Sep · 7 | Follow-up |
| S27 | Daily injection | Taken 4 Oct | due-today | 5 Oct | — | Due |
| S28 | Biweekly injection | Taken 1 Oct | upcoming | 15 Oct | — | — |

### No schedule

| # | Medication | Logs | Kind | Card shows | Email |
|---|---|---|---|---|---|
| S29 | Weekly injection, Monday | none | fixed (no log yet) | due-today, 5 Oct | Due |
| S30 | As-Needed pill | Taken 1 Oct | as-needed | "As needed" | — |
| S31 | Weekly pill, Monday, **Inactive** | Taken 21 Sep | inactive | last taken 21 Sep, "Reminders off" | — |
| S32 | Weekly injection, **Inactive** | Taken 14 Sep | inactive | last taken 14 Sep, "Reminders off" | — |
| S33 | Weekly pill, no scheduled day | none | unscheduled | "Not scheduled" | — |

In every row, last taken is the latest Taken log that is not in the future (S11 and S25
show the Taken log, not the Skipped one; S17 shows 4 Oct), or "Not yet taken".

## Expected email for the full table on this day

- **Due today (9)**: S01, S03, S04, S12, S17, S18, S25, S27, S29
- **Follow-ups (7)**: S06, S08, S09, S13, S21, S23, S26
- **Not listed (17)**: every other row

## How the two implementations are held to this table

- `tests/fixtures/schedule-cases.ts` contains one case per row, keyed by the row number.
  `tests/lib/schedule.test.ts` asserts status, next intake, missed due date, days overdue
  and follow-up for every case.
- `scripts/reminder/seed-reminder-scenarios.ps1` creates the same rows in the dev
  environment with every date shifted so that the table's "5 Oct" is the day the script is
  run, and names each Medication with its row number. The `ppa_Summary` of that day's
  Reminder Run must list exactly the row numbers marked Due and Follow-up above.
- A change to any rule changes this table first, then both implementations.
