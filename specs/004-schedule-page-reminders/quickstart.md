# Quickstart: Validating Medication Schedule Details & Daily Reminder

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

A run guide that proves the feature works end to end. Rules, shapes and step lists are in
the contracts and data model; this file only says how to exercise them and what to expect.

Since 2026-10-05 the reminder is a Microsoft Teams message to the user behind the
Dataverse connection (research R7). No address is configured anywhere. Every example
address in this repository is `reminder@example.com`; never type a real personal address
into a file, a commit message, an issue or a pull request.

## Prerequisites

- Node 22, `npm ci` done.
- PowerShell 7, `pac` CLI and Azure CLI signed in to the **dev** environment
  (`pac auth list` shows MedTrackDev as active).
- For scenarios D to H: the one-time environment setup in
  [contracts/privacy-and-deployment.contract.md](./contracts/privacy-and-deployment.contract.md)
  is complete for dev, and the solution containing the flow has been deployed there.

## A. Schedule rules (automated)

```bash
npm run test -- tests/lib/schedule.test.ts
```

**Expect**: one passing case per row S01–S33 of
[contracts/schedule-rules.contract.md](./contracts/schedule-rules.contract.md).
The existing `tests/lib/adherence.test.ts` still passes, with added cases showing a
Biweekly Medication is scheduled on one day per fortnight, not seven.

## B. Schedule section on the card (automated)

```bash
npm run test -- tests/components/medication-schedule.test.tsx tests/hooks/use-medication-schedule.test.tsx tests/pages/medications.test.tsx
```

**Expect**: every row of the Acceptance mapping in
[contracts/ui-medication-schedule.contract.md](./contracts/ui-medication-schedule.contract.md)
passes, including the loading state, the error state with Retry, and the Active switch.

## C. Schedule section in the browser (manual)

```bash
npm run dev:mock
```

1. Open the Medications page.
2. **Expect**: each card ends with a schedule section showing Last taken and Next intake;
   everything above it looks as it did before.
3. Check one card of each kind: due today, upcoming, Past Due, As needed, and one in the
   Inactive section reading "Reminders off".
4. Switch an Active card to Inactive and back. **Expect**: the row changes without a reload.
5. Resize to 375 px and to 768 px. **Expect**: no horizontal scrolling; rows wrap cleanly.
6. Tab through the page. **Expect**: focus order unchanged; nothing in the section traps focus.

### Live query check (once, against dev)

```bash
npm run dev:live
```

Pick a Medication with at least three Taken logs on different days.

**Expect**: its card shows the newest of them as last taken; in the browser network panel
or Power Apps Monitor each of the two schedule queries returns at most one row and only
the five selected columns. This is the only check that runs the new queries against real
Dataverse.

Then disconnect the network and reload the page. **Expect**: every card shows "Couldn't
load schedule." with Retry, and exactly one error toast appears.

## D. Seed the decision table into dev

```powershell
pwsh scripts/reminder/seed-reminder-scenarios.ps1
```

**Expect**: 33 Medications named `S01 …` to `S33 …` and their logs, with every date shifted
so that today plays the part of "5 Oct" in the table. The script is idempotent and removes
its own rows with `-Remove`.

## E. Daily reminder — full run

> **Before a manual test (found 2026-10-05, research R5)**: "Test → Manually" obeys the
> trigger condition, so it starts a run only when the local hour in `ppa_ReminderTimeZone`
> is 0 to 3. To test at another time, set that variable's current value in dev to a zone
> where it is now between 00:00 and 03:59, turn the flow off and on, and pass the same
> zone as `-TimeZone` to the seed and assert scripts. Restore the zone afterwards. Set
> the value outside the solution (not from the solution's own screen), or the next export
> fails the check in section H.

1. Delete today's Reminder Run row if one exists (the guard would otherwise stop the run).
2. In Power Automate, open **MedTrack – Daily Reminder** and choose **Test → Manually**.
3. Check the result:

```powershell
pwsh scripts/reminder/assert-reminder-run.ps1 -ExpectDue S01,S03,S04,S12,S17,S18,S25,S27,S29 -ExpectFollowUp S06,S08,S09,S13,S21,S23,S26
```

**Expect**:
- The script reports outcome **Sent**, 9 due, 7 follow-ups, and an exact match on names.
- One message arrives in Teams, in the chat with the Flow bot ("Workflows"), and as a
  notification on a phone signed in to the same account. Its first line holds the counts;
  then a "Due today" section and a "Follow-ups" section, where injection rows carry a
  "Last taken … · site" line; then an "Open MedTrack" link.
- In run history the `SendReminder` step shows its inputs and outputs as hidden, and the
  `Me` step shows its outputs as hidden.

## F. Daily reminder — guard, quiet day, changes of state

| Step | Expect |
|---|---|
| Run the flow a second time on the same day | Run ends at the guard; no second message; Reminder Run unchanged |
| Log S06 as Taken, delete today's Reminder Run, run again | S06 no longer listed |
| Switch S08 to Inactive, delete the row, run again | S08 no longer listed |
| Switch S31 to Active on a Monday, delete the row, run again | S31 listed under Due |
| `seed-reminder-scenarios.ps1 -Remove`, delete the row, run again (no Medications due) | Outcome **Nothing To Send**; no message |

## G. Daily reminder — failure is visible

1. In dev, open the connection reference **MedTrack Teams** and remove its connection.
2. Delete today's Reminder Run and run the flow.

**Expect**: the run shows **Failed** in run history; the Reminder Run row is **Failed**
with error step `SendReminder`; no message. Then pick the Teams connection again and run
the flow: the same row moves to **Sent** with attempts = 2.

## H. Privacy checks

```bash
npm run lint && npm run build:ci && npm run test
pwsh scripts/ci/assert-no-envvar-values.ps1 -Path solution/src
```

**Expect**: all pass.

Then:

1. **Planted address**: on a throwaway branch add a real-looking address (not
   `example.com`) to any Markdown file and open a pull request. **Expect**: CI fails at the
   secret scan. Delete the branch.
2. **Artifact path**: run **Promote to Production** through to the export job.
   **Expect**: the zip check passes and the uploaded `managed-solution` artifact, when
   downloaded and unzipped, contains no `environmentvariablevalues.json` and no address.
3. **History**: `gitleaks git` over the full history reports no email-address findings.

## I. Unattended overnight check

Leave the flow on for one night with at least one seeded Medication due the next day.

**Expect**: a Reminder Run for the new day with outcome Sent, created within 15 minutes of
local midnight, and exactly one message. Runs at 01:00–03:00 either do not appear or end at
the guard.

## Definition of done for this feature

- Sections A, B and H pass in CI.
- Sections C, E, F, G and I have been run once in dev and once in production (E to G in
  production use two or three real Medications instead of the seed set).
- `npm run lint` and `npm run build:ci` pass with zero errors; no new `any`.
