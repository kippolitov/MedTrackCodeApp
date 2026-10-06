---

description: "Task list for Medication Schedule Details & Daily Email Reminder"
---

# Tasks: Medication Schedule Details & Daily Email Reminder

**Input**: Design documents from `/specs/004-schedule-page-reminders/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Included. The constitution (Principle II) makes tests-first mandatory, and plan.md defines them. App code is covered by Vitest; the cloud flow is covered by seeding the decision table into dev and asserting on the day's `ppa_ReminderRun` row.

**Organization**: Tasks are grouped by user story in priority order. US1 needs no cloud components. US3 extends the flow built in US2, so it depends on US2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: Which user story the task belongs to (US1, US2, US3)
- **(owner)**: A manual step only the repository owner can do
- Paths are relative to the repository root.

## Path Conventions

Single-project web app (existing structure). New paths added by this feature:
`src/lib/schedule.ts`, `src/hooks/use-medication-schedule.ts`,
`src/components/medications/medication-schedule.tsx`, `tests/fixtures/`, `tests/hooks/`,
`scripts/reminder/`, `solution/src/Entities/ppa_ReminderRun/`, `solution/src/Workflows/`.

## Rule for every task

No real personal address is ever typed into a file, a script argument, a commit message,
a branch name, an issue or a pull request. The only example address in this repository is
`reminder@example.com`.

## Change of delivery channel (2026-10-05)

The reminder is now a **Microsoft Teams message** to the user behind the Dataverse
connection, not an email (research R7). Tasks below were written for email; where one
says "email", read "reminder message". What that changed in the task list:

- T026, T029, T032 (recipient part): the variable `ppa_ReminderRecipientEmail`, the script
  `set-reminder-recipient.ps1` and the `ValidateRecipient` step were built, used, and then
  removed. There is no address to set.
- T028, T051: the second connection is Microsoft Teams, and the GitHub variable is
  `PP_CONN_TEAMS_ID`.
- T033: the send step is Teams *Post message in a chat or channel* (`SendReminder`),
  preceded by a lookup of the connection's own user (`Me`). The message ends with a link to
  the app, from the new variable `ppa_MedTrackAppUrl`.
- T035, T047: the solution source is at version 1.0.0.4 with the Teams version of the flow.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffolding shared by every later phase.

- [X] T001 Add the line `solution/deployment-settings.json` to `.gitignore` next to the existing `power.config.json` entry (the new folders `scripts/reminder/` and `tests/fixtures/` are created by the first task that adds a file to them)
- [X] T002 [P] Add five terms to `CONTEXT.md` in the existing format (bold term, definition, `_Avoid_` line): **Past Due** (a Medication with a Missed Intake from an earlier day, shown on its card; _Avoid_: Overdue — Overdue is a Dose due today whose Reminder Time has passed), **Next Intake** (the date a Medication is next due; rolling from the last Taken or Skipped log for Injection, fixed schedule otherwise), **Missed Intake** (a due date that ended with no Taken or Skipped Intake Log — derived, distinct from the Missed status the user records), **Follow-up** (a reminder on the 1st, 3rd, 5th or 7th day after a Missed Intake), **Reminder Run** (one row per day recording the daily check's outcome)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The corrected fixed-schedule rule, the guard that keeps email addresses out of the repository, and the single decision table every story is tested against.

**⚠️ CRITICAL**: Complete before any user story work.

- [X] T003 Fix the Biweekly rule: add `isScheduledOn(med, date)` to `src/lib/schedule.ts` (one Dose per even seven-day block from the anchor; date-only `ppa_startdate` read as its calendar day), make `scheduledDosesOnDay` in `src/lib/adherence.ts` call it, remove the unused `weeksBetween` from `src/lib/date-utils.ts`, with three regression tests in `tests/lib/adherence.test.ts` (done 2026-10-05, commit `d209dba`)
- [X] T004 Add a custom rule `email-address` to `.gitleaks.toml` that flags `local@domain.tld` strings, with an allowlist for `example.com`, `example.org`, `users.noreply.github.com` and `noreply@anthropic.com`, and with the pattern written so it does **not** match OData annotations (`…@odata.bind`, `@odata.`, `@OData.`, `@Microsoft.`) or `git@github.com` (research R9)
- [X] T005 Run `gitleaks dir . --config .gitleaks.toml` and `gitleaks git --config .gitleaks.toml` locally; refine the rule in `.gitleaks.toml` until both report zero `email-address` findings on the current tree and history. Allowlist only strings that are not real addresses; never allowlist a real one
- [X] T006 [P] Create `tests/fixtures/schedule-cases.json`: one object per row S01–S33 of `specs/004-schedule-page-reminders/contracts/schedule-rules.contract.md`, with every date as a day offset from "today" (the table's 5 Oct = 0; created 1 Sep = -34) and every weekday as an offset too (`scheduledDayOffset: -1` = the weekday of yesterday), so the same file works for any real "today". Fields: `id`, `label`, `method`, `frequency`, `active`, `scheduledDayOffset`, `startDateOffset`, `createdOffset`, `logs[] {status, dayOffset, time, site}`, and `expect {kind, status, nextIntakeOffset, missedDueOffset, daysPastDue, followUpDue, lastTakenOffset, email: "due" | "follow-up" | "none"}`

**Checkpoint**: The fixed schedule is correct, CI can reject a committed address, and the decision table exists as data.

---

## Phase 3: User Story 1 - See each medication's schedule on its card (Priority: P1) 🎯 MVP

**Goal**: Every card on the Medications page ends with a schedule section showing last taken (with injection site), next intake, and a due-today or Past Due marker.

**Independent Test**: With Medications of each kind set up, open the Medications page and confirm every card shows the correct last taken date/time, site, and next intake date; log an injection late and see its next date move while a weekly pill's does not. No cloud flow is needed.

### Tests for User Story 1 ⚠️

> Write these first and confirm they fail before implementing (T011).

- [X] T007 [P] [US1] Create `tests/lib/schedule.test.ts`: import `tests/fixtures/schedule-cases.json`, fix `today` at local 2026-10-05, build a Medication and its latest Taken/Skipped logs from each case, call `computeSchedule(medication, { lastTaken, lastSkipped }, today)` and assert `kind`, `status`, `nextIntake`, `missedDueDate`, `daysPastDue`, `followUpDue` and `lastTaken` for all 33 rows; add named tests that Missed-status logs are ignored and that kind precedence is inactive → as-needed → rolling → unscheduled → fixed
- [X] T008 [P] [US1] Create `tests/hooks/use-medication-schedule.test.tsx` using the existing `vi.mock('@/generated/services/Ppa_intakelogsService', …)` pattern: assert `getAll` is called twice per Medication with `select` = `ppa_intakelogid, ppa_loggedat, ppa_status, ppa_injectionsite, _ppa_medication_value`, a `filter` containing the Medication id, the status (`894250000` Taken / `894250001` Skipped) and `ppa_loggedat le`, `orderBy: ['ppa_loggedat desc']`, `top: 1`; that results are cached as arrays under keys `['intakelogs','latest',id,'taken'|'skipped']`; that a rejected call surfaces `isError` and a working `refetch`; and that invalidating `['intakelogs']` refetches both
- [X] T009 [P] [US1] Create `tests/components/medication-schedule.test.tsx` covering every row of the Content and States tables in `specs/004-schedule-page-reminders/contracts/ui-medication-schedule.contract.md`: last taken with and without a site, "Not yet taken", upcoming date, "Due today" badge, "Past Due · was due <date>" for fixed (with next date) and rolling (no date), "Counted from last dose" hint, "As needed", "Not scheduled", "Reminders off", two `Skeleton` rows with `aria-busy`, and the error text with a Retry button that calls refetch and never shows "Not yet taken"; with `sonner` mocked, a failed load calls `toast.error` with the fixed id `schedule-load-error`, so two failing cards rendered together raise one toast, not two
- [X] T010 [US1] Extend `tests/pages/medications.test.tsx`: add a `vi.mock` for `Ppa_intakelogsService` with a default `getAll` resolving `{ data: [], success: true }` so the existing tests still pass, then add acceptance tests that each card renders a region labelled `Schedule for <name>` as its last block, that a card in the Inactive section reads "Reminders off", and that switching Inactive → Active shows a next intake date without a reload
- [X] T011 [US1] Run `npm run test -- tests/lib/schedule.test.ts tests/hooks tests/components/medication-schedule.test.tsx tests/pages/medications.test.tsx` and confirm the new tests fail for the right reason (missing `computeSchedule`, hook and component), not because of a typo in a test file under `tests/`

### Implementation for User Story 1

- [X] T012 [US1] In `src/lib/schedule.ts` add `ScheduleKind` (`'rolling' | 'fixed' | 'as-needed' | 'inactive' | 'unscheduled'`), `ScheduleDetails` (`kind`, `lastTaken: { at: Date; site?: Ppa_intakelogsppa_injectionsite } | null`, `nextIntake: Date | null`, `status: 'due-today' | 'past-due' | 'upcoming' | 'none'`, `missedDueDate: Date | null`, `daysPastDue: number | null`, `followUpDue: boolean`) and the pure function `computeSchedule(medication, { lastTaken, lastSkipped }, today)` implementing Steps 1–4 of `contracts/schedule-rules.contract.md`. `today` is a parameter, never `new Date()` inside the module; types use the generated `Ppa_medications` / `Ppa_intakelogs`; reuse `isScheduledOn`; no `any`
- [X] T013 [US1] Create `src/hooks/use-medication-schedule.ts`: `useMedicationSchedule(medication)` runs the two queries from T008 with TanStack Query `useQueries` (`staleTime: 30_000`, arrays under `['intakelogs','latest',id,…]`) and returns `{ details: ScheduleDetails | undefined, isLoading, isError, refetch }`, computing `details` with `computeSchedule` and the current date at render
- [X] T014 [US1] Create `src/components/medications/medication-schedule.tsx`: a region `aria-label="Schedule for <name>"` with the two rows from the UI contract, using only `Badge`, `Skeleton`, `Button`, `Separator` and Lucide icons (`CalendarCheck`, `AlertTriangle`, `BellOff`, all `aria-hidden`), `formatDateLabel` with `{ weekday: 'short', month: 'short', day: 'numeric' }` (year only when not the current year), `formatTime`, and `getSiteLabel`; design tokens only, no inline colours; rows stack on narrow widths and sit side by side from `sm`. On a failed load, in addition to the in-card message and Retry, call `toast.error('Couldn\'t load schedule for some medications.', { id: 'schedule-load-error' })` from an effect (constitution Principle III; the fixed id de-duplicates across cards) and `console.error` the underlying error
- [X] T015 [US1] Edit `src/components/medications/medication-card.tsx` to render `<MedicationSchedule medication={medication} />` as the last block inside the card, below the Active switch and after a `Separator`; change nothing above it
- [X] T016 [P] [US1] Edit `src/mocks/mock-intakelogs-service.ts` so `getAll` also honours a `ppa_status eq <n>` filter, a `_ppa_medication_value eq <id>` filter, `orderBy: ['ppa_loggedat desc']` and `top`, keeping the existing date-range behaviour for other callers
- [X] T017 [P] [US1] Edit `src/mocks/mock-data.ts` so `npm run dev:mock` shows one card of each kind: due today, upcoming, Past Due on the fixed schedule, Past Due on the rolling schedule (injection last taken more than one interval ago), As-Needed, and one Inactive Medication with a past Taken log
- [X] T018 [US1] Run `npm run test`, `npm run lint` and `npm run build:ci`; all must pass with zero errors and no new `any` in `src/lib/schedule.ts`, `src/hooks/use-medication-schedule.ts` or `src/components/medications/medication-schedule.tsx`
- [X] T019 [US1] Run `npm run dev:mock` and complete section C of `specs/004-schedule-page-reminders/quickstart.md`: every kind of card, the Active switch both ways, no horizontal scroll at 375 px and 768 px, keyboard focus order unchanged
- [ ] T020 [US1] Run `npm run dev:live` against the dev environment (constitution Principle II: exercise the new queries against a real Dataverse endpoint, not only `vi.mock`). For a Medication with at least three Taken logs on different days, confirm on its card that last taken is the newest one (`orderBy: ['ppa_loggedat desc']` honoured) and, in the browser network panel or Power Apps Monitor, that each of the two schedule queries returns at most one row (`top: 1` honoured) and only the five selected columns. Record the result in `specs/004-schedule-page-reminders/research.md` R4. If either option is not honoured, change `src/hooks/use-medication-schedule.ts` to sort and take the first row client-side over a bounded page, and update `tests/hooks/use-medication-schedule.test.tsx` to match

**Checkpoint**: US1 is complete and demonstrable on its own. This is the MVP.

---

## Phase 4: User Story 2 - Get an email on the days a medication is due (Priority: P2)

**Goal**: A cloud flow checks at local midnight and sends one email listing the Active Medications due that day, at most once a day, with the reminder address kept out of the repository.

**Independent Test**: With one Active Medication due today, one not due and one Inactive that would otherwise be due, run the flow: exactly one email arrives naming only the first; on a day with nothing due, none arrives; a search of the repository and its history for the address finds nothing.

### Acceptance harness for User Story 2 ⚠️

> Build these first; T034 is the point where they must go from failing to passing.

- [X] T021 [P] [US2] Create `scripts/reminder/seed-reminder-scenarios.ps1` (PowerShell 7, token from `az account get-access-token`, `-EnvironmentUrl` defaulting to dev as in `scripts/seed-demo-data.ps1`): read `tests/fixtures/schedule-cases.json`, create one Medication per case named `<id> <label>` and its Intake Logs with dates resolved from offsets against the real local today, idempotently; `-Remove` deletes only rows it created. Include the primary name column on every POST and lowercase `@odata.bind` names
- [X] T022 [P] [US2] Create `scripts/reminder/assert-reminder-run.ps1`: read today's `ppa_reminderruns` row (key `ppa_name` = local `yyyy-MM-dd`), parse `ppa_summary` (`Due: a; b` / `Follow-up: c; d`, `–` for empty), and exit non-zero with a diff unless the outcome and the case ids match `-ExpectOutcome`, `-ExpectDue` and `-ExpectFollowUp`
- [X] T023 [P] [US2] Create `scripts/ci/assert-no-envvar-values.ps1` with `-Path <dir>` and `-Zip <file>` modes: fail if any `environmentvariablevalues.json` exists or any file contains a non-allowlisted email address (same allowlist and OData exclusions as T004); on failure print the offending file **path** only, never the matched text
- [X] T024 [P] [US2] Create `scripts/reminder/set-reminder-recipient.ps1 -EnvironmentUrl <url>`: prompt for the address with hidden input (never a parameter), validate its shape, then create or update the `environmentvariablevalue` row for `ppa_ReminderRecipientEmail` **without** the `MSCRM.SolutionUniqueName` header (deliberate exception, research R8); never print or write the address

### Dataverse components for User Story 2

- [X] T025 [US2] Create `scripts/reminder/create-reminder-schema.ps1` (idempotent, header `MSCRM.SolutionUniqueName: MedTrackSolution`) that creates table `ppa_ReminderRun` exactly as `specs/004-schedule-page-reminders/data-model.md` §2: **User-owned**; activities, notes and auditing off; primary name `ppa_name` Text (10), required, holding the local run date `yyyy-MM-dd`; alternate key `ppa_reminderrun_date` on `ppa_name`; `ppa_Outcome` local Choice, required, values `894250000` Started, `894250001` Sent, `894250002` Nothing To Send, `894250003` Failed; `ppa_DueCount` Whole number 0–1000, required; `ppa_FollowUpCount` Whole number 0–1000, required; `ppa_Summary` Multiline text (4000), optional; `ppa_ErrorStep` Text (200), optional; `ppa_Attempts` Whole number 1–24, required. No lookup to `ppa_medication`. No column for the reminder address
- [X] T026 [US2] Extend `scripts/reminder/create-reminder-schema.ps1` to also create, in `MedTrackSolution`: environment variable definition `ppa_ReminderRecipientEmail` (Text, **no default value, no current value**), `ppa_ReminderTimeZone` (Text, default `UTC`), and connection references `ppa_MedTrackDataverse` (`shared_commondataserviceforapps`) and `ppa_MedTrackMail` (`shared_office365`; first created for `shared_sendmail`, which this tenant refuses — research R7); finish with `PublishXml`
- [X] T027 [US2] Run `scripts/reminder/create-reminder-schema.ps1` against dev (`pac auth list` must show MedTrackDev active); confirm the alternate key reaches Active status; identify which security role gives the owner access to `ppa_medication` and, unless it is System Administrator or System Customizer, add user-level Create/Read/Write on `ppa_reminderrun` to it (data-model.md §7)
- [ ] T028 [US2] (owner) In dev: create a Microsoft Dataverse connection and a Microsoft Teams connection, both signed in as the owner (done), share each with the deployment service principal as "Can use", and set GitHub Environment `dev` variables `PP_CONN_DATAVERSE_ID`, `PP_CONN_TEAMS_ID` and `REMINDER_TIME_ZONE` (a Windows time zone name), following `specs/004-schedule-page-reminders/contracts/privacy-and-deployment.contract.md`
- [X] T029 [US2] (owner) Run `pwsh scripts/reminder/set-reminder-recipient.ps1 -EnvironmentUrl <dev url>` and enter the address at the prompt (done for the email version; superseded — the script and the variable no longer exist)

### Cloud flow for User Story 2

- [X] T030 [US2] Spike research R5 in dev: a throwaway solution flow with an hourly Recurrence trigger whose trigger condition reads `ppa_ReminderTimeZone` through `convertFromUtc(utcNow(), <env var>, 'HH')`. Record in `specs/004-schedule-page-reminders/research.md` R5 whether it saves and fires; if it does not, record that the hour check moves to the first action and ends the run as Cancelled. Delete the throwaway flow
- [X] T031 [US2] In dev, inside `MedTrackSolution`, create the flow "MedTrack – Daily Reminder" per `contracts/reminder-flow.contract.md`: hourly Recurrence at minute 0, the local-hour 0–3 gate from T030, concurrency 1; then steps 1–3: local `today` from `ppa_ReminderTimeZone`, `WhoAmI`, and the guard (create `ppa_reminderrun` with `ppa_name = today`, outcome Started, attempts 1, counts 0; on duplicate key read the row — outcome Failed → set Started and attempts + 1 and continue, anything else → end the run)
- [X] T032 [US2] Add steps 4–6 to the flow: validate `ppa_ReminderRecipientEmail` (failure step name `ValidateRecipient`); list Medications with `statecode eq 0`, `ppa_isactive eq true`, `ppa_frequency ne 894250003`, `_ownerid_value eq <WhoAmI user>` and only the columns in data-model.md §1; for each, read the latest Taken and latest Skipped log (`top 1`, `ppa_loggedat le utcNow()`, newest first) and apply Steps 1–3 of `contracts/schedule-rules.contract.md` to decide **due today** (rolling for Injection with a Taken or Skipped log, fixed otherwise). Use the date text of `ppa_startdate` as-is, never shifted through a time zone
- [X] T033 [US2] Add steps 7–9 and the failure path: nothing due → outcome Nothing To Send; otherwise one Office 365 Outlook "Send an email (V2)" (first built with Mail "Send an email notification (V3)", which this tenant refuses — research R7) with Secure Inputs and Secure Outputs on, subject `MedTrack: <n> due today`, HTML section "Due today" ordered by Reminder Time then name, each line `<name> — <dosage> — <Reminder Time or "no reminder time">`, injections adding `Last taken <date> · <site>` or `Not yet taken`; then outcome Sent with `ppa_DueCount`, `ppa_Summary` (`Due: …` / `Follow-up: –`). Wrap steps 4–9 in a scope whose failure handler sets outcome Failed and `ppa_ErrorStep` = `<step name> (<status code>)` only — no raw error text — and ends the run Failed; a failure after the send succeeded leaves the outcome as Started
- [X] T034 [US2] In dev run `pwsh scripts/reminder/seed-reminder-scenarios.ps1`, test the flow manually, then `pwsh scripts/reminder/assert-reminder-run.ps1 -ExpectOutcome Sent -ExpectDue S01,S03,S04,S12,S17,S18,S25,S27,S29`; fix the flow until it passes and one email with the nine due rows arrives. Check the send action's inputs are hidden in run history (the seeded run passed with the email version, whose messages the owner's mail provider then refused; delivery was confirmed by the owner with the Teams version — research R7, R10)

### Source control and pipeline for User Story 2

- [X] T035 [US2] Export `MedTrackSolution` from dev (unmanaged) and unpack it into `solution/src` with `pac solution unpack`, bump `<Version>` in `solution/src/Other/Solution.xml` from `1.0.0.1` to `1.0.0.2`, then run `pwsh scripts/ci/assert-no-envvar-values.ps1 -Path solution/src`; the diff must add `Entities/ppa_ReminderRun/`, the flow under `Workflows/`, two environment variable **definitions** and two connection references, and nothing else
- [X] T036 [P] [US2] Create `solution/deployment-settings.template.json` (connection references `ppa_MedTrackDataverse` → `__CONN_DATAVERSE_ID__`, `ppa_MedTrackMail` → `__CONN_MAIL_ID__`; environment variable `ppa_ReminderTimeZone` → `__REMINDER_TIME_ZONE__`; **no** entry for `ppa_ReminderRecipientEmail`) and `scripts/ci/render-deployment-settings.ps1`, which writes `solution/deployment-settings.json` from `PP_CONN_DATAVERSE_ID`, `PP_CONN_MAIL_ID` and `REMINDER_TIME_ZONE`, fails if any is missing, and prints no values
- [X] T037 [P] [US2] Create `scripts/deploy/configure-reminder-flow.ps1` (service principal token from `PP_CLIENT_ID`/`PP_CLIENT_SECRET`/`PP_TENANT_ID`, `PP_ENVIRONMENT_URL`): find the flow by unique name, check its owner is the service principal, turn it on if it is off, change no ownership, and exit non-zero if the flow is missing or cannot be turned on
- [X] T038 [US2] Edit `.github/workflows/deploy.reusable.yml`: render the deployment settings before "Import solution", pass the file to `import-solution` (`use-deployment-settings-file: true`), and run `scripts/deploy/configure-reminder-flow.ps1` after "Publish solution customizations"
- [X] T039 [US2] Edit `.github/workflows/promote-prod.yml`: use the rendered settings on the dev re-import; run `scripts/ci/assert-no-envvar-values.ps1 -Zip out/MedTrackCore_managed.zip` after "Export solution as Managed" and **before** "Upload managed solution artifact"; in `deploy-production` render with the production variables, import with the settings file, then run `configure-reminder-flow.ps1`
- [X] T040 [US2] Edit `.github/workflows/ci.yml` to run `pwsh scripts/ci/assert-no-envvar-values.ps1 -Path solution/src` as a required step beside the gitleaks scan, then run `actionlint` over `.github/workflows/`
- [ ] T041 [US2] Open a pull request, let CI pass, merge, and let `deploy-dev` run. In dev confirm the flow is on and owned by the service principal, then open its Details page: record in `specs/004-schedule-page-reminders/research.md` R10 whether it is reported as unlicensed and, if so, apply the first fallback (owner as co-owner and `licensee_systemuserid`)
- [ ] T042 [US2] Complete sections F, G and H of `specs/004-schedule-page-reminders/quickstart.md` in dev, skipping the follow-up rows: second run stops at the guard; quiet day gives Nothing To Send; an Inactive row switched to Active is listed; a removed Teams connection gives Failed with `SendReminder` and recovers to Sent with attempts 2; a planted non-example address fails CI; changing the address leaves `git status` clean
- [X] T043 [P] [US2] Add a "Daily email reminder" section to `README.md`: what the flow does, the one-time setup per environment, that the address is set with `scripts/reminder/set-reminder-recipient.ps1` and held in `ppa_ReminderRecipientEmail` (with `reminder@example.com` as the only example), that a change can take up to an hour, that the first email may land in junk, and that failures are visible only in the Reminder Run table and flow run history because the flow owner is a service principal

**Checkpoint**: US1 and US2 both work. The owner gets one email on a due day and none on a quiet day.

---

## Phase 5: User Story 3 - Keep being nudged for a week after a missed intake (Priority: P3)

**Goal**: A missed intake produces a follow-up in the daily email on the 1st, 3rd, 5th and 7th day after it was due, then stops.

**Independent Test**: With seeded Medications 1, 2, 3, 5, 7 and 8 days past due, one run lists exactly those at 1, 3, 5 and 7 days as follow-ups; logging one as Taken removes it from the next run.

**Depends on**: US2 (extends the same flow).

- [X] T044 [US3] Extend the flow's per-Medication step with Step 4 of `contracts/schedule-rules.contract.md`: compute the missed due date (rolling: `localDay(lastResolved) + interval` when before today; fixed: the most recent scheduled date before today that is not earlier than the anchor and has no Taken or Skipped log on or after it), `daysPastDue`, and add the Medication to a **follow-up** list only when it is not due today and `daysPastDue` is 1, 3, 5 or 7
- [X] T045 [US3] Extend the email and the run record: subject variants `MedTrack: <n> due today, <m> follow-up(s)` and `MedTrack: <m> follow-up(s)`; HTML section "Follow-ups", longest past due first, each line `<name> — <dosage> — was due <date> (<n> day(s) ago)` plus the injection line; either section omitted when empty; a Medication listed at most once; `ppa_FollowUpCount` and the `Follow-up:` group of `ppa_Summary` filled; "Nothing To Send" only when both lists are empty
- [X] T046 [US3] In dev, with the full seed in place, delete today's Reminder Run, test the flow, and run `pwsh scripts/reminder/assert-reminder-run.ps1 -ExpectOutcome Sent -ExpectDue S01,S03,S04,S12,S17,S18,S25,S27,S29 -ExpectFollowUp S06,S08,S09,S13,S21,S23,S26`. Then, re-running after each change: log S06 as Taken → not listed; switch S08 to Inactive → not listed; remove every due row → an email with follow-ups only (this last case was run in the connection-free copy of the flow only, because the owner's own Medications in dev were due that day; see research R10)
- [ ] T047 [US3] Export and unpack the updated flow into `solution/src`, bump `<Version>` in `solution/src/Other/Solution.xml` to `1.0.0.3` (now `1.0.0.4`, exported with the Teams version; the pull request is still to do), run `pwsh scripts/ci/assert-no-envvar-values.ps1 -Path solution/src`, and merge through a pull request so `deploy-dev` redeploys it

**Checkpoint**: All three stories work in dev.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Review, production rollout, and the checks that span stories.

- [X] T048 Run the `code-review` skill over `src/lib/schedule.ts`, `src/hooks/use-medication-schedule.ts`, `src/components/medications/medication-schedule.tsx` and `scripts/`; fix every CRITICAL finding (dead wiring, swallowed errors, placeholders)
- [X] T049 Run the `visual-qa` skill on the Medications page with its edge-case checklist (empty list, intake history error, long Medication names, 375 px and 768 px, dark mode), recording against `specs/004-schedule-page-reminders/contracts/ui-medication-schedule.contract.md`
- [X] T050 [P] Compare the gzipped main chunk of `npm run build:ci` on this branch with `main`; if it grew by more than 50 KB, record the justification in `specs/004-schedule-page-reminders/plan.md` Complexity Tracking
- [ ] T051 (owner) In production: create and share the two connections, set GitHub Environment `production` variables `PP_CONN_DATAVERSE_ID`, `PP_CONN_TEAMS_ID` and `REMINDER_TIME_ZONE`, per `contracts/privacy-and-deployment.contract.md`
- [ ] T052 Run "Promote to Production" (`.github/workflows/promote-prod.yml`): the zip check must pass; download the `managed-solution` artifact and confirm it contains no `environmentvariablevalues.json` and no address; confirm the flow is on in production
- [ ] T053 Complete sections E to G of `specs/004-schedule-page-reminders/quickstart.md` in production using two or three real Medications instead of the seed set
- [ ] T054 Complete section I of `quickstart.md` in production: after one night, a Reminder Run exists for the new day, created within 15 minutes of local midnight, with exactly one email
- [ ] T055 Run `gitleaks git --config .gitleaks.toml` over the full history; record a zero result against SC-011 in `specs/004-schedule-page-reminders/checklists/requirements.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: after Setup. T003 is done. T005 follows T004. T006 is independent.
- **US1 (Phase 3)**: needs T003 and T006. Needs nothing from US2 or US3.
- **US2 (Phase 4)**: needs T004–T006. Does not need US1's code, but US1 first is the planned order.
- **US3 (Phase 5)**: needs US2 complete through T041.
- **Polish (Phase 6)**: T048–T050 need US1; T051–T055 need US3.

### Within User Story 1

T007–T010 → T011 (red) → T012 → T013 → T014 → T015 → T018 → T019 → T020. T016 and T017 can be done any time after T012. T020 needs a signed-in session against dev.

### Within User Story 2

- T021–T024 first, in parallel.
- T025 → T026 → T027 (one script, then run it). Table creation is never parallel.
- T028 and T029 (owner) need T027 and T024.
- T030 → T031 → T032 → T033 → T034. T034 also needs T021, T022, T028, T029.
- T035 needs T034 and T023. T036 and T037 are independent of the flow.
- T038 and T039 need T036 and T037; T040 needs T023. T041 needs T035 and T038–T040. T042 needs T041.

### Within User Story 3

T044 → T045 → T046 → T047.

### Parallel Opportunities

- T002 with T001; T006 with T004/T005.
- T007, T008, T009 (three new test files); T016 with T017.
- T021, T022, T023, T024 (four new scripts); T036 with T037; T043 at any point in US2.
- US1 (app code) and the US2 scripts and schema (T021–T027) touch different files and can proceed side by side.

---

## Parallel Example: User Story 1

```bash
# Three new test files, no shared state:
Task: "Create tests/lib/schedule.test.ts from tests/fixtures/schedule-cases.json"
Task: "Create tests/hooks/use-medication-schedule.test.tsx (query shape, keys, error, invalidation)"
Task: "Create tests/components/medication-schedule.test.tsx (every row of the UI contract)"

# After computeSchedule exists:
Task: "Edit src/mocks/mock-intakelogs-service.ts to honour status filter, orderBy and top"
Task: "Edit src/mocks/mock-data.ts to add one card of each schedule kind"
```

## Parallel Example: User Story 2

```bash
# Four independent scripts:
Task: "Create scripts/reminder/seed-reminder-scenarios.ps1"
Task: "Create scripts/reminder/assert-reminder-run.ps1"
Task: "Create scripts/ci/assert-no-envvar-values.ps1"
Task: "Create scripts/reminder/set-reminder-recipient.ps1"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 and Phase 2 (T003 is already done).
2. Phase 3 through T020.
3. **Stop and validate**: the schedule section works on every card with no cloud flow.
4. It can ship on its own through the existing pipeline.

### Incremental Delivery

1. US1 → schedule on the cards.
2. US2 → daily email for what is due today, with the address protected. Two platform checks happen here (T030 trigger condition, T041 licence state); each has a recorded fallback.
3. US3 → follow-ups for a week after a missed intake.
4. Polish → review, production setup, overnight check.

### Owner involvement

Tasks marked **(owner)** need the repository owner: T028, T029 and T051. T034, T041, T042, T046 and T052–T054 need access to the environments and an inbox, so they are done with the owner or by the owner.

---

## Notes

- Tests are written first and seen to fail (T011 for the app; T034 and T046 for the flow).
- Create Dataverse tables one at a time; never in parallel.
- Every Dataverse script is PowerShell 7 and gets a fresh token per run.
- Commit after each task or logical group. Before every commit, the diff must contain no email address other than `reminder@example.com`.
- Stop at any checkpoint to validate that story on its own.
