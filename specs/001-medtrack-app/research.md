# Research: MedTrack — Phase 0 Findings

**Branch**: `001-medtrack-app` | **Date**: 2026-06-17 | **Plan**: [plan.md](plan.md)

All NEEDS CLARIFICATION items from Technical Context are resolved here.

---

## 1. Testing Setup

**Decision**: Vitest 2 + @testing-library/react 16 + jsdom + MSW 2

**Rationale**: Vitest integrates natively with Vite's config and module graph — zero
duplication of transform / alias settings. `@testing-library/react` is the standard
for behaviour-driven React component testing. MSW (Mock Service Worker) 2 stubs the
`@microsoft/power-apps` data client at the network boundary, avoiding true Dataverse calls
in unit/integration tests while still exercising hooks and service classes (not in-component
`useEffect` mocks, which the constitution prohibits for Dataverse calls).

**How to add**:
```bash
npm install --save-dev vitest @testing-library/react @testing-library/user-event \
  @testing-library/jest-dom @vitejs/plugin-react jsdom msw
```

**vite.config.ts additions**:
```ts
/// <reference types="vitest" />
export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
  },
})
```

**tests/setup.ts**:
```ts
import '@testing-library/jest-dom'
import { server } from './mocks/server'
beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

**package.json script**:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Alternatives considered**:
- Jest: requires babel config and separate transform pipeline; doesn't share Vite config.
- Playwright (component tests): heavier setup, slow for unit/integration level tests.
- No testing: blocks merge per constitution Principle II.

---

## 2. Injection Sites (Superseded — No Schema Change Required)

**Decision**: No `ppa_validinjection_sites` column is created. FR-005 (injection site
configuration in the Add/Edit Medication form) has been removed from scope.

The body map and injection site selection appear **only on the Log Intake form**. All five
canonical sites (Right Hip, Left Hip, Abdominal Right, Abdominal Center, Abdominal Left) are
always available for any Injection-method medication — no per-medication filtering is applied.
Site keys are already defined in the generated `Ppa_intakelogsppa_injectionsite` enum and
stored on `ppa_intakelogs.ppa_injectionsite` (single-select option set). No new Dataverse
columns are needed.

`src/lib/injection-sites.ts` still provides label helpers and recently-used detection
(comparing `ppa_loggedat` + `ppa_injectionsite` on existing logs within the past 7 days).

---

## 3. Adherence Calculation Algorithm

**Decision**: Pure client-side computation in `src/lib/adherence.ts` using date-fns helpers.

**Rationale**: Dataverse does not support aggregate queries at the level needed (per-day
dose totals across medication frequencies). Client-side computation over a filtered dataset
is the only practical approach within the Power Apps Code App pattern.

### Algorithm

**Scheduled dose count for a day** (given a list of active medications):
A medication contributes a scheduled dose to date `D` if:
- `frequency === Daily` — always
- `frequency === Weekly` — `D.dayOfWeek === medication.ppa_scheduledday`
- `frequency === Biweekly` — `D.dayOfWeek === medication.ppa_scheduledday` (same logic as
  weekly; biweekly cadence tracked via actual intake logs, not schedule alone)
- `frequency === As_Needed` — never contributes to scheduled count; only appears in
  calendar when a log exists

**7-day adherence % (dashboard)**:
```
window = [today-6 .. today]   (7 calendar days, local timezone)
For each day D in window:
  scheduled[D] = active medications with a scheduled dose on D
  taken[D]     = intake logs on D with status = Taken
adherence_7d = sum(taken[D] for D in window) / sum(scheduled[D] for D in window) * 100
```
If `sum(scheduled) === 0`, adherence displays as "—" (no scheduled doses in window).

**Current streak (consecutive fully-adherent days)**:
```
streak = 0
D = today
loop:
  if scheduled[D].count === 0: skip D (rest day), continue to D-1
  if taken[D].count < scheduled[D].count: break
  streak++
  D = D - 1
```

**Analytics period adherence**:
Same formula as 7-day but with window = last 3 months / 6 months / 1 year.
Group by ISO week or month for chart data points.

**Per-medication breakdown**:
Filter intake logs by `ppa_medication_value === medicationId` before running the algorithm.

**Biweekly handling note**: "Biweekly" in the spec means every-two-weeks. Since Dataverse
stores only `ppa_scheduledday` (a day of the week) without a week-offset, a "biweekly"
medication dose is scheduled on its day every second week starting from the medication's
`createdon` date. Implementation: `Math.floor(weeksBetween(createdon, D) % 2) === 0`.

---

## 4. CSV Export

**Decision**: Client-side string assembly → `Blob` → `URL.createObjectURL` download link.

**Rationale**: No server-side endpoint exists (Power Apps Code App is a pure SPA). The
browser's File API is available in Power Apps embedded webview. File size is bounded
(~1 MB for 1-year / 3-medication dataset). This approach requires no additional packages.

**Implementation** (`src/lib/csv-export.ts`):
```ts
export function downloadCsv(rows: IntakeLogRow[], filename: string): void {
  const header = 'Medication,Date,Time,Status,Injection Site,Notes\n'
  const body = rows.map(r => [
    csvEscape(r.medicationName),
    format(r.loggedAt, 'yyyy-MM-dd'),
    format(r.loggedAt, 'HH:mm'),
    r.status,
    r.injectionSite ?? '',
    csvEscape(r.notes ?? ''),
  ].join(',')).join('\n')
  const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

**Alternatives considered**:
- **xlsx / SheetJS**: Adds ~500 KB gzipped to the bundle; CSV is the spec requirement.
- **Server action**: No server available in this deployment model.

---

## 5. Overdue Reminder Detection

**Decision**: Client-side, TanStack Query `refetchInterval` + `useMemo` derivation.

**Rationale**: There is no server-side push mechanism in the Power Apps Code App model.
The spec explicitly states reminders are in-app banners (not OS push). The overdue state
is derived from current wall-clock time vs. scheduled reminder times, computed on every
render after a short polling refetch.

**Algorithm** (`src/hooks/use-overdue.ts`):
```ts
// 1. useQuery on medications (staleTime: 5 min, refetchInterval: 60_000)
// 2. useQuery on today's intake logs (staleTime: 30s, refetchInterval: 30_000)
// 3. Derive overdue list:
//    For each active medication with a scheduled dose today:
//      if no Taken intake log exists for today AND reminderTime < now → overdue
// 4. Return sorted by most-overdue first
```

**Polling interval**: 60 seconds (balances responsiveness vs. Dataverse quota).
Banner updates between refetches purely from the local cache (no spinner shown).

**Alternatives considered**:
- `setInterval` in a `useEffect`: works but harder to test and invalidates TanStack
  Query's cache management; rejected in favour of `refetchInterval`.
- Web Workers: unnecessary complexity for a simple time comparison.
