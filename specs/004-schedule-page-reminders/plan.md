# Implementation Plan: Medication Schedule Details & Daily Email Reminder

**Branch**: `004-schedule-page-reminders` | **Date**: 2026-10-05 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-schedule-page-reminders/spec.md`

## Summary

Add a schedule section to the bottom of every card on the Medications page showing when the
Medication was last taken (with the injection site for injections) and when the next intake
is, and send one email a day listing the Medications due that day plus follow-ups for
missed intakes on the 1st, 3rd, 5th and 7th day afterwards. Injections roll forward from
the last dose; everything else follows the fixed schedule. Active/Inactive is the only
reminder switch. The reminder address must never appear in this public repository.

Technical approach: a pure TypeScript module (`src/lib/schedule.ts`) holds the schedule
rule and is the reference implementation; a new `MedicationSchedule` component renders it
from two single-row Dataverse queries per Medication. A solution-aware scheduled cloud flow
re-implements the same rule, guarded by a new one-row-per-day `ppa_ReminderRun` table so it
sends at most once a day and leaves a visible outcome. Both implementations are held to one
numbered decision table. The reminder address is an environment variable whose value is set
per environment outside the solution; CI checks stop it reaching the repository or the
exported solution artifact. The flow deploys through the existing GitHub Actions pipeline
using a deployment settings file.

## Technical Context

**Language/Version**: TypeScript 5 (strict) / React 19 / Vite 7 for the app. Power Automate
workflow definition language for the cloud flow. PowerShell 7 for deployment and
validation scripts, per repository convention.

**Primary Dependencies**: Unchanged app stack — TanStack Query 5, shadcn/ui on Radix,
Tailwind 4, date-fns 4, Lucide, PAC-generated Dataverse services (`src/generated/`).
Platform: Microsoft Dataverse connector, Mail connector, `pac` CLI,
`microsoft/powerplatform-actions`, gitleaks. **No new npm dependencies.**

**Storage**: Dataverse. Reads `ppa_medication` and `ppa_intakelog` (no schema change).
Adds table `ppa_ReminderRun`, environment variable definitions
`ppa_ReminderRecipientEmail` and `ppa_ReminderTimeZone`, and connection references
`ppa_MedTrackDataverse` and `ppa_MedTrackMail`. See [data-model.md](./data-model.md).

**Testing**: Vitest + Testing Library with `vi.mock` of the generated services (existing
pattern) for the module, hook, component and page. The flow is verified by seeding the
decision table into dev and asserting on the `ppa_ReminderRun` row. See
[quickstart.md](./quickstart.md).

**Target Platform**: Power Apps Code App in the browser (mobile ~375 px, tablet ~768 px+);
Power Automate cloud flow in the same environment; GitHub-hosted runners for deployment.

**Project Type**: Single-project web app (Power Apps Code App) plus Dataverse solution
components and CI/CD scripts.

**Performance Goals**: Medications page content, including every schedule section, within
2 s (SC-004). Reminder email within 15 minutes of local midnight (SC-006). Main bundle
growth well under the constitution's 50 KB gzipped threshold — one small module, one
component, one hook.

**Constraints**: The reminder address never appears in the repository, its history, CI
logs or build artifacts (FR-028). At most one email per calendar day (FR-020). The flow
never writes Medications or Intake Logs (FR-027). Dataverse list queries use `$select`;
intake-log queries use `staleTime` ≤ 30 s. Cross-platform: every script is `.ps1`.

**Scale/Scope**: One owner; roughly 5–15 Medications; one email a day; about 365
`ppa_ReminderRun` rows a year. 1 new library module, 1 hook, 1 component, 1 table, 1 flow,
2 environment variables, 2 connection references, 6 scripts, 3 workflow edits.

**Unknowns**: None block planning. The owner settled the three open choices on
2026-10-05: try the time-zone environment variable in the trigger condition (research R5),
use the Mail connector (R7), and keep the deployment service principal as the flow owner
(R10). Two points still need a check in dev, each with a stated fallback: whether the
trigger condition can read the environment variable, and whether the
service-principal-owned flow is reported as unlicensed because it uses the premium
Dataverse connector.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Applicability & Compliance |
|---|---|
| **I. Code Quality & Type Safety** | New code is strict TypeScript with no `any`. `ScheduleDetails` extends the generated `Ppa_medications` / `Ppa_intakelogs` types rather than copying them. Shared logic lives in `src/lib/schedule.ts` and `src/hooks/use-medication-schedule.ts`; `scheduledDosesOnDay` is changed to call the new `isScheduledOn` so the fixed schedule has one definition. Remote state goes through TanStack Query only. **One deviation**: the schedule rule exists twice, in TypeScript and in the cloud flow. Recorded in Complexity Tracking. **PASS with justified deviation** |
| **II. Testing Standards** | Each user story has an independently runnable acceptance test: US1 by Vitest page and component tests; US2 and US3 by the seeded decision table plus `assert-reminder-run.ps1`. The two new Dataverse queries are tested through the generated service functions with the existing `vi.mock` stub pattern. Tests are written first and seen to fail (fixtures before `schedule.ts`; component tests before the component). Test files mirror `src/`. **PASS** |
| **III. User Experience Consistency** | The schedule section uses `Badge`, `Skeleton`, `Separator`, `Button` and Lucide icons only, with existing design tokens. Verified at 375 px and 768 px. State is conveyed by icon and text as well as colour; Retry meets the 44 px target. No destructive actions are added. Loading and error are shown in place on each card rather than as a toast: a toast per card would stack N messages for one outage and would not say which card failed. The constitution's toast rule is read as covering feedback for user-initiated operations, which this section does not have. **PASS** |
| **IV. Performance Requirements** | Both new queries specify `select` (five columns), a filter and `top: 1`. `staleTime` is 30 s. Cards render before intake history arrives. No new route, no chart, no new dependency; bundle growth is a few KB. **PASS** |
| **Tech Stack Standards** | No new app-layer technology. Dates use date-fns and the existing `Intl` helpers. The cloud flow, table, environment variables and connection references are Dataverse solution components deployed by the existing `pac`-based pipeline. **PASS** |
| **Workflow & Quality Gates** | Follows specify → plan → tasks → implement. Delivery is by story: US1 is a working increment with no flow; US2 adds the flow; US3 adds follow-ups. Lint, build and tests gate every pull request, with two added checks for the reminder address. **PASS** |

**Initial gate**: PASS, one justified deviation.

**Post-design re-check**: PASS. Phase 1 added no new deviation. Two design choices tighten
compliance: the decision table gives both implementations a single test oracle
(Principle II), and `today` is injected into `computeSchedule` rather than read from the
clock (Principle I, predictability).

### Project rules from CLAUDE.md

| Rule | How this plan meets it |
|---|---|
| Environment variables for configuration | Address and time zone are environment variables; connection ids are GitHub Environment variables |
| `MSCRM.SolutionUniqueName` on created components | Used for the table, the definitions, the connection references and the flow. **Deliberate exception**: the reminder address *value* is created without it so it cannot be exported (research R8) |
| Consult design rules before designing tables | Done; permanent choices are listed in data-model.md §2 |
| Define a security model | data-model.md §7 |
| No placeholder columns, no rollup fields | Every `ppa_ReminderRun` column is written by the flow; counts are computed in the flow |
| Never silently swallow errors | Card shows an error with Retry; flow records Failed and ends the run as Failed |
| PowerShell for Dataverse API calls | All six scripts are `.ps1` |
| No parallel table creation | One table |
| Homepage strategy, forms, plug-ins, PCF | Not applicable — no model-driven app, form, plug-in or control is added |

## Project Structure

### Documentation (this feature)

```text
specs/004-schedule-page-reminders/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── schedule-rules.contract.md           # The rule and its decision table (S01–S33)
│   ├── ui-medication-schedule.contract.md   # What the card shows, in every state
│   ├── reminder-flow.contract.md            # Trigger, steps, email, failure handling
│   └── privacy-and-deployment.contract.md   # Where the address lives; pipeline changes
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
src/
├── lib/
│   ├── schedule.ts                    # NEW  isScheduledOn, computeSchedule, ScheduleDetails
│   └── adherence.ts                   # EDIT scheduledDosesOnDay delegates to isScheduledOn
├── hooks/
│   └── use-medication-schedule.ts     # NEW  two top-1 queries per Medication → ScheduleDetails
├── components/medications/
│   ├── medication-schedule.tsx        # NEW  the schedule section
│   └── medication-card.tsx            # EDIT renders MedicationSchedule as its last block
└── mocks/
    ├── mock-intakelogs-service.ts     # EDIT honour status filter, orderBy and top (dev:mock)
    └── mock-data.ts                   # EDIT cases for each schedule kind

tests/
├── fixtures/
│   └── schedule-cases.ts              # NEW  one case per decision-table row
├── lib/
│   ├── schedule.test.ts               # NEW
│   └── adherence.test.ts              # EDIT Biweekly: one day per fortnight
├── hooks/
│   └── use-medication-schedule.test.tsx   # NEW  query shape, invalidation, error
├── components/
│   └── medication-schedule.test.tsx   # NEW  every state in the UI contract
└── pages/
    └── medications.test.tsx           # EDIT US1 acceptance; Active switch

solution/
├── src/
│   ├── Entities/ppa_ReminderRun/      # NEW  table (unpacked from dev)
│   ├── Workflows/                     # NEW  MedTrack – Daily Reminder
│   ├── environmentvariabledefinitions/    # NEW  two definitions, no value files
│   └── Other/Customizations.xml       # EDIT connection references; Solution.xml root components
└── deployment-settings.template.json  # NEW  placeholders for connection ids and time zone

scripts/
├── ci/
│   ├── render-deployment-settings.ps1 # NEW
│   └── assert-no-envvar-values.ps1    # NEW
├── deploy/
│   └── configure-reminder-flow.ps1    # NEW  confirm service-principal owner, turn on
└── reminder/
    ├── set-reminder-recipient.ps1     # NEW  local only; prompts for the address
    ├── seed-reminder-scenarios.ps1    # NEW  decision table → dev, dates relative to today
    └── assert-reminder-run.ps1        # NEW  checks today's ppa_ReminderRun

.github/workflows/
├── ci.yml                 # EDIT add the solution content check
├── deploy.reusable.yml    # EDIT render settings, pass to import, configure flow
└── promote-prod.yml       # EDIT same, plus the zip check before the artifact upload

.gitleaks.toml             # EDIT email-address rule and allowlist
.gitignore                 # EDIT solution/deployment-settings.json
README.md                  # EDIT reminder setup, naming the variable but not its value
CONTEXT.md                 # EDIT new terms: Next Intake, Missed Intake, Follow-up, Reminder Run
```

**Structure Decision**: The existing single-project layout is kept. App code follows the
established `lib` → `hooks` → `components` layering, with tests mirroring it. Dataverse
components are authored in dev inside `MedTrackSolution` and unpacked into `solution/src`,
which the pipeline already packs and imports. Pipeline scripts extend `scripts/ci` and
`scripts/deploy`; scripts the owner runs by hand go in a new `scripts/reminder` folder so
they are not mistaken for CI steps.

## Delivery order

Each story is a demonstrable increment (constitution: incremental delivery).

| Order | Increment | Contains | Demonstrable result |
|---|---|---|---|
| 0 | Foundations | Biweekly fix in `isScheduledOn` (research R2) — **done 2026-10-05**; email-address gitleaks rule and allowlist; baseline scan of the existing repository | Existing tests pass; CI rejects a planted address |
| 1 | **US1 (P1)** | `schedule.ts`, fixtures, hook, component, card edit, mock data | Schedule section on every card; no cloud components yet |
| 2 | Platform spikes | Verify research R5 (time zone in the trigger condition) and R10 (licence state of the service-principal-owned flow) in dev before building on them | Two yes/no answers; fallbacks chosen if needed |
| 3 | **US2 (P2)** | Table, environment variables, connection references, flow (due-today only), privacy scripts, pipeline edits | One email on a due day; nothing on a quiet day; address nowhere in the repo |
| 4 | **US3 (P3)** | Follow-up branch in the flow; seeded day-1/3/5/7 rows | Follow-ups on the right days; stop after a week |
| 5 | Production | One-time setup in production; promote; overnight check | quickstart.md section I passes in production |

Increment 0 changes existing behaviour for Biweekly Medications on Home and in Adherence.
The owner confirmed the fix and it is already implemented on this branch.

## Risks

| Risk | Likelihood | Effect | Mitigation |
|---|---|---|---|
| Reminder address leaks through the exported solution artifact | Low once set by script | Permanent exposure in a public repo | Value kept outside the solution; zip check before upload; gitleaks rule |
| The two implementations of the rule drift apart | Medium over time | Card and email disagree | One decision table; fixtures and seed script both generated from its rows |
| Service-principal-owned flow is flagged as unlicensed (premium Dataverse connector) | Medium | Flow suspended; no emails | Check the flow's Details page in increment 2; designate the owner as licensed user, or assign a Process licence (research R10) |
| Flow is left turned off after import | Low | No emails | `configure-reminder-flow.ps1` fails the deploy if the flow is not on |
| Nobody receives Power Automate's failure emails (owner is a service principal) | Certain | A failed check is noticed only if the owner looks | `ppa_ReminderRun` records every outcome; a missing row for a day is itself the signal; noted in README |
| Email lands in junk at the recipient (sent from a Microsoft service address) | Medium | Reminder not seen | Check on first run; owner marks sender as safe; noted in README |
| Changed address takes up to an hour to apply | Certain | Next run may use the old address | Documented in quickstart.md and README |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Schedule rule implemented twice — TypeScript (`src/lib/schedule.ts`) and cloud-flow expressions (Principle I: duplication disallowed) | The card runs in the browser; the reminder must run at midnight with no browser open. No single runtime serves both. | A C# plug-in as the only implementation needs a .NET build and registration the pipeline does not have, and the Code App cannot call it through generated services. Storing the next intake date on the row goes stale as days pass. A GitHub Actions cron reusing the TypeScript was ruled out by the request for a cloud flow and by public workflow logs. The duplication is contained by one decision table that both implementations are tested against. |
