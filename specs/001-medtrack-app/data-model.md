# Data Model: MedTrack

**Branch**: `001-medtrack-app` | **Date**: 2026-06-17 | **Plan**: [plan.md](plan.md)

---

## Dataverse Entities

### Entity 1: ppa_medications

**Logical name**: `ppa_medication` | **Entity set**: `ppa_medications`
**Generated model**: `src/generated/models/Ppa_medicationsModel.ts`
**Service**: `src/generated/services/Ppa_medicationsService.ts`

| Dataverse Column | TypeScript Field | Type | Required | Notes |
|-----------------|-----------------|------|----------|-------|
| `ppa_medicationid` | `ppa_medicationid` | `string` (GUID) | Yes | PK; auto-generated |
| `ppa_name` | `ppa_name` | `string` | Yes | Medication display name |
| `ppa_dosage` | `ppa_dosage` | `string` | Yes | Combined text e.g. "40mg/0.8mL" |
| `ppa_frequency` | `ppa_frequency` | `Ppa_medicationsppa_frequency` | Yes | Choice: 894250000=Daily, 894250001=Weekly, 894250002=Biweekly, 894250003=As_Needed |
| `ppa_scheduledday` | `ppa_scheduledday` | `Ppa_medicationsppa_scheduledday \| undefined` | No | Choice: 894250000–894250006 (Mon–Sun); only relevant when frequency is Weekly or Biweekly |
| `ppa_method` | `ppa_method` | `Ppa_medicationsppa_method` | Yes | Choice: 894250000=Pill, 894250001=Injection, 894250002=Topical, 894250003=Inhaler, 894250004=Liquid |
| `ppa_remindertime` | `ppa_remindertime` | `string \| undefined` | No | Time string in `HH:mm` format (stored as text) |
| `ppa_instructions` | `ppa_instructions` | `string \| undefined` | No | Free-text special handling notes |
| `ppa_isactive` | `ppa_isactive` | `boolean` | Yes | Whether medication appears in daily schedule |
| `ownerid` | `ownerid` | `string` | Yes | User reference; set by platform |
| `statecode` | `statecode` | `Ppa_medicationsstatecode` | Yes | 0=Active, 1=Inactive (Dataverse system field) |

**$select for list queries** (medications page + dashboard):
```ts
select: ['ppa_medicationid', 'ppa_name', 'ppa_dosage', 'ppa_frequency',
         'ppa_scheduledday', 'ppa_method', 'ppa_remindertime',
         'ppa_instructions', 'ppa_isactive']
```

**Validation rules**:
- `ppa_name`: required, non-empty string
- `ppa_dosage`: required, non-empty string
- `ppa_frequency`: required; must be one of the four valid option set values
- `ppa_scheduledday`: required if frequency is Weekly or Biweekly; otherwise null/undefined
- `ppa_method`: required; must be one of the five valid option set values
- `ppa_remindertime`: when present, must match `HH:mm` format (00:00–23:59)

---

### Entity 2: ppa_intakelogs

**Logical name**: `ppa_intakelog` | **Entity set**: `ppa_intakelogs`
**Generated model**: `src/generated/models/Ppa_intakelogsModel.ts`
**Service**: `src/generated/services/Ppa_intakelogsService.ts`

| Dataverse Column | TypeScript Field | Type | Required | Notes |
|-----------------|-----------------|------|----------|-------|
| `ppa_intakelogid` | `ppa_intakelogid` | `string` (GUID) | Yes | PK; auto-generated |
| `ppa_Medication@odata.bind` | `"ppa_Medication@odata.bind"` | `string` | Yes | Navigation property binding: `/ppa_medications(<GUID>)` |
| `ppa_logname` | `ppa_logname` | `string` | Yes | Snapshot of medication name at time of logging (preserved on medication delete) |
| `ppa_loggedat` | `ppa_loggedat` | `string` | Yes | ISO 8601 datetime of actual intake (user's local time converted to UTC for storage) |
| `ppa_scheduledfor` | `ppa_scheduledfor` | `string` | Yes | ISO 8601 datetime of the scheduled dose time this log pertains to |
| `ppa_status` | `ppa_status` | `Ppa_intakelogsppa_status` | Yes | Choice: 894250000=Taken, 894250001=Skipped, 894250002=Missed |
| `ppa_injectionsite` | `ppa_injectionsite` | `Ppa_intakelogsppa_injectionsite \| undefined` | No | Choice: 894250000=RightHip, 894250001=LeftHip, 894250002=AbdominalRight, 894250003=AbdominalCenter, 894250004=AbdominalLeft |
| `ppa_notes` | `ppa_notes` | `string \| undefined` | No | Free-text notes |
| `ownerid` | `ownerid` | `string` | Yes | User reference; set by platform |

> **Note**: `ppa_photourl` exists in the generated model but is out of scope for v1 per spec assumption.

**$select for list queries** (calendar, analytics):
```ts
select: ['ppa_intakelogid', 'ppa_loggedat', 'ppa_scheduledfor', 'ppa_status',
         'ppa_injectionsite', 'ppa_logname', 'ppa_notes',
         '_ppa_medication_value']
```

**Validation rules**:
- `ppa_logname`: required; set from `medication.ppa_name` at save time
- `ppa_loggedat`: required; must be a valid ISO 8601 datetime
- `ppa_scheduledfor`: required; set from the medication's reminder time on the logged date
- `ppa_status`: required; must be one of the three valid option set values
- `ppa_injectionsite`: required when the associated medication has `ppa_method === 894250001`; must be one of the five canonical valid site keys
- `"ppa_Medication@odata.bind"`: required; format `/ppa_medications(<GUID>)`

---

## App-Layer Types

These types live in `src/lib/` or `src/hooks/` and extend (never duplicate) the generated types.

### Medication (UI view model)

```ts
// src/lib/adherence.ts
import type { Ppa_medications } from '@/generated'

// No additional fields needed — Ppa_medications contains all required columns.
// Use Ppa_medications directly as the view model for medication management.
export type MedicationViewModel = Ppa_medications
```

### IntakeLog (UI view model)

```ts
import type { Ppa_intakelogs } from '@/generated'

export interface IntakeLogViewModel extends Ppa_intakelogs {
  loggedAtDate: Date     // parsed from ppa_loggedat
  scheduledForDate: Date // parsed from ppa_scheduledfor
}
```

### Overdue medication (derived state)

```ts
export interface OverdueMedication {
  medication: MedicationViewModel
  overdueBy: number  // milliseconds since reminder time passed
}
```

### Adherence stats (derived state)

```ts
export interface AdherenceStats {
  adherencePercent7d: number | null  // null when no scheduled doses in window
  streak: number                     // consecutive fully-adherent days
  missedToday: number
  activeMedicationCount: number
}
```

### Analytics data point

```ts
export interface AdherenceDataPoint {
  periodLabel: string  // 'Jan 2026', 'Week 3', etc.
  periodStart: Date
  adherencePercent: number
  scheduledCount: number
  takenCount: number
}
```

### Log Intake dialog pre-population state

```ts
// src/stores/log-intake-store.ts
export interface LogIntakePrePopulation {
  medicationId?: string     // pre-set from banner / schedule / calendar
  dateTime?: Date           // current datetime (all entry points)
  calendarDate?: Date       // calendar entry point: date override only
}
```

---

## State Transitions

### Medication lifecycle

```
Active (ppa_isactive: true)
  → [Toggle inactive] → Inactive (ppa_isactive: false)
  → [Toggle active]   → Active
  → [Delete confirmed] → Deleted (Dataverse record deleted; intake logs retained)
```

### Intake log lifecycle

```
Draft (in dialog, unsaved)
  → [Save] → Saved (ppa_intakelogid assigned, Dataverse record created)
  → [Edit] → Draft (dialog re-opened with current values)
  → [Delete confirmed] → Deleted (Dataverse record deleted)
```

### Injection site selection

```
Available (chip label, no dot)
  ← recently-used (within 7 days) ↔ not recently used
  → [Tap chip] → Selected (highlighted chip, site stored in draft log)
```
