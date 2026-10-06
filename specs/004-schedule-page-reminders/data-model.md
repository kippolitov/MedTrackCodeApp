# Phase 1 Data Model: Medication Schedule Details & Daily Email Reminder

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-05

This feature reads two existing tables, adds one table, two environment variable
definitions and two connection references, and introduces derived (unstored) shapes in the
app. Table name, column types and ownership type are permanent in Dataverse; the choices
below were checked against `.claude/skills/dataverse-web-api/resources/dataverse-design-rules.md`.

---

## 1. Existing tables (read only — no schema change)

### `ppa_medication`

| Column | Used for |
|---|---|
| `ppa_medicationid` | Key; filter on intake logs |
| `ppa_name`, `ppa_dosage` | Reminder content |
| `ppa_method` | `894250001` Injection → rolling schedule; all others → fixed |
| `ppa_frequency` | `894250000` Daily (1 day), `894250001` Weekly (7), `894250002` Biweekly (14), `894250003` As-Needed (never due) |
| `ppa_scheduledday` | Fixed-schedule weekday for Weekly and Biweekly (`894250000` Monday … `894250006` Sunday) |
| `ppa_startdate`, `createdon` | Biweekly anchor (`ppa_startdate`, else `createdon`); also the earliest date an intake can count as missed |
| `ppa_remindertime` | Shown in the reminder (`HH:mm`) |
| `ppa_isactive` | The only reminder switch (FR-015) |
| `statecode` | `0` only; Archived rows are excluded |
| `_ownerid_value` | Flow filter: the connection user's own Medications (research R11) |

### `ppa_intakelog`

| Column | Used for |
|---|---|
| `_ppa_medication_value` | Filter per Medication |
| `ppa_status` | `894250000` Taken, `894250001` Skipped, `894250002` Missed |
| `ppa_loggedat` | The date and time of the intake (research R3) |
| `ppa_injectionsite` | Shown beside last taken for Injection Medications |

The app never writes either table for this feature; the flow never writes them at all (FR-027).

---

## 2. New table: `ppa_ReminderRun`

One row per local calendar day on which the daily check ran. It is both the idempotency
guard (FR-020) and the owner-visible record of the outcome (FR-021).

| Property | Value | Note |
|---|---|---|
| Schema name | `ppa_ReminderRun` | Logical `ppa_reminderrun`, set `ppa_reminderruns` |
| Display name | Reminder Run / Reminder Runs | |
| Ownership | **User-owned** | Permanent. Matches the other two tables; rows belong to the flow's connection user |
| Primary name | `ppa_name` (Text, 10) | The local run date as `yyyy-MM-dd`. Required |
| Alternate key | `ppa_reminderrun_date` on `ppa_name` | Duplicate create fails → "already ran today" |
| Auditing | Off | |
| Activities / notes / attachments | Off | Permanent choice; not needed |

### Columns

| Schema name | Type | Required | Purpose |
|---|---|---|---|
| `ppa_name` | Text (10) | Yes | Local run date, `yyyy-MM-dd`. Sorts chronologically as text |
| `ppa_Outcome` | Choice (local) | Yes | See values below |
| `ppa_DueCount` | Whole number (0–1000) | Yes | Medications listed as due today |
| `ppa_FollowUpCount` | Whole number (0–1000) | Yes | Medications listed as follow-ups |
| `ppa_Summary` | Multiline text (4000) | No | Names of the Medications listed, in two labelled groups. Used by acceptance checks |
| `ppa_ErrorStep` | Text (200) | No | Name and status code of the step that failed. **Never** raw connector error text (research R9) |
| `ppa_Attempts` | Whole number (1–24) | Yes | 1 on first run, +1 on each retry after a failure |

No date-typed duplicate of `ppa_name` is added: it would hold the same fact twice.
No column ever holds the reminder address.

### `ppa_Outcome` values

| Value | Label | Meaning |
|---|---|---|
| `894250000` | Started | Row created; work in progress or interrupted |
| `894250001` | Sent | Message accepted by the connector |
| `894250002` | Nothing To Send | Nothing due and no follow-up owed |
| `894250003` | Failed | The check or the send failed **before** a message was accepted |

### State transitions

```text
(no row) ──create──▶ Started ──nothing listed──▶ Nothing To Send   (final)
                        │
                        ├─message accepted─▶ Sent                  (final)
                        │
                        └──error before send accepted──▶ Failed ──retry (next hourly run)──▶ Started
```

- A later run on the same day proceeds **only** when the existing row is `Failed`.
- `Started`, `Sent` and `Nothing To Send` all end a later run immediately.
- A row stuck at `Started` means a run was interrupted after it may have sent. It is not
  retried, which keeps the guarantee at "never two messages" rather than "always one".
- Retries stop after the 03:00 local run (research R5); the row then stays `Failed`.

### Validation rules

- `ppa_name` matches `^\d{4}-\d{2}-\d{2}$` (enforced by the flow that writes it; the
  alternate key enforces uniqueness).
- `ppa_DueCount + ppa_FollowUpCount = 0` when the outcome is `Nothing To Send`, and `> 0`
  when it is `Sent`.
- `ppa_ErrorStep` is set only when the outcome is `Failed`.

### Retention

Rows are small and one per day (about 365 a year). No clean-up job is planned.

---

## 3. Environment variables (definitions only in the solution)

| Schema name | Type | Default in solution | Current value | Purpose |
|---|---|---|---|---|
| `ppa_ReminderTimeZone` | Text | `UTC` | Set per environment through the deployment settings file | Windows time zone name that defines "today" and "midnight" (FR-014) |
| `ppa_MedTrackAppUrl` | Text | `not-configured` | Set per environment through the deployment settings file, from the environment id and app id | Address of the app, added to the reminder as a link; the link is left out unless the value starts with `https://` |

Rule: `solution/src` must never contain an `environmentvariablevalues.json` file. CI
enforces this (research R9).

Removed on 2026-10-05: `ppa_ReminderRecipientEmail`. The reminder became a Teams message to
the Dataverse connection's own user, so there is no address to store (research R7, R8).

---

## 4. Connection references

| Schema name | Connector | Used for |
|---|---|---|
| `ppa_MedTrackDataverse` | Microsoft Dataverse (`shared_commondataserviceforapps`) | List Medications and Intake Logs, create/update Reminder Run, read the connection's own user |
| `ppa_MedTrackTeams` | Microsoft Teams (`shared_teams`) | Post the reminder to the owner as the Flow bot |

Connections are created by the owner in each environment and are never source-controlled.
Their ids reach the import step through GitHub Environment variables (see
[contracts/privacy-and-deployment.contract.md](./contracts/privacy-and-deployment.contract.md)).

---

## 5. Derived shapes in the app (not stored)

Defined in `src/lib/schedule.ts`. They extend, and never copy, the generated Dataverse types.

### `ScheduleKind`

`'rolling' | 'fixed' | 'as-needed' | 'inactive' | 'unscheduled'`

| Kind | When |
|---|---|
| `inactive` | `ppa_isactive` is false (checked first) |
| `as-needed` | Frequency is As-Needed |
| `rolling` | Method is Injection **and** a Taken or Skipped log exists |
| `fixed` | Everything else with a determinable schedule |
| `unscheduled` | Weekly/Biweekly with neither a scheduled day nor an anchor, and no log |

### `ScheduleDetails`

| Field | Type | Meaning |
|---|---|---|
| `kind` | `ScheduleKind` | Above |
| `lastTaken` | `{ at: Date; site?: injection-site value } \| null` | Latest Taken log not in the future (FR-003, FR-004) |
| `nextIntake` | `Date \| null` | Local start-of-day of the next intake; null for `inactive`, `as-needed`, `unscheduled`, and while Past Due on the rolling schedule |
| `status` | `'due-today' \| 'past-due' \| 'upcoming' \| 'none'` | Drives the visual state (FR-009, FR-010) |
| `missedDueDate` | `Date \| null` | The date the missed intake was due (FR-008, FR-009) |
| `daysPastDue` | `number \| null` | Whole days since `missedDueDate` |
| `followUpDue` | `boolean` | True when `daysPastDue` is 1, 3, 5 or 7. Not shown in the UI; exists so the module and the flow are tested against the same table (FR-022) |

### Inputs to the calculation

`computeSchedule(medication, { lastTaken, lastSkipped }, today)` — a pure function. `today`
is passed in, never read from the clock inside the module, so every rule is testable.

---

## 6. Relationships

```text
systemuser ──owns──▶ ppa_medication ──1:N──▶ ppa_intakelog
systemuser ──owns──▶ ppa_reminderrun              (no lookup to medication)
```

`ppa_reminderrun` deliberately has no lookup to `ppa_medication`. A run covers many
Medications, and a lookup would block deleting a Medication that once appeared in a
reminder. Names are recorded as text in `ppa_Summary` instead.

---

## 7. Security model

| Principal | `ppa_medication` | `ppa_intakelog` | `ppa_reminderrun` | Environment variables |
|---|---|---|---|---|
| App user (the owner, in the Code App) | unchanged | unchanged | none required — the app does not read this table | — |
| Flow's Dataverse connection (the owner's, shared with the service principal) | Read (own rows) | Read (own rows) | Create, Read, Write (own rows) | Read definition and value |
| Deployment service principal (owns the flow) | unchanged | unchanged | schema only (import) | definition only (import) |

- The service principal owns the flow but the flow's data access is the owner's: every
  Dataverse action runs through the owner's connection, so it sees the owner's rows only.
- No security role is source-controlled in `solution/src` today. The privileges on
  `ppa_reminderrun` are added to whichever role already grants the owner access to
  `ppa_medication` and `ppa_intakelog`. If that role is System Administrator or System
  Customizer, no change is needed. Identifying it is a setup task; no new role is built
  from scratch.
- No column-level security: the table holds no secret. The reminder address is not in it.
- Health information (Medication names) is stored in `ppa_Summary` at user level, the same
  exposure as the Medication rows themselves.
