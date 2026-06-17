# Quickstart Validation Guide: MedTrack

**Branch**: `001-medtrack-app` | **Date**: 2026-06-17 | **Plan**: [plan.md](plan.md)

This guide documents runnable validation scenarios that prove each user story works end-to-end.
Run these after each story is implemented to confirm the golden path before moving to the next.
See [data-model.md](data-model.md) for field names and [contracts/ui-contracts.md](contracts/ui-contracts.md) for component contracts.

---

## Prerequisites

```bash
# Install dependencies (including testing devDependencies added in US1 setup)
npm install

# Run type check
npm run build

# Run lint
npm run lint

# Run tests
npm run test

# Start dev server (requires Dataverse connection via pac code)
npm run dev
```

**Dataverse requirements**:
- Authenticated Power Platform environment with the `Med Track Code App` published
- `ppa_medications` table has the `ppa_validinjection_sites` text column added
- `pac code` types regenerated after column addition
- At least one user account for testing data isolation (two accounts for SC-008)

---

## US1 — Medication Management Validation

**Spec**: User Story 1 | **Priority**: P1 | **Acceptance tests**: `tests/pages/medications.test.tsx`

### Happy path (manual + automated)

1. Open `/medications` — expect empty state with "Add your first medication" CTA.
2. Tap "Add Medication" — `<MedicationForm>` dialog opens with all fields empty; Active = on.
3. Fill in: Name = "Methotrexate", Dosage = "15mg/0.6mL", Frequency = "Weekly", Scheduled Day = "Monday", Method = "Injection". Observe: Injection Sites section appears.
4. Select sites: "Right Hip" and "Left Hip". Tap "Save".
5. Expect: dialog closes; Sonner success toast; medication appears in Active section with name, dosage badge, "Weekly" tag, "Injection" tag, "Monday" label, and no instructions row.
6. Tap "Add Medication" again. Fill: Name = "Folic Acid", Dosage = "1mg", Frequency = "Daily", Method = "Pill". Tap "Save". Expect: appears in Active section.
7. Tap edit (pencil) on Methotrexate. Change Dosage to "20mg/0.8mL". Tap "Update". Expect: updated dosage shown on card everywhere.
8. Tap the Active toggle on "Folic Acid" to off. Expect: moves to Inactive section; disappears from active list.
9. Tap delete on Methotrexate. Expect: confirmation dialog appears. Tap "Delete". Expect: removed from list; Sonner success toast.

### Edge cases to verify

- [ ] Changing Frequency from "Weekly" to "Daily": Scheduled Day field disappears; no saved value retained after switching back to "Weekly".
- [ ] Changing Method from "Injection" to "Pill": Injection Sites section disappears; sites are cleared.
- [ ] Saving without Name: Save button remains disabled.
- [ ] Changing Method from "Injection" to "Pill": Save button is enabled (no site required for non-injection).

### Automated test scenarios (`tests/pages/medications.test.tsx`)

- Renders empty state when medication list is empty
- Creates medication via form → service `create()` called with correct payload
- Edit pre-populates all fields from existing medication
- Delete triggers confirmation dialog; calls service `delete()` only after confirm
- Frequency change to Daily clears Scheduled Day from form state

---

## US2 — Dashboard Validation

**Spec**: User Story 2 | **Priority**: P2 | **Acceptance tests**: `tests/pages/home.test.tsx`

**Seed data required**: 1 active Daily medication with reminder time 08:00; 5 consecutive days of
Taken intake logs; 1 intake log from yesterday that is Missed.

### Happy path

1. Open `/` at 09:00 — expect overdue banner: medication name, dosage, "overdue by ~1 hour", "Log" button.
2. Expect StatsBar: adherence ≈ 83% (5 taken / 6 scheduled over 6 days), streak = 5, missed today = 0, active count = 1. (Note: overdue ≠ missed until logged.)
3. Expect Today's Schedule: medication listed with 08:00 time, status = Pending.
4. Tap "Log" on the banner — LogIntakeDialog opens pre-set: medication = current medication, date/time = now, status = Taken.
5. Save — banner disappears; schedule item updates to "Taken"; StatsBar updates.
6. Tap standalone "Log Intake" button — LogIntakeDialog opens: no medication pre-set, date/time = now, status = Taken.

### Edge cases to verify

- [ ] No scheduled medications today: Today's Schedule shows empty state with "Add Medication" CTA.
- [ ] Multiple overdue medications: banner shows aggregated count.
- [ ] Streak resets to 0 when today has a missed dose (after logging Missed status).

---

## US3 — Intake Logging Validation

**Spec**: User Story 3 | **Priority**: P3 | **Acceptance tests**: `tests/components/log-intake-dialog.test.tsx`

### Happy path (injection dose)

1. Open LogIntakeDialog via standalone button.
2. Select medication "Methotrexate" (Injection, 2 valid sites: Right Hip, Left Hip).
3. Expect: Injection Site section appears. Tap "Show Body Map".
4. Expect: silhouette figure visible. Right Hip shows orange dot (used 3 days ago = recent). Left Hip shows no dot (not recent).
5. Tap "Right Hip" chip. Expect: chip highlights; "(recent)" suffix visible.
6. Observe: "Log Intake" button becomes enabled.
7. Enter Note: "Post-gym, rotating sites".
8. Tap "Log Intake". Expect: dialog closes; Sonner success toast; log appears in calendar for today.

### Happy path (pill dose)

1. Open LogIntakeDialog. Select "Folic Acid" (Pill).
2. Expect: Injection Site section is hidden entirely.
3. Change Status to "Skipped". Tap "Log Intake". Expect: saved; calendar day shows skipped indicator.

### Edge cases to verify

- [ ] All 5 canonical sites are always shown for any Injection medication (no per-medication filtering).
- [ ] Changing medication mid-dialog from Injection to Pill: injection section hides and previously selected site is cleared.
- [ ] Navigating away mid-dialog (Cancel): form state is discarded; no Dataverse call made.
- [ ] Calendar entry-point: date field pre-set to selected calendar date, not today.
- [ ] Banner entry-point: medication field is read-only (disabled).

---

## US4 — Calendar & History Validation

**Spec**: User Story 4 | **Priority**: P4 | **Acceptance tests**: `tests/pages/calendar.test.tsx`

**Seed data required**: Intake logs across at least 2 weeks; include at least one day with Taken,
one with Missed, one with mixed (both Taken and Missed), one with Skipped only.

### Happy path

1. Open `/calendar`. Expect: current month view; days with records show colour indicators.
2. Confirm colour coding: Taken-only day = green; Missed-only day = red; Skipped-only day = grey; mixed (Taken + Missed) = orange.
3. Tap a day with records. Expect: day detail panel opens listing all intake events (medication, time, status, injection site where applicable).
4. Tap "Log Intake" in panel. Expect: LogIntakeDialog opens with date pre-set to that day (not today).
5. Navigate to previous month. Expect: calendar updates; indicators shown for that month; no full-page reload (previous month data is cached).
6. Tap a day with no records. Expect: empty state in panel with "Log Intake" option.

### Edge cases to verify

- [ ] Future month: all days empty; no colour indicators.
- [ ] Month with no data: empty state message shown; no error.
- [ ] Editing an intake log from calendar panel: all fields update; calendar indicator may change colour.
- [ ] Deleting an intake log from panel: confirmation dialog; indicator removed after delete.

---

## US5 — Analytics & Export Validation

**Spec**: User Story 5 | **Priority**: P5 | **Acceptance tests**: `tests/pages/analytics.test.tsx`

**Seed data required**: ≥ 90 days of intake logs for ≥ 2 medications.

### Happy path

1. Open `/analytics`. Default time window = 3M. Expect: chart shows monthly adherence % for last 3 months.
2. Tap "6M". Expect: chart updates to 6-month window. Tap "1Y". Expect: 12-month view.
3. Select medication filter = "Methotrexate". Expect: chart shows only Methotrexate adherence; other medications excluded.
4. Select filter = "All". Reset to 3M window. Tap "Export". Expect: CSV download begins within 5 seconds; file opens in spreadsheet; contains one row per intake log with columns: Medication, Date, Time, Status, Injection Site, Notes.
5. Confirm exported rows contain only current user's data.

### Edge cases to verify

- [ ] Analytics with no intake data: chart shows empty state; export button disabled or produces empty CSV with header only.
- [ ] 1-year export with 3 medications and ~1,000 rows: completes in < 5 seconds.

---

## Cross-Story Validation

### SC-008 — Data Isolation (two-account test)

1. Log in as User A. Add medication "Lisinopril". Log 3 intakes.
2. Log in as User B (separate browser / incognito). Open all screens.
3. Verify: Medications page shows no medications; Dashboard shows empty schedule; Calendar shows no indicators; Analytics shows no data.
4. Log out of User A. Confirm no User A data is visible to User B under any navigation path.

### SC-009 — Responsive Layout

1. Open Chrome DevTools. Set viewport to 375 × 812 px (iPhone SE). Navigate through all 4 screens.
   - Verify: no horizontal scrolling on any screen.
   - Verify: all primary actions reachable (Add Medication, Log Intake, calendar day tap, Export).
2. Set viewport to 768 × 1024 px (iPad). Repeat above.
   - Verify: layout adapts (sidebar nav instead of bottom nav; calendar detail as side panel).

### Build validation

```bash
npm run lint   # Must exit 0 with no errors
npm run build  # Must exit 0; check dist/ bundle sizes
npm run test   # Must exit 0; all tests passing
```
