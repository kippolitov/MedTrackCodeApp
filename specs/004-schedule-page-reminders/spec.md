# Feature Specification: Medication Schedule Details & Daily Email Reminder

**Feature Branch**: `004-schedule-page-reminders`

**Created**: 2026-10-05

**Status**: Draft

**Input**: User description: "create a new page called Schedule that shows the schedule of each medication's details, such as frequency, last time taken with corresponding body part and my next intake date scheduled. Also, trigger a cloud flow daily at midnight that would check based on the last date taken and frequency, and send email to [reminder address withheld] to remind me to take the medication today. Hide this email so it is not shown anywhere in public repo."

> The reminder address given in the original request is deliberately left out of this document. See FR-028.
>
> The original request asked for a separate "Schedule" page. That was changed during clarification: the schedule details now live on the existing Medications page. The branch name keeps the earlier wording.

## Clarifications

### Change after implementation, 2026-10-05

- Q: How should the daily reminder reach the user? → A: As a Microsoft Teams message, which
  arrives as a notification on the user's phone, with a link to the app. Email was built
  first and dropped: the user's mail provider refused messages from the new tenant.
  Everywhere this document says "email", read "reminder message". Consequences: the
  reminder goes to the user whose Medications are tracked, with no address to configure,
  so the requirements about choosing, changing and protecting a reminder address (FR-028
  to FR-031, SC-011, SC-012, User Story 2 scenarios 10 and 11) are met by there being no
  stored address; the checks that keep any address out of the repository remain. The
  "subject" is the first line of the message. Details: research R7 and
  contracts/reminder-flow.contract.md.

### Session 2026-10-05

- Q: Is the next intake date counted forward from the last Taken date (rolling interval), or is it the next occurrence of the Medication's existing fixed schedule? → A: Rolling for Injection Medications; the existing fixed schedule for every other administration method.
- Q: What happens after an intake is missed? → A: Follow-up emails are sent every other day, starting the very next day, and stop after a week — that is, on the 1st, 3rd, 5th, and 7th day after the intake was due.
- Q: Where is the schedule information shown? → A: Not on a separate page. It is shown at the bottom of each Medication's card on the existing Medications page.
- Q: What decides whether a Medication gets reminders? → A: Its Active/Inactive status. Active Medications are reminded; Inactive ones are not. There is no separate reminder setting.
- Q: What is a Medication with a missed intake called on its card? → A: "Past Due". "Overdue" keeps its existing meaning on Home: a Dose due today whose Reminder Time has passed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See each medication's schedule on its card (Priority: P1)

On the Medications page, every Medication's card gains a schedule section at the bottom.
Without opening anything else, it tells the user when they last took the Medication (and,
for injections, where on the body) and when the next intake is. The frequency is already
shown on the card and stays where it is.

For injections the next intake is counted forward from the last time the injection was
actually taken, so a late or early injection moves the following one with it. For every
other Medication the next intake follows the fixed schedule the app already uses.

**Why this priority**: This is the core of the request and delivers value on its own. Today
the user has to combine the Medications list, the Calendar, and memory to work out when a
weekly or biweekly dose is next due and which injection site was used last. It also
establishes the "next intake date" rule that the reminders in Stories 2 and 3 depend on.

**Independent Test**: With a daily pill, a weekly pill, a weekly injection, a biweekly
injection, an As-Needed medication, and an Inactive medication set up — some with Intake
Logs and one with none — open the Medications page and confirm every card's schedule section
shows the correct last taken date/time, injection site where applicable, and next intake
date. Log one injection two days late and confirm its next intake date moves two days later
while the weekly pill's does not.

**Acceptance Scenarios**:

1. **Given** the user has Medications, **When** they open the Medications page, **Then**
   every Medication's card shows a schedule section at the bottom with its last time taken
   and its next intake date, below the card's existing content.
2. **Given** an Injection Medication whose most recent Taken Intake Log recorded the site
   "Left Hip", **When** the user views its card, **Then** the last-taken date and time are
   shown together with "Left Hip".
3. **Given** a Pill Medication with a Taken Intake Log, **When** the user views its card,
   **Then** the last-taken date and time are shown and no injection site is shown.
4. **Given** a Medication with no Taken Intake Log, **When** the user views its card,
   **Then** last taken reads "Not yet taken" and a next intake date is still shown.
5. **Given** a Weekly Injection Medication last Taken on Friday 2 October, **When** the user
   views its card, **Then** the next intake date is Friday 9 October, regardless of the
   Medication's scheduled day.
6. **Given** a Biweekly Injection Medication last Taken on 1 October, **When** the user
   views its card, **Then** the next intake date is 15 October.
7. **Given** a Weekly Pill Medication scheduled for Wednesdays that was Taken late on a
   Friday, **When** the user views its card, **Then** the next intake date is the following
   Wednesday.
8. **Given** an As-Needed Medication, **When** the user views its card, **Then** next
   intake reads "As needed" and no date is shown.
9. **Given** an Inactive Medication, **When** the user views its card in the Inactive
   section, **Then** its last time taken is shown, no next intake date is shown, and the
   card states that reminders are off.
10. **Given** an Inactive Medication, **When** the user switches it to Active, **Then** its
    card immediately shows a next intake date again.
11. **Given** a Medication whose next intake is today, **When** the user views its card,
    **Then** the schedule section clearly marks it as due today.
12. **Given** a Medication with a missed intake that was due on 1 October, **When** the user
    views its card, **Then** the schedule section is marked Past Due and shows that it was
    due on 1 October.
13. **Given** the user logs a Dose as Taken elsewhere in the app, **When** they return to the
    Medications page, **Then** that Medication's last taken and next intake date reflect the
    new Intake Log without a manual refresh.

---

### User Story 2 - Get an email on the days a medication is due (Priority: P2)

Every day at midnight, an automated check works out which of the user's Active Medications
are due that day. If at least one is due, the user receives a single email listing them, so
the reminder is waiting in their inbox when they wake up — even if they never open the app.
Switching a Medication to Inactive is how the user turns its reminders off.

**Why this priority**: The email removes the need to remember to open the app, which matters
most for weekly and biweekly Medications that are easy to forget. It depends on the next
intake date rule from Story 1 and on an address that must be kept private, so it follows the
schedule details rather than leading them.

**Independent Test**: Set up one Active Medication due today, one Active Medication not due
today, and one Inactive Medication that would otherwise be due today. Let the midnight check
run and confirm that exactly one email arrives at the configured address naming only the
first. Repeat on a day with nothing due and confirm no email arrives. Search the repository
and its history for the address and confirm zero matches.

**Acceptance Scenarios**:

1. **Given** at least one Active Medication is due today, **When** the midnight check runs,
   **Then** one email is sent to the configured reminder address listing every Active
   Medication due today.
2. **Given** three Active Medications are due today, **When** the midnight check runs,
   **Then** the user receives one email listing all three, not three separate emails.
3. **Given** no Medication is due today and no follow-up is owed, **When** the midnight
   check runs, **Then** no email is sent.
4. **Given** a Medication is Inactive, **When** the midnight check runs on a day it would
   otherwise be due, **Then** it is not included in the email.
5. **Given** an Inactive Medication is switched to Active, **When** the next midnight check
   runs on a day it is due, **Then** it is included in the email.
6. **Given** a Medication is Archived or As-Needed, **When** the midnight check runs,
   **Then** it is never included in the email.
7. **Given** a Dose due today has already been logged as Taken or Skipped, **When** the
   check runs, **Then** that Medication is not included in the email.
8. **Given** an Injection Medication is due today, **When** the email is sent, **Then** its
   entry includes the date and injection site of the last Taken Intake Log so the user can
   rotate sites.
9. **Given** the check runs more than once on the same day, **When** an email has already
   been sent that day, **Then** no second email is sent.
10. **Given** the reminder address is changed in the environment's configuration, **When**
    the next midnight check runs, **Then** the email goes to the new address and nothing in
    the repository has changed.
11. **Given** the complete repository — every file, every commit, every branch — **When** it
    is searched for the reminder address, **Then** there are no matches.

---

### User Story 3 - Keep being nudged for a week after a missed intake (Priority: P3)

When the day a Medication was due ends without the user logging it as Taken or Skipped, the
intake counts as missed. Starting the very next day, the user receives a follow-up reminder
every other day for one week, so a missed weekly or biweekly dose is not silently forgotten.
After a week the follow-ups stop on their own.

**Why this priority**: It builds on the daily email from Story 2 and only matters once that
email exists. It is most valuable for injections, where a missed dose stays outstanding
until it is actually taken.

**Independent Test**: Leave a biweekly injection unlogged on its due date and let the
midnight check run for ten more days. Confirm follow-ups arrive on the 1st, 3rd, 5th, and
7th days after the due date and on no other day. Repeat, but log the injection as Taken
after the first follow-up, and confirm no further follow-up arrives.

**Acceptance Scenarios**:

1. **Given** a Medication was due on 1 October and has no Taken or Skipped Intake Log since,
   **When** the midnight check runs on 2 October, **Then** the email includes a follow-up
   for that Medication stating it was due on 1 October.
2. **Given** the same missed intake stays unlogged, **When** the check runs each day,
   **Then** follow-ups are sent on 2, 4, 6, and 8 October and not on 3, 5, or 7 October.
3. **Given** the same missed intake is still unlogged, **When** the check runs on 9 October
   or any later day, **Then** no follow-up is sent for it.
4. **Given** a missed intake, **When** the user logs the Medication as Taken or Skipped,
   **Then** no further follow-up is sent for it.
5. **Given** a missed Weekly Pill intake that was due on a Wednesday, **When** the following
   Wednesday arrives, **Then** the Medication is listed as due today and not as a follow-up.
6. **Given** a follow-up is owed on a day when other Medications are due, **When** the check
   runs, **Then** the user receives one email containing both, with follow-ups clearly
   separated from Medications due today.
7. **Given** a follow-up is owed on a day when nothing else is due, **When** the check runs,
   **Then** the user still receives one email containing the follow-up.
8. **Given** a Medication with a missed intake is switched to Inactive or is Archived,
   **When** the check runs, **Then** no follow-up is sent for it.
9. **Given** follow-ups for a missed injection have ended after a week, **When** the user
   views its card on the Medications page, **Then** it is still marked Past Due.

---

### Edge Cases

- **No Medications at all**: the Medications page keeps its existing empty state; the
  midnight check sends nothing.
- **Never taken**: a Medication with no Taken Intake Log shows "Not yet taken". Its next
  intake date comes from the fixed schedule (frequency, scheduled day, start date), for
  injections as well, until the first injection is logged.
- **Only Skipped or Missed logs exist**: neither counts as "last taken". Last taken stays
  "Not yet taken" (or the older Taken log, if one exists).
- **Injection logged as Skipped**: the next intake date moves one interval on from the
  skipped date, so a deliberate skip is not chased with follow-ups.
- **Injection logged as Missed**: this records the miss but does not move the next intake
  date; the injection stays Past Due and the follow-up week runs its course unless the
  injection is Taken or Skipped.
- **Injection still untaken after the follow-up week**: no further emails are sent for it.
  Its card stays Past Due, and emails resume only after it is next logged as Taken or
  Skipped, which sets a new next intake date.
- **Injection taken early**: the next intake date is counted from the early date, so it
  also moves earlier.
- **Dose logged a day or more late**: a Taken or Skipped Intake Log dated on or after the
  due date resolves the missed intake and stops follow-ups.
- **Missed Daily Medication on the fixed schedule**: the next Dose is due the very next
  day, so the Medication appears as due today in that day's email and no separate follow-up
  is ever sent for it.
- **Several intakes of one Medication missed in a row**: the Medication appears once in an
  email, never once per missed intake.
- **Medication switched to Inactive and back during the follow-up week**: no follow-up is
  sent while it is Inactive. Once Active again, any of the 1st, 3rd, 5th, and 7th days that
  are still ahead are honoured; days that passed while Inactive are not made up.
- **Injection logged without a site** (older data): the last-taken date and time are shown
  with no site, rather than a blank label or an error.
- **Intake Log edited or deleted**: the card reflects the current Intake Logs; if the
  latest Taken log is deleted, last taken falls back to the previous one and the next
  intake date for an injection is recalculated from it.
- **Intake Log dated in the future**: ignored when determining last taken and next intake.
- **Newly added Medication**: scheduled dates before the Medication's start date (or the
  date it was added, when no start date is set) never count as missed.
- **Weekly or Biweekly Medication with no scheduled day or start date and no Taken log**:
  next intake reads "Not scheduled" and the Medication is not emailed, rather than guessing.
- **Time zone and daylight saving**: "today" and "midnight" follow the user's local time
  zone, including on days when clocks change; the user never gets two reminders or none
  because of a clock change.
- **Email cannot be sent** (delivery failure, missing or malformed address): the failure is
  recorded where the owner can see it, no partial or duplicate email is sent, and the next
  day's check runs normally.
- **Intake history cannot be loaded on the Medications page**: the cards still show their
  Medication details, and the schedule section shows an error with a way to retry — never
  "Not yet taken", which would be a false statement.

## Requirements *(mandatory)*

### Functional Requirements

**Schedule details on the Medications page**

- **FR-001**: The Medications page MUST show a schedule section at the bottom of every
  Medication's card, below the card's existing content. No separate Schedule page and no
  new navigation item are added.
- **FR-002**: The existing content of each card (name, dosage, frequency, scheduled day,
  administration method, Reminder Time, instructions, Active switch, edit and delete), the
  Active and Inactive sections, and the order of Medications in the list MUST remain
  unchanged.
- **FR-003**: The schedule section MUST show when the Medication was last taken: the date
  and time of its most recent Taken Intake Log that is not dated in the future. Skipped and
  Missed Intake Logs MUST NOT count as last taken. When no such log exists it MUST read
  "Not yet taken".
- **FR-004**: For Injection Medications, the schedule section MUST show the injection site
  recorded on that last Taken Intake Log next to the last-taken date. Non-injection
  Medications MUST NOT show a site. If the log has no site recorded, the date is shown alone.
- **FR-005**: For an Active Daily, Weekly, or Biweekly Medication the schedule section MUST
  show its next intake date, determined as follows:
  - *Injection Medications — rolling schedule*: the next intake date is the date of the most
    recent Taken or Skipped Intake Log plus the Medication's interval: 1 day for Daily,
    7 days for Weekly, 14 days for Biweekly. Missed Intake Logs MUST NOT move the date.
    Until the Medication has a first Taken or Skipped Intake Log, the fixed schedule
    applies. The section MUST indicate that the date is counted from the last dose.
  - *All other Medications (Pill, Topical, Inhaler, Liquid) — fixed schedule*: the next
    intake date is the next date, today or later, on which the Medication is scheduled under
    the same rules that Home, Calendar, and Adherence already use. If today's Dose already
    has a Taken or Skipped Intake Log, the next intake date is the following scheduled date.
- **FR-006**: As-Needed Medications MUST show "As needed" in place of a next intake date.
  Medications whose next intake date cannot be determined MUST show "Not scheduled".
- **FR-007**: For an Inactive Medication the schedule section MUST still show when it was
  last taken, MUST NOT show a next intake date, and MUST state that reminders are off.
- **FR-008**: A Medication has a **missed intake** when its most recent due date before
  today has no Taken or Skipped Intake Log dated on or after that due date. Due dates
  earlier than the Medication's start date (or the date it was added, when no start date is
  set) MUST NOT count.
- **FR-009**: The schedule section of an Active Medication with a missed intake MUST be
  marked Past Due and MUST show the date the intake was due, for as long as the intake stays
  unlogged. A past date MUST NOT be presented as an upcoming intake.
- **FR-010**: Schedule sections that are Past Due and those due today MUST be visually
  distinguished from each other and from those due later, in a way that does not rely on
  colour alone.
- **FR-011**: The schedule section MUST reflect the current Medications and Intake Logs each
  time the Medications page is viewed, including changes made elsewhere in the app during
  the same session, and MUST update immediately when the Active switch is changed.
- **FR-012**: While intake history is loading, the schedule section MUST show a loading
  state. If it cannot be loaded, the card MUST still show its Medication details and the
  schedule section MUST show an error with a retry.
- **FR-013**: Dates and times in the schedule section MUST be shown in the user's local time
  zone, in the same locale-aware format used on the rest of the app, and the Medications
  page MUST remain fully usable on mobile and tablet screen sizes without horizontal
  scrolling.

**Daily email reminder**

- **FR-014**: The system MUST run an automated check once per day at midnight in the user's
  local time zone, without the user needing to have the app open.
- **FR-015**: A Medication's Active/Inactive status MUST be the only control over whether
  it is reminded. Active Medications are eligible for reminders and follow-ups; Inactive
  Medications MUST never be included. No separate reminder setting is introduced.
- **FR-016**: The check MUST treat an Active Medication as due today when its next intake
  date under FR-005 is today, so the email and the Medications page never disagree.
- **FR-017**: The check MUST also exclude Archived Medications, As-Needed Medications,
  Medications with no determinable next intake date, and any Medication whose Dose for
  today already has a Taken or Skipped Intake Log.
- **FR-018**: When at least one Medication is due today or owed a follow-up (FR-022), the
  system MUST send exactly one email to the configured reminder address. For every listed
  Medication the email MUST give its name, dosage, and Reminder Time, and — for Injection
  Medications — the date and injection site of the last Taken Intake Log.
- **FR-019**: When no Medication is due today and no follow-up is owed, the system MUST NOT
  send an email.
- **FR-020**: The system MUST NOT send more than one reminder email for the same calendar
  day, even if the check runs more than once.
- **FR-021**: If the check cannot complete or the email cannot be sent — including when the
  reminder address is missing or malformed — the failure MUST be recorded where the owner
  can see it. Failures MUST NOT be silently discarded and MUST NOT prevent the next day's
  check from running.

**Follow-up after a missed intake**

- **FR-022**: For each Active Medication with a missed intake (FR-008), the daily check MUST
  include a follow-up on the 1st, 3rd, 5th, and 7th day after the date the intake was due,
  and on no other day.
- **FR-023**: Follow-ups for a missed intake MUST stop as soon as any of these is true: the
  Medication has a Taken or Skipped Intake Log dated on or after the due date; the
  Medication is Inactive or Archived; for a Medication on the fixed schedule, its next
  scheduled date has arrived; or seven days have passed since the intake was due.
- **FR-024**: After the 7th day, the system MUST NOT send any further email about that
  missed intake. For an Injection Medication on the rolling schedule this means no further
  email is sent for the Medication until it is next logged as Taken or Skipped.
- **FR-025**: Follow-ups MUST be delivered in the same single daily email as Medications
  due today (FR-018, FR-020), in a clearly separate section, each stating the date the
  intake was due and how many days ago that was.
- **FR-026**: A Medication MUST appear at most once in any email. A Medication that is due
  today MUST be listed as due today rather than as a follow-up.
- **FR-027**: The daily check MUST NOT create, change, or delete Intake Logs. Recording a
  Dose as Taken, Skipped, or Missed remains a user action.

**Reminder address privacy**

- **FR-028**: The reminder address MUST NOT appear anywhere in the repository or in anything
  published from it. This covers source files, configuration files, specifications and
  other documentation, tests, sample and seed data, exported solution or flow definitions,
  the built application, commit messages, branch names, issue and pull-request text, and
  automated build or deployment logs and artifacts.
- **FR-029**: The reminder address MUST be held as environment-specific configuration
  outside the repository and MUST be changeable without any change to the repository.
- **FR-030**: Wherever the repository needs to refer to the reminder address — in
  documentation, examples, or tests — it MUST use an obviously fictitious placeholder.
- **FR-031**: Setup instructions in the repository MUST explain where the reminder address
  is supplied, without stating its value.

### Key Entities

- **Medication** *(existing)*: The recurring treatment being scheduled. This feature reads
  its name, dosage, administration method, frequency, scheduled day, start date, Reminder
  Time, and whether it is Active, Inactive, or Archived. The administration method decides
  which schedule applies (rolling for Injection, fixed for everything else); the
  Active/Inactive status decides whether it is reminded.
- **Intake Log** *(existing)*: The record of a Dose outcome. This feature reads its status
  (Taken, Skipped, Missed), its date, and its injection site. It never writes one.
- **Schedule Details** *(derived, not stored)*: One per Medication, combining its last Taken
  Intake Log, its next intake date, and whether it is due today or has a missed intake.
  Shown at the bottom of the Medication's card and used by the daily check.
- **Missed Intake** *(derived, not stored)*: A due date that passed without a Taken or
  Skipped Intake Log. Has the date it was due and the number of days since. Distinct from
  the Missed Intake Log status, which the user records by hand.
- **Reminder Address** *(configuration)*: The single email address that receives the daily
  reminder. Held per environment, outside the repository.
- **Daily Reminder Check**: One run per calendar day. Has a date, an outcome (email sent,
  nothing to send, or failed), and — when sent — the Medications it listed as due today and
  as follow-ups.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On the Medications page, the user can read the last taken date and next
  intake date of any Medication without opening another screen, in under 10 seconds.
- **SC-002**: Across a test set covering Daily, Weekly, Biweekly, As-Needed, Inactive, and
  never-taken Medications, in both Injection and non-injection methods, 100% of cards show
  the correct last taken date/time, injection site, and next intake date.
- **SC-003**: After an injection is logged late or early, its next intake date moves by
  exactly the same number of days, while a non-injection Medication logged late keeps its
  original scheduled date.
- **SC-004**: The Medications page, including every schedule section, shows its content
  within 2 seconds of being opened on a typical connection.
- **SC-005**: Over 14 consecutive days, the user receives exactly one email on every day
  that has at least one Medication due or one follow-up owed, and zero emails on every
  other day.
- **SC-006**: Every reminder email arrives within 15 minutes after midnight local time.
- **SC-007**: Every reminder email lists 100% of the Active Medications due that day and
  100% of the follow-ups owed that day, and nothing else.
- **SC-008**: Zero emails ever mention an Inactive Medication.
- **SC-009**: For an intake left unlogged for 10 days after its due date, follow-ups arrive
  on exactly the 1st, 3rd, 5th, and 7th days and on no other day.
- **SC-010**: After a missed intake is logged as Taken or Skipped, zero further follow-ups
  are sent for it, starting with the very next daily check.
- **SC-011**: A search for the reminder address across all repository files, the full
  commit history of every branch, issue and pull-request text, and build and deployment
  logs returns zero matches.
- **SC-012**: Changing the reminder address takes effect on the next daily check with zero
  changes to the repository.
- **SC-013**: The Medications page remains usable at 375 px and 768 px widths with no
  horizontal scrolling.

## Assumptions

- **Personal, single-recipient reminder**: The reminder covers the Medications owned by the
  app's owner and goes to one address. Per-user reminder addresses are out of scope.
- **Midnight means local midnight**: The check runs at 00:00 in the owner's local time zone,
  the same zone the app already uses to decide what "today" is.
- **One digest, not one email per Medication**: A single email listing everything due today
  and every follow-up owed is less noisy than several.
- **"Stop after a week" includes the 7th day**: The last follow-up goes out on the 7th day
  after the intake was due, giving four follow-ups in total.
- **Missed means unlogged**: An intake is missed when its due date ends with no Taken or
  Skipped Intake Log. The user does not have to record a Missed Intake Log for follow-ups
  to start, and recording one does not stop them.
- **Skipped is a deliberate decision**: Consistent with ADR-0001, a Dose logged as Skipped
  triggers no reminder or follow-up, and for injections it advances the rolling schedule.
- **As-Needed Medications are never reminded even when Active**: They have no due date, so
  there is no day on which a reminder could be sent.
- **Rolling schedule applies to the schedule section and emails only**: Home, the Overdue
  banner, Calendar, Adherence, and Streak keep using the fixed schedule for every
  Medication, including injections. After a late or early injection, the Medications page
  and emails can therefore name a different day than Home does until the two realign.
  Changing those existing surfaces is out of scope.
- **The schedule section is read-only**: Logging a Dose stays on the existing Home and
  Calendar surfaces. The schedule section only displays.
- **Existing card ordering is kept**: Medications are not re-sorted by next intake date.
- **Email content is acceptable in plain email**: The reminder contains Medication names and
  dosages. The owner accepts this health information being delivered to a personal inbox.
- **Delivery mechanism**: As requested, the daily check is delivered as a scheduled cloud
  flow in the same environment as the app, using that environment's standard outbound email.
- **The reminder address is supplied out-of-band**: The owner enters it directly into the
  environment's configuration during setup. It is never passed through the repository, and
  it is intentionally omitted from this specification.
- **Dependencies**: The existing Medication and Intake Log data, and the ability to send
  outbound email from the environment the app runs in.
