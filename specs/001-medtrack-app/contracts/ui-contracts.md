# UI Contracts: MedTrack

**Branch**: `001-medtrack-app` | **Date**: 2026-06-17 | **Plan**: [../plan.md](../plan.md)

These contracts define the public interface of each screen and shared component. They specify
route paths, required props, emitted events, and pre/post-conditions. They are not
implementation code — implementation belongs in `tasks.md` and the source files.

---

## Routes

| Path | Page Component | Lazy Loaded | Auth Required |
|------|---------------|-------------|---------------|
| `/` | `src/pages/home.tsx` (Dashboard) | No (initial route) | Yes (platform auth) |
| `/medications` | `src/pages/medications.tsx` | Yes | Yes |
| `/calendar` | `src/pages/calendar.tsx` | Yes | Yes |
| `/analytics` | `src/pages/analytics.tsx` | Yes | Yes |

All routes share `src/pages/_layout.tsx` which renders the persistent bottom nav bar (mobile)
/ side nav (tablet) for switching between the 4 screens.

---

## Layout

### `_layout.tsx`

**Responsibility**: Root shell; renders nav + `<Outlet>`. Must remain visible on all routes.

**Nav items** (4 tabs):
1. Home (dashboard icon) → `/`
2. Medications (pill icon) → `/medications`
3. Calendar (calendar icon) → `/calendar`
4. Analytics (chart icon) → `/analytics`

**Nav behaviour**:
- Mobile (< 768 px): fixed bottom navigation bar
- Tablet (≥ 768 px): collapsible left sidebar

**Pre-condition**: User is authenticated (platform identity); layout renders unconditionally
after platform auth handshake.

---

## Screen Contracts

### Dashboard (`/`)

**Data dependencies**:
- `useMedications()` — active medications with reminder times
- `useIntakeLogs({ from: startOf7DaysAgo, to: endOfToday })` — for stats and schedule
- `useOverdue()` — derives overdue list from the above

**Rendered regions** (top to bottom):
1. `<OverdueBanner>` — visible only when `overdue.length > 0`
2. `<StatsBar>` — always visible
3. Today's Schedule section — always visible (empty state when no doses today)
4. `<Button>` Log Intake (standalone) — always visible at bottom

**Post-condition**: All Dataverse reads use `$select`; no unbounded `getAll()` call.

---

### Medications (`/medications`)

**Data dependencies**:
- `useMedications()` — all medications for current user

**Rendered regions**:
1. "Add Medication" button in page header
2. Active medications section (count badge + list of `<MedicationCard>`)
3. Inactive medications section (count badge + list, collapsible on mobile)

**Empty state**: When no medications exist, show illustration + "Add your first medication" CTA.

**Post-condition**: After any create/update/delete mutation, the medications list query is
invalidated and re-fetched.

---

### Calendar (`/calendar`)

**Data dependencies**:
- `useIntakeLogs({ from: startOfMonth, to: endOfMonth })` — scoped to viewed month
- `useMedications()` — for "Log Intake" pre-population

**Rendered regions**:
1. Month navigation header (prev / current month label / next)
2. `react-day-picker` month view with day cell modifiers
3. Day detail panel (mobile: bottom sheet; tablet: right panel) — visible when a day is selected

**Day cell modifiers** (applied to react-day-picker `modifiers` prop):
- `has-taken`: day has ≥ 1 Taken log → green indicator
- `has-missed`: day has ≥ 1 Missed log AND no Taken → red indicator
- `has-skipped`: day has only Skipped logs → grey indicator
- `mixed`: day has both Taken and at least one Missed → orange indicator

**Post-condition**: Month navigation only fetches logs for the viewed month; previous months
remain in TanStack Query cache (`staleTime: 5 min`).

---

### Analytics (`/analytics`)

**Data dependencies**:
- `useIntakeLogs({ from: windowStart, to: today })` — filtered by selected time window
- `useMedications()` — for filter dropdown

**Rendered regions**:
1. Time window selector (3 buttons: 3M / 6M / 1Y); default = 3M
2. Medication filter dropdown (All / individual medication)
3. `<AdherenceChart>` (Recharts)
4. Per-medication breakdown table
5. Export button → `downloadCsv()`

**Post-condition**: Chart re-renders only when window or filter changes (memoised data series).

---

## Shared Component Contracts

### `<MedicationCard>`

```ts
interface MedicationCardProps {
  medication: MedicationViewModel
  onEdit: (medication: MedicationViewModel) => void
  onDelete: (medicationId: string) => void
  onToggleActive: (medicationId: string, isActive: boolean) => void
}
```

**Renders**: name, dosage badge, frequency tag, method tag, reminder time, instructions
preview (first 60 chars + ellipsis when longer). Edit (pencil) and Delete (trash) icon
buttons in card actions area.

**Constraints**: Delete triggers `<ConfirmDeleteDialog>` — `onDelete` is NOT called until
user confirms.

---

### `<MedicationForm>` (modal dialog)

```ts
type MedicationFormMode = 'add' | 'edit'

interface MedicationFormProps {
  mode: MedicationFormMode
  initialValues?: MedicationViewModel  // required when mode === 'edit'
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (medication: MedicationViewModel) => void
}
```

**Fields** (identical for add and edit):
- Name (text input, required)
- Dosage (text input, required)
- Frequency (Select, required; options: Daily / Weekly / Biweekly / As-Needed)
- Scheduled Day (Select, conditional; visible only when Frequency is Weekly or Biweekly)
- Method (Select with icon, required; options: Pill / Injection / Topical / Inhaler / Liquid)
- Reminder Time (time input, optional)
- Instructions (Textarea, optional)
- Active (Toggle/Switch, defaults to `true` in add mode)

**Buttons**: Cancel | Save (add mode) / Update (edit mode)

**Invariants**:
- When Frequency changes away from Weekly/Biweekly, Scheduled Day value is cleared to undefined
- Save/Update button disabled until Name, Dosage, Frequency, and Method are all filled
- No injection site section in the medication form; site selection occurs only at log time

---

### `<LogIntakeDialog>`

```ts
interface LogIntakeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  prePopulation: LogIntakePrePopulation
  onSaved: (log: IntakeLogViewModel) => void
}
```

**Fields**:
- Medication (Select from user's active medications, required; may be pre-set)
- Date (date picker, required; defaults to current date or `prePopulation.calendarDate`)
- Time (time input, required; defaults to current time)
- Status (3-button segmented control: Taken / Skipped / Missed; default = Taken)
- Injection Site section (visible only when selected medication has Method = Injection)
- Notes (Textarea, optional)

**Injection site section** (when visible):
- Show Body Map / Hide Body Map toggle button
- When shown: `<BodyMap>` component showing all 5 canonical sites
- Site must be selected before save is enabled (when medication is Injection)

**Buttons**: Cancel | Log Intake

**Invariants**:
- When selected medication changes mid-dialog, injection site section shows/hides based on
  the new medication's method; any previously selected site is cleared; all 5 canonical sites
  remain available (no per-medication filtering)
- Medication field cannot be cleared once pre-set from banner or schedule (read-only select)
- When medication is pre-set from banner: medication field is disabled (read-only)

---

### `<BodyMap>`

```ts
interface BodyMapProps {
  recentSites: Ppa_intakelogsppa_injectionsite[]  // sites used in the past 7 days
  selectedSite: Ppa_intakelogsppa_injectionsite | undefined
  onSiteSelect: (site: Ppa_intakelogsppa_injectionsite) => void
}
```

**Renders**:
- Human silhouette SVG figure with filled orange circle (`●`) overlaid at each recently-used
  site position. Figure dots are NOT click targets (pointer-events: none on dots).
- Pill-shaped chip buttons below the figure — one per canonical site (always all 5:
  Right Hip, Left Hip, Abdominal Right, Abdominal Center, Abdominal Left). Recently-used
  chips display "(recent)" suffix. Selected chip shows highlighted/active state.

**Invariants**:
- All 5 canonical sites are always shown; no per-medication filtering
- Only one chip may be selected at a time (single-select; tapping a chip deselects previous)
- No auto-select on mount; user must tap a chip to select a site
- Chip tap target: minimum 44×44 px (WCAG 2.1 AA)
- Orange dot positions are fixed: Right Hip (lower right), Left Hip (lower left),
  Abdominal Right (mid right), Abdominal Center (mid center), Abdominal Left (mid left)

---

### `<OverdueBanner>`

```ts
interface OverdueBannerProps {
  overdueMedications: OverdueMedication[]
  onLog: (medication: MedicationViewModel) => void
}
```

**Renders**: When `overdueMedications.length > 0`, shows a persistent amber banner.
- If 1 overdue: "[Name] [Dosage] — overdue by [X h Y min] [Log]"
- If 2+: aggregated count — "[N] doses overdue — [View All] / [Log First]"

**Constraints**: Banner stays visible until all overdue medications have a Taken log for today.
No dismiss/close button (intentional per spec; banner resolves by logging).

---

### `<StatsBar>`

```ts
interface StatsBarProps {
  stats: AdherenceStats
  isLoading: boolean
}
```

**Renders 4 stat tiles** (left to right / 2×2 on mobile):
1. 7-day adherence % (with sparkline or percentage ring)
2. Streak (consecutive days with all doses taken)
3. Missed today (count)
4. Active medications (count)

**Loading state**: `<Skeleton>` tiles from `src/components/ui/skeleton.tsx`.

---

### `<AdherenceChart>`

```ts
interface AdherenceChartProps {
  data: AdherenceDataPoint[]
  isLoading: boolean
}
```

**Chart type**: Recharts `<BarChart>` (bar per period, Y-axis = 0–100%).
Single series (overall adherence %); filtered series (per-medication) when medication filter active.

**Constraints**: Maximum 52 data points (1Y / weekly grouping). No windowing needed below this
threshold per constitution Principle IV (recharts windowing required above 90 records).

---

## Data Flow Contracts

### Query key conventions (TanStack Query)

```ts
// Medications
['medications']                    // list (all user medications)
['medications', medicationId]      // single record

// Intake logs
['intakelogs', { from, to }]       // list filtered by date range
['intakelogs', { from, to, medicationId }] // filtered by date + medication
```

### Mutation invalidation rules

| Mutation | Invalidates |
|----------|------------|
| Create medication | `['medications']` |
| Update medication | `['medications']`, `['medications', id]` |
| Delete medication | `['medications']` |
| Create intake log | `['intakelogs']` (all) |
| Update intake log | `['intakelogs']` (all) |
| Delete intake log | `['intakelogs']` (all) |

### Sonner toast conventions

| Event | Toast type | Message |
|-------|-----------|---------|
| Medication saved | `success` | "[Name] saved" |
| Medication deleted | `success` | "[Name] deleted" |
| Intake logged | `success` | "Intake logged" |
| Intake updated | `success` | "Intake updated" |
| Any Dataverse error | `error` | "Something went wrong. Please try again." |
| CSV export ready | `success` | "Report downloaded" |
