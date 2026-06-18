# Tasks: MedTrack — Medication Reminder & Intake Logger

**Branch**: `001-medtrack-app` | **Date**: 2026-06-17 | **Spec**: [spec.md](spec.md)

**Input**: Design documents from `specs/001-medtrack-app/`

**Tests**: Included per constitution Principle II — red-green-refactor is mandatory. Tests must be written and confirmed to FAIL before implementation begins.

**Organization**: Tasks are ordered by user story (US1→US2→US3→US4→US5) to enable independent implementation and validation of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unresolved dependencies within the phase)
- **[Story]**: Which user story this task belongs to (US1–US5; maps to spec.md priorities P1–P5)
- Exact file paths included in all descriptions

---

## Phase 1: Setup

**Purpose**: Install test infrastructure. This phase must complete before ANY user story work begins.

⚠️ **Vitest is not installed** — no tests can run until Phase 1 is complete (see plan.md §Complexity Tracking).

- [X] T001 Install Vitest 2 + @testing-library/react 16 + @testing-library/user-event + @testing-library/jest-dom + jsdom + msw 2 as devDependencies: `npm install --save-dev vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom msw`
- [X] T002 Add `/// <reference types="vitest" />` to vite.config.ts and add `test: { environment: 'jsdom', globals: true, setupFiles: ['./tests/setup.ts'] }` block inside `defineConfig`
- [X] T003 Add `"test": "vitest run"` and `"test:watch": "vitest"` scripts to package.json
- [X] T004 Create tests/mocks/server.ts — `setupServer()` from msw/node with empty handlers array; export `server`
- [X] T005 Create tests/setup.ts — import `@testing-library/jest-dom`; import `server` from `./mocks/server`; wire `beforeAll(() => server.listen())`, `afterEach(() => server.resetHandlers())`, `afterAll(() => server.close())`

**Checkpoint**: `npm run test` runs with zero test files and exits 0.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: App shell, shared Zustand stores, date utilities, and Dataverse TanStack Query hooks. MUST complete before any user story phase begins.

⚠️ **CRITICAL**: No user story work can begin until this phase is complete.

- [X] T006 [P] Update src/router.tsx — add routes for `/medications`, `/calendar`, `/analytics` using `React.lazy()` + `<Suspense fallback={<div />}>` wrappers; keep `/` (home) eager-loaded; see contracts/ui-contracts.md §Routes for route table
- [X] T007 [P] Update src/pages/_layout.tsx — add 4-tab persistent nav: Home (dashboard icon) `/`, Medications (pill icon) `/medications`, Calendar (calendar icon) `/calendar`, Analytics (chart icon) `/analytics`; mobile (< 768 px): fixed bottom nav bar; tablet (≥ 768 px): collapsible left sidebar; see contracts/ui-contracts.md §Layout
- [X] T008 [P] Create src/stores/ui-store.ts — Zustand store: `isMedicationFormOpen: boolean`, `medicationFormMode: 'add' | 'edit'`, `editingMedication: MedicationViewModel | null`, `selectedCalendarDate: Date | null`, and setter actions for each; export `useUiStore`
- [X] T009 [P] Create src/stores/log-intake-store.ts — Zustand store: `prePopulation: LogIntakePrePopulation`, `setPrePopulation(p: LogIntakePrePopulation): void`, `clearPrePopulation(): void`; `LogIntakePrePopulation` shape per data-model.md §Log Intake dialog pre-population state
- [X] T010 [P] Create src/lib/date-utils.ts — export: `startOfLocalDay(d: Date): Date`, `endOfLocalDay(d: Date): Date`, `isSameLocalDay(a: Date, b: Date): boolean`, `weeksBetween(start: Date, end: Date): number`, `parseISOLocal(iso: string): Date`; use date-fns 4 primitives only (no Moment.js)
- [X] T011 [P] Create src/hooks/use-medications.ts — `useMedications()`: `Ppa_medicationsService.getAll({ select: ['ppa_medicationid','ppa_name','ppa_dosage','ppa_frequency','ppa_scheduledday','ppa_method','ppa_remindertime','ppa_instructions','ppa_isactive'] })`, query key `['medications']`, `staleTime: 5 * 60 * 1000`; `useCreateMedication()`, `useUpdateMedication()`, `useDeleteMedication()` mutations; invalidation per contracts/ui-contracts.md §Mutation invalidation rules
- [X] T012 [P] Create src/hooks/use-intake-logs.ts — `useIntakeLogs({ from: Date, to: Date, medicationId?: string })`: `Ppa_intakelogsService.getAll({ select: ['ppa_intakelogid','ppa_loggedat','ppa_scheduledfor','ppa_status','ppa_injectionsite','ppa_logname','ppa_notes','_ppa_medication_value'], filter: ... })`, query key `['intakelogs', { from, to }]` or `['intakelogs', { from, to, medicationId }]`, `staleTime: 30_000`; `useCreateIntakeLog()`, `useUpdateIntakeLog()`, `useDeleteIntakeLog()` mutations; all mutations invalidate entire `['intakelogs']` key family

**Checkpoint**: App shell loads at `/`; nav tabs switch between pages at 375 px and 768 px; `npm run build` exits 0 with no type errors.

---

## Phase 3: User Story 1 — Medication Management (Priority: P1) 🎯 MVP

**Goal**: Users can add, view, edit, deactivate, and delete medications from a grouped Active / Inactive list.

**Independent Test**: Create two medications (one Daily pill, one Weekly injection with Scheduled Day = Wednesday), edit one dosage, deactivate one, delete the other — all from `/medications` without touching intake logging or the dashboard.

### Tests for US1 ⚠️ Write first — confirm they FAIL before implementing any component

- [X] T013 [P] [US1] Write failing unit tests for MedicationForm in tests/components/medication-form.test.tsx: (1) Save button disabled when Name is empty; (2) Scheduled Day field appears when Frequency = Weekly; (3) Scheduled Day field appears when Frequency = Biweekly; (4) Scheduled Day field hidden when Frequency = Daily; (5) switching Frequency to Daily clears Scheduled Day from form state; (6) NO injection site section exists in the form (FR-005 removed); (7) form calls `Ppa_medicationsService.create()` with correct payload on Save
- [X] T014 [P] [US1] Write failing acceptance tests for medications page in tests/pages/medications.test.tsx: (1) empty state shows "Add your first medication" CTA when list is empty; (2) medication appears in Active section immediately after create; (3) edit form pre-populates all saved field values; (4) delete shows ConfirmDeleteDialog before calling service.delete(); (5) toggling Active moves medication from Active to Inactive section

### Implementation for US1

- [X] T015 [P] [US1] Create src/components/medications/medication-card.tsx — renders: name, dosage badge, frequency tag, method tag (with Lucide icon), reminder time, instructions preview (first 60 chars + "…" when longer); action row: pencil edit button, trash delete button (triggers ConfirmDeleteDialog), Active toggle switch; props: `MedicationCardProps` per contracts/ui-contracts.md §MedicationCard
- [X] T016 [US1] Create src/components/medications/medication-form.tsx — `<Dialog>` modal; fields per FR-001/002: Name text input (required), Dosage text input (required), Frequency Select (required; options: Daily / Weekly / Biweekly / As-Needed), Scheduled Day Select (conditional: visible ONLY when Frequency = Weekly or Biweekly; hidden for Daily and As-Needed), Method Select (required; Pill / Injection / Topical / Inhaler / Liquid each with distinct Lucide icon), Reminder Time input (optional), Instructions Textarea (optional), Active Switch (defaults `true` in add mode); Cancel + Save/Update buttons; Save/Update disabled until Name + Dosage + Frequency + Method are all non-empty; Frequency change to Daily or As-Needed silently clears Scheduled Day; NO injection site section; props: `MedicationFormProps` per contracts/ui-contracts.md §MedicationForm
- [X] T017 [US1] Create src/components/medications/medication-list.tsx — consumes `useMedications()`; Active section: count badge + list of `<MedicationCard>`; Inactive section: count badge + collapsible list of `<MedicationCard>`; empty state illustration + "Add your first medication" CTA when total count = 0; passes `onEdit`, `onDelete`, `onToggleActive` callbacks down to each card
- [X] T018 [US1] Create src/pages/medications.tsx — lazy-loaded (imported via React.lazy in router); "Add Medication" button in page header sets ui-store `isMedicationFormOpen=true, mode='add'`; renders `<MedicationList>` and `<MedicationForm>`; MedicationForm `onSaved` callback fires `useCreateMedication` or `useUpdateMedication` then shows Sonner success toast per contracts/ui-contracts.md §Sonner toast conventions; delete fires `useDeleteMedication` then success toast; `['medications']` cache invalidated after every mutation
- [X] T019 [US1] Verify T013 + T014 tests now pass: run `npm run test` and confirm zero failures
- [X] T020 [US1] Verify responsive at 375 px and 768 px on `/medications` — no horizontal scroll; Add Medication, edit, delete, and Active toggle all reachable; Inactive section visible

**Checkpoint**: US1 is fully functional and independently testable; `npm run test` passes; `npm run build` passes.

---

## Phase 4: User Story 2 — Dashboard & Daily Schedule (Priority: P2)

**Goal**: Users see a personalised daily dashboard with 4 adherence stats, today's dose schedule, and a persistent overdue medication banner.

**Independent Test**: With seed data (one active Daily medication, reminder 08:00, 5 consecutive Taken logs), open dashboard at 09:00 and confirm: adherence ≈ 83 %, streak = 5, today's schedule entry visible, overdue banner visible with correct medication.

### Tests for US2 ⚠️ Write first — confirm they FAIL before implementing

- [X] T021 [P] [US2] Write failing unit tests for adherence.ts in tests/lib/adherence.test.ts: (1) Daily med always contributes to scheduled count; (2) Weekly med contributes only on its ppa_scheduledday; (3) Biweekly med uses `Math.floor(weeksBetween(createdon, D) % 2) === 0`; (4) As-Needed med contributes 0 to scheduled count; (5) adherence7d returns `null` when scheduled count = 0; (6) streak increments on consecutive fully-adherent days; (7) streak breaks on first day with missing Taken log; (8) streak skips rest days (scheduledCount === 0)
- [X] T022 [P] [US2] Write failing integration tests for use-adherence in tests/hooks/use-adherence.test.ts — use MSW handler returning seeded medications + intake logs; verify returned `AdherenceStats` shape matches expected values
- [X] T023 [P] [US2] Write failing acceptance tests for home page in tests/pages/home.test.tsx: (1) StatsBar renders all 4 tiles with values; (2) OverdueBanner visible when overdue medication exists; (3) OverdueBanner hidden when no overdue medications; (4) Today's Schedule lists all doses due today; (5) standalone "Log Intake" button rendered

### Implementation for US2

- [X] T024 [P] [US2] Create src/lib/adherence.ts — pure functions: `scheduledDosesOnDay(medications: Ppa_medications[], date: Date): Ppa_medications[]`; `takenLogsOnDay(logs: Ppa_intakelogs[], date: Date): Ppa_intakelogs[]`; `adherence7d(medications, logs): number | null` (sum taken / sum scheduled × 100 over 7-day window; returns null when scheduled = 0); `currentStreak(medications, logs): number` (loop from today backwards; skip rest days; break on partial day); `missedToday(medications, logs): number`; biweekly scheduling: `Math.floor(weeksBetween(med.createdon!, D) % 2) === 0`; As-Needed excluded from scheduled count
- [X] T025 [US2] Create src/hooks/use-adherence.ts — combines `useMedications()` data + `useIntakeLogs({ from: startOf7DaysAgo, to: endOfToday })` data; calls adherence.ts pure functions in `useMemo`; returns `AdherenceStats`; inherits loading state from both queries
- [X] T026 [US2] Create src/hooks/use-overdue.ts — queries `useMedications()` with `refetchInterval: 60_000`; queries `useIntakeLogs({ from: today, to: today })` with `refetchInterval: 30_000`; derives `OverdueMedication[]` in `useMemo`: active med, scheduled dose today, no Taken log for today, `reminderTime < now`; sorted most-overdue first (largest `overdueBy` first)
- [X] T027 [P] [US2] Create src/components/dashboard/stats-bar.tsx — 4 stat tiles (left-to-right / 2×2 on mobile): 7-day adherence % | streak | missed today | active medication count; `<Skeleton>` tiles when `isLoading=true`; props: `StatsBarProps` per contracts/ui-contracts.md §StatsBar
- [X] T028 [P] [US2] Create src/components/dashboard/schedule-list.tsx — derives today's scheduled doses from `useMedications()` + today's intake logs; renders each dose: medication name, dosage, scheduled time (ppa_remindertime), status badge (Pending / Taken / Skipped / Missed); empty state "No doses scheduled today" + "Add Medication" CTA when no active medications are scheduled; each dose row has "Log" quick-action that opens LogIntakeDialog (wired in US3)
- [X] T029 [US2] Create src/components/dashboard/overdue-banner.tsx — amber persistent banner; 1 overdue: "[Name] [Dosage] — overdue by [X h Y min] [Log]"; 2+ overdue: "[N] doses overdue — [View All] [Log First]"; no dismiss/close button (per spec: banner resolves only by logging); `onLog(medication)` callback; props: `OverdueBannerProps` per contracts/ui-contracts.md §OverdueBanner
- [X] T030 [US2] Update src/pages/home.tsx — replace placeholder content; compose: `<OverdueBanner>` (when `overdue.length > 0`), `<StatsBar>`, `<ScheduleList>`, standalone "Log Intake" `<Button>`; onLog and standalone button both call `setPrePopulation` in log-intake-store and set dialog open in ui-store (LogIntakeDialog component itself is wired in Phase 5 / T038)
- [X] T031 [US2] Verify T021–T023 tests now pass: `npm run test`; verify responsive at 375 px and 768 px on `/`

**Checkpoint**: Dashboard displays live adherence stats, schedule, and overdue banner with seed data; tests pass; `npm run build` passes.

---

## Phase 5: User Story 3 — Intake Logging (Priority: P3)

**Goal**: Users can log a dose event from 4 entry points; injectable medications show the body map with all 5 canonical sites always available; no per-medication site filtering.

**Independent Test**: Open Log Intake dialog via standalone button; select an injection medication; confirm all 5 canonical sites shown on body map with no auto-selection; tap "Right Hip" chip; add a note; save — confirm Sonner toast and record visible on calendar.

### Tests for US3 ⚠️ Write first — confirm they FAIL before implementing

- [X] T032 [P] [US3] Write failing unit tests for injection-sites.ts in tests/lib/injection-sites.test.ts: (1) `INJECTION_SITES` array contains exactly 5 entries in canonical order; (2) `getSiteLabel` returns correct display string for each enum value; (3) `getRecentSites` returns sites from intake logs within past 7 days; (4) `getRecentSites` excludes sites from logs older than 7 days; (5) `getRecentSites` returns empty array when no recent logs
- [X] T033 [P] [US3] Write failing unit tests for BodyMap in tests/components/body-map.test.tsx: (1) all 5 chip buttons always rendered (no filtering per medication); (2) no chip auto-selected on mount (no auto-select per FR-005 removal); (3) tapping a chip calls `onSiteSelect` with correct site value; (4) tapping a second chip deselects the first (single-select); (5) recently-used chip shows "(recent)" suffix; (6) figure dots have `pointer-events: none` (not interactive)
- [X] T034 [P] [US3] Write failing acceptance tests for LogIntakeDialog in tests/components/log-intake-dialog.test.tsx: (1) injection site section visible when Injection medication selected; (2) injection site section hidden when Pill medication selected; (3) "Log Intake" button disabled when Injection med selected and no site chosen; (4) "Log Intake" button enabled when Pill med selected (no site required); (5) changing medication from Injection→Pill hides injection section and clears selected site; (6) medication field disabled (read-only) when pre-set from banner entry point; (7) `Ppa_intakelogsService.create()` called with correct payload on save including ppa_logname snapshot

### Implementation for US3

- [X] T035 [P] [US3] Create src/lib/injection-sites.ts — `INJECTION_SITES: Ppa_intakelogsppa_injectionsite[]` (all 5 canonical values: RightHip=894250000, LeftHip=894250001, AbdominalRight=894250002, AbdominalCenter=894250003, AbdominalLeft=894250004); `getSiteLabel(site: Ppa_intakelogsppa_injectionsite): string` display name map; `getRecentSites(logs: Ppa_intakelogs[], now: Date): Ppa_intakelogsppa_injectionsite[]` — returns sites where `ppa_loggedat` is within past 7 days and `ppa_injectionsite` is set
- [X] T036 [US3] Create src/components/intake/body-map.tsx — human silhouette SVG figure; filled orange circle overlay at each recently-used site position (pointer-events: none on all figure dots); 5 pill-shaped chip `<button>` elements below figure — ALWAYS all 5 canonical sites (Right Hip, Left Hip, Abdominal Right, Abdominal Center, Abdominal Left), no filtering; recently-used chips show "(recent)" suffix; single-select: tapping a chip calls `onSiteSelect` and clears previous; selected chip shows highlighted/active variant; chip tap target ≥ 44×44 px (WCAG 2.1 AA); NO auto-select on mount; props: `BodyMapProps` per contracts/ui-contracts.md §BodyMap
- [X] T037 [US3] Create src/components/intake/log-intake-dialog.tsx — `<Dialog>` modal; fields: Medication Select (required; active medications from `useMedications()`; disabled when pre-populated from banner entry), Date picker (required; default `prePopulation.calendarDate ?? today`), Time input (required; default now), Status 3-button segmented control (Taken green ✓ / Skipped × / Missed 🕐; default Taken per FR-011), Injection Site section (conditional: visible only when `selectedMedication.ppa_method === Injection`; contains Show/Hide Body Map toggle + `<BodyMap recentSites={...} selectedSite={...} onSiteSelect={...} />`), Notes Textarea (optional); "Log Intake" button disabled when: no medication selected, OR (Injection method AND no site selected); on save: `useCreateIntakeLog()` with payload per data-model.md (ppa_Medication@odata.bind = `/ppa_medications(<guid>)`, ppa_logname = medication.ppa_name snapshot, ppa_loggedat ISO string, ppa_scheduledfor, ppa_status, ppa_injectionsite when applicable); Sonner "Intake logged" toast on success; reads `prePopulation` from log-intake-store; props: `LogIntakeDialogProps` per contracts/ui-contracts.md §LogIntakeDialog
- [X] T038 [US3] Wire LogIntakeDialog into src/pages/home.tsx — import `<LogIntakeDialog>`; render it with `open` from ui-store and `prePopulation` from log-intake-store; standalone "Log Intake" button: `setPrePopulation({ dateTime: new Date() })` then open dialog; OverdueBanner `onLog`: `setPrePopulation({ medicationId, dateTime: new Date() })` then open dialog (medication field disabled per invariant); ScheduleList row "Log": `setPrePopulation({ medicationId, dateTime: new Date() })` then open dialog; `onSaved` closes dialog and calls `clearPrePopulation`; confirms US2 acceptance scenario 3 passes
- [X] T039 [US3] Verify T032–T034 tests now pass: `npm run test`; verify responsive at 375 px and 768 px for LogIntakeDialog (body map chip layout, Status control, dialog scroll)

**Checkpoint**: Full logging flow functional from all 4 entry points; body map shows all 5 sites with no auto-select; Injection vs Pill conditional section correct; tests pass.

---

## Phase 6: User Story 4 — Calendar & History View (Priority: P4)

**Goal**: Users browse intake history month by month with colour-coded day indicators; tapping a day opens a detail panel; Log Intake from the panel pre-populates the calendar date.

**Independent Test**: With pre-seeded logs across 2 weeks, confirm correct colour indicators per day; tap a day → detail panel lists all events with correct metadata; tap "Log Intake" in panel → LogIntakeDialog date field = that calendar date (not today).

### Tests for US4 ⚠️ Write first — confirm they FAIL before implementing

- [X] T040 [P] [US4] Write failing acceptance tests for calendar page in tests/pages/calendar.test.tsx: (1) day with Taken-only → green indicator; (2) day with Missed-only and no Taken → red; (3) day with only Skipped logs → grey; (4) day with both Taken and at least one Missed → orange; (5) tapping a day opens day detail panel; (6) "Log Intake" in panel opens LogIntakeDialog with `calendarDate` = selected day (not today); (7) month navigation triggers new `useIntakeLogs` query for that month; (8) tapping empty day → panel shows empty state + "Log Intake" option

### Implementation for US4

- [X] T041 [P] [US4] Create src/components/intake/intake-log-card.tsx — renders single log entry: `ppa_logname` medication name (snapshot), `ppa_loggedat` time formatted `HH:mm`, status badge (Taken green / Skipped grey / Missed red), injection site display label via `getSiteLabel()` (when `ppa_injectionsite` set), notes preview; edit (pencil) button calls `onEdit`; delete (trash) button opens ConfirmDeleteDialog then calls `onDelete`; props: `{ log: IntakeLogViewModel; onEdit: () => void; onDelete: () => void }`
- [X] T042 [US4] Create src/pages/calendar.tsx — lazy-loaded; `useIntakeLogs({ from: startOfMonth(viewedMonth), to: endOfMonth(viewedMonth) })` with `staleTime: 5 * 60 * 1000`; month navigation header with prev/current label/next; react-day-picker `<DayPicker>` with `modifiers` prop: `has-taken` (≥1 Taken log → green), `has-missed` (≥1 Missed and no Taken → red), `has-skipped` (only Skipped → grey), `mixed` (Taken + at least one Missed → orange); day tap: set `selectedCalendarDate` in ui-store and open detail panel; detail panel: mobile (< 768 px) bottom sheet, tablet (≥ 768 px) right panel; panel renders `<IntakeLogCard>` list for selected day or empty state; panel "Log Intake" button: `setPrePopulation({ calendarDate: selectedDate })` then open LogIntakeDialog; panel edit: opens LogIntakeDialog with existing log pre-populated; panel delete: `useDeleteIntakeLog()` mutation with confirm dialog; invalidates `['intakelogs']` on mutation
- [X] T043 [US4] Verify T040 tests now pass: `npm run test`; verify responsive at 375 px (bottom sheet panel, month nav) and 768 px (side panel, month nav)

**Checkpoint**: Calendar shows accurate day indicators; day detail panel and date pre-population work; month navigation caches previous months; tests pass.

---

## Phase 7: User Story 5 — Analytics & Adherence Reports (Priority: P5)

**Goal**: Users see adherence trends over 3M / 6M / 1Y windows, can filter by medication, and export a CSV report containing all intake events.

**Independent Test**: With ≥ 90 days of seeded intake data for 2 medications, confirm chart shows accurate adherence % for each time window, medication filter updates chart to per-medication data, and Export downloads a valid CSV with expected column headers and rows.

### Tests for US5 ⚠️ Write first — confirm they FAIL before implementing

- [X] T044 [P] [US5] Write failing unit tests for csv-export.ts in tests/lib/csv-export.test.ts: (1) CSV header row = `Medication,Date,Time,Status,Injection Site,Notes`; (2) rows contain correct field values from intake log data; (3) medication name containing a comma is wrapped in double-quotes; (4) notes containing a double-quote has the quote escaped; (5) empty `ppa_injectionsite` renders as empty string (not `undefined` or `null`)
- [X] T045 [P] [US5] Write failing acceptance tests for analytics page in tests/pages/analytics.test.tsx: (1) default time window selector shows 3M active on load; (2) switching to 6M updates chart data (different date range query); (3) switching to 1Y updates chart data; (4) medication filter dropdown lists all medications + "All"; (5) selecting a medication updates chart to per-medication series; (6) Export button triggers downloadCsv with correct filename; (7) per-medication breakdown table renders with medication names and adherence values

### Implementation for US5

- [X] T046 [P] [US5] Create src/lib/csv-export.ts — `csvEscape(s: string): string` (wraps value in double-quotes if it contains comma, double-quote, or newline; escapes internal double-quotes by doubling); `downloadCsv(rows: IntakeLogRow[], filename: string): void`: assemble header + body CSV string → `new Blob([...], { type: 'text/csv;charset=utf-8;' })` → `URL.createObjectURL(blob)` → create `<a>` → set `href` + `download` → `a.click()` → `URL.revokeObjectURL(url)`; `IntakeLogRow` interface: `{ medicationName: string; loggedAt: Date; status: string; injectionSite?: string; notes?: string }`; per research.md §CSV Export
- [X] T047 [US5] Create src/components/analytics/adherence-chart.tsx — Recharts `<BarChart>` with adherence % on Y-axis (0–100); time window selector: 3 `<Button>` toggles (3M / 6M / 1Y; default 3M); medication filter `<Select>` (All / individual medication; populates from `useMedications()`); data series computed from adherence.ts functions grouped by ISO week (≤ 52 data points in 1Y window — within Recharts limit per constitution Principle IV); `isLoading` → `<Skeleton>` chart placeholder; memoised data recomputation (only recalculates on window or filter change); props: `AdherenceChartProps` per contracts/ui-contracts.md §AdherenceChart
- [X] T048 [US5] Create src/pages/analytics.tsx — lazy-loaded; `useIntakeLogs({ from: windowStart, to: today })` where `windowStart` = 3M / 6M / 1Y ago based on selected window; `useMedications()` for filter dropdown; renders: `<AdherenceChart>`, per-medication breakdown table (name, scheduled count, taken count, adherence %); Export button: calls `downloadCsv(filteredRows, 'medtrack-report.csv')` + Sonner "Report downloaded" toast; post-condition: chart data series memoised via `useMemo` — only recalculates when window or filter state changes
- [X] T049 [US5] Verify T044–T045 tests now pass: `npm run test`; verify responsive at 375 px and 768 px for analytics chart, time window selector, and Export button

**Checkpoint**: Analytics shows accurate trends; CSV export downloads correctly; medication filter works; tests pass.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Accessibility audit, responsive verification, bundle health, and spec artifact cleanup.

- [X] T050 [P] Fix stale FR-005 references in specs/001-medtrack-app/data-model.md: (a) remove the `ppa_validinjection_sites` validation rule bullet from §Entity 1 ppa_medications Validation rules; (b) update `ppa_injectionsite` validation rule in §Entity 2 to remove "AND must be in the medication's ppa_validinjection_sites list"; (c) remove "→ [Auto-select] → Selected (when medication has exactly 1 valid site)" line from §State Transitions Injection site selection
- [X] T051 [P] Fix stale FR-005 references in specs/001-medtrack-app/quickstart.md: (a) remove "ppa_medications table has the ppa_validinjection_sites text column added" and "pac code types regenerated after column addition" from Prerequisites; (b) update US1 happy path steps 3–4 to remove injection site selection from form steps; (c) update US1 edge case "Changing Method from Injection to Pill: Injection Sites section disappears; sites are cleared" to describe the medication form (no injection section in form — remove this edge case); (d) update US3 step 2 to remove "2 valid sites: Right Hip, Left Hip" (all 5 canonical sites always shown)
- [ ] T052 WCAG 2.1 AA audit across all 4 screens — verify: visible focus rings on all interactive elements (medication cards, form fields, nav tabs, dialog close, body map chips, status buttons); text contrast ≥ 4.5:1 (normal text) / 3:1 (large text) against Tailwind token backgrounds; all touch targets ≥ 44×44 px (especially body map chips, status segmented control buttons, nav tabs); all `<Dialog>` components trap focus and restore on close; icon-only buttons have `aria-label`
- [ ] T053 Full responsive verification at 375 px and 768 px — Chrome DevTools Device Mode; navigate all 4 screens; verify: no horizontal scroll on any screen; bottom nav visible at 375 px; sidebar visible at 768 px; body map chips wrap correctly at 375 px; calendar detail shows as bottom sheet at 375 px and right panel at 768 px; Export button reachable at 375 px
- [X] T054 [P] Bundle size audit: `npm run build`; inspect `dist/` chunk sizes (gzipped); verify home chunk ≠ medications/calendar/analytics chunks (code splitting works); flag any lazy chunk > 50 KB gzipped in plan.md §Complexity Tracking with justification
- [X] T055 [P] Run `npm run lint` — zero errors; auto-fix all auto-fixable warnings; add inline justification comment for any remaining suppressions; no `any` types without comment
- [ ] T056 Run quickstart.md validation — execute all manual scenarios: US1 happy path, US2 seed-data dashboard test, US3 injection logging with body map, US4 calendar navigation + day panel + Log Intake date pre-population, US5 time window switching + CSV export check; cross-story: SC-008 data isolation (two-account incognito test), SC-009 responsive at 375 px and 768 px

**Checkpoint**: All tests pass; lint clean; build clean with no oversized chunks; responsive verified; accessibility checked; quickstart.md scenarios all pass.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 complete — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2; no dependency on other stories; first independent MVP increment
- **US2 (Phase 4)**: Depends on Phase 2; US1 data improves realism but not structurally required
- **US3 (Phase 5)**: Depends on Phase 2 + US1 (medication list populates dialog) + US2 (wires LogIntakeDialog into home.tsx)
- **US4 (Phase 6)**: Depends on Phase 2 + US3 (intake logs created by LogIntakeDialog power calendar indicators)
- **US5 (Phase 7)**: Depends on Phase 2; analytically independent but benefits from US1–US4 data
- **Polish (Phase 8)**: Depends on all desired stories complete

### User Story Dependencies

- **US1 (P1)**: Independent after Foundational — medications CRUD; standalone value as a medicine cabinet
- **US2 (P2)**: Independent after Foundational — dashboard display; Log button fully functional after US3 wires in
- **US3 (P3)**: Depends on US1 (medication dropdown) + US2 (home.tsx wiring target)
- **US4 (P4)**: Depends on US3 (intake logs needed for calendar day indicators and editing)
- **US5 (P5)**: Independent after Foundational — can build against seeded data in parallel with US3/US4

### Within Each User Story

1. Tests MUST be written and confirmed to FAIL before any implementation task starts
2. Lib utilities (adherence.ts, injection-sites.ts, csv-export.ts) before hooks/components that call them
3. Leaf components before parent components and pages
4. Core component implementation before integration wiring into pages
5. `npm run test` + `npm run build` must pass before marking story done

---

## Parallel Opportunities

### Phase 2 — All 7 tasks run in parallel (completely independent files)

```
Task A: T006 Update src/router.tsx
Task B: T007 Update src/pages/_layout.tsx
Task C: T008 Create src/stores/ui-store.ts
Task D: T009 Create src/stores/log-intake-store.ts
Task E: T010 Create src/lib/date-utils.ts
Task F: T011 Create src/hooks/use-medications.ts
Task G: T012 Create src/hooks/use-intake-logs.ts
```

### Phase 3 (US1) — Tests parallel; implementation sequential

```
# Step 1 — Write tests in parallel:
Task A: T013 Write tests/components/medication-form.test.tsx
Task B: T014 Write tests/pages/medications.test.tsx

# Step 2 — Confirm tests FAIL (no component exists yet)

# Step 3 — Implement sequentially:
# T015 medication-card.tsx → T016 medication-form.tsx → T017 medication-list.tsx → T018 medications.tsx
```

### Phase 4 (US2) — Tests parallel; lib then hooks then components

```
# Step 1 — Write tests in parallel:
Task A: T021 Write tests/lib/adherence.test.ts
Task B: T022 Write tests/hooks/use-adherence.test.ts
Task C: T023 Write tests/pages/home.test.tsx

# Step 2 — Confirm tests FAIL

# Step 3 — Implement:
# T024 adherence.ts → T025 use-adherence.ts → T026 use-overdue.ts
# Then in parallel: T027 stats-bar.tsx || T028 schedule-list.tsx
# Then sequentially: T029 overdue-banner.tsx → T030 home.tsx update
```

### Phase 8 (Polish) — T050, T051, T054, T055 all parallel

```
Task A: T050 Fix data-model.md stale references
Task B: T051 Fix quickstart.md stale references
Task C: T054 Bundle size audit
Task D: T055 Lint pass
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: User Story 1 — medications CRUD
4. **STOP and VALIDATE**: Run US1 independent test; run `npm run test`; demo medication list
5. Deploy/demo if ready

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Phase 3 (US1) → Test independently → Demo (medications work)
3. Phase 4 (US2) → Test independently → Demo (dashboard shows live stats)
4. Phase 5 (US3) → Test independently → Demo (logging works from all 4 entry points)
5. Phase 6 (US4) → Test independently → Demo (calendar populated with history)
6. Phase 7 (US5) → Test independently → Demo (analytics + CSV export)
7. Phase 8 → Polish, accessibility, bundle audit, quickstart validation

---

## Notes

- `[P]` = different files, no unresolved dependencies within the phase — safe to parallelise
- `[Story]` label maps each task to its user story acceptance scenarios in spec.md
- Constitution Principle II mandates red-green-refactor: test tasks MUST fail before the implementation task that satisfies them
- **FR-005 removed**: no `ppa_validinjection_sites` column; body map ALWAYS shows all 5 canonical sites; NO auto-select; NO injection site section in medication form (see spec.md §Clarifications)
- `$select` MUST be passed on every `getAll()` call — unbounded queries violate constitution Principle IV
- No `any` types without inline justification comment — TypeScript strict mode enforced (constitution Principle I)
- Run `npm run lint` and `npm run build` after each story completes before moving to the next
- Data isolation (SC-008): Dataverse `ownerid` enforces row-level security; no app-layer filtering required — but must be verified by cross-account testing in T056
