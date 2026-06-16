<!--
SYNC IMPACT REPORT
==================
Version change: (template / unratified) → 1.0.0
Rationale: Initial ratification of the MedTrack constitution. MAJOR baseline (1.0.0)
because this establishes the first governing principle set for the project.

Modified principles: N/A (initial adoption)
Added sections:
  - Core Principles I–V (Patient Data Privacy & Security; Accessible Responsive UX;
    Type-Safe Quality-Gated Code; Data Integrity & Reminder Reliability;
    Power Platform Alignment)
  - Security, Privacy & Compliance Requirements
  - Development Workflow & Quality Gates
  - Governance
Removed sections: N/A

Templates requiring updates:
  - .specify/templates/plan-template.md ✅ reviewed — generic "Constitution Check" gate
    aligns; no edits required (gates are derived from this file at plan time)
  - .specify/templates/spec-template.md ✅ reviewed — mandatory sections compatible;
    no edits required
  - .specify/templates/tasks-template.md ✅ reviewed — task categories (security
    hardening, accessibility, polish) accommodate principle-driven tasks; no edits required
  - .specify/templates/checklist-template.md ✅ reviewed — compatible; no edits required

Follow-up TODOs: None. RATIFICATION_DATE set to first-adoption date 2026-06-16.
-->

# MedTrack Constitution

MedTrack is a Power Apps Code App (React + TypeScript + Vite on Microsoft Power Platform,
backed by Dataverse) that helps people manage medication schedules and log intakes. Because
the app handles sensitive personal health information, every principle below is binding on all
features, screens, and data flows.

## Core Principles

### I. Patient Data Privacy & Security (NON-NEGOTIABLE)

All medication, intake, dosage, injection-site, note, and photo data is sensitive personal
health information and MUST be protected accordingly.

- Access MUST be scoped to the authenticated owner. A user MUST never read or write another
  user's records; row-level ownership MUST be enforced at the Dataverse/data layer, not only
  in the UI.
- Authentication MUST be delegated to Power Platform / Entra ID; the app MUST NOT implement
  its own credential store or bypass platform identity.
- Sensitive data MUST NOT be written to logs, telemetry, analytics events, URLs, or any
  third-party service. Diagnostic logging MUST exclude health content and personal identifiers.
- Secrets, connection strings, and environment IDs MUST come from configuration/environment
  variables — never hard-coded in source.
- Photo attachments MUST be stored within the governed Dataverse/Power Platform boundary and
  served only to their owner.

**Rationale**: A breach of medication or health data causes real-world harm and erodes trust
irreversibly; privacy is the product's foundation, not a feature.

### II. Accessible, Responsive User Experience

The interface MUST be usable and pleasant on both phones and tablets, for all users.

- Every screen MUST be responsive and verified at mobile (~375px) and tablet (~768px+)
  breakpoints; primary tasks MUST be reachable without horizontal scrolling.
- Interactive elements MUST meet WCAG 2.1 AA: keyboard operability, visible focus, text
  contrast ≥ 4.5:1, and touch targets ≥ 44×44px.
- Components MUST use the established accessible primitives (Radix UI / shadcn) and provide
  labels/ARIA for icon-only controls, the body-map injection-site selector, and charts.
- Time-sensitive flows (logging a dose, responding to a reminder) MUST be completable in the
  fewest reasonable steps; destructive actions (delete medication/intake) MUST require
  confirmation.

**Rationale**: Adherence depends on the app being frictionless and inclusive across the devices
people actually carry; an unusable reminder is a missed dose.

### III. Type-Safe, Quality-Gated Code

Code quality is enforced mechanically, not by convention alone.

- The project MUST remain in TypeScript strict mode; `any` is disallowed except with an inline
  justification comment. Dataverse record shapes MUST be modeled as explicit types.
- `npm run lint` and `npm run build` (which runs `tsc -b`) MUST pass with zero errors before
  any change is considered complete.
- Server/data state MUST flow through TanStack Query; client/UI state through Zustand. Direct
  ad-hoc fetch-and-store patterns that duplicate this layering are disallowed.
- Components MUST be small and single-purpose; shared logic MUST be extracted into hooks or
  `lib/` utilities rather than copy-pasted.

**Rationale**: A health app cannot afford silent runtime type errors; enforced gates keep an
AI-and-human codebase consistent and safe to change.

### IV. Data Integrity & Reminder Reliability

Schedules, doses, and adherence numbers MUST be trustworthy.

- Dates and times MUST be stored and computed unambiguously (consistent timezone handling via
  the project's date library); a dose's scheduled time MUST be reconstructable.
- A logged intake MUST be immutable in meaning: edits MUST preserve an accurate timestamp of
  when the dose was actually taken, distinct from when the record was created or edited.
- Adherence analytics, "missed dose," and "upcoming dose" calculations MUST be derived from a
  single, documented source of truth so the dashboard, calendar, and exported reports always
  agree.
- Reminder scheduling MUST degrade safely: a failed or missed notification MUST NOT corrupt
  the schedule, and the dashboard MUST still surface the missed dose.

**Rationale**: If adherence data or reminders are wrong, users make incorrect health decisions;
correctness here is a safety requirement, not a nicety.

### V. Power Platform Alignment

The app MUST work with the Power Platform model, not around it.

- Dataverse is the system of record. New persistent entities MUST be Dataverse tables with
  explicit logical/entity-set names registered in `power.config.json`.
- External capabilities (notifications, email, file services) MUST be accessed through
  approved Power Platform connectors with declared connection references — not unmanaged
  direct calls.
- The build MUST stay deployable via the Power Apps toolchain (`pac code`, the Power Apps Vite
  plugin); changes MUST NOT break `npm run build` output consumed by `pac code push`.
- Environment-specific values (app ID, environment ID, connection references) MUST live in
  configuration and remain free of secrets in source control.

**Rationale**: Staying inside the platform's governance, identity, and ALM model is what makes
the security and compliance guarantees above actually hold.

## Security, Privacy & Compliance Requirements

- **Data minimization**: Collect only fields needed for medication management and adherence.
  New personal-data fields require explicit justification in the feature spec.
- **Least privilege**: Connector and table permissions MUST grant the minimum scope required;
  broad or admin-level scopes MUST be justified in the plan's Complexity Tracking.
- **In transit & at rest**: All data exchange MUST use HTTPS/TLS via platform endpoints;
  persistence relies on Dataverse-managed encryption at rest.
- **Auditability**: Create/update/delete of medications and intakes SHOULD be attributable to
  the acting user via platform audit capabilities, without storing health content in app logs.
- **Export safety**: Exported reports MUST contain only the requesting user's data and MUST be
  generated client-side or through governed services, never via an unauthenticated endpoint.

## Development Workflow & Quality Gates

- **Spec-driven flow**: Features follow the Spec Kit lifecycle — `specify` → `clarify`
  (when needed) → `plan` → `tasks` → `implement`. Each artifact MUST reflect these principles.
- **Constitution Check**: `plan.md` MUST pass the Constitution Check gate before Phase 0 and
  again after design. Violations MUST be recorded in Complexity Tracking with justification.
- **Definition of done** for any change:
  1. `npm run lint` passes with zero errors.
  2. `npm run build` (`tsc -b` + Vite) passes with zero errors.
  3. Affected screens verified responsive at mobile and tablet breakpoints.
  4. No sensitive data added to logs, telemetry, or external services.
- **Reviews**: Changes touching authentication, data access, ownership scoping, or export MUST
  receive explicit security review against Principle I before merge.
- **Incremental delivery**: Work is organized by independently testable user stories (P1, P2,
  …) so each slice is a deployable MVP increment.

## Governance

This constitution supersedes other development practices for MedTrack. Where guidance conflicts,
the constitution wins.

- **Amendments**: Changes are proposed via pull request that updates this file, states the
  rationale, and bumps the version per the policy below. Material changes MUST update dependent
  Spec Kit templates in the same change.
- **Versioning policy** (semantic):
  - **MAJOR**: Backward-incompatible governance change — removing or redefining a principle.
  - **MINOR**: Adding a new principle/section or materially expanding guidance.
  - **PATCH**: Clarifications, wording, and non-semantic refinements.
- **Compliance review**: Plans, specs, tasks, and code reviews MUST verify alignment with these
  principles. Unjustified violations block merge until resolved or recorded in Complexity
  Tracking.
- **Runtime guidance**: Day-to-day agent and contributor guidance lives in `CLAUDE.md` and the
  Spec Kit artifacts under `specs/`; those MUST remain consistent with this constitution.

**Version**: 1.0.0 | **Ratified**: 2026-06-16 | **Last Amended**: 2026-06-16
