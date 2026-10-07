# Contract: "MedTrack – Daily Reminder" Cloud Flow

The scheduled cloud flow that decides what is due and sends the daily reminder. Since
2026-10-05 the reminder is a Microsoft Teams message, not an email (research R7); where the
spec says "email", read "reminder message". Covers
FR-014 to FR-027 and User Stories 2 and 3. The rules it applies are in
[schedule-rules.contract.md](./schedule-rules.contract.md); the table it writes is in
[data-model.md](../data-model.md).

## Identity

| Property | Value |
|---|---|
| Display name | MedTrack – Daily Reminder |
| Solution | `MedTrackSolution` |
| Type | Scheduled cloud flow (solution-aware) |
| Owner | The deployment service principal |
| Connection references | `ppa_MedTrackDataverse`, `ppa_MedTrackTeams` (both the owner's connections) |
| Environment variables read | `ppa_ReminderTimeZone`, `ppa_MedTrackAppUrl` |
| Writes | `ppa_reminderrun` only. Never Medications or Intake Logs (FR-027) |

## Trigger

| Setting | Value |
|---|---|
| Type | Recurrence, every 1 hour, at minute 5 (`startTime` `2026-01-01T00:05:00Z`) |
| Trigger condition | local hour, from `convertFromUtc(utcNow(), <time zone>, 'HH')`, is 0, 1, 2 or 3 |
| Concurrency | 1 (no parallel runs) |

Normal night: the 00:05 run does the work and the 01:05–03:05 runs stop at step 3.

The trigger is kept off the hour boundary on purpose. A Recurrence trigger can fire a
fraction of a second early; at minute 0 that made the midnight check read the local hour
as 23 and skip itself (research R5).

## Steps

1. **Establish the day.** `today` = local date from `ppa_ReminderTimeZone`.
2. **Identify the owner.** No separate step: step 5 filters on "owned by the calling
   user", which Dataverse resolves from the connection. (`WhoAmI` is not callable from the
   connector; see research R11.)
3. **Guard.** Create a `ppa_reminderrun` row with `ppa_name = today`, outcome Started,
   attempts 1.
   - Created → continue.
   - Duplicate key → read the existing row. Outcome Failed → set it to Started, add 1 to
     attempts, continue. Any other outcome → end the run (Succeeded, nothing done).
4. *(Removed.)* There is no recipient setting to validate: step 8 reads who to notify
   from Dataverse.
5. **Load Medications.** `statecode eq 0`, `ppa_isactive eq true`,
   `ppa_frequency ne 894250003`,
   `Microsoft.Dynamics.CRM.EqualUserId(PropertyName='ownerid')`; select only the columns
   listed in data-model.md.
6. **For each Medication**, in sequence:
   1. Latest Taken log and latest Skipped log, each `top 1`, `ppa_loggedat le utcNow()`,
      newest first.
   2. Apply Steps 1–4 of the schedule rules.
   3. Due today → add to the **due** list. Follow-up owed → add to the **follow-up** list.
      Otherwise nothing.
7. **Nothing listed** → update the row: outcome Nothing To Send, both counts 0. End.
8. **Send one message** (see below):
   1. `Me` — read the connection's own user from Dataverse (`systemusers`, filtered with
      `EqualUserId(PropertyName='systemuserid')`, column `domainname`). Secure Outputs on.
   2. `SendReminder` — Microsoft Teams *Post message in a chat or channel*, posting as the
      Flow bot in a chat with that user. Secure Inputs and Secure Outputs on.
9. **Record success.** Update the row: outcome Sent, both counts, `ppa_Summary`.

Steps 4 to 9 sit in one scope. Any failure inside it runs **Failure**.

### Failure

- Update the row: outcome Failed, `ppa_ErrorStep` = `<name of the failed step> (<status code>)`.
- The raw error message is **not** stored anywhere by the flow.
- End the run as **Failed**, so it is visible in run history. Power Automate's own failure
  emails go to the flow owner, which is the service principal, so nobody receives them:
  the Reminder Run row is the record the owner checks.
- If the failure happened **after** the send action succeeded (step 9 itself failed), the
  outcome is left as Started, not Failed, so no retry can send a second message.

## Message

| Part | Content |
|---|---|
| From | the Flow bot (shown in Teams as "Workflows") |
| To | the user behind the Dataverse connection, in a one-to-one chat with the bot |
| First line | `MedTrack: <n> due today` · `MedTrack: <n> due today, <m> follow-up(s)` · `MedTrack: <m> follow-up(s)`, in bold |
| Then | two sections, each omitted when empty |
| Last line | a link "Open MedTrack" to the value of `ppa_MedTrackAppUrl`; left out unless that value starts with `https://` |

**Section "Due today"** — one line per Medication, ordered by Reminder Time then name:

`<name> — <dosage> — <Reminder Time, or "no reminder time">`

**Section "Follow-ups"** — one line per Medication, longest past due first:

`<name> — <dosage> — was due <date> (<n> day(s) ago)`

**Injection Medications**, in either section, add a second line:

`Last taken <date> · <injection site>` — or `Not yet taken`

Rules:

- A Medication appears at most once in a message (FR-026).
- No Medication names in the first line, so a lock-screen preview shows counts only.
- The app's address is an environment identifier. It is read from an environment variable
  whose value is set per environment and is never part of the solution or the repository.
- No address is stored anywhere: not in the flow, not in an environment variable.

## `ppa_Summary` format

```text
Due: <name>; <name>; …
Follow-up: <name>; <name>; …
```

A group with no entries is written as `Due: –` or `Follow-up: –`. Acceptance checks parse
this text.

## Acceptance mapping

| Spec scenario | How it is checked |
|---|---|
| US2-1, US2-2, US2-8 | Seeded scenarios → one message; Reminder Run is Sent with the expected Due names |
| US2-3 | With no Medications due → Reminder Run is Nothing To Send; no message |
| US2-4, US2-5 | Rows S31, S32 never listed; switch one to Active and re-run on a due day |
| US2-6 | Row S30 never listed; an Archived Medication never listed |
| US2-7 | Row S02 not listed |
| US2-9 | Run the flow twice on one day → second run ends at the guard; one message |
| US2-10 | Superseded: there is no address to change (privacy-and-deployment.contract.md) |
| US2-11 | See privacy-and-deployment.contract.md |
| US3-1 to US3-3 | Rows S06 to S09, S13, S14, S21 to S24 cover days 1, 2, 3, 5, 7 and 8 in a single run |
| US3-4 | Log a follow-up row as Taken; next run omits it |
| US3-5 | Row S29: its previous intake was missed and it is due again today → listed under Due, not Follow-up |
| US3-6, US3-7 | Full seeded run has both sections; a run with only follow-up rows still sends |
| US3-8 | Switch a follow-up row to Inactive; next run omits it |
| Failure visibility (FR-021) | Make the send step fail (for example, unbind the Teams connection reference) → Reminder Run is Failed with `SendReminder` or `Me`; run history shows Failed |
