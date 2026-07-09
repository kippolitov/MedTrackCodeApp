# MedTrack

A medication scheduling and adherence tracking app. Users manage a personal list of medications, log each dose outcome, and review adherence analytics.

## Language

**Medication**:
A recurring prescription or treatment a user is managing. Has a name, dosage, frequency, administration method, and optional reminder time. Not the same as a Dose.
_Avoid_: Drug, prescription

**Dose**:
A single scheduled occurrence of a Medication at a specific point in time. One Medication generates many Doses over time. Logging a Dose produces an Intake Log.
_Avoid_: Scheduled dose, medication instance

**Intake Log**:
The record created when a user acts on a Dose. Captures what happened (`ppa_status`), when the user logged it (`ppa_loggedat`), and when the dose was due (`ppa_scheduledfor`).
_Avoid_: Log entry, intake record

**Taken**:
Intake Log status — the user actually administered the medication. Counts toward adherence and streak.
_Avoid_: Completed, done

**Skipped**:
Intake Log status — a deliberate choice not to take the dose (e.g. per clinical instruction). **Neutral**: excluded from both the adherence numerator and denominator, and does not count toward or break a streak.
_Avoid_: Missed — Skipped ≠ Missed

**Missed**:
Intake Log status — the dose time passed with no deliberate action taken. Counts against adherence and breaks the streak.
_Avoid_: Skipped — Missed ≠ Skipped

**Overdue**:
A computed, transient state for a Dose: scheduled today, reminder time has already passed, and no Intake Log exists yet. Resolved by any logged status (Taken, Skipped, or Missed). Never persisted in Dataverse.
_Avoid_: Pending, due, late

**Adherence**:
The percentage of scheduled Doses that were Taken over a given time window. Skipped Doses are excluded from both numerator and denominator. Returns null when no Doses were scheduled in the window.
_Avoid_: Compliance, completion rate

**Streak**:
The number of consecutive days on which every non-Skipped scheduled Dose was Taken. A day whose only scheduled Doses were all Skipped is treated as a rest day (does not count toward nor break the streak). A day with any Missed Dose ends the streak.
_Avoid_: Run, consecutive days

**Active (Medication)**:
`ppa_isactive = true` — the medication is included in daily scheduling and adherence. The user sets this to pause or resume a medication without archiving it.
_Avoid_: Enabled — use "paused" for `ppa_isactive = false`

**Archived (Medication)**:
`statecode = 1` (Dataverse system field) — the medication is soft-deleted and must be filtered out at query time. Distinct from an Active/paused medication.
_Avoid_: Deleted, inactive (reserve "inactive" for the `ppa_isactive` toggle)

**Scheduled For**:
The datetime a Dose was due — derived from the Medication's Reminder Time on the log date. Written automatically to `ppa_scheduledfor` when an Intake Log is created; not editable by the user.
_Avoid_: Due time (that's the concept; Scheduled For is the field name)

**Reminder Time**:
A time-of-day stored on a Medication (`ppa_remindertime`, `HH:mm` format). Determines when a Dose becomes Overdue and is copied to Scheduled For when logging.
_Avoid_: Due time, alarm
