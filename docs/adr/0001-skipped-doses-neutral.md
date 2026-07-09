# ADR-0001: Skipped doses are excluded from adherence and streak calculations

**Date**: 2026-07-09
**Status**: Accepted

## Context

A Skipped dose is a deliberate clinical choice — the user (or their doctor) decided not to take a dose on that occasion. This is categorically different from a Missed dose, which is a failure to act.

Two alternative treatments were considered:

- **Count Skipped as non-adherent (same as Missed)**: rejected because it conflates deliberate decisions with failures, producing misleading adherence scores that could cause unwarranted concern or erode trust.
- **Count Skipped as adherent (same as Taken)**: rejected because the medication was not actually administered, which matters for clinical accuracy and honest reporting.

## Decision

Skipped doses are **neutral**:

- Excluded from the adherence numerator (not counted as taken)
- Excluded from the adherence denominator (not counted as scheduled)
- Do not count toward the streak, but do not break it either
- A day consisting entirely of Skipped doses is treated as a rest day for streak purposes
- Any logged status — including Skipped — resolves the Overdue state for that dose

## Consequences

The following functions require updating to implement this rule:

- `adherence7d()` in `src/lib/adherence.ts` — exclude Skipped from scheduled count
- `currentStreak()` in `src/lib/adherence.ts` — treat Skipped-only days as rest days
- `missedToday()` in `src/lib/adherence.ts` — exclude Skipped from "not taken" count
- `useOverdue()` in `src/hooks/use-overdue.ts` — resolve Overdue on any logged status, not just Taken
