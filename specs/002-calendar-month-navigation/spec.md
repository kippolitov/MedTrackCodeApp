# Feature Specification: Calendar Month/Year Navigation & Localized Time

**Feature Branch**: `002-calendar-month-navigation`

**Created**: 2026-06-25

**Status**: Draft

**Input**: User description: "add ability to navigate between months and years on the Calendar tab. The time should be localized and in correct format (AM/PM for USA, 24 HR for others)"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse adherence history across past and future months (Priority: P1)

A user reviewing their medication history wants to look back at how well they adhered in
previous months and look ahead to upcoming days. From the Calendar tab they move backward
and forward one month at a time, and the calendar grid and the day-detail panel update to
reflect the month they are viewing.

**Why this priority**: Stepping between adjacent months is the most common navigation need and
the foundation of the calendar's value — without it, the calendar only ever shows the current
month. It is the minimum viable increment.

**Independent Test**: From the current month, step back one month and confirm the grid, the
month label, and the intake markers all reflect the previous month; step forward two months
and confirm the same. Delivers value on its own because users can review any adjacent period.

**Acceptance Scenarios**:

1. **Given** the Calendar tab showing the current month, **When** the user activates the
   "previous month" control, **Then** the calendar displays the prior month with that month's
   intake markers and the visible month/year label updates accordingly.
2. **Given** the calendar showing a past month, **When** the user activates the "next month"
   control, **Then** the calendar advances one month and updates its markers and label.
3. **Given** the calendar showing any month other than today's, **When** the user activates the
   "Today" control, **Then** the calendar returns to the current month and re-selects today.
4. **Given** the user is viewing a month boundary (e.g., December), **When** they move forward,
   **Then** the calendar correctly rolls over to the next year's January.

---

### User Story 2 - Jump directly to a specific month and year (Priority: P2)

A user who started medication many months ago, or who wants to plan around a future date,
wants to jump straight to a chosen month and year without clicking through every intervening
month.

**Why this priority**: Direct jumping removes tedious repeated stepping for users with long
histories, but it builds on and is less essential than adjacent-month stepping (P1).

**Independent Test**: Open the month and year selectors, choose a month and a year several
periods away from today, and confirm the calendar jumps directly to that month/year with the
correct markers. Delivers value because long-range navigation becomes a single action.

**Acceptance Scenarios**:

1. **Given** the Calendar tab, **When** the user opens the year selector and chooses a different
   year, **Then** the calendar displays the same month in the chosen year.
2. **Given** the Calendar tab, **When** the user opens the month selector and chooses a different
   month, **Then** the calendar displays the chosen month in the currently viewed year.
3. **Given** the user has jumped to a distant month, **When** the month/year changes, **Then**
   only intake data for the newly viewed month is loaded and displayed.

---

### User Story 3 - Read intake times in my region's format (Priority: P2)

A user reviewing the day-detail panel for a selected date wants every intake time shown in the
time format natural to their region — 12-hour with AM/PM for United States users, 24-hour for
users in regions that use it — so times are immediately readable without mental conversion.

**Why this priority**: Correct, locale-appropriate time formatting affects comprehension and
trust of adherence data. It is independent of navigation and can ship separately, but it is a
correctness/clarity improvement rather than a new navigation capability.

**Independent Test**: With the application locale set to a United States locale, confirm intake
times in the day panel render as 12-hour with AM/PM; switch to a 24-hour locale and confirm the
same times render in 24-hour format. Delivers value independently of month/year navigation.

**Acceptance Scenarios**:

1. **Given** the application is running under a United States locale, **When** the day-detail
   panel shows logged intake times, **Then** each time is displayed in 12-hour format with an
   AM/PM indicator (e.g., "8:30 AM").
2. **Given** the application is running under a locale that conventionally uses 24-hour time,
   **When** the day-detail panel shows logged intake times, **Then** each time is displayed in
   24-hour format (e.g., "20:30").
3. **Given** any supported locale, **When** a date label is shown (month/year heading and the
   selected-day heading), **Then** the date is formatted according to that locale's conventions.
4. **Given** intake times are displayed, **When** the user views them, **Then** the times reflect
   the user's local time zone consistently with how times are entered and stored.

---

### Edge Cases

- **Year rollover**: Moving forward from December shows the following January; moving back from
  January shows the previous December, with the year label updated.
- **No data in a month**: A navigated-to month with no intake logs shows an empty grid (no
  markers) and an empty-state message in the day panel rather than an error.
- **Selected day persistence**: When the viewed month changes, the day-detail panel does not show
  a day that is outside the viewed month; the selection either clears or moves to an in-month day
  in a predictable, consistent way.
- **Navigation bounds**: Selectors offer a sensible, bounded range of years (not an infinite or
  unusably long list) anchored around the period during which the user could plausibly have data.
- **Locale without explicit region**: When the host provides a language but no clear regional
  convention, the app falls back to a defined default time format rather than failing.
- **Midnight / noon edge times**: 12:00 displays correctly as "12:00 PM" (noon) and "12:00 AM"
  (midnight) in 12-hour locales, and as "12:00" / "00:00" respectively in 24-hour locales.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Calendar tab MUST let users move to the previous month and to the next month
  via clearly labeled, single-action controls.
- **FR-002**: The Calendar tab MUST let users jump directly to any month within the supported
  range without stepping through intervening months.
- **FR-003**: The Calendar tab MUST let users jump directly to any year within the supported
  range without stepping through intervening months.
- **FR-004**: When the viewed month or year changes, the system MUST update the calendar grid,
  the visible month/year label, and the intake markers to reflect the newly viewed month.
- **FR-005**: When the viewed month or year changes, the system MUST load and display intake data
  scoped to that month only (no unbounded fetching of all history).
- **FR-006**: The system MUST provide a single-action "Today" control that returns the calendar
  to the current month and re-selects the current day.
- **FR-007**: Month and year navigation MUST handle year boundaries correctly (December → next
  January, January → previous December) with the year label kept accurate.
- **FR-008**: The available year range offered for direct selection MUST be bounded to a
  reasonable window so the selector remains usable.
- **FR-009**: Intake times shown in the day-detail panel MUST be formatted according to the
  user's locale: 12-hour with an AM/PM indicator for United States locales and 24-hour for
  locales that conventionally use 24-hour time.
- **FR-010**: Date labels (the month/year heading and the selected-day heading) MUST be formatted
  according to the user's locale conventions.
- **FR-011**: Displayed intake times MUST reflect the user's local time zone consistently with
  how times are captured and stored, so a logged time reads back as the same wall-clock time.
- **FR-012**: All navigation controls and the localized time output MUST remain usable and legible
  at mobile (~375 px) and tablet (~768 px+) widths, and MUST be operable by keyboard with visible
  focus, consistent with existing Calendar tab interactions.
- **FR-013**: Navigating to a month with no logs MUST present an empty state, not an error.

### Key Entities *(include if feature involves data)*

- **Viewed Month**: The month/year currently displayed by the calendar. Drives which intake
  logs are queried and which markers are rendered. Not persisted between sessions.
- **Selected Day**: The specific day whose intake logs appear in the day-detail panel. Bounded
  to the viewed month.
- **Intake Log (existing)**: A recorded medication event with a logged timestamp and status
  (taken / missed / skipped). The timestamp is the value rendered in the user's localized time
  format.
- **User Locale**: The regional/language setting that determines time format (12- vs 24-hour),
  date label format, and time-zone presentation.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can navigate from the current month to any month within the supported range
  in no more than three interactions.
- **SC-002**: After any month or year change, the calendar grid and its intake markers reflect the
  newly viewed month within 1 second under normal conditions.
- **SC-003**: 100% of intake times shown to United States-locale users display in 12-hour AM/PM
  format, and 100% shown to 24-hour-locale users display in 24-hour format, with no mixed output
  on a single screen.
- **SC-004**: Year-boundary navigation (December↔January) produces the correct month and year
  label in 100% of forward and backward transitions.
- **SC-005**: Navigating to a month with no intake logs never produces an error state; it always
  shows an empty state.
- **SC-006**: All navigation controls are reachable and operable by keyboard and meet touch-target
  and contrast expectations at 375 px and 768 px widths.

## Assumptions

- The user's locale and time zone are derived from the application host/browser context already
  available to the app; no new user-facing locale-selection setting is introduced by this feature.
- "USA format" means 12-hour time with AM/PM; "others" defaults to 24-hour time for locales that
  conventionally use it. Where a locale's convention is ambiguous, the app applies a single
  defined default (24-hour) rather than guessing per user.
- Time-zone handling continues to use the same local-day logic already used by the Calendar tab;
  this feature changes how times are *formatted*, not how timestamps are stored.
- The supported navigation range is bounded to a practical window around the present (covering
  plausible past medication history and near-future planning) rather than unlimited.
- Time localization in scope for this feature applies to time and date displays on the Calendar
  tab; broader app-wide localization of every screen is out of scope for this increment.
- The existing month-stepping affordance from the calendar control may be retained, replaced, or
  augmented as long as the requirements above are met; the spec does not mandate a specific control
  layout.
- Existing intake-log data, query hooks, and the day-detail panel are reused; this feature adds
  navigation and formatting, not new data entities.
