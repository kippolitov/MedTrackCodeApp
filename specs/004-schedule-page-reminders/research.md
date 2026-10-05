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
- "Last taken" can be arbitrarily old (an Overdue injection last taken months ago), so a
  date-bounded list query would report "Not yet taken" falsely.
- `IGetAllOptions` supports `orderBy` and `top`, so no hand-written OData is needed.
- Keys under `['intakelogs']` mean the existing create/update/delete mutations already
  invalidate these queries (FR-011). `useUpdateIntakeLog` patches cached data with
  `old?.map(…)`, so the cached value must be an array.
- Cards render immediately; only the schedule section waits (FR-012, SC-004).

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

**Decision**: The **Mail** connector, action **Send an email notification (V3)**, through
connection reference `ppa_MedTrackMail`. Secure Inputs and Secure Outputs are switched on
for the send action so the address does not appear in run history.

**Owner direction (2026-10-05)**: use the Mail connector.

**Rationale**:
- Standard (non-premium) connector that needs no mailbox and no user sign-in, so it has
  no dependency on the owner's Exchange licence or on a personal OAuth token that can
  expire. That fits a flow owned by a service principal (R10).
- Its limit of 100 calls per 24 hours is far above one email a day.

**Consequences**:
- The email is sent from a Microsoft service address, not from the owner. The first
  message may land in junk at the recipient; the owner marks the sender as safe once.
- Replies go nowhere. The email is a notification only.

**Alternatives considered**: Office 365 Outlook *Send an email (V2)* — sends from the
owner's own mailbox, but needs an Exchange Online mailbox and a user OAuth connection;
Outlook.com connector (personal account in a work tenant); SMTP connector (credentials to
manage); Azure Communication Services (new Azure resource).

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
  non-compliant. The Dataverse connector is premium; the Mail connector is not. Choosing
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

---

## R11. Whose Medications the flow reads

**Decision**: The flow calls `WhoAmI` through its Dataverse connection and filters
Medications by `_ownerid_value eq <that user>`. The Dataverse connection is the owner's
own, shared with the service principal that owns the flow, so `WhoAmI` returns the owner.

**Rationale**: The reminder is personal and single-recipient (spec Assumptions). If the
connection's user holds a broad role such as System Administrator, an unfiltered query
would return every user's Medications and email them all to one address.

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
  of 100 calls per 24 hours).
- Microsoft Learn — Power Automate licensing FAQ (failure and licensing behaviour of
  service-principal-owned flows).
- This repository — `src/lib/adherence.ts`, `src/hooks/use-intake-logs.ts`,
  `src/generated/models/CommonModels.ts`, `.github/workflows/promote-prod.yml`,
  `.github/workflows/deploy.reusable.yml`, `.gitleaks.toml`.
