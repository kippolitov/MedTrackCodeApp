# Phase 0 Research: GitHub Actions CI/CD Migration

All Technical Context unknowns are resolved below. Each item follows Decision / Rationale / Alternatives.

## R1. CI validation gate (build/test/lint) on GitHub

**Decision**: A single `ci.yml` workflow triggered on `pull_request` → `main` and `push` → `main`. Steps: `actions/checkout`, `actions/setup-node` (Node 20, npm cache), `npm ci`, `npm run lint`, `npx tsc -b`, `npm run build:ci`, `npm run test`, secret scan, and `actionlint`. A single required status check (a `ci` job) aggregates results so branch protection has one gate.

**Rationale**: Mirrors the constitution's Definition of Done (lint + build + tests) and SC-001/SC-002. npm caching keeps the run under the 10-minute budget. One aggregating job keeps branch-protection config simple.

**Key detail**: The current `build` script is `tsc -b && vite build && pac code push` — it deploys as a side effect, which is wrong for a PR gate. Add a **`build:ci`** script (`tsc -b && vite build`, no `pac code push`) and use it in CI. Deployment is a separate workflow. This also decouples build from auth.

**Alternatives**: Separate workflows per check (rejected — more branch-protection wiring, slower feedback); reuse the existing `build` script (rejected — pushes to Power Platform on every PR).

## R2. Power Platform authentication in CI

**Decision**: Non-interactive **service principal** (Microsoft Entra app registration) auth. Secrets `PP_CLIENT_ID`, `PP_CLIENT_SECRET`, `PP_TENANT_ID`, plus per-environment `PP_ENVIRONMENT_URL`, stored in GitHub **Environments** (`dev`, `production`). `pac auth create --applicationId $PP_CLIENT_ID --clientSecret $PP_CLIENT_SECRET --tenant $PP_TENANT_ID --environment $PP_ENVIRONMENT_URL`.

**Rationale**: Microsoft's documented CI pattern for Power Platform GitHub Actions uses SP auth (`app-id` / `client-secret` / `tenant-id`); supports MFA-protected tenants; satisfies FR-006 (no interactive login, no committed creds). The SP must be registered as an application user in each environment with rights to import solutions and push the code app.

**Alternatives**: Username/password service connection (rejected — no MFA, weaker, discouraged by Microsoft); OIDC/workload-identity federation (deferred — attractive later as it removes the stored client secret, but `pac` SP-secret auth is the currently documented, lowest-friction path; noted as a future hardening in quickstart).

## R3. Deploying the Code App

**Decision**: Install `pac` CLI in the runner (via `microsoft/powerplatform-actions/actions/install` or `dotnet tool install --global Microsoft.PowerApps.CLI.Tool`), authenticate (R2), render `power.config.json` from a committed template + environment secrets (R6), run `pac code push`. Wrap in `scripts/deploy/deploy-app.*` with `pac --log-to-console` for inline diagnostics.

**Rationale**: Code Apps have **no dedicated Power Platform GitHub Action** (the official actions cover solutions, not `pac code`). The supported path is the `pac` CLI, which is exactly today's manual step (`npm run build` → `pac code push`) lifted into CI. `--log-to-console` is Microsoft's recommendation for ephemeral runners.

**Alternatives**: `deploy-solution` action only (rejected — deploys Dataverse components but not the Code App bundle); package the app inside a solution (rejected — Code Apps deploy via `pac code push`, not solution import; over-complex).

## R4. Dataverse schema deployment

**Decision**: Manage schema as a **source-controlled unpacked solution** under `solution/`. In the deploy workflow: `pac solution pack` → `import-solution` (official action) with `--async` and publish. Schema import runs **before** the app push (FR-007). Use a **managed** solution import to production and **unmanaged** to dev (standard ALM), or unmanaged-both for simplicity in a single-maker setup — decided at task time based on whether prod is locked.

**Rationale**: Solution ALM is the first-party mechanism for moving Dataverse table/column metadata between environments; the official `import-solution`/`pack-solution`/`publish-solution` actions support SP auth. Source-controlling the unpacked solution gives reviewable schema diffs. The existing `.power/schemas/*.Schema.json` files are client SDK typings, not a deployable solution, so a real solution export is required as a setup task.

**Alternatives**: Web API metadata calls per column (rejected — brittle, non-transactional, reinvents solution import); Power Platform Pipelines (rejected — this feature's goal is GitHub-native CI/CD, not the in-platform pipeline tool).

## R5. Opt-in operational data migration

**Decision**: OFF by default. A **`workflow_dispatch`** boolean input `migrate_data` (default `false`) on the deploy/promote workflows. When true, run `scripts/deploy/migrate-data.ps1`, a Web API upsert against `data/ppa_medication.json`/`data/ppa_intakelog.json`, addressing each record by its **alternate key** so records upsert by a stable key rather than duplicate (FR-016, FR-008). Data step gated behind the production approval and skipped entirely on normal `push`-triggered runs.

**Rationale**: Idempotent-by-alternate-key upsert via the Dataverse Web API (`PATCH .../entityset(altkey='value')`) is a first-party, well-documented capability; `workflow_dispatch` inputs are the native GitHub mechanism for per-run opt-in. Default-false guarantees routine merges never touch existing records (SC-011, edge case "Accidental data migration").

**Prerequisite/risk**: Idempotent upsert requires an **alternate key** on each table (e.g., a natural key on medication name + owner). If none exists, a setup task must add one; otherwise migration falls back to create-only and cannot be safely re-run. Flagged in data-model.md. Migrating real user health data also carries privacy weight — migration is manual, approval-gated, and must not log record contents.

**Correction (found live 2026-07-01 during T039)**: This research originally planned `pac data import`/`export` (Configuration Migration) as the mechanism. That command **does not exist** in the PAC CLI (verified against v2.7.4 — `pac help`, `pac package --help`, `pac solution --help` show no `data` noun). The only related tool, `pac tool CMT`, is a separate Windows GUI executable (`DataMigrationUtility.exe`) with no documented headless/silent mode, so it cannot run on a GitHub-hosted `ubuntu-latest` runner. Replaced with a custom Web API upsert script — validated live: `PATCH .../ppa_medications(ppa_name='...')` upserts by the single-attribute alternate key; composite alternate keys involving a lookup attribute (`ppa_intakelog`'s medication+scheduledfor key) must be addressed using the lookup's `_<attribute>_value` EDM property name (e.g. `_ppa_medication_value=<guid>`), not the plain attribute name — this isn't obvious from the entity key metadata and returns a `0x80060888` "key ... not valid" error otherwise.

**Alternatives**: `windows-latest` runner + CMT (rejected — CMT has no documented non-interactive/silent mode, high risk of not working headlessly at all); always-on data sync (rejected — violates FR-016 and risks overwriting prod data).

## R6. Externalizing environment/app identifiers

**Decision**: Remove `power.config.json` from tracking; commit `power.config.template.json` with placeholders (`__ENVIRONMENT_ID__`, `__APP_ID__`). A `scripts/ci/render-power-config.*` step substitutes per-environment values from GitHub Environment **variables** (non-secret IDs like `PP_ENVIRONMENT_ID`, `PP_APP_ID`) at deploy time. `.gitignore` ignores `power.config.json`.

**Rationale**: Satisfies FR-020 — the same committed config works for dev and prod, with real IDs supplied per environment. Environment/app IDs are treated as non-secret **variables** (not secrets) since they identify but don't authenticate; credentials remain secrets. Supports the two-stage promotion (different app/env IDs per stage if they differ).

**Open item resolved**: Whether dev and prod use the same `appId` — the render step supports either (same value in both environments' variables, or different). No code change needed to switch.

**Alternatives**: Keep IDs committed (rejected — FR-020, ties repo to one environment); store IDs as secrets (rejected — unnecessary; they're identifiers, and keeping them as variables keeps logs/readability sane).

## R7. Git history purge + credential rotation (one-time)

**Decision**: Before making the repo public, run a one-time `git filter-repo` to remove `localhost-key.pem`, `localhost.pem`, and prior `power.config.json` values from **all** history, force-push the rewritten history (coordinated with the team), then **rotate** the Power Platform app-registration client secret (and regenerate localhost dev certs locally). Documented as `scripts/security/history-purge-runbook.md`. Also make `vite.config.ts` HTTPS block conditional so the app runs without the committed `.pem` files.

**Rationale**: FR-018/FR-019 — a public repo must have zero secrets in working tree *and* history; rotation invalidates anything previously exposed. `git filter-repo` is the maintained, Microsoft/GitHub-recommended tool (BFG is the alternative). The vite dev-server cert paths (`vite.config.ts` lines ~37–40) currently hard-require the `.pem` files, so removing them breaks `npm run dev` unless made conditional.

**Alternatives**: BFG Repo-Cleaner (viable alternative, noted); leave history and just delete files (rejected — FR-019, values stay retrievable); rewrite without rotation (rejected — exposed secret remains valid).

## R8. Secret-scanning gate

**Decision**: Add **`gitleaks`** as a required step in `ci.yml` (scans the PR diff/commits, fails on detection) with a `.gitleaks.toml` allowlist for known non-secrets. Recommend enabling GitHub-native **secret scanning + push protection** on the repo as defense-in-depth (free for public repos).

**Rationale**: FR-021, SC-010 — automated, merge-blocking detection. `gitleaks` is provider-agnostic, runs on any runner, and doesn't depend on GitHub Advanced Security, so it works immediately; native push protection adds pre-push coverage once the repo is public.

**Alternatives**: Native secret scanning only (rejected as the *gate* — it's alerting/push-protection, not a required CI status check on the diff); TruffleHog (viable alternative, noted).

## R9. Environment protection, serialization, and rollback

**Decision**:
- **GitHub Environments**: `dev` (no reviewers, auto-deploy on push to main) and `production` (required reviewers = the approval gate, FR-014). Env-scoped secrets/variables give per-stage config.
- **Serialization** (FR-011): `concurrency: { group: deploy-${{ environment }}, cancel-in-progress: false }` so deploys to one environment queue rather than overlap.
- **Fork safety** (FR-012): deploy jobs run only on `push`/`workflow_dispatch` (never on `pull_request` from forks); PR runs execute build/test/scan without environment secrets.
- **Rollback** (FR-015): re-run the deploy workflow pinned to the last-known-good commit/tag (redeploys that build artifact + the prior solution version). Documented in quickstart.

**Rationale**: All are native GitHub features that directly satisfy the corresponding FRs without custom infrastructure.

**Alternatives**: Self-managed locks/mutex (rejected — `concurrency` is built in); blue/green app slots (rejected — not supported for Code Apps; redeploy-previous is the pragmatic rollback).

## R10. Azure DevOps decommission

**Decision**: Out of scope to script. Once GitHub CI/CD is green and has deployed to both environments successfully, disable/delete the Azure DevOps pipeline(s) manually and remove any ADO-specific files if present (none are committed here). Captured as a final checklist item, not an automated task.

**Rationale**: SC-008 is about capability parity, not tooling teardown automation. No ADO pipeline definition exists in this repo, so migration is additive on the GitHub side.
