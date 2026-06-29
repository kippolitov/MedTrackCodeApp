# Quickstart & Validation: Calendar Month/Year Navigation & Localized Time

**Feature**: 002-calendar-month-navigation | **Branch**: `002-calendar-month-navigation`

How to run and validate this feature end-to-end. Implementation details live in `tasks.md`; this is a
run/verify guide.

## Prerequisites

- Node + npm installed; dependencies installed (`npm install`).
- On branch `002-calendar-month-navigation`.

## Run the app

- **With seed data, no Power runtime** (best for visual checks): `npm run dev:mock`
  - Exercises the calendar with mock intake logs (`src/mocks/`), no Dataverse needed.
- **Plain dev** (browser, no data unless connected): `npm run dev`
- **Against live Dataverse**: `npm run dev:live` (`pac code run`)

## Automated validation

Run the targeted tests (these MUST be written first and fail before implementation — constitution II):

```bash
npm test -- date-utils
npm test -- calendar
```

Then the full quality gates (Definition of Done):

```bash
npm run lint     # zero errors
npm run build    # tsc -b + vite build, zero errors
npm test         # all tests pass
```

## Manual validation scenarios

Map to the contracts in `contracts/` and success criteria in `spec.md`.

### Navigation (US-1, US-2)
1. Open the **Calendar** tab → current month is shown.
2. Click **previous month** → grid, markers, and the month/year label show the prior month. (N1)
3. Click **next month** twice → advances correctly. (N2)
4. Open the **year** dropdown → only years `currentYear−5 .. currentYear+1` are listed. (N8)
5. Pick a different **year**, then a different **month** → grid jumps directly there. (N3, N4)
6. From **December**, go forward → **January** of the next year, label updated. (N5) Reverse from January. (N6)
7. Click **Today** from a different month → returns to current month with today selected. (N7)
8. Navigate to a month with no logs → empty grid + day-panel empty state, no error. (N9)

### Localized time/date (US-3)
9. With a **US locale** (browser set to `en-US`): select a day with logs → times read as `8:30 AM`,
   date heading in US style. (FR-009/FR-010)
10. Switch the **browser locale** to a 24-hour locale (e.g., `en-GB`/`de-DE`) and reload → same times read
    as `20:30`; date heading in that locale's style. (SC-003)
11. Verify a noon log shows `12:00 PM` (US) and a midnight log shows `12:00 AM` (US); `12:00` / `00:00` in 24-hr.

### Responsive (FR-012, SC-006)
12. At ~375 px width: controls wrap, no horizontal scroll, calendar + day panel stack.
13. Tab through all navigation controls: each is focusable with a visible ring and operable by keyboard.

## Expected outcomes

- All `contracts/` behaviors (N1–N10, time/date acceptance tables) hold.
- `npm run lint`, `npm run build`, and `npm test` pass with zero errors.
- No mixed 12-/24-hour times on a single screen for a given locale (SC-003).
