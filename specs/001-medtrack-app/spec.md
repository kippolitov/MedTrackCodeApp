# Feature Specification: MedTrack — Medication Reminder & Intake Logger

**Feature Branch**: `001-medtrack-app`

**Created**: 2026-06-16

**Status**: Draft

**Input**: User description: "MedTrack is a medication reminder app for users to manage their medication schedules and log intakes. The app allows users to add, edit, and delete medications, specifying details such as medication name, dosage, frequency, administration method (pill, injection, etc.), and injection site if applicable. Users can set reminders for each medication and receive notifications when it's time to take them. When logging an intake, users can record the date/time, injection site (with selectable body map), notes, and attach photos if needed. The app should provide a dashboard with an overview of upcoming doses, missed doses, and a calendar view of intake history, where user can log and update intake instances. Include analytics for adherence tracking, trends, and exportable reports. Ensure secure user authentication using Dataverse, data privacy, and a user-friendly interface optimized for both mobile and tablet devices."

---

## Clarifications

### Session 2026-06-17

- Q: Is photo attachment/URL required in v1? → A: No. Photo attachment (URL field) is out of scope for this stage; removed from intake logging and all references.
- Q: What time periods should the analytics screen support? → A: 3 months, 6 months, and 1 year (replacing the prior 7-day and 30-day windows).
- Q: Should the Log Intake dialog pre-populate the date when opened from the calendar? → A: Yes. When "Log Intake" is triggered from a calendar day, the dialog MUST pre-populate the date field with that selected calendar date.
- Q: What fields and layout does the Edit Medication form use? → A: Per provided screenshot — modal dialog with: Medication Name (text), Dosage (single combined text, e.g. "40mg/0.8mL"), Frequency (dropdown), Scheduled Day (conditional dropdown shown only when frequency is Weekly), Method (dropdown), Reminder Time (single time picker), Instructions (optional text area for special handling notes), Active (toggle). "Cancel" and "Update" buttons.
- Q: What are the exact Frequency dropdown options? → A: Per screenshot — Daily, Weekly, Biweekly, As-Needed. "Every N Days" is not an option. Scheduled Day appears for Weekly and Biweekly; As-Needed has no scheduled day.
- Q: What are the exact Method dropdown options? → A: Per screenshot — Pill, Injection, Topical, Inhaler, Liquid. Each option has a distinct icon. "Other" is not an option.
- Q: How is the Status field presented in the Log Intake dialog? → A: Three-button segmented control — "Taken" (green, checkmark icon), "Skipped" (× icon), "Missed" (clock icon). Default selection when opened is "Taken".
- Q: How does the body map behave in the Log Intake dialog? → A: A "Show Body Map" / "Hide Body Map" toggle button controls visibility. When visible: a silhouette figure displays orange filled dots on recently-used sites; valid site names appear as chip labels below the figure with "(recent)" appended to recently-used ones. Confirmed site set for injectable medications: Right Hip, Left Hip, Abdominal Right, Abdominal Center, Abdominal Left (and other standard locations per medication config).
- Q: (CHK001) Is the confirmed injection site list complete and canonical for v1? → A: Yes. The definitive site set is exactly: Right Hip, Left Hip, Abdominal Right, Abdominal Center, Abdominal Left. No additional sites (upper arm, thigh) are supported in v1.
- Q: (CHK002) What defines a "recently-used" injection site? → A: A site is recently-used if it was selected in any intake log within the past 7 days.
- Q: (CHK003) Is single-select enforced, and what are the tap targets on the body map? → A: Only one site can be selected at a time. The pill-shaped chip labels below the figure are the interactive tap targets. The filled dots on the silhouette figure are visual indicators only and are not individually tappable.
- Q: (CHK004) What happens when a medication has only one valid injection site? → A: The single valid site is auto-selected when the body map is displayed; the user does not need to tap to confirm selection.
- Q: (CHK011/CHK012) What are the pre-population rules for the Log Intake dialog per entry point? → A: Reminder banner: medication pre-set to overdue med, date/time = current, status = Taken. Dashboard schedule item: medication pre-set, date/time = current, status = Taken. Calendar day panel: date = selected calendar date, time = current, medication not pre-set, status = Taken. Standalone "Log Intake" button: date/time = current, medication not pre-set, status = Taken.
- Q: (CHK008) What happens to the Scheduled Day value when Frequency changes away from Weekly/Biweekly? → A: The previously selected Scheduled Day value is silently cleared; it is not retained if the user switches back to Weekly or Biweekly.
- Q: (CHK016) Do Add Medication and Edit Medication use the same field sets? → A: Yes — identical field sets. Edit pre-populates all fields with current saved values; Add starts with all fields empty/unset (Active defaults to enabled).
- Q: (CHK019) When does the injection site configuration section appear in the Add/Edit Medication form? → A: Only when Method is set to Injection. For all other methods (Pill, Topical, Inhaler, Liquid) the injection site section is hidden entirely.
- Q: Does the Add/Edit Medication form include an injection site configuration section? → A: No. FR-005 is removed entirely. The injection site body map appears only on the Log Intake form. All 5 canonical sites are always available for any Injection-method medication when logging — no per-medication site list is configured or stored. The ppa_medications table requires no new columns.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Medication Management (Priority: P1)

A user sets up their personal medication list by adding, editing, and deleting medications.
Each medication captures its name, dosage (as a single combined text such as "40mg/0.8mL"),
frequency, scheduled day (for weekly medications), administration method, optional special
handling instructions, a single daily reminder time, and — for injectable medications — a
list of valid injection sites for rotation. The user can toggle a medication active or inactive
without deleting it. The medication list groups records into Active and Inactive sections with
counts.

**Why this priority**: Nothing else in the app works without a medication list. This is the
foundational data-entry flow and the first thing a new user does. It also delivers standalone
value as a personal medicine cabinet reference.

**Independent Test**: A tester creates two medications (one pill with daily frequency, one
injection with weekly frequency, scheduled day Wednesday, and two valid injection sites), edits
one field on each, deactivates one, and confirms the list reflects each change — all without
touching intake logging or the dashboard.

**Acceptance Scenarios**:

1. **Given** a user is on the Medications screen, **When** they tap "Add Medication" and
   complete all required fields, **Then** the new medication appears in the Active section
   of their list immediately, showing name, dosage, frequency tag, method tag, and reminder time.
2. **Given** an existing medication, **When** the user opens Edit Medication and changes the
   dosage text and saves via "Update", **Then** the updated dosage is shown everywhere the
   medication appears.
3. **Given** the user sets Frequency to "Weekly" in the Add/Edit form, **When** the form
   renders, **Then** a "Scheduled Day" dropdown appears allowing selection of a day of the week.
4. **Given** the user enters text in the optional Instructions field,
   **When** the medication is saved, **Then** the instructions text appears on the medication
   card in the list.
5. **Given** an existing medication, **When** the user deletes it after confirming the
   confirmation prompt, **Then** it is removed from the list and no longer appears in reminders
   or the schedule.
6. **Given** an active medication, **When** the user sets the Active toggle to off and saves,
   **Then** the medication moves to the Inactive section and disappears from the daily schedule.

---

### User Story 2 — Dashboard & Daily Schedule (Priority: P2)

A user opens the app and sees a personalised dashboard that shows today's date, an at-a-glance
health greeting, and four key statistics: 7-day adherence percentage, current streak (consecutive
days with all doses taken), missed doses today, and active medication count. Below the stats sits
"Today's Schedule" — a list of every dose due today with its time and status. A persistent
medication-reminder banner appears when a dose is overdue, showing medication name, dosage,
how long it is overdue, and a one-tap "Log" button.

**Why this priority**: The dashboard is what users open every day. It is the primary driver of
adherence behaviour and the surface where users act on reminders. Without it, the app has no
daily touchpoint.

**Independent Test**: With seed data (one medication, one overdue dose), a tester confirms the
dashboard shows the correct adherence %, streak, missed count, today's schedule entry, and
the overdue reminder banner — without using any other screen.

**Acceptance Scenarios**:

1. **Given** a user has at least one active medication with a dose due today, **When** they
   open the dashboard, **Then** they see that medication in "Today's Schedule" with the
   correct scheduled time.
2. **Given** a dose is overdue, **When** the user views the dashboard,
   **Then** a banner shows the medication name, dose, and how many hours/minutes it is overdue.
3. **Given** the user taps "Log" on the reminder banner, **When** the Log Intake dialog opens,
   **Then** it is pre-filled with the relevant medication and the current date/time.
4. **Given** a user who has taken all doses for 5 consecutive days, **When** they view the
   dashboard, **Then** the streak counter shows 5.
5. **Given** no medications are scheduled for today, **When** the user views the schedule
   section, **Then** an empty state message and an "Add Medication" call-to-action are shown.

---

### User Story 3 — Intake Logging (Priority: P3)

A user records a dose event via the Log Intake dialog. They select the medication from a
dropdown (showing name and dosage), set the actual date and time, then choose a status using
a three-button segmented control: Taken (green), Skipped, or Missed. For injectable medications,
an Injection Site section appears with a Show/Hide Body Map toggle; tapping the figure or a
chip label selects a site, with recently-used sites marked "(recent)" and shown with orange
dots on the silhouette. Optionally, they add free-text notes. The dialog can be opened from
the reminder banner, the dashboard schedule, the calendar, or a standalone "Log Intake" button.

**Why this priority**: Intake logging is the data-capture event that powers adherence
statistics, the calendar, and analytics. Without it, all other views are empty.

**Independent Test**: A tester opens the Log Intake dialog independently, logs a "Taken"
injection event on Humira with injection site "Left Hip" and a note, then confirms the record
appears in the intake history with all fields intact.

**Acceptance Scenarios**:

1. **Given** the Log Intake dialog is open, **When** the user selects an injectable medication,
   **Then** the injection site body map is displayed with all 5 canonical sites available as chip labels.
2. **Given** the body map is visible, **When** the user taps a site,
   **Then** it becomes selected and the site label appears below the map; recently-used sites
   are labelled "(recent)".
3. **Given** all required fields are filled, **When** the user taps "Log Intake",
   **Then** the intake is saved and a success toast is shown.
4. **Given** a pill medication is selected, **When** the Log Intake dialog is shown,
   **Then** the injection site section is hidden entirely.
5. **Given** an existing intake record on the calendar, **When** the user opens and edits it,
   **Then** the updated fields are saved and the calendar reflects the change immediately.

---

### User Story 4 — Calendar & History View (Priority: P4)

A user navigates to the Calendar screen to review their intake history month by month.
Each day cell is visually marked to indicate whether it had doses taken, skipped, or missed
(colour-coded dots or fill). Tapping a day opens a side panel listing every intake event for
that day, with medication name, time, status, and injection site. From this panel the user can
log a new intake for that day — with the date pre-populated — or edit/delete an existing one.

**Why this priority**: The calendar gives users a bird's-eye view of their adherence history
and lets them retrospectively correct or supplement records. It adds significant value but
requires US3 data to be meaningful.

**Independent Test**: With pre-seeded intake records across at least two weeks, a tester
confirms the calendar shows correct colour indicators per day, taps a day to see the detail
panel, taps "Log Intake" and confirms the dialog date is pre-populated with that day, and
successfully saves the new intake.

**Acceptance Scenarios**:

1. **Given** intake records exist for a month, **When** the user views that month on the
   calendar, **Then** each day with records shows a colour indicator matching its intake
   statuses (taken / skipped / missed).
2. **Given** the user taps a day with records, **When** the day detail panel opens,
   **Then** all intake events for that day are listed with medication, time, status, and
   injection site (where applicable).
3. **Given** the day detail panel is open for a specific calendar date, **When** the user
   taps "Log Intake", **Then** the Log Intake dialog opens with the date field pre-populated
   with that selected calendar date (not the current date).
4. **Given** the user is on the calendar, **When** they navigate to the previous or next
   month, **Then** the calendar updates to show that month's data without a full-page reload.
5. **Given** a day with no records, **When** the user taps it,
   **Then** the panel shows an empty state with a "Log Intake" option.

---

### User Story 5 — Analytics & Adherence Reports (Priority: P5)

A user visits the Analytics screen to understand their long-term adherence patterns. They see
charts of adherence percentage over three selectable time windows: 3 months, 6 months, and
1 year. A per-medication breakdown and a trend line are also shown. They can export their full
intake history as a downloadable CSV report filtered by date range and medication. All analytics
data reflects only the authenticated user's records.

**Why this priority**: Analytics provides motivation and clinical value but is not required for
the core daily use loop. It is the last feature to be delivered, building on the data populated
by US1–US4.

**Independent Test**: With at least 90 days of pre-seeded intake data, a tester confirms the
analytics screen shows an accurate adherence percentage across all three time windows, a readable
trend chart, a per-medication breakdown, and successfully downloads a CSV export containing the
expected rows.

**Acceptance Scenarios**:

1. **Given** intake history exists, **When** the user opens Analytics,
   **Then** they see a chart with three selectable views: 3 months, 6 months, and 1 year,
   each showing adherence % for the corresponding period.
2. **Given** the user selects a specific medication filter, **When** the chart updates,
   **Then** only adherence data for that medication is shown.
3. **Given** the user sets a date range and taps "Export",
   **Then** a CSV report is generated containing one row per intake event within that range,
   including medication name, date/time, status, injection site, and notes.
4. **Given** two users with separate accounts, **When** each views Analytics,
   **Then** each sees only their own intake data — no cross-user data leakage.

---

### Edge Cases

- What happens when a user deletes a medication that has existing intake logs? The intake
  logs must be preserved (with the medication name retained as a string snapshot) so that
  historical adherence data remains accurate.
- What if the user logs two intakes for the same medication at the same time? The system
  must allow it (e.g., split doses) but show both entries distinctly in the calendar.
- What happens if the user is offline or the Dataverse connection fails when logging an intake?
  The user must receive a clear error message; the form data must not be lost so they can retry.
- What if the user navigates away mid-form in the Log Intake dialog without saving?
  The unsaved changes are discarded silently (no persistence of partial data).
- What happens when there is no intake history for the selected calendar month?
  All day cells show as empty; navigating to a future month shows the same empty state.
- What if the user opens the calendar for a date that is more than 1 year in the past?
  The calendar must still display correctly, but adherence indicators may reflect data outside
  the analytics window; the calendar is a history view, not bounded by analytics periods.

---

## Requirements *(mandatory)*

### Functional Requirements

**Medication Management**

- **FR-001**: Users MUST be able to create and edit a medication record specifying:
  - *Name*: free-text medication name.
  - *Dosage*: a single combined text field (e.g., "40mg/0.8mL").
  - *Frequency*: dropdown with exactly four options: Daily, Weekly, Biweekly, As-Needed.
  - *Scheduled Day*: day-of-week dropdown that MUST appear when Frequency is "Weekly" or
    "Biweekly", and MUST be hidden for Daily and As-Needed. When the user changes Frequency
    from Weekly or Biweekly to Daily or As-Needed, any previously selected Scheduled Day value
    MUST be silently cleared and not retained.
  - *Method*: administration method dropdown with exactly five options, each with a distinct
    icon: Pill, Injection, Topical, Inhaler, Liquid.
  - *Reminder Time*: a single time-of-day picker per medication.
  - *Instructions* (optional): free-text area for special handling notes
    (e.g., "Refrigerate before use, allow to warm to room temperature").
  - *Active*: boolean toggle controlling whether the medication appears in the daily schedule.
- **FR-002**: The Add and Edit Medication forms MUST be presented as a modal dialog using
  identical field sets. In Add mode, all fields start empty/unset except Active, which defaults
  to enabled. In Edit mode, all fields are pre-populated with the medication's current saved
  values. Edit provides "Cancel" and "Update" actions; Add provides "Cancel" and "Save" (or
  equivalent) actions.
- **FR-003**: Users MUST be able to delete a medication after confirming a destruction prompt;
  associated intake logs MUST be retained with a snapshot of the medication name.
- **FR-004**: Users MUST be able to mark a medication inactive via the Active toggle; inactive
  medications MUST be hidden from the daily schedule but remain visible in the medication list
  under a separate "Inactive" section.
- **FR-006**: The medication list MUST group medications into Active and Inactive sections, each
  showing a count, and display per card: name, dosage, frequency tags, method tag, reminder time,
  and instructions preview (when present).

**Dashboard**

- **FR-007**: The dashboard MUST display: current date, personalised greeting, 7-day adherence
  percentage, current streak (consecutive fully-adherent days), missed-dose count for today,
  and active medication count.
- **FR-008**: The dashboard MUST list all doses scheduled for today, showing medication name,
  dosage, scheduled time, and intake status (pending / taken / skipped / missed).
- **FR-009**: When one or more doses are overdue, the dashboard MUST display a persistent
  reminder banner showing the overdue medication, dosage, and elapsed overdue time; the banner
  MUST include a one-tap "Log" action that opens the Log Intake dialog pre-filled for that dose.
- **FR-010**: The dashboard MUST provide a "Log Intake" button that opens the Log Intake dialog
  independently of any specific overdue reminder.

**Intake Logging**

- **FR-011**: Users MUST be able to log an intake event specifying: medication (from their list),
  actual date and time, and status selected via a three-button segmented control:
  "Taken" (checkmark icon, green when active), "Skipped" (× icon), "Missed" (clock icon).
  The Log Intake dialog MUST pre-populate fields based on how it was opened:
  - *From overdue reminder banner*: medication pre-set to the overdue medication; date/time = current; status = Taken.
  - *From dashboard schedule item*: medication pre-set to that schedule item's medication; date/time = current; status = Taken.
  - *From calendar day detail panel*: date pre-set to the selected calendar date; time = current; medication not pre-set; status = Taken.
  - *From standalone "Log Intake" button*: date/time = current; medication not pre-set; status = Taken.
- **FR-012**: When the selected medication's administration method is Injection, the Log Intake
  form MUST show an "Injection Site" section containing a "Show Body Map" / "Hide Body Map"
  toggle button. When the body map is visible:
  - A human silhouette figure MUST display filled orange dots on recently-used sites (visual indicator only — the figure itself is NOT a tap target).
  - All five canonical injection sites MUST appear as pill-shaped chip labels below the figure; tapping a chip selects that site. The canonical set is: Right Hip, Left Hip, Abdominal Right, Abdominal Center, Abdominal Left.
  - Only ONE site may be selected at a time (single-select). Tapping a chip selects it and deselects any previously selected site.
  - The user MUST have one site selected before the "Log Intake" save action is enabled.
  - When the method is not Injection, this entire section MUST be hidden.
- **FR-013**: The body map MUST visually distinguish two site states:
  - *Recently-used*: the site was selected in an intake log within the past 7 days — shown as a filled orange dot on the figure AND a "(recent)" suffix on its chip label.
  - *Not recently used*: no dot on the figure; chip label shows the site name only with no suffix.
  The complete canonical site set in v1 is: Right Hip, Left Hip, Abdominal Right, Abdominal Center, Abdominal Left.
- **FR-014**: Users MUST be able to add free-text notes to any intake log entry.
- **FR-015**: Users MUST be able to edit any field of an existing intake log after it has been
  saved.

**Calendar**

- **FR-016**: The calendar MUST display a month view with colour-coded indicators per day
  reflecting the intake statuses (taken / skipped / missed) recorded on that day.
- **FR-017**: Tapping a day MUST open a detail panel listing all intake events for that day.
- **FR-018**: When "Log Intake" is triggered from a calendar day detail panel, the Log Intake
  dialog MUST pre-populate the date field with the selected calendar date.
- **FR-019**: Users MUST be able to log a new intake or edit/delete an existing one directly
  from the calendar day detail panel.
- **FR-020**: Users MUST be able to navigate between months without losing their session state.

**Analytics**

- **FR-021**: The analytics screen MUST show adherence percentage as a chart with three
  selectable time windows: 3 months, 6 months, and 1 year.
- **FR-022**: Adherence data MUST be filterable by individual medication.
- **FR-023**: Users MUST be able to export their intake history as a downloadable CSV report
  filtered by date range and optionally by medication.

**Security & Privacy**

- **FR-024**: The app MUST authenticate users via the platform identity provider (Power Platform /
  Dataverse); the app MUST NOT implement its own credential store.
- **FR-025**: Each user's medication and intake data MUST be isolated; users MUST only be able
  to read and write their own records.
- **FR-026**: Exported reports MUST contain only the requesting user's data.

### Key Entities

- **Medication**: Represents a single drug or supplement in the user's list. Key attributes:
  name, dosage (single combined text), administration method, frequency, scheduled day (when
  weekly or biweekly), single reminder time, instructions (optional free-text), active/inactive
  status, owner (user reference).
- **Intake Log**: Records a single dose event. Key attributes: medication reference, medication
  name snapshot (for deleted medications), actual date/time taken, status (Taken / Skipped /
  Missed), injection site (when applicable), notes, owner (user reference).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can add their first medication and log their first intake in under
  3 minutes from first opening the app.
- **SC-002**: The dashboard loads and displays today's schedule in under 2 seconds on a
  standard device with an active connection.
- **SC-003**: 90% of users can locate the "Log Intake" action without guidance on their
  first session (measured via task-completion observation).
- **SC-004**: The Log Intake flow from opening the dialog to successful save takes under
  60 seconds for an injection dose including body-map site selection.
- **SC-005**: Adherence percentage and streak shown on the dashboard exactly match the
  values calculated from the raw intake log data (0% tolerance for calculation errors).
- **SC-006**: The calendar displays intake history for any month containing records within
  1 second of the user navigating to that month.
- **SC-007**: An exported CSV report covering a 1-year window with data for 3 medications
  downloads and opens correctly in a standard spreadsheet application within 5 seconds of
  the export action.
- **SC-008**: No intake or medication record belonging to User A is visible to or editable
  by User B under any navigation path (verified by cross-account testing).
- **SC-009**: The app is fully usable — all primary tasks reachable without horizontal
  scrolling — on a 375 px wide mobile screen and a 768 px wide tablet screen.

---

## Assumptions

- Users are authenticated via Power Platform / Dataverse before accessing any screen; there
  is no guest or anonymous access mode.
- Photo attachment functionality (URL or camera) is out of scope for this version.
- Reminders are in-app banner notifications surfaced on the dashboard when a dose becomes
  overdue; push notifications to the device OS are a future enhancement dependent on
  platform connector availability.
- Medication frequency options are exactly: Daily, Weekly (with Scheduled Day), Biweekly (with
  Scheduled Day), and As-Needed. No custom interval (e.g., "every N days") is supported in v1.
- The canonical injection site set in v1 is exactly five locations: Right Hip, Left Hip,
  Abdominal Right, Abdominal Center, Abdominal Left. Upper arm and thigh sites are out of
  scope for v1. Custom site names are not supported.
- All times are stored and displayed in the user's local device timezone; multi-timezone
  support is out of scope for v1.
- The app targets a single authenticated user per device session; family/caregiver proxy
  accounts (managing another person's medications) are out of scope for v1.
- Export report format is CSV; PDF export is a future enhancement.
- Data retention follows standard Dataverse / Power Platform policies; no custom data
  retention or deletion workflow is required for v1.
