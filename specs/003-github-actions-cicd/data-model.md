# Phase 1 Data Model: GitHub Actions CI/CD Migration

This feature is CI/CD automation, so the "data model" is the set of configuration and process
entities the pipeline operates on, plus the Dataverse tables the schema/data steps touch. There is
no new application data model.

## Configuration & Process Entities

### Pipeline Run
A single execution of a workflow.
- **Fields**: workflow (ci | deploy-dev | promote-prod), trigger (pull_request | push | workflow_dispatch), commit SHA, actor, status per stage, overall outcome, started/finished timestamps, artifact reference.
- **Source of truth**: GitHub Actions run metadata (not stored in the repo).
- **Rules**: PR-triggered runs MUST NOT access environment secrets (FR-012). Every deploy run MUST be traceable to commit + environment + actor + outcome (FR-009).

### Application Artifact
The packaged build output of a successful `build:ci`.
- **Fields**: name, commit SHA, contents (`dist/` bundle), retention.
- **Rules**: Produced once per successful build; consumed by deploy jobs; retained for rollback reference (FR-004, FR-015).

### Target Environment
A Power Platform environment the pipeline deploys to, modeled as a **GitHub Environment**.
- **Instances**: `dev`, `production`.
- **Fields**: name, protection level (dev = none, production = required reviewers), env-scoped secrets/variables, promotion order (dev → production).
- **Rules**: production is protected — deploys require manual approval (FR-014); deploys to one environment are serialized via `concurrency` (FR-011).

### Deployment Record
A traceable record of one deployment.
- **Fields**: deployed version/commit, environment, actor, timestamp, outcome, data-migration flag (on/off for that run).
- **Source of truth**: GitHub Actions run history + optional release tag.
- **Rules**: On any deploy-step failure, the environment retains its previous working version and data (FR-010).

### Schema Change Set (source-controlled solution)
- **Location**: `solution/src/` (unpacked), packed to `solution.zip` at deploy time.
- **Contents**: Dataverse tables `ppa_medication`, `ppa_intakelog` and their columns/relationships.
- **Rules**: Imported and published **before** the app push (FR-007); destructive changes to production require approval (FR-014).

### Data Change Set (opt-in)
- **Location**: `data/ppa_medication.json`, `data/ppa_intakelog.json` (plain records), upserted by `scripts/deploy/migrate-data.ps1` via the Dataverse Web API.
- **Fields**: enabled flag (`migrate_data`, default false), tables in scope, alternate-key mapping for upsert.
- **Rules**: OFF by default; runs only on explicit `workflow_dispatch` opt-in; idempotent upsert by alternate key; approval-gated for production; never logs record contents (FR-016, FR-008).
- **Note**: originally planned as a Configuration Migration schema driven by `pac data import` — that command does not exist in the PAC CLI (the only related tool, `pac tool CMT`, is a Windows GUI executable, not scriptable on a Linux runner). Found live 2026-07-01 during T039; replaced with the Web API upsert script above.

### Sensitive Material (governed, must be absent)
- **Instances**: `localhost-key.pem`, `localhost.pem` (private key/cert); prior committed `environmentId`/`appId`; any credential/token.
- **Rules**: Absent from working tree (FR-018) and history (FR-019); identifiers externalized to secrets/variables (FR-020); reintroduction blocked by the secret-scanning gate (FR-021).

## Secrets & Variables (per GitHub Environment)

| Name | Type | Scope | Purpose |
|---|---|---|---|
| `PP_CLIENT_ID` | secret | dev, production | Service-principal app (client) ID for `pac auth` |
| `PP_CLIENT_SECRET` | secret | dev, production | Service-principal client secret (rotated per R7) |
| `PP_TENANT_ID` | secret | dev, production | Entra tenant ID |
| `PP_ENVIRONMENT_URL` | variable | dev, production | Target environment URL for `pac auth`/solution import |
| `PP_ENVIRONMENT_ID` | variable | dev, production | Injected into `power.config.json` at deploy time |
| `PP_APP_ID` | variable | dev, production | Code App ID injected into `power.config.json` |

Notes: identifiers are **variables** (not authenticating), credentials are **secrets**. `dev` and `production`
may hold identical or different values per column without any code change (R6).

## Dataverse Tables Referenced (existing — not created by this feature)

### ppa_medication (`ppa_medications`)
- Primary id: `ppa_medicationid`; primary name: `ppa_name`.
- **Alternate key needed for data migration** (R5): a natural key enabling idempotent upsert (e.g., `ppa_name` + owner). If absent, add as a setup task before enabling `migrate_data`.

### ppa_intakelog (`ppa_intakelogs`)
- Related to `ppa_medication` (intake events).
- **Alternate key needed for data migration**: a stable natural key (e.g., medication reference + scheduled timestamp) so re-runs upsert rather than duplicate.

## State Transitions

**Release lifecycle**: `PR opened` → CI gate (build/test/lint/secret-scan) → `merged to main` → auto-deploy to **dev** (schema → app; data only if opted in) → validation on dev → **manual approval** → deploy to **production** (schema → app; data only if opted in + approved) → deployment record/tag. Any failed step halts the transition and preserves the prior live version (FR-010).
