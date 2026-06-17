# UX & Interaction Requirements Quality Checklist: MedTrack

**Purpose**: Validate completeness, clarity, and consistency of UX and interaction requirements before planning. Tests the quality of requirements as written — not whether the implementation works.
**Created**: 2026-06-17
**Feature**: [spec.md](../spec.md)
**Focus**: UX & Interaction requirements quality — pre-planning gate
**Depth**: Standard (thorough pre-planning)

---

## Body Map & Injection Site Interaction

- [x] CHK001 Is the complete canonical list of selectable injection site names defined in the spec (e.g., "Left Hip", "Right Hip", "Abdominal Left", etc.)? [Completeness, Spec §FR-005, Gap] ✓ FR-005 & FR-013: exactly 5 sites — Right Hip, Left Hip, Abdominal Right, Abdominal Center, Abdominal Left.
- [x] CHK002 Is "recently-used" defined with a specific threshold (e.g., last N intakes or within the past N days), or is it left as an undefined vague term? [Clarity, Spec §FR-013, Gap] ✓ FR-013: recently-used = selected in an intake log within the past 7 days.
- [x] CHK003 Are the visual states of a body map site (unselected / valid / selected / recently-used / invalid/unavailable) each given distinct requirements? [Clarity, Spec §FR-013, Gap] ✓ FR-012 & FR-013: two states defined — recently-used (orange dot + "(recent)" chip) and not recently used (chip only, no dot). Single-select; chips are the tap targets; figure dots are visual only.
- [x] CHK004 Is it specified what happens when a medication has only one valid injection site — does the body map auto-select it, or does the user still tap to confirm? [Edge Case, Spec §FR-012, Gap] ✓ N/A — FR-005 removed; all 5 canonical sites always shown for any Injection medication; "exactly one valid site" scenario cannot occur. User must always tap to select.
- [ ] CHK005 Are accessibility requirements defined for the body map as a custom interactive element (keyboard operability, ARIA role, touch target size ≥ 44×44 px)? [Coverage, Spec §Constitution §III, Gap]
- [ ] CHK006 Is the body map layout described for mobile viewport (375 px) where vertical space is constrained? [Responsiveness, Gap]

---

## Conditional Form Fields (Scheduled Day)

- [x] CHK007 Is the Scheduled Day field explicitly scoped to the "Weekly" frequency value only, with all other frequency values confirmed to hide it? [Clarity, Spec §FR-001] ✓ Updated: shows for Weekly and Biweekly; hidden for Daily and As-Needed.
- [x] CHK008 Is the data-handling requirement defined for when a user changes Frequency from "Weekly" to another option — is the previously selected Scheduled Day silently cleared or retained? [Edge Case, Spec §FR-001, Gap] ✓ FR-001: Scheduled Day is silently cleared when Frequency changes to Daily or As-Needed; not retained.
- [x] CHK009 Are the available Frequency options enumerated (Daily, Weekly, Every N Days)? And for "Every N Days", is the N-value input field and its constraints specified? [Completeness, Spec §FR-001, Gap] ✓ Resolved: options confirmed as Daily, Weekly, Biweekly, As-Needed per screenshot.
- [ ] CHK010 Is it specified whether the Reminder Time field is always visible regardless of frequency, or whether it conditionally changes based on frequency type? [Clarity, Spec §FR-001, Gap]

---

## Log Intake Dialog — Entry Points & Pre-population

- [x] CHK011 Are all four entry points for the Log Intake dialog listed, and is the exact pre-populated state for each entry point specified? (e.g., medication + time from banner; date from calendar day; no pre-fill from standalone button) [Completeness, Spec §US3, FR-018, Gap] ✓ FR-011: all four entry points with pre-population rules explicitly defined.
- [x] CHK012 Is it specified what the Log Intake dialog looks like when opened from the standalone "Log Intake" button with no contextual pre-fill — are all fields blank, or are defaults applied (e.g., current date/time)? [Clarity, Spec §FR-010, Gap] ✓ FR-011: date/time = current, no medication pre-set, status = Taken.
- [ ] CHK013 Is it defined what happens to the injection site body map if the user switches the medication selector mid-dialog to a medication with a different method (e.g., from injection to pill)? [Edge Case, Spec §FR-012, Gap]
- [ ] CHK014 Is the required vs optional status of every Log Intake dialog field explicitly stated (medication, date/time, status, injection site, notes)? [Completeness, Spec §FR-011–FR-014, Gap]
- [x] CHK015 Are requirements defined for the default status selection in the Log Intake dialog when opened from an overdue reminder vs. opened independently? [Clarity, Spec §FR-009, FR-011, Gap] ✓ FR-011: default is "Taken" in all entry points.

---

## Add / Edit Medication Modal

- [x] CHK016 Is it specified whether Add Medication and Edit Medication use identical field sets, or whether certain fields (e.g., Active toggle) appear only in Edit mode? [Consistency, Spec §FR-001, FR-002] ✓ FR-002: identical field sets; Add starts empty (Active defaults on); Edit pre-populates all fields.
- [ ] CHK017 Are validation requirements defined for each form field — which are required, which are optional, and what format or range constraints apply (e.g., reminder time must be a valid time)? [Completeness, Spec §FR-001, Gap]
- [ ] CHK018 Is the behavior when the user taps "Cancel" with unsaved edits in the Edit Medication form explicitly specified (discard silently, or prompt to confirm discard)? [Edge Case, Spec §US1, Gap]
- [x] CHK019 Is it specified what triggers the injection site configuration section to appear or disappear within the medication form when the Method dropdown changes? [Clarity, Spec §FR-001, FR-005, Gap] ✓ FR-005 removed — injection site section does not exist in the medication form at all; body map appears only on the Log Intake form (FR-012).
- [ ] CHK020 Is the Instruction field's character limit (if any) specified, and is truncation behavior on the medication card defined? [Clarity, Spec §FR-001, FR-006, Gap]

---

## Medication List Card & Grouping

- [ ] CHK021 Are display requirements consistent between the Active and Inactive medication card, or are fields shown differently for inactive records? [Consistency, Spec §FR-004, FR-006]
- [ ] CHK022 Is the sort order of medications within each group (Active / Inactive) specified (e.g., alphabetical, most recently added, manual)? [Completeness, Spec §FR-006, Gap]
- [ ] CHK023 Are requirements defined for the medication card when the Instructions field is empty — is the instructions row hidden, or is a placeholder shown? [Edge Case, Spec §FR-006, Gap]

---

## Reminder Banner

- [ ] CHK024 Is it specified whether multiple simultaneous overdue doses show one banner each (stacked) or a single aggregated banner with a count? [Clarity, Spec §FR-009, Gap]
- [ ] CHK025 Is the dismissal or persistence behavior of the reminder banner specified — does tapping ✕ permanently hide it until next reminder, or only for the current session? [Clarity, Spec §FR-009, Gap]

---

## Calendar & Day Detail Panel

- [ ] CHK026 Are colour-coding rules defined for mixed-status days (e.g., a day with both Taken and Missed events — which colour wins, or are multiple indicators shown)? [Clarity, Spec §FR-016, Gap]
- [ ] CHK027 Is it specified whether the day detail panel is a side panel (tablet/desktop) or a bottom sheet / full overlay (mobile), or whether this layout is responsive? [Clarity, Spec §US4, Gap]
- [ ] CHK028 Are requirements defined for the calendar when navigated to a month before any medications were added — is the month empty, or is a specific message shown? [Edge Case, Spec §FR-016, Gap]

---

## Empty States & Loading States

- [ ] CHK029 Are empty state requirements defined for each primary screen: Dashboard (no medications), Medications list, Calendar (no records in selected month), Analytics (no data yet), and Log Intake dropdown (no medications)? [Completeness, Spec §US1–US5, Gap]
- [ ] CHK030 Are loading state requirements specified for asynchronous data operations — specifically: dashboard schedule load, calendar month navigation, and analytics chart time-window switch? [Coverage, Gap]
- [ ] CHK031 Are requirements defined for connection error states — what the user sees when a data save or fetch fails, and whether partial form data is preserved for retry? [Spec §Edge Cases, Coverage]

---

## Destructive Action Confirmations

- [ ] CHK032 Are confirmation dialog requirements consistent across all destructive actions (delete medication, delete intake log), including whether dialog text, button labels, and cancel behaviour match? [Consistency, Spec §FR-003, FR-015]
- [ ] CHK033 Is the confirmation dialog content (title, body message, confirm label, cancel label) specified, or only its existence? [Clarity, Spec §FR-003, Gap]

---

## Analytics UX

- [ ] CHK034 Is the default/initial time window specified for when the Analytics screen first loads (3 months, 6 months, or 1 year)? [Clarity, Spec §FR-021, Gap]
- [ ] CHK035 Is the chart type (line chart, bar chart, area chart) specified for the adherence trend, or is it left to implementation discretion? [Clarity, Spec §FR-021, Gap]

---

## Notes

- Check items off as completed: `[x]`
- Add inline findings, e.g.: `- [x] CHK001 ✓ Sites listed in FR-005` or `- [ ] CHK002 ⚠ No threshold defined — needs clarification before planning`
- Items marked `[Gap]` indicate a requirement that appears to be absent from the spec and likely needs to be added via `/speckit-clarify` before planning begins
- Items without `[Gap]` reference existing spec sections that may need tightening for clarity or consistency
- Total items: 35 | Passing: 12/35 | Focus: UX & Interaction | Depth: Standard pre-planning gate
- Last updated: 2026-06-17 (clarification session 5 — FR-005 removed; CHK004/CHK019 notes updated)
