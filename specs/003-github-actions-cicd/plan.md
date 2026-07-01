# Implementation Plan: GitHub Actions CI/CD Migration

**Branch**: `003-github-actions-cicd` | **Date**: 2026-07-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-github-actions-cicd/spec.md`

## Summary

Replace the current manual / Azure DevOps release path for the MedTrack Power Apps Code App with GitHub-native CI/CD. GitHub Actions will, on every pull request, install dependencies and run lint → type-check → build → tests → secret scan as a single required gate. On merge to `main` it will package the Code App and deploy it, along with the Dataverse schema (as a solution) and — only on explicit opt-in — operational data, to a **dev** environment automatically and to **production** behind a manual approval gate. In parallel the repository is hardened for public release: sensitive material (a committed `localhost` private key and real environment/app identifiers) is purged from history and rotated, environment identifiers are externalized to per-environment GitHub secrets/variables, and a secret-scanning gate blocks any future leaks.

Technical approach: GitHub Actions workflows using the official Power Platform Actions + `pac` CLI authenticated with a service principal; Dataverse schema managed as an unpacked solution under source control (pack + import); opt-in data migration via a Web API upsert script keyed by stable alternate key (`scripts/deploy/migrate-data.ps1` — `pac data import` was assumed available but does not exist in the PAC CLI, found live 2026-07-01 during T039); GitHub Environments (`dev`, `production`) providing per-stage secrets, required-reviewer approval, and concurrency-based serialization; `gitleaks` as the PR secret-scanning gate; `git filter-repo` for the one-time history purge.

## Technical Context

**Language/Version**: Workflow/automation layer — GitHub Actions YAML, Bash, and PowerShell (`.ps1`, per project convention). Application under test — TypeScript 5 / React 19 / Vite 7 (unchanged by this feature).

**Primary Dependencies**: GitHub Actions; Power Platform CLI (`pac`) via `microsoft/powerplatform-actions`; Power Platform / Dataverse Web API; `actions/setup-node`; `gitleaks` (secret scanning); `rhysd/actionlint` (workflow linting); `git filter-repo` (one-time history rewrite). App build deps unchanged (`@microsoft/power-apps-vite`, vitest, eslint).

**Storage**: Dataverse (tables `ppa_medication`, `ppa_intakelog`) in two Power Platform environments (dev, production); GitHub Actions artifacts (build output); GitHub Environments (secrets/variables).

**Testing**: Existing `vitest run` suite (unchanged) executed in CI; `actionlint` for workflow validation; direct `pac solution import` against dev as integration verification (no separate dry-run/staged-import step); secret-scan self-test with a planted fake secret.

**Target Platform**: `ubuntu-latest` GitHub-hosted runners; Power Platform prod region environments.

**Project Type**: CI/CD automation added to an existing single-project web app (Power Apps Code App).

**Performance Goals**: Full PR validation (install → lint → type-check → build → test → secret scan) completes in **< 10 minutes** for a typical change (SC-002); npm dependency caching enabled.

**Constraints**: No credentials, keys, or environment/app/tenant identifiers in the repo or its history (FR-018–FR-020); non-interactive service-principal auth only (FR-006); deploys to a given environment serialized (FR-011); production deploys and destructive schema/data ops behind manual approval (FR-014); operational data migration OFF by default, per-run opt-in only (FR-016); no partial-release left live on failure (FR-010).

**Scale/Scope**: 1 Code App, 2 Dataverse tables, 2 environments, 4 workflows (CI, deploy-dev, promote-prod, and a reusable deploy job), ~1 one-time history-purge runbook.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

This feature adds CI/CD automation and repo hardening; it introduces no application runtime code. The constitution's app-facing principles are satisfied because the pipeline **enforces** them rather than altering them.

| Principle | Applicability & Compliance |
|---|---|
| **I. Code Quality & Type Safety** | The CI gate runs `npm run lint` and a new `build:ci` script (`tsc -b && vite build` — the same build the constitution's `npm run build` performs, minus that script's `pac code push` deploy side-effect, which does not belong in a PR gate) on every PR, blocking merge on any error. Automation code (YAML/scripts) is kept small, single-purpose, and free of secrets; workflow logic is validated by `actionlint`. No `any`/type changes introduced. **PASS** |
| **II. Testing Standards** | The pipeline runs the full `vitest` suite on every PR and blocks merge on failure; deployment stages are validated by staged solution import against dev before production. No trivial tests added. The migration preserves and gates the existing red-green workflow. **PASS** |
| **III. User Experience Consistency** | No UI changes. N/A — no screens, components, or tokens touched. **PASS (N/A)** |
| **IV. Performance Requirements** | CI budget of < 10 min (SC-002) with npm caching honors the spirit of the performance principle. No change to app bundle, queries, or `staleTime`. **PASS** |
| **Tech Stack Standards** | Deployment tooling (`pac code`, Power Apps Vite plugin) is exactly the stack the constitution already fixes for deployment. No new app dependencies. **PASS** |
| **Workflow & Quality Gates** | Directly strengthens the constitution's Definition of Done by automating lint/build/test gating and adding branch protection. **PASS** |

**Result**: No violations. Complexity Tracking not required.

## Project Structure

### Documentation (this feature)

```text
specs/003-github-actions-cicd/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (workflow + secrets/env contracts)
│   ├── ci.contract.md
│   ├── deploy.contract.md
│   └── secrets-and-environments.contract.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
.github/
└── workflows/
    ├── ci.yml                 # PR gate: install, lint, type-check, build, test, secret-scan, actionlint
    ├── deploy-dev.yml         # On push to main: build → package → deploy app + schema (+opt-in data) to dev
    ├── promote-prod.yml       # Manual/approved: deploy the dev-validated release to production
    └── deploy.reusable.yml    # Reusable workflow: shared auth + app/schema/data deploy job

solution/                      # Dataverse schema as an unpacked (source-controlled) solution
├── src/                       # Unpacked solution components (tables ppa_medication, ppa_intakelog)
└── solution-metadata files    # solution.xml, customizations.xml, etc. (pac solution unpack output)

data/                          # Opt-in operational data migration assets
├── ppa_medication.json         # Sample medication records, keyed by ppa_name alternate key
├── ppa_intakelog.json          # Sample intake log records, keyed by medicationName + ppa_scheduledfor
└── README.md                  # How opt-in migration is triggered and scoped

scripts/
├── ci/
│   └── render-power-config.(ps1|sh)   # Build power.config.json from template + env secrets/vars
├── deploy/
│   ├── auth.(ps1|sh)                  # Non-interactive pac auth via service principal
│   ├── deploy-app.(ps1|sh)            # pac code push wrapper (reads rendered config)
│   └── migrate-data.ps1               # Web API upsert of data/*.json (pac data import doesn't exist)
└── security/
    └── history-purge-runbook.md       # One-time git filter-repo + rotation procedure

power.config.template.json     # Committed template; real environmentId/appId injected at deploy time
.gitleaks.toml                 # Secret-scanning ruleset (allowlist for known non-secrets)
.gitignore                     # Updated: ignore power.config.json, localhost*.pem, *.pfx, *.key
```

Existing app source under `src/`, `tests/`, and config files remain unchanged **except**:
- `vite.config.ts` — make the dev-server HTTPS block conditional so the app runs after `localhost*.pem` are removed (generate/enable certs only when present locally).
- `power.config.json` — removed from tracking; replaced by `power.config.template.json` + render step.

**Structure Decision**: Single-project web app with an added automation layer. All CI/CD lives under `.github/workflows/` and `scripts/`; Dataverse ALM assets live under `solution/` and `data/`. No app architectural change; the app’s `src/`/`tests/` layout is untouched.

## Complexity Tracking

No constitution violations — section intentionally empty.
