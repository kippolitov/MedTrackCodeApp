# MedTrack — Agent Team Plan Review

**Date**: 2026-06-20 | **Branch**: `001-medtrack-app`

Three specialist agents (Data Architect, UX Designer, The Skeptic) independently reviewed
the MedTrack spec, plan, data model, and implementation code. This document consolidates
all findings by severity.

**Total findings**: 14 Critical · 15 High · 16 Medium · 4 Low

---

## CRITICAL — Must Fix Before Any Testing

These issues cause silent failures, security gaps, or broken core features.

### C-01 — Biweekly medications are never scheduled (silent, guaranteed)

**Source**: Skeptic #2 (escalating Data Architect #6)

`createdon` is not in `MEDICATIONS_SELECT` in `use-medications.ts`, but
`scheduledDosesOnDay()` in `adherence.ts` reads `med.createdon` for the Biweekly
frequency path. Because `$select` is applied on every `getAll()` call and `createdon`
is absent from the list, the field is always `undefined`. The guard `if (!med.createdon)
return false` silently fires for every biweekly medication — they never appear in Today's
Schedule, never count toward adherence, and never trigger the overdue banner.

**Fix**: Add `'createdon'` to `MEDICATIONS_SELECT` in `src/hooks/use-medications.ts`.

---

### C-02 — Analytics medication filter is always broken (silent, guaranteed)

**Source**: Skeptic #5

`analytics.tsx` filters by `l['ppa_Medication@odata.bind']?.includes(medicationId)`.
`ppa_Medication@odata.bind` is a write-only OData navigation property — it is never
present on retrieved records, which expose `_ppa_medication_value` instead. The
`includes()` check always evaluates to `undefined` → falsy. All per-medication filtering
and per-medication adherence breakdowns always return zero results regardless of selection.

**Fix**: Replace `l['ppa_Medication@odata.bind']?.includes(medicationId)` with
`l._ppa_medication_value === medicationId` everywhere in `analytics.tsx`.

---

### C-03 — Medication deletion blocked when intake logs exist

**Source**: Skeptic #1 + Data Architect #3

The `ppa_medication` lookup on `ppa_intakelogs` is marked `required: true` at the
Dataverse column level. In Dataverse, the default cascade behavior for a required
lookup is **Restrict** — deletion of the parent record fails with a constraint error
when child records exist. This means **no medication can ever be deleted** once it has
a single intake log. FR-003 (delete with log preservation) is undeliverable as modelled.

**Fix**: (1) Change the `ppa_medication` lookup to optional (nullable) at the Dataverse
column level. (2) Confirm the relationship cascade is set to `Remove Link` (not `Restrict`
or `Cascade Delete`). (3) Add try/catch to `useDeleteMedication()` in `medications.tsx`
with a user-facing toast error.

---

### C-04 — Medication save has no error handling — silent data loss on network failure

**Source**: Skeptic #4

`handleSave()` in `medication-form.tsx` calls `createMed.mutateAsync()` and
`updateMed.mutateAsync()` with no try/catch. A transient network error or Dataverse
validation error (400/500) throws unhandled, producing either a blank screen or a React
crash. The user has no indication whether the medication was saved, and all entered data
is lost. The spec's edge-case requirement ("form data must not be lost so they can retry")
is violated.

**Fix**: Wrap `handleSave()` in try/catch and call `toast.error()` on failure — matching
the existing pattern in `log-intake-dialog.tsx`.

---

### C-05 — No server-side owner filter — data isolation depends entirely on role config

**Source**: Skeptic #3

`useMedications()` and `useIntakeLogs()` perform unbounded `getAll()` calls with no
`filter` on `ownerid` or `_owninguser_value`. FR-025 and SC-008 (per-user data isolation)
are assumed to be enforced by the Dataverse security role alone. If the security role is
misconfigured or uses Business Unit scope instead of User scope, every user can read every
other user's medications and intake logs. There is zero defense-in-depth.

**Fix**: Either (a) explicitly add a cross-account test to the test plan that verifies
SC-008 with a real second account, OR (b) add an explicit `filter: '_owninguser_value eq
<currentUserId>'` to all list queries.

---

### C-06 — `ppa_instructions` maxLength 100 — too small for clinical notes

**Source**: Data Architect #1

`ppa_instructions` is capped at 100 characters. The example in the spec is
"Refrigerate before use, allow to warm to room temperature" (60 chars), and real
clinical instructions (preparation steps, allergy warnings, split-dose protocols)
routinely exceed this. Users who type more than 100 characters will hit a silent
truncation or a Dataverse 400 error.

**Fix**: Increase `ppa_instructions` maxLength to 2000 at the Dataverse column level
and regenerate the service types.

---

### C-07 — `ppa_notes` maxLength 100 — too small for intake notes

**Source**: Data Architect #2

Same problem as C-06 for the intake log notes field. Free-text clinical observations
easily exceed 100 characters.

**Fix**: Increase `ppa_notes` maxLength to 2000 and regenerate.

---

### C-08 — CSV export writes raw option-set codes for injection sites

**Source**: UX Designer #9, escalated by Skeptic Escalation #1

`analytics.tsx` line 114: `String(l.ppa_injectionsite)` writes `"894250001"` into
the CSV "Injection Site" column. The export is clinically unusable — codes are
indecipherable to any user or clinician reading the file. `getSiteLabel()` is already
available in `src/lib/injection-sites.ts`.

**Fix**: Change to `getSiteLabel(l.ppa_injectionsite)` in the CSV export handler.

---

### C-09 — Multiple overdue medications: no path to log all of them

**Source**: UX Designer #3, escalated by Skeptic Escalation #3

When 2+ medications are overdue, the banner shows only "Log First." There is no "View
All" button or any path to the 2nd, 3rd, 4th overdue medication from the banner. A user
with 5 simultaneous breakfast medications must: tap "Log First" → complete full dialog →
return to dashboard → wait for banner to recalculate → repeat 4 more times. The core
multi-medication daily flow is broken.

**Fix**: Add a "View All" button that opens a modal listing all overdue medications with
individual "Log" buttons, or auto-expand the banner to show each medication with its own
Log action.

---

### C-10 — Edit flow for inactive medication's intake log is permanently broken

**Source**: UX Designer #10, escalated by Skeptic Escalation #4 and Skeptic #10

The LogIntakeDialog medication dropdown filters to `activeMeds` only. When editing a
historical log for a medication that has since been deactivated, the pre-populated
`medicationId` matches nothing in the dropdown. `selectedMed` is `undefined`, `canSave`
is permanently `false`, and the save button is permanently disabled with no explanation.
FR-015 ("MUST be able to edit any field of an existing intake log") is flatly violated.

**Fix**: In edit mode, merge the editing medication into the dropdown list regardless of
active status. Show it with an "(inactive)" label suffix.

---

### C-11 — Body map defaults to expanded — buries save button on mobile

**Source**: UX Designer #1

`showBodyMap` initializes to `true`. On a 375px screen, the expanded body map
(silhouette + 5 chip labels) pushes the "Log Intake" save button off-screen. The user
must scroll to both select a chip and reach the save button. SC-004 (≤ 60-second
injection log) is at immediate risk.

**Fix**: Default `showBodyMap` to `false`. Auto-expand only when an injection-method
medication is pre-populated on dialog open.

---

### C-12 — Disabled "Log Intake" button gives no explanation when injection site missing

**Source**: UX Designer #2

When an injection medication is selected and no site has been chosen, the "Log Intake"
button is disabled with no tooltip, inline message, or visual indicator explaining why.
A first-time user cannot discover what they need to do to proceed.

**Fix**: Show an inline hint below the Injection Site section ("Select an injection site
to continue") when `isInjection && !selectedSite && attemptedSave`. Alternatively,
enable the button and show a validation toast on tap.

---

### C-13 — LogIntakeDialog backdrop-click silently discards injection log data

**Source**: UX Designer #6, escalated by Skeptic Escalation #6

Radix Dialog closes on backdrop click by default. A user who has spent 30 seconds
selecting an injection site and typing notes loses all data if they misclick outside
the dialog. On mobile, misclicking the backdrop is common. SC-001 (first-time task
in < 3 minutes) is threatened when the user must redo the entire injection log.

**Fix**: Add `onInteractOutside={(e) => e.preventDefault()}` to the Dialog content
when form state is dirty, OR show a "Discard changes?" confirmation before closing.

---

### C-14 — Edit Medication: Cancel silently discards changes without confirmation

**Source**: UX Designer #6

`medication-form.tsx` has no dirty-check before `onOpenChange(false)`. Tapping Cancel
in Edit mode after modifying multiple fields discards all changes without warning.

**Fix**: Track `isDirty` by comparing current form state to `initialValues` snapshot.
Show a "Discard changes?" confirmation dialog when `isDirty && isEdit`.

---

## HIGH — Fix Before Release

### H-01 — Overdue banner never refreshes after page load

**Source**: Skeptic #6

`useMedications()` and `useIntakeLogs()` inside `use-overdue.ts` have no `refetchInterval`.
The overdue banner is frozen at its initial state — doses that become overdue after page
load never appear, and logged doses keep the banner showing.

**Fix**: Add `refetchInterval: 60_000` to the medications query and `refetchInterval: 30_000`
to the intake logs query within `use-overdue.ts`.

---

### H-02 — Dashboard schedule doesn't distinguish Skipped / Missed / Pending

**Source**: UX Designer #4

The schedule list shows only "Taken" badge or "Log" button. Explicitly Skipped or Missed
doses look identical to pending (not-yet-logged) doses. Users cannot tell if a dose was
handled or just not recorded yet, leading to double-logging risk.

**Fix**: Show per-item status badges: Taken (green), Skipped (grey), Missed (red), Pending
(default). Show "Edit" icon for already-logged items instead of a second "Log" button.

---

### H-03 — `now` is stale in LogIntakeDialog — recent sites don't update within session

**Source**: Skeptic #7

`const now = new Date()` in `log-intake-dialog.tsx` is captured at component mount, not
on each dialog open. The component stays mounted on `home.tsx`. Sites used after the first
session mount never appear as "(recent)" in subsequent opens during the same session.

**Fix**: Move `const now = new Date()` inside the `useEffect` that fires on `open`, or
compute it fresh inside the `getRecentSites()` call.

---

### H-04 — `ppa_scheduledfor` required but As-Needed medications have no scheduled time

**Source**: Data Architect #7

For As-Needed medications with no reminder time, `scheduledFor` is set to the log time
itself (a meaningless value). The column is marked required at Dataverse level, and a
POST without it will fail. The As-Needed semantic is muddled.

**Fix**: Document the convention: for As-Needed medications, `ppa_scheduledfor` is set
equal to `ppa_loggedat`. Add this to `data-model.md`. Alternatively, make the column
optional at the Dataverse level.

---

### H-05 — Biweekly week alignment uses calendar-week boundary, not creation date

**Source**: Skeptic #9

`differenceInCalendarWeeks(date, start)` counts from the start-of-calendar-week
containing `start`, not from `start` itself. A medication created on Wednesday with a
Biweekly/Monday schedule would count the preceding Monday as week 0, making the
medication appear scheduled before it was created.

**Fix**: Use `differenceInWeeks` (exact weeks from creation timestamp) and add
`isAfter(date, med.createdon)` guard to prevent scheduling before creation date.

---

### H-06 — Rapid double-tap creates duplicate intake logs

**Source**: Skeptic #11

`isPending` propagates through React's render cycle asynchronously. A double-tap before
the first render can submit two identical mutations, creating duplicate Taken records.
This inflates adherence above 100% and corrupts the streak counter.

**Fix**: Track submission state with a `useRef` boolean set synchronously on first tap,
cleared on promise resolution. This prevents the race condition that `isPending` cannot.

---

### H-07 — Future dates allowed in Log Intake — corrupts analytics and calendar

**Source**: Skeptic #12

No validation prevents `loggedAtDate` from being set to a future value. A user who
accidentally enters next month's date creates a log that inflates future adherence, appears
in the calendar for a future month, and shows "(recent)" injection sites indefinitely.

**Fix**: Validate `loggedAtDate <= new Date()` before save. Show an inline error for
future datetimes.

---

### H-08 — `statecode` not filtered in medications query

**Source**: Skeptic #8

`useMedications()` applies no `filter: 'statecode eq 0'`. If a record is deactivated at
the Dataverse level (admin action), its behavior in the app is undefined — it may appear
with `ppa_isactive: true` but be excluded from some queries.

**Fix**: Add `filter: 'statecode eq 0'` to the medications `getAll()` call.

---

### H-09 — Calendar day panel hidden below fold on mobile with no affordance

**Source**: UX Designer #7

The day panel (`<aside>`) stacks below the calendar on mobile. On a 375px device the
calendar fills the viewport. After tapping a day, the panel is off-screen with no visual
hint that it exists. The "Log Intake" button in the panel is undiscoverable.

**Fix**: Convert the day panel to a bottom sheet (Radix/Vaul Drawer) on mobile, or
`scrollIntoView` the panel header after a day is tapped.

---

### H-10 — No "Today" button on calendar navigation

**Source**: UX Designer #8

After reviewing history for a past month, returning to the current month requires N taps
of the next-month button. No shortcut exists.

**Fix**: Add a "Today" text button next to the month/year label. On click:
`setViewedMonth(new Date())`.

---

### H-11 — Dosage field placeholder doesn't show combined format

**Source**: UX Designer #5

Placeholder shows "e.g. 100mg" but the spec's primary use case is "40mg/0.8mL" for
injectables. First-time users of injectable medications won't know combined notation
is supported.

**Fix**: Change placeholder to `"e.g. 100mg or 40mg/0.8mL"`.

---

### H-12 — `ppa_logname` overloaded as both primary name and medication snapshot

**Source**: Data Architect #8

The primary name column on `ppa_intakelogs` serves double duty as the medication name
snapshot. Future enhancements (e.g., composite display name "Humira – 2026-06-20 – Taken")
cannot be added without corrupting the snapshot.

**Fix (v1 acceptable)**: Document the coupling in `data-model.md`. Plan to add a
dedicated `ppa_medicationname_snapshot` column before adding display-name logic.

---

### H-13 — DateTime behavior for intake log columns undocumented

**Source**: Data Architect #5

`ppa_loggedat` and `ppa_scheduledfor` must use `DateTimeBehavior = UserLocal` (store UTC,
display in user's local timezone). This is assumed but not documented. If configured as
`TimeZoneIndependent`, all displayed times will be shifted by the user's UTC offset.

**Fix**: Verify both columns are `UserLocal` in the Dataverse environment. Document
explicitly in `data-model.md`. Add a timezone round-trip test.

---

### H-14 — Missing `ppa_startdate` column for Biweekly anchor date

**Source**: Data Architect #6 (also part of C-01)

The Biweekly alternating-week calculation uses `createdon` as the anchor. A user whose
medication started before they installed MedTrack cannot align the schedule to their actual
first-dose date.

**Fix**: Add `ppa_startdate` (DateOnly, optional) to `ppa_medications`. Biweekly
algorithm uses this when present, falls back to `createdon` when null.

---

### H-15 — Adherence counts raw logs, not distinct medications — can exceed 100%

**Source**: Skeptic #17

`takenLogsOnDay()` counts all Taken log records. If a medication is logged twice (see H-06),
`takenTotal` can exceed `scheduledTotal`. The adherence percentage can exceed 100% and
`missedToday` can go negative (clamped to 0 by `Math.max`).

**Fix**: Count distinct medication IDs with at least one Taken log per day, not the raw
count of Taken records.

---

## MEDIUM — Improvements Before GA

| # | Area | Issue | Fix |
|---|------|-------|-----|
| M-01 | UX | Status segmented control has icons in spec but text-only in code; color-only selected state fails WCAG 2.1 AA (red-green blindness) | Add CheckCircle / X / Clock icons to each button; show always, not just when selected |
| M-02 | UX | Analytics X-axis labels overlap at 375px for 52-point 1-year view | Set `interval` or `minTickGap` on XAxis: 0 for 3M, 1 for 6M, 3 for 1Y |
| M-03 | UX | Calendar day cell: dark text on dark status-fill background may fail 4.5:1 contrast in light mode | Force `color: white` on date numbers in colored cells; add `aria-label="June 15, taken"` |
| M-04 | UX | Medication list has no sort order — users with 15+ meds must scan unordered list | Client-side alphabetical sort on Active and Inactive arrays before render |
| M-05 | UX | Dashboard error state looks identical to empty state — hides connection failures | Add `isError` checks to all data hooks; show inline error banner with Retry button |
| M-06 | UX | Reminder time uses 3 Select dropdowns instead of `<input type="time">` — non-standard, cramped at 375px | Replace with native `<input type="time">` (already used in LogIntakeDialog) |
| M-07 | UX | Stats bar shows "0" streak / "0" missed / "0" active when no medications exist — looks like failure, not first-run | Show "—" for all stats when `activeMedicationCount === 0`; show a first-run empty state with "Add Medication" CTA |
| M-08 | UX | Scheduled Day is not in `canSave` validation — user can save Weekly/Biweekly medication with null day | Add `(!showScheduledDay || form.scheduledDay !== null)` to `canSave` |
| M-09 | Schema | Duplicate medication names allowed — "Insulin" and "insulin" are separate records | Add client-side warning (not block) in `handleSave()` for case-insensitive name match |
| M-10 | Schema | "Biweekly" is ambiguous (means "every two weeks" here, but can mean "twice a week") | Add clarifying comment in `data-model.md`: "894250002 = every two weeks (fortnightly)" |
| M-11 | Schema | `ppa_photourl` dead column in schema and generated models — photo is out of scope for v1 | Exclude from all `$select` lists; add comment in model that it is out of scope |
| M-12 | Schema | Security role not documented — UserOwned tables alone don't enforce SC-008 without role config | Document required security role: copy Basic User, set User scope on both tables |
| M-13 | ALM | Solution association for both Dataverse tables not confirmed — could be in Default Solution | Verify and document solution membership; add to deployment checklist |
| M-14 | Performance | `perMedStats` in `analytics.tsx` is O(medications² × days) — 20 meds × 365 days = 146K iterations synchronously | Pre-build a `dayMap` in O(days), reduce per-medication pass to O(medications × logs) |
| M-15 | UX | `Suspense` fallback is `<div />` — blank screen during lazy-route load on slow connections | Replace with a minimal skeleton or spinner |
| M-16 | UX | Sidebar NavLink at icon-only breakpoint may have touch targets < 44px | Add `min-w-[44px]` to collapsed nav items |

---

## LOW — Nice to Have

| # | Area | Issue | Recommendation |
|---|------|-------|----------------|
| L-01 | UX | Standalone "Log Intake" button at bottom of Dashboard is below fold when schedule is long | Move to floating action button (fixed bottom-right, above nav bar) |
| L-02 | UX | Mobile top header (h-14) provides only branding — wastes 56px on space-constrained screens | Remove top header on mobile; page h1 provides sufficient context |
| L-03 | Schema | `ppa_sortorder` (WholeNumber, optional) would enable future drag-to-reorder without migration | Add the column now at zero cost since table is new |
| L-04 | Health | Future-dated intake logs can cause injection sites to show as "(recent)" indefinitely | Fixed by H-07; include as secondary effect |

---

## Resolved Skeptic Items (No Action Needed)

- Primary Name attributes: present on both tables (`ppa_name`, `ppa_logname`).
- SchemaNames prefixed `ppa_`: confirmed in generated models.
- Circular relationships: none (no cycles possible with two tables).
- File attachments: not needed (photo URL out of scope).
- Quick Find / subgrid views: N/A — this is a standalone Code App, not an MDA.
- Export mechanism: CSV export implemented in `analytics.tsx`.
- Authentication: handled by platform via `getContext()` — no custom credential code.
- Route-level code splitting: `React.lazy()` confirmed in `router.tsx`.

---

## Implementation Sequence (Priority Order)

### Immediate (before any testing milestone)

1. **C-01** — Add `createdon` to `MEDICATIONS_SELECT`
2. **C-02** — Fix `_ppa_medication_value` filter in `analytics.tsx`
3. **C-03** — Fix cascade config + make lookup optional + add delete error handling
4. **C-04** — Add try/catch to `medication-form.tsx` `handleSave()`
5. **C-06/07** — Increase `ppa_instructions` and `ppa_notes` maxLength to 2000
6. **C-08** — Fix CSV injection site label
7. **C-10** — Include inactive medication in LogIntakeDialog dropdown during edit
8. **H-06** — Add `useRef` deduplication guard on Log Intake save

### Before User Testing

9. **C-05** — Confirm SC-008 with cross-account test; optionally add owner filter
10. **C-09** — Add "View All" to multi-medication overdue banner
11. **C-11/12** — Body map: default hidden; add "select site" inline hint
12. **C-13/14** — Dirty-check + confirmation on dialog close
13. **H-01** — Add `refetchInterval` to `use-overdue.ts`
14. **H-02** — Show Skipped/Missed/Pending status badges in schedule list
15. **H-03** — Move `now` inside `useEffect` in LogIntakeDialog
16. **H-07** — Block future dates in Log Intake
17. **H-09** — Calendar day panel bottom sheet on mobile
18. **H-10** — Add "Today" button to calendar
19. **H-15** — Count distinct meds in adherence, not raw log count
20. **M-01** — Add icons to status segmented control (WCAG)
21. **M-07** — First-run empty state on Dashboard
22. **M-08** — Add Scheduled Day to `canSave` validation

### Before GA

23. H-04 through H-14, M-02 through M-16 as capacity allows
