# Phase 0 Research: Medication Schedule Details & Daily Email Reminder

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-10-05

Each entry records a decision, why it was made, and what was rejected. Items marked
**Verify** are decisions that rest on documented behaviour not yet exercised in this
project's environments; each has a matching early task so a wrong assumption surfaces
before dependent work starts.

---

## R1. Where the schedule rule lives

**Decision**: One pure TypeScript module, `src/lib/schedule.ts`, is the reference
implementation of every schedule rule (FR-003 to FR-009, FR-016, FR-022 to FR-024). The
cloud flow re-implements the same rule in workflow expressions. Both are held to one
decision table in [contracts/schedule-rules.contract.md](./contracts/schedule-rules.contract.md):
the table drives the Vitest fixtures for the module, and the same rows are seeded into
Dataverse to check the flow.

**Rationale**: The card runs in the browser and the reminder runs at midnight with no
browser open, so one runtime cannot serve both. A shared, numbered decision table is the
cheapest way to keep two implementations honest (FR-016: the email and the page never
disagree).

**Alternatives considered**:
- *C# plug-in or Custom API as the single implementation* — one copy of the logic, but adds
  a .NET project, an assembly build and registration to a pipeline that today packs XML
  only, and Code Apps cannot call a Custom API through the generated services.
- *Store `next intake date` on the Medication row* — rejected: for fixed-schedule
  Medications the value changes as days pass, not only when a row changes, so a stored
  value goes stale. The spec also defines it as derived, not stored.
- *GitHub Actions cron running the TypeScript module* — reuses the code, but the request
  asked for a cloud flow, and a public repository's workflow logs are the wrong place for
  health data.

The duplication is a Constitution I deviation and is recorded in plan.md Complexity Tracking.

---

## R2. Existing Biweekly rule is defective and must be fixed first

**Finding**: `scheduledDosesOnDay` in `src/lib/adherence.ts` treats a Biweekly Medication as
scheduled when `weeksBetween(anchor, date) % 2 === 0`. It never looks at the scheduled day,
so **every one of the seven days** in an even week counts as scheduled. The existing test
only samples one day per week, so it does not catch this. Today this inflates Biweekly
Medications on Home and in Adherence.

**Decision**: `src/lib/schedule.ts` exports `isScheduledOn(medication, date)` with the
corrected rule: a Biweekly Medication is scheduled on the date inside each even seven-day
block (counted from the anchor) whose weekday equals the Medication's scheduled day, or the
anchor's own weekday when no scheduled day is set. `scheduledDosesOnDay` is changed to call
`isScheduledOn`, so there is one definition of the fixed schedule.

**Rationale**: The spec defines the fixed schedule as "the same rules that Home, Calendar,
and Adherence already use". Copying the defect would show a Biweekly pill as due on seven
consecutive days and email the owner every day of that week. Fixing it only in the new
module would make the card disagree with Home.

**Consequence**: Home, the Overdue banner and Adherence change for Biweekly Medications:
one scheduled Dose per fortnight instead of seven. Adherence percentages for past periods
containing a Biweekly Medication will rise. This is a behaviour change to existing screens.

**Owner direction (2026-10-05)**: fix it. **Done the same day**: `isScheduledOn` added in
`src/lib/schedule.ts`, `scheduledDosesOnDay` delegates to it, and the now-unused
`weeksBetween` helper was removed. Three regression tests were added to
`tests/lib/adherence.test.ts` and seen to fail first.

**Second defect fixed with it**: `ppa_startdate` is a DateOnly column (`"2026-06-01"`), and
the old code read it with `new Date()`, which treats it as UTC midnight — the previous
calendar day anywhere west of UTC. The anchor is now built from the date's parts, so it is
the same calendar day in every time zone. The flow must do the same: use the date text of
`ppa_startdate` as-is and never convert it through a time zone.

**Alternatives considered**: Leave `adherence.ts` untouched and accept the disagreement —
rejected, violates FR-016 in spirit and Constitution I (duplicated shared logic).

---

## R3. Which timestamp means "taken"

**Decision**: `ppa_loggedat` is the date and time of an intake everywhere in this feature:
last taken, the rolling anchor, "already logged today", and "logged on or after the due
date". A log's calendar day is its `ppa_loggedat` in the owner's local time zone.

**Rationale**: It is the date/time field the user sets in the Log Intake dialog, and it is
what `takenLogsOnDay` and `useOverdue` already use. `ppa_scheduledfor` is derived from the
Reminder Time and is not user-editable.

**Alternatives considered**: `ppa_scheduledfor` — rejected, it cannot represent a late dose.

---

## R4. Loading the schedule data for the cards

**Decision**: For each Medication, two small queries through the generated
`Ppa_intakelogsService.getAll`: the latest Taken log, and the latest Skipped log. Each uses
`select` (five columns), `filter` (medication, status, `ppa_loggedat le now`),
`orderBy: ['ppa_loggedat desc']`, `top: 1`. They run in parallel with TanStack Query
`useQueries`, with `staleTime` 30 s, under query keys that start with `['intakelogs', …]`
and return arrays.

**Rationale**:
- "Last taken" can be arbitrarily old (a Past Due injection last taken months ago), so a
  date-bounded list query would report "Not yet taken" falsely.
- `IGetAllOptions` supports `orderBy` and `top`, so no hand-written OData is needed.
- Keys under `['intakelogs']` mean the existing create/update/delete mutations already
  invalidate these queries (FR-011). `useUpdateIntakeLog` patches cached data with
  `old?.map(…)`, so the cached value must be an array.
- Cards render immediately; only the schedule section waits (FR-012, SC-004).

**Verify**: that the Code Apps data service honours `orderBy` and `top` against real
Dataverse. The Vitest suite stubs the generated service, so it cannot show this; tasks.md
T020 checks it live in dev. Fallback: sort and take the first row client-side over a
bounded page.

**Alternatives considered**:
- *One unbounded query for all Taken/Skipped logs* — grows without limit; violates
  Constitution IV.
- *One 120-day window query plus per-Medication fallbacks* — larger payload than 2×N
  single-row queries for a typical list of 5 to 10 Medications, and two code paths.
- *Aggregate (max per Medication)* — not available through the generated service.

---

## R5. How the daily check is triggered at local midnight

**Decision**: A Recurrence trigger that fires every hour, with a trigger condition that
lets it run only when the local hour is 0 to 3. Local time comes from a Text environment
variable, `ppa_ReminderTimeZone` (a Windows time zone name, default `UTC`). The first run
after local midnight does the work; later runs that night exit at the idempotency guard
(R6) unless the earlier attempt failed, in which case they retry.

**Rationale**:
- Daylight saving is handled by `convertFromUtc`, not by trigger arithmetic. A zone whose
  clocks jump at midnight skips hour 0 entirely on that day; the hour-1 run covers it.
- A transient outage at 00:00 is retried at 01:00, 02:00 and 03:00 without owner action
  (FR-021: a failure must not prevent the check from running).
- The time zone is configuration, not a literal in a public repository (CLAUDE.md:
  environment variables for configuration).
- The trigger condition keeps run history to at most four entries a night.

**Owner direction (2026-10-05)**: try the time-zone environment variable in the trigger
condition first.

**Verify**: that a trigger condition may reference an environment-variable parameter. If it
may not, drop the condition and make "local hour not 0–3" the first action, ending the run
as Cancelled. The design is otherwise unchanged.

**Verified (2026-10-05, tasks.md T030)**: yes — the trigger condition can read the
environment variable, and it reads the **current value**, not the default written into the
flow definition. Two throwaway solution flows were created in dev through the Dataverse
Web API, each with a one-minute Recurrence trigger and the condition
`@equals(convertFromUtc(utcNow(), parameters('ppa_ReminderTimeZone (ppa_ReminderTimeZone)'), 'HH'), '<hour>')`,
while the variable's current value was temporarily `Eastern Standard Time` (default `UTC`):

| Flow | `<hour>` | Saved and turned on | Runs in the next minutes |
|---|---|---|---|
| A | the Eastern hour (`03`) | yes | one per minute, all Succeeded |
| B | the UTC hour (`07`) | yes | none |

A fired and B did not, so the condition used the value set in the environment. The
fallback (hour check as the first action) is not needed. Both flows and the temporary
value were deleted afterwards; `ppa_ReminderTimeZone` is back to its default with no
current value in dev. The same test showed that `workflow.uniquename` can be set when a
flow is created through the Web API, which is how `configure-reminder-flow.ps1` finds the
flow.

**Consequence found in the same session — a manual test obeys the trigger condition.**
A third throwaway flow with the real condition (local hour 0 to 3) was triggered by hand
while the local hour was 7: the trigger was evaluated and did **not** fire, so no run
started. "Test → Manually" therefore starts a run only when the local hour in
`ppa_ReminderTimeZone` is 0 to 3. Moving the hour check into the first action (the
fallback above) would not help; the run would start and end as Cancelled.

Verified way to test at any time of day, with no design change:

1. Set the current value of `ppa_ReminderTimeZone` in dev to a Windows time zone where it
   is currently between 00:00 and 03:59.
2. Turn the flow off and on. A changed value did **not** reach a running flow until this
   was done; after it, the next manual trigger fired at once.
3. Seed and assert with the same zone (`-TimeZone` on `seed-reminder-scenarios.ps1` and
   `assert-reminder-run.ps1`), because "today" is that zone's date.
4. Restore the real zone and turn the flow off and on again.

This is an open point for the owner: keep the gate and test this way, or change the gate.
quickstart.md sections E to G assume a manual test simply runs.

**Alternatives considered**:
- *Daily Recurrence at 00:00 with a literal `timeZone`* — simplest, but the zone would be
  duplicated (trigger and in-flow date maths), hard-coded, and there is no retry.
- *Every 15 minutes* — supports half-hour-offset zones exactly, at the cost of a noisy run
  history. Not needed for the owner's zone; recorded as a known limitation (R13).

---

## R6. At most one email per day, and a visible record of each check

**Decision**: A new user-owned Dataverse table, `ppa_ReminderRun`, with one row per local
calendar day and an alternate key on the day. The flow creates the row before doing
anything else; a duplicate-key failure means a check already ran today. See
[data-model.md](./data-model.md) for columns and the state machine. The row stores the
outcome, counts, the Medications listed, and a sanitised error — never the reminder address.

**Rationale**: FR-020 needs a guard that survives manual re-runs and the hourly retries in
R5; flow run history cannot provide that. The same row is the "record where the owner can
see it" required by FR-021, and it gives acceptance tests something to assert against
without reading an inbox.

**Alternatives considered**:
- *Rely on the trigger firing once* — fails on manual re-run and on retry.
- *Write the last-run date into an environment variable* — misuse of configuration as state.
- *A column on Medication* — per-Medication state cannot express "nothing was due today".

---

## R7. Which email connector

**Decision (changed 2026-10-05)**: The **Office 365 Outlook** connector, action **Send an
email (V2)**, through connection reference `ppa_MedTrackMail`. Secure Inputs and Secure
Outputs are switched on for the send action so the address does not appear in run history.

**Rationale**:
- It works in this tenant today. The owner's account holds a Developer E5 licence with an
  Exchange Online mailbox, which is all the connector needs.
- Standard (non-premium) connector, no new account and no stored secret.
- Its limit (300 calls per 60 seconds per connection) is far above one email a day.
- The recipient's mail provider does not matter: the connector delivers to any address.

**Consequences**:
- The email is sent **from the mailbox of the account that signed in to the connection**
  (the owner). That address is visible to the recipient and, like the reminder address, is
  never written in this repository.
- A copy of every reminder is kept in that mailbox's Sent Items, with the recipient
  address on it. That is the owner's own mailbox, outside the repository and outside
  Dataverse.
- The connection is an OAuth sign-in by a person. If the sign-in stops being valid (for
  example after a password change), the send step fails; the Reminder Run row then shows
  outcome Failed with the send step, and the owner repairs the connection.
- The first message from a new tenant's address may land in junk at the recipient; the
  owner marks the sender as safe once.

**First decision, and why it was dropped**: the owner's direction on 2026-10-05 was the
**Mail** connector, *Send an email notification (V3)*: no mailbox, no user sign-in, and a
limit of 100 calls per 24 hours. On the first real run (tasks.md T034) its send step failed
with HTTP 401 and this message from the connector:

> The Mail connector is currently restricted for new tenants. Microsoft is working on
> enabling this connector. In the meantime, please consider using alternatives like
> Office 365 Outlook, Gmail, SendGrid connector instead.

No tenant or admin setting for this restriction was found in Microsoft's documentation.
The rest of that run was correct, and the failure was recorded as designed: Reminder Run
outcome Failed, error step `SendEmail (401)`. The owner chose Office 365 Outlook the same
day.

**Moving the connection reference**: `ppa_MedTrackMail` keeps its name. Its `connectorid`
can be changed in place with a PATCH (`create-reminder-schema.ps1` does this when it finds
the old connector). Two things were observed in dev: the platform ignores an attempt to
clear `connectionid`, so the old connection stays attached until a new one is picked; and
a flow definition that uses the reference **cannot be saved, even switched off**, until the
reference points to a valid connection of the new connector
(`ConnectionAuthorizationFailed`). The order is therefore: create the connection, bind the
reference, then update the flow.

**Alternatives considered**:
- *Outlook.com* — sends from a personal Microsoft account; fine, but one more account.
- *SMTP* — could send from the recipient's own provider, but stores a mail password in the
  connection.
- *SendGrid* — account, API key and a verified sender for one email a day.
- *Gmail* — with a consumer Gmail account, Google allows it only alongside an approved list
  of connectors.
- *Azure Communication Services* — a new Azure resource to own.

One more observation from the failed Mail send: Secure Inputs hid the step's inputs, but
the connector's **error response stayed readable** in run history even with Secure Outputs
on. That response held no address this time. It is the reason the flow stores only the step
name and status code, never the error text (R9).

---

## R8. Where the reminder address lives

**Decision**: A Text environment variable, `ppa_ReminderRecipientEmail`. The solution
contains the **definition only**: no default value and no current value. The owner sets the
current value once per environment by running a local script that prompts for it and
creates the `environmentvariablevalue` row **without** the `MSCRM.SolutionUniqueName`
header, so the value exists only in the environment's unmanaged layer and is not a
component of `MedTrackSolution`.

**Rationale**:
- Microsoft's guidance is that definitions belong in the solution and values do not. A
  value that is part of the solution is written to its own JSON file inside the exported
  zip.
- `promote-prod.yml` exports the solution from dev and **uploads the zip as a build
  artifact**. On a public repository that artifact is downloadable, so a value inside
  `MedTrackSolution` in dev would publish the address. Keeping the value out of the
  solution closes that path.
- Changing the address is a re-run of the script; nothing in the repository changes
  (FR-029, SC-012). A changed value can take up to an hour to reach the flow.
- The address never passes through GitHub at all, not even as a secret.

This is a deliberate, documented exception to the CLAUDE.md rule that every Dataverse
component is created with the solution header.

**Found while building the flow (2026-10-05) — needs an owner decision.** A flow that
reads an environment variable with **neither a default value nor a current value cannot be
turned on**. Activating a test copy of the flow in dev, before any address was set, failed
with `XrmEnvironmentVariableAttributeNotFound: Attribute 'value' was not found for
environment variable 'ppa_ReminderRecipientEmail'`. Three things follow:

- In dev the order T029 (set the address) → turn the flow on is required, which is the
  planned order, so nothing is blocked today.
- quickstart.md section G ("clear the value → Reminder Run is Failed with
  `ValidateRecipient`") cannot work as written if clearing means deleting the value row:
  the flow would have nothing to resolve. The `ValidateRecipient` step itself is verified
  (see "Flow build" below) for a value that is present but not an address.
- Production: the definition arrives with the first import, so the address cannot be set
  before that import (tasks.md T051 runs the script before T052), yet the flow cannot be
  turned on until it is set. As ordered, the first production deploy would fail at
  `configure-reminder-flow.ps1`; the owner would then set the address and re-run it.

Recommended change, **not applied**: give `ppa_ReminderRecipientEmail` a default value
that is plainly not an address, such as `not-configured`. The address still never enters
the solution; the flow can be turned on in any environment; and a missing address then
shows up exactly as designed — a Reminder Run with outcome Failed and error step
`ValidateRecipient`. It would change data-model.md §3 ("Default in solution: None"),
tasks.md T026 and `create-reminder-schema.ps1`.

**Alternatives considered**:
- *GitHub Environment secret injected through the deployment settings file* — automates
  setup, but routes the address through CI, where one mistaken `echo` exposes it.
- *Secret-type environment variable backed by Azure Key Vault* — strongest, but needs an
  Azure subscription and Key Vault for one email address.
- *A row in a custom settings table* — works, but environment variables are the platform's
  intended mechanism for per-environment key/value configuration.

---

## R9. Guard rails so the address cannot reach the repository

**Decision**: Three independent checks, because a single missed step is otherwise a
permanent leak in public history.

1. **Email-address rule in gitleaks** — a custom rule in `.gitleaks.toml` flags any email
   address in committed content, with an allowlist for `example.com`/`example.org`,
   GitHub `noreply` addresses, and the commit co-author address. Runs in the existing CI
   gate on every pull request. A baseline scan on 2026-10-05 showed that a plain
   `local@domain.tld` pattern also matches OData annotations already in the repository
   (`ppa_Medication@odata.bind`, `@OData.Community…`, `@Microsoft.Dynamics…`) and
   `git@github.com`. The rule must exclude those, and the first task is a baseline run that
   reports zero findings on the current tree before the rule is made blocking.
2. **Solution content check** — `scripts/ci/assert-no-envvar-values.ps1` fails if
   `solution/src` (in CI) or an exported solution zip (in `promote-prod.yml`, **before**
   the artifact upload) contains any `environmentvariablevalues.json` file or any
   non-allowlisted email address.
3. **Sanitised errors** — the flow never copies a connector's raw error text into
   `ppa_ReminderRun`, because a mail delivery error can quote the recipient. Only the
   failing step's name and status code are stored.

**Rationale**: FR-028 lists exported solution definitions, build artifacts and logs
explicitly. Check 2 covers the one automated path that publishes solution content.

**Not covered by tooling**: commit messages, branch names, and issue or pull-request text.
gitleaks scans file content. These stay a matter of care, noted in quickstart.md.

---

## R10. Deploying a flow through the existing pipeline

**Decision**:
- The flow, its two connection references, the two environment variable definitions and
  the new table are authored in the dev environment inside `MedTrackSolution`, then
  unpacked into `solution/src` — the same source of truth the pipeline already packs.
- **The deployment service principal owns the flow.** It imports the solution, so it
  becomes the owner, and the pipeline leaves it that way.
- The owner creates the two connections once per environment and shares each with the
  service principal ("Can use"). The Dataverse connection stays the owner's own, so the
  flow reads only the owner's Medications (R11).
- A committed `solution/deployment-settings.template.json` maps the connection references
  to placeholders. `scripts/ci/render-deployment-settings.ps1` fills them from GitHub
  Environment variables and the import step passes the rendered file. The rendered file is
  git-ignored, mirroring `power.config.template.json`.
- After import, `scripts/deploy/configure-reminder-flow.ps1` confirms the flow exists, is
  owned by the service principal and is turned on, turning it on if it is not.

**Owner direction (2026-10-05)**: use the service principal as the flow owner.

**Rationale**:
- Microsoft documents the deployment settings file as the way to bind connection
  references non-interactively, and requires that the connections be owned by, or shared
  with, the importing identity. OAuth connections can be shared only with a service
  principal user, which is exactly this case.
- Service-principal ownership is Microsoft's recommended pattern for flows deployed by a
  pipeline: the flow does not depend on one person's account, and no post-import
  reassignment step is needed.

**Consequences**:
- **Licensing.** A service-principal-owned flow that uses a premium connector needs a
  Power Automate Process licence or a designated licensed user, or it can be suspended as
  non-compliant. The Dataverse connector is premium; the email connector is not. Choosing
  the service principal as owner does not remove this requirement.
- **Failure emails.** Power Automate sends its own failure notifications to the flow
  owner. With a service principal as owner nobody receives them, so the `ppa_ReminderRun`
  row (R6) and the flow's run history are the only failure records. A day with no row at
  all means the flow could not even reach Dataverse.

**Verify**: after the first deploy to dev, whether the flow's Details page reports it as
unlicensed or non-compliant. If it does, in order of preference:
1. Add the owner as a co-owner and set `licensee_systemuserid` to the owner, so the flow
   runs under the owner's entitlement while the service principal stays the owner. This
   needs the owner to hold a licence that covers the Dataverse connector in a flow.
2. Assign a Power Automate Process licence to the flow.

**Alternatives considered**:
- *Reassign the flow to the owner after each import* — runs under the owner's licence with
  no extra step, but ties the flow to a personal account and adds a reassignment on every
  deploy. Set aside at the owner's direction.
- *Import flows by hand in each environment* — bypasses the pipeline that spec 003 made
  the only release path.

**Flow build (2026-10-05, tasks.md T031 to T033)**: the flow was created in dev through
the Dataverse Web API as a solution component of `MedTrackSolution`, turned **off**, with
unique name `ppa_MedTrackDailyReminder`. It cannot be turned on until the two connections
exist and the address is set (T028, T029), so its connector steps (WhoAmI, list rows, add
and update a row, send email) had not run when this was written.

**First real run (2026-10-05, later the same day)**, after the owner created the
connections and set the address. Seeded with the decision table and tested through the
time-zone workaround in R5:

| Step | Result |
|---|---|
| Turn the flow on | failed until the `WhoAmI` step was replaced (R11) |
| Guard: add the Reminder Run row | worked; a second add for the same day is rejected with HTTP 412 |
| List Medications owned by the connection's user | worked |
| Latest Taken and latest Skipped log per Medication | worked |
| Due today, from real rows | S01, S03, S04, S12, S17, S18, S25, S27, S29 — matches the contract — plus the owner's own Medications |
| Send the email | **failed, HTTP 401: Mail connector restricted for new tenants (R7)** |
| Failure path | Reminder Run outcome Failed, error step `SendEmail (401)`, run ended Failed |

The flow was turned off again and the seeded rows, the test Reminder Run and the temporary
time zone were removed.

**Second real run (2026-10-05), with Office 365 Outlook (R7)**, after the owner created
that connection. Same seed, same time-zone workaround:

| Step | Result |
|---|---|
| Bind the connection, update the flow, turn it on | worked |
| Due today | the same nine seed rows, plus the owner's own Medications |
| Send the email | **accepted by the connector** (*Send an email (V2)*, HTTP 200) |
| Reminder Run | outcome Sent, attempts 1; `assert-reminder-run.ps1` passes |
| Send step in run history | inputs and outputs are marked secured and cannot be opened; the same holds for `ValidateRecipient` |

What a run cannot show is the message arriving: the owner confirms that in the inbox
(or junk folder), which is the last open part of T034.

**Export (tasks.md T035)**: the unmanaged export from dev, unpacked into `solution/src`,
adds exactly the Reminder Run table with its relationships, the flow under `Workflows/`,
the two environment variable definitions and the two connection references. The test copy
of the flow was created outside the solution and is not in the export. The exported zip and
the unpacked folder both pass `assert-no-envvar-values.ps1`: the time-zone value set for
testing and the recipient value stay out, because both were created without the solution
header. The folder packs again with `pac solution pack`.

Everything else was run in dev first, in a copy of the flow whose connector steps were
replaced by stand-in steps fed from `tests/fixtures/schedule-cases.json`:

| Scenario | Result |
|---|---|
| Full decision table, zone UTC | 9 due: S01, S03, S04, S12, S17, S18, S25, S27, S29 — matches the contract; ordered by Reminder Time then name; injection lines show last taken and site |
| Full table, zone `Hawaiian Standard Time` (local date one day behind UTC) | same 9 due |
| Only rows that are not due | outcome Nothing To Send, no send step |
| Run already recorded as Sent | run ends Succeeded at the guard, nothing else runs |
| Run already recorded as Failed | set to Started, attempts 2, check continues |
| Row can be neither created nor read | run ends Failed (`GuardFailed`) |
| Recipient is not an address | outcome Failed, error step `ValidateRecipient (BadRequest)`, run Failed |
| Send step fails | outcome Failed, error step `SendEmail (…)`, run Failed |
| Step after an accepted send fails | outcome left as Started, run Failed |

Two platform details from that work: a Compose step accepts Secure Inputs only (which also
hides its output), and `createArray()` cannot be called with no arguments.

**Follow-ups (2026-10-05, tasks.md T044 and T045)**, run in the same kind of copy before
the real flow could be updated (it waits for the Office 365 Outlook connection, R7):

| Scenario | Result |
|---|---|
| Full decision table | subject `MedTrack: 9 due today, 7 follow-ups`; the same 9 due; follow-ups S13, S23, S26 (7 days), S09 (5), S08 (3), S06, S21 (1) — matches the contract, longest past due first; follow-up count 7 |
| Rows 1, 2 and 3 days past due, none due today | subject `MedTrack: 2 follow-ups`; body has the Follow-ups section only; summary `Due: –`; the 2-day row is not listed |
| One follow-up | subject `MedTrack: 1 follow-up` |
| Rows 2, 4 and 8 days past due, and a row created today | outcome Nothing To Send, no send step |

The copy was deleted afterwards. Because the address is never written into the flow, its
parameter for `ppa_ReminderRecipientEmail` has an empty default in the definition. Saving
the flow in the designer may rewrite that default from the environment; if an address ever
appeared there, the email-address checks on `solution/src` and on the exported zip are
what would catch it before a commit or an artifact upload.

---

## R11. Whose Medications the flow reads

**Decision**: The flow calls `WhoAmI` through its Dataverse connection and filters
Medications by `_ownerid_value eq <that user>`. The Dataverse connection is the owner's
own, shared with the service principal that owns the flow, so `WhoAmI` returns the owner.

**Rationale**: The reminder is personal and single-recipient (spec Assumptions). If the
connection's user holds a broad role such as System Administrator, an unfiltered query
would return every user's Medications and email them all to one address.

**Changed while building (2026-10-05)**: `WhoAmI` cannot be called from the flow. It is a
Dataverse *function*, and the connector's "Perform an unbound action" offers actions only;
turning the flow on failed until the step was removed. The flow now filters with
`Microsoft.Dynamics.CRM.EqualUserId(PropertyName='ownerid')`, which Dataverse evaluates as
"owned by the calling user" — the same rows, with no separate step. Checked in the first
real run: with the owner's connection the flow listed the nine seeded rows that were due
and the owner's own Medications, and nothing else.

---

## R12. UI placement and components

**Decision**: A new `MedicationSchedule` component rendered as the last block of
`MedicationCard`, under the Active switch and separated by the existing `Separator`. It
uses `Badge`, `Skeleton`, `Button` and Lucide icons only. Dates go through the existing
`formatDateLabel` and `formatTime` helpers. State is carried by icon and text as well as
colour. See [contracts/ui-medication-schedule.contract.md](./contracts/ui-medication-schedule.contract.md).

**Rationale**: FR-001 and FR-002 (bottom of the card, nothing else moves); Constitution III
(shadcn/ui only, design tokens, WCAG AA); FR-010 (not colour alone); FR-013 (shared
locale formatting).

**Alternatives considered**: A collapsible section — hides the one thing the user came to
read. A tooltip — unusable on touch screens.

---

## R13. Known limitations accepted

- **Half-hour-offset time zones**: with an hourly trigger the check runs at 00:30 local in
  such zones, outside SC-006's 15-minute target. Not the owner's zone. Moving to a
  30-minute trigger fixes it if ever needed.
- **One owner per environment**: the `ppa_ReminderRun` alternate key is the day alone, so
  two people cannot each have a run on the same day. Matches the single-recipient scope.
- **Flow logic is verified by seeded scenarios, not unit tests**: workflow expressions
  cannot be unit-tested in this toolchain. The seeded decision-table rows plus assertions
  on the `ppa_ReminderRun` row are the acceptance test (see quickstart.md).

---

## Sources

- Microsoft Learn — Environment variables overview and FAQ (values are separate from
  definitions; remove values from the solution before export; values should not be
  included in the solution; propagation delay for changed values).
- Microsoft Learn — Use a connection reference in a solution (OAuth connections can be
  shared only with a service principal user).
- Microsoft Learn — Pre-populate connection references and environment variables for
  automated deployments (deployment settings file; ownership or sharing validation).
- Microsoft Learn — Support for service principal owned flows; Assign a user licence to a
  flow owned by a service principal (premium flows need a Process licence or a designated
  licensed user; `licensee_systemuserid`).
- Microsoft Learn — Troubleshoot common issues with email in flows (Mail connector limit
  of 100 calls per 24 hours; Office 365 Outlook 300 calls per 60 seconds).
- Microsoft Learn — Power Automate licensing FAQ (failure and licensing behaviour of
  service-principal-owned flows).
- This repository — `src/lib/adherence.ts`, `src/hooks/use-intake-logs.ts`,
  `src/generated/models/CommonModels.ts`, `.github/workflows/promote-prod.yml`,
  `.github/workflows/deploy.reusable.yml`, `.gitleaks.toml`.
