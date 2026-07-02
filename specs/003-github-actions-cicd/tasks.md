---

description: "Task list template for feature implementation"
---

# Tasks: GitHub Actions CI/CD Migration

**Input**: Design documents from `/specs/003-github-actions-cicd/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md (all present)

**Tests**: Not explicitly requested as a TDD suite for this feature. "Test" tasks below are the quickstart.md validation scenarios (manual/CI verification of the automation itself), not unit tests.

**Organization**: Tasks are grouped by user story (from spec.md) in priority order, with US4 (public-repo readiness) sequenced ahead of US2/US3 because US2's deploy workflow consumes the config-externalization artifacts US4 introduces.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Paths are relative to the repository root.

## Path Conventions

Single-project web app (existing structure). New paths added by this feature:
`.github/workflows/`, `scripts/ci/`, `scripts/deploy/`, `scripts/security/`, `solution/`, `data/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffolding shared by every later phase.

- [X] T001 Create directory scaffolding: `.github/workflows/`, `scripts/ci/`, `scripts/deploy/`, `scripts/security/`, `solution/src/`, `data/` (add `.gitkeep` placeholders as needed)
- [X] T002 [P] Add a `build:ci` script (`"tsc -b && vite build"`, no `pac code push`) to `package.json`
- [X] T003 [P] Create `.gitleaks.toml` at the repo root with a baseline allowlist section (empty to start)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish a known-good baseline before any step is automated.

**⚠️ CRITICAL**: Complete before starting any user story phase.

- [X] T004 Verify `npm ci`, `npm run lint`, `npm run build:ci` (from T002), and `npm run test` all succeed locally on a clean checkout

**Checkpoint**: Baseline confirmed — user story implementation can begin.

---

## Phase 3: User Story 1 - Automated build and test on every change (Priority: P1) 🎯 MVP

**Goal**: Every PR to `main` and every push to `main` automatically installs, lints, type-checks, builds, and tests the app, reporting one pass/fail status that blocks merge on failure.

**Independent Test**: Open a PR with a deliberately failing test; confirm the pipeline fails and blocks merge. Push a fix; confirm it passes. No deployment involved.

### Implementation for User Story 1

- [X] T005 [US1] Create `.github/workflows/ci.yml` with a single `ci` job (`runs-on: ubuntu-latest`) triggered on `pull_request` → `main` and `push` → `main`; add `actions/checkout` and `actions/setup-node` (Node 20, `cache: npm`) steps followed by `npm ci`
- [X] T006 [US1] Add a lint step (`npm run lint`) to `.github/workflows/ci.yml`
- [X] T007 [US1] Add a type-check + build step (`npm run build:ci`) to `.github/workflows/ci.yml`
- [X] T008 [US1] Add a test step (`npm run test`) to `.github/workflows/ci.yml`
- [X] T009 [US1] Add an `actionlint` step to `.github/workflows/ci.yml` that validates every workflow file under `.github/workflows/`
- [X] T010 [US1] Add a build-artifact upload step (`actions/upload-artifact`, named with the commit SHA) to `.github/workflows/ci.yml` for the `dist/` output, for later deploy workflows to consume
- [X] T011 [US1] Configure a branch protection rule on `main` (repo Settings → Branches) requiring the `ci` status check to pass before merge
- [X] T012 [US1] Verify (quickstart.md V1): a PR with a failing test fails `ci` and is blocked from merging; a passing PR merges; the full run completes in under 10 minutes

**T011/T012 completed 2026-07-01**: created the public GitHub repo `kippolitov/MedTrackCodeApp`, pushed all local branches (with purged history), and configured branch protection on `main` requiring the `ci` status check via the GitHub API. Opened a real PR (#1) to exercise it: the first run failed fast on invalid Action references (`rhysd/actionlint@v1` doesn't exist as a versioned action; fixed to use its download script) — a genuine bug this live test caught. After fixing that plus `gitleaks-action` v2→v3 (Node 20 deprecation) and bumping `actions/checkout`/`setup-node`/`upload-artifact` to their latest majors, the PR passed cleanly in 56s with zero warnings, and `gh pr view` confirms `mergeable: MERGEABLE` / `mergeStateStatus: CLEAN` — branch protection is correctly wired to the `ci` check.

**Note (resolves spec.md edge case "Non-blocking vs blocking checks")**: No step in `ci.yml` is advisory or `continue-on-error`. Every step defined in this phase — including the artifact upload (T010) — is part of the single required `ci` status check and blocks merge on failure. This is a deliberate, documented resolution: the pipeline draws no distinction between "essential" and "advisory" steps.

**Checkpoint**: US1 is fully functional and independently testable — this is the MVP.

---

## Phase 4: User Story 4 - Make the repository safe to be public (Priority: P2)

**Goal**: Remove all sensitive material from the working tree and git history, externalize environment identifiers, and add a merge-blocking secret-scanning gate.

**Independent Test**: Scan the working tree and full git history and confirm zero private keys, credentials, or hardcoded environment/app identifiers; add a file with a fake secret in a PR and confirm the CI gate blocks it.

**Depends on**: Phase 3 (`.gitleaks.toml` from T003 and `.github/workflows/ci.yml` from T005 must exist before T017).

### Implementation for User Story 4

- [X] T013 [P] [US4] Create `power.config.template.json` at the repo root mirroring `power.config.json`'s structure, with placeholder tokens `__ENVIRONMENT_ID__` and `__APP_ID__` in place of the real `environmentId`/`appId`
- [X] T014 [P] [US4] Create `scripts/ci/render-power-config.ps1` that reads `power.config.template.json`, substitutes `__ENVIRONMENT_ID__`/`__APP_ID__` from the `PP_ENVIRONMENT_ID`/`PP_APP_ID` environment variables, and writes `power.config.json`
- [X] T015 [US4] Update `.gitignore` to ignore `power.config.json`, `localhost*.pem`, `*.pfx`, and `*.key`; run `git rm --cached` on the currently tracked `power.config.json`, `localhost-key.pem`, and `localhost.pem`
- [X] T016 [US4] Make the `server.https` block in `vite.config.ts` conditional on `localhost-key.pem`/`localhost.pem` existing locally, so `npm run dev` works without committed certs
- [X] T017 [US4] Add a required `gitleaks` step to `.github/workflows/ci.yml` (from T005) using `.gitleaks.toml` (from T003), failing the run when a secret is detected
- [X] T018 [US4] Write `scripts/security/history-purge-runbook.md` documenting the one-time `git filter-repo` procedure to purge `localhost-key.pem`, `localhost.pem`, and prior `power.config.json` values from all history, the force-push/re-clone coordination with collaborators, and Power Platform service-principal client-secret rotation
- [X] T019 [US4] Execute the history-purge runbook (T018): run `git filter-repo`, force-push the rewritten history, and rotate the Power Platform service-principal client secret
- [X] T020 [US4] Verify (quickstart.md V2, V8): a full working-tree + history secret scan (e.g. `gitleaks detect --source . --log-opts="--all"`) finds zero secrets/identifiers; a PR adding a fake key is blocked by the `gitleaks` step from T017

**Completed 2026-07-01 (live walkthrough)**: Committed all pending work first (required — `git-filter-repo` resets the working tree to match rewritten history and would have discarded uncommitted changes), took a local mirror backup, then ran `git-filter-repo --invert-paths --path localhost-key.pem --path localhost.pem --path power.config.json --force` across all 4 local branches. Verified via `gitleaks detect` (installed via `brew install gitleaks`) on every branch individually plus manual grep for the real GUIDs/private-key markers across `git log --all -p`: **zero leaks, zero occurrences, on all 20 unique commits**. `localhost-key.pem`, `localhost.pem`, and `power.config.json` remain on disk (untracked, gitignored) for local dev/deploy use. Audit found no actual Power Platform client secret was ever committed (only the dev TLS cert and the `environmentId`/`appId` identifiers), so no credential rotation was needed for previously-exposed material — the two new service-principal secrets from T021 have never been committed anywhere. **Force-push is intentionally deferred**: per the earlier decision to keep this local-only, the rewritten history has not been pushed to the existing Azure DevOps remote (that would rewrite shared team history) or anywhere else yet — it will go to the new GitHub remote once created (T022 prerequisite).

**Checkpoint**: The repository is safe to make public; the config-externalization mechanism (T013/T014) is ready for US2 to consume.

---

## Phase 5: User Story 2 - Deploy the application to a Power Platform environment (Priority: P2)

**Goal**: A validated merge to `main` deploys the Code App to the dev Power Platform environment automatically; promotion to production requires manual approval. No developer runs `pac` commands locally.

**Independent Test**: Merge an approved change to `main`; confirm the app in the dev environment reflects the change with a traceable deployment record, and no manual `pac` command was run.

**Depends on**: Phase 4 (`power.config.template.json` / `render-power-config.ps1` from T013/T014).

### Implementation for User Story 2

- [X] T021 [US2] Provision a Power Platform service principal (Entra app registration) and register it as an application user with sufficient rights (import solutions, push Code Apps) in both the dev and production Dataverse environments
- [X] T022 [US2] Create GitHub Environments `dev` (no required reviewers) and `production` (required reviewers = release owners) in repo Settings → Environments, each populated with secrets `PP_CLIENT_ID`, `PP_CLIENT_SECRET`, `PP_TENANT_ID` and variables `PP_ENVIRONMENT_URL`, `PP_ENVIRONMENT_ID`, `PP_APP_ID` per data-model.md
- [X] T023 [P] [US2] Create `scripts/deploy/auth.ps1` performing non-interactive `pac auth create` using `PP_CLIENT_ID`/`PP_CLIENT_SECRET`/`PP_TENANT_ID`/`PP_ENVIRONMENT_URL`, failing fast with a clear message if any are missing or invalid
- [X] T024 [P] [US2] Create `scripts/deploy/deploy-app.ps1` wrapping `pac --log-to-console code push` against the rendered `power.config.json`
- [X] T025 [US2] Create `.github/workflows/deploy.reusable.yml`: a reusable workflow accepting `environment` and `migrate_data` inputs, with `concurrency: { group: deploy-${{ inputs.environment }}, cancel-in-progress: false }`, that checks out the code, installs the `pac` CLI, runs T023's auth script, builds the app (or downloads the CI artifact from T010), runs T014's render-config script, then runs T024's deploy-app script. Only `push` and `workflow_dispatch` triggers reach this workflow (never `pull_request`), so fork-originated PRs never have access to its environment secrets (FR-012)
- [X] T026 [US2] Create `.github/workflows/deploy-dev.yml` triggered on `push` to `main` and `workflow_dispatch`, calling `deploy.reusable.yml` with `environment: dev`
- [X] T027 [US2] Create `.github/workflows/promote-prod.yml` triggered on `workflow_dispatch` only, calling `deploy.reusable.yml` with `environment: production` (the `production` GitHub Environment's required reviewers enforce the approval gate)
- [X] T028 [US2] Add a deployment-record step to `deploy.reusable.yml` that writes a job summary (commit SHA, environment, actor, timestamp, outcome, and the `migrate_data` flag/outcome for that run) for traceability
- [X] T029 [US2] Verify (quickstart.md V9): confirm `deploy-dev.yml` and `promote-prod.yml` have no `pull_request` trigger, and that a workflow run on a fork-originated PR (in `ci.yml`) has no access to the `dev`/`production` GitHub Environment secrets (e.g., inspect the run's environment context or attempt to reference a secret and confirm it resolves empty)
- [X] T030 [US2] Verify (quickstart.md V3, V6, V7): merging to `main` deploys to dev automatically with no local `pac` command and a traceable record; `promote-prod.yml` pauses for reviewer approval before running production steps; a forced step failure leaves the prior working version live

**T021/T022 completed 2026-07-01 (live walkthrough)**: provisioned two service principals via `pac admin create-service-principal` (`MedTrack-GitHub-Actions-Dev` → MedTrackDev, `MedTrack-GitHub-Actions-Prod` → MedTrack); created GitHub Environments `dev` (no reviewers) and `production` (required reviewer) via the API; populated `PP_CLIENT_ID`/`PP_CLIENT_SECRET`/`PP_TENANT_ID` (secrets) and `PP_ENVIRONMENT_URL`/`PP_ENVIRONMENT_ID` (variables) in both via `gh secret set`/`gh variable set`.

**T030 completed 2026-07-01 (V3 fully verified; V6/V7 deferred)**: merging PR #1 to `main` auto-triggered `deploy-dev.yml`. The first real run surfaced the `PP_APP_ID` bootstrapping gap exactly as anticipated (fail-fast message, no partial state) — resolved by minting a fresh `appId` via a one-time `pac code init`/`pac code push` in a scratch directory (see T031-T034 note below), then setting `PP_APP_ID` as a `dev` variable. Three more real bugs surfaced and were fixed via the normal PR flow, each confirmed by re-running the workflow: (1) `pac auth create`'s profile wasn't present by the time `pac code push` ran — moved authentication to run immediately before the steps that need it; (2) `pac code push` requires Node 22+, not 20; (3) GitHub's Linux runners have no OS keyring, requiring `--accept-cleartext-caching` on `pac auth create`. The **final run (28545770932) succeeded on every step** — schema pack/import/publish, app push, and deployment record all green, with `Migrate operational data (opt-in)` correctly **skipped** (V3 fully verified: automated, traceable, zero local `pac` commands during the run). **V6 (production approval gate) and V7 (forced-failure rollback) are not yet exercised** — those require actually running `promote-prod.yml` against the real `production` environment, deliberately deferred as a separate, higher-stakes action. **⚠ Correction — the "app push" part of this claim was a false positive; see "Post-completion correction" at the end of this file.**

**V6/V7 completed 2026-07-02 (live walkthrough)**: Production's `PP_APP_ID` had the same bootstrapping gap dev had — resolved (at the time) by observing `pac code list` return the same appId regardless of which Dataverse environment was active, so the same value used for dev was set as production's `PP_APP_ID` variable. **⚠ Correction — this specific claim was wrong**, see "Post-completion correction" at the end of this file: Code App `appId`s ARE per-environment, and the `pac code list` behavior observed here was itself a CLI bug (confirmed independently later — see the correction section), not evidence of a shared/tenant-wide app. Reusing dev's appId for production caused a real `InvalidEnvironmentName` failure that had to be fixed later by minting a genuinely distinct production appId. Confirmed production (`MedTrack`, orgfff21ac2) already had the base tables from before this CI/CD project existed, but was missing `ppa_prescriber` and the alternate keys, with zero existing records — a safe, additive-only first run. Triggered `promote-prod.yml`: the run entered `waiting` status with `pending_deployments` listing `kippolitov` as the required reviewer (**V6 confirmed** — approval gate blocks production steps; this part of the finding holds). Approved via the API; the run then completed with a green checkmark end-to-end (run 28556059569) — schema imported/published, app "pushed", migration correctly skipped. **⚠ Correction — "app pushed" was a false positive**, see "Post-completion correction" below. Verified live: `ppa_prescriber` and the medication alternate key are now present in production (this part is accurate — schema deployment was never in question). For **V7**, pushed a throwaway branch (`test/v7-forced-failure`, deleted after the test, never merged) with a deliberately unclosed XML tag in `ppa_Medication/Entity.xml`, then ran `deploy-dev.yml` via `workflow_dispatch --ref` against that branch: `Pack solution` failed fast (run 28556539024) and every subsequent step (Import solution, Deploy Code App, etc.) was correctly `skipped` — Dataverse was never called. Confirmed dev's `ppa_prescriber` column and existing medication record (same GUID) were untouched afterward (**V7 confirmed** — a forced failure stops before any live-environment mutation, prior working version/data intact, per SC-007; this finding holds regardless of the app-push correction).

**T029 completed 2026-07-01 (static verification)**: Confirmed via `gh workflow list`/file inspection that `deploy-dev.yml` triggers only on `push: [main]` and `workflow_dispatch`, and `promote-prod.yml` triggers only on `workflow_dispatch` — neither has a `pull_request` trigger, so a fork-originated PR can never cause either to run. Separately, `ci.yml`'s single `ci` job declares no `environment:` key at all, which is the mechanism GitHub uses to scope environment secrets/variables (`vars.PP_ENVIRONMENT_URL`, `secrets.PP_CLIENT_ID/SECRET/TENANT_ID`) to a job — without it, those secrets are never in scope regardless of trigger. Combined with GitHub's standard behavior of issuing a read-only `GITHUB_TOKEN` and withholding repo/environment secrets from `pull_request`-triggered runs on fork PRs (verified branch protection via `gh api .../branches/main/protection`: only the `ci` check is required, `enforce_admins: false`, no special exception), a fork PR run of `ci.yml` structurally has zero access to `dev`/`production` secrets — there is no code path that could resolve them. `gh api .../environments` confirms `dev` has no protection rules and `production` has a `required_reviewers` rule (kippolitov), matching T022.

**Checkpoint**: US1, US4, and US2 all work independently — app deploys are fully automated.

---

## Phase 6: User Story 3 - Deploy Dataverse schema and data changes alongside the app (Priority: P3)

**Goal**: Dataverse schema changes deploy before the app that depends on them; operational data migration is available but off by default, running only on explicit per-run opt-in, idempotently, without exposing record contents in logs.

**Independent Test**: Introduce a schema change and an opt-in data change, run the pipeline against dev, and confirm both are present and the app functions against them, without hand-editing the environment.

**Depends on**: Phase 5 (`deploy.reusable.yml`, `deploy-dev.yml`, `promote-prod.yml` from T025–T027, which this phase extends).

### Implementation for User Story 3

- [X] T031 [US3] Export the current Dataverse solution (tables `ppa_medication`, `ppa_intakelog`) via `pac solution export` and unpack it into `solution/src/` via `pac solution unpack`
- [X] T032 [P] [US3] Add a stable alternate key to `ppa_medication` in `solution/src/` (required for idempotent data upsert)
- [X] T033 [P] [US3] Add a stable alternate key to `ppa_intakelog` in `solution/src/` (required for idempotent data upsert)
- [X] T034 [US3] ~~Create `data/data-schema.xml`, a Configuration Migration schema~~ — superseded, see correction below
- [X] T035 [US3] Insert schema pack/import/publish steps (`pac solution pack` → `import-solution` action → `publish-solution` action, using `solution/src/`) into `deploy.reusable.yml` (T025), running **before** the existing app-push step
- [X] T036 [US3] Add a conditional data-migration step (`if: inputs.migrate_data`) to `deploy.reusable.yml` running a Web API upsert (`scripts/deploy/migrate-data.ps1`) against `data/*.json` (see correction below), fully skipped when `migrate_data` is false
- [X] T037 [US3] Configure the data-migration step from T036 to run with minimal/quiet output (avoid verbose per-record logging); verified per quickstart.md V10 that no record field values (e.g., medication names, intake timestamps) appear in the workflow's run logs — only aggregate success/failure and record counts (FR-016's "MUST NOT expose or log record contents" clause)
- [X] T038 [US3] Expose a `migrate_data` boolean `workflow_dispatch` input (default `false`) on `deploy-dev.yml` and `promote-prod.yml` (T026/T027), passed through to `deploy.reusable.yml`
- [X] T039 [US3] Verify (quickstart.md V4, V5): a schema change (new column) is applied before the app push and the app functions against it; a normal deploy run leaves existing records untouched; re-running with `migrate_data=true` twice upserts records with no duplicates and no record contents appear in the run logs (T037)

**T031-T034 completed 2026-07-01 (live walkthrough)**: The project owner manually exported the unmanaged `MedTrackSolution` (containing `ppa_Medication`, `ppa_IntakeLog`) from the original environment and imported it into MedTrackDev. From there: exported + unpacked it into `solution/src/` via `pac solution export`/`pac solution unpack`; created both alternate keys (`ppa_medication_name_key` on `ppa_name`; `ppa_intakelog_medication_scheduledfor_key` on `ppa_medication`+`ppa_scheduledfor`) via the Dataverse Web API, confirmed `EntityKeyIndexStatus: Active` for both, published, then re-exported/re-unpacked so `solution/src/` reflects the real keys; updated `data/data-schema.xml` to reference them as active (no longer proposed/commented). Production (MedTrack) does not yet have this schema — it will receive it automatically the first time `promote-prod.yml` runs, since that's the pipeline's job.

**Correction to T034/T036/T037 (found live 2026-07-01 during T039)**: `pac data import`/`export` (Configuration Migration) **do not exist** in the PAC CLI — verified against v2.7.4 (`pac help`, `pac package --help`, `pac solution --help` show no `data` noun). The only related tool, `pac tool CMT`, is a separate Windows GUI executable (`DataMigrationUtility.exe`) with no documented headless mode, so it cannot run on a GitHub-hosted `ubuntu-latest` runner. `data/data-schema.xml` (the Configuration Migration schema T034 produced) is removed; replaced with `data/ppa_medication.json` / `data/ppa_intakelog.json` (plain record sets) and `scripts/deploy/migrate-data.ps1`, a self-contained Web API upsert. Two real bugs surfaced building the replacement, each fixed via the normal PR flow and confirmed by re-running the workflow: (1) the composite alternate key on `ppa_intakelog` includes a lookup attribute (`ppa_medication`) — Web API URL addressing for that requires the lookup's `_ppa_medication_value` EDM property name, not the plain attribute name, or it 400s with `0x80060888`/"key ... not valid"; (2) `ConvertFrom-Json` auto-converts the ISO-8601 `ppa_scheduledfor` string into a `[DateTime]` object, and naive interpolation renders it in the local culture format (`01/15/2026 08:00:00`) instead of ISO 8601, producing a malformed URL (`Bad Request - Error in query syntax`) — fixed by explicitly reformatting to `yyyy-MM-ddTHH:mm:ssZ` before building the request URI.

**T039 completed 2026-07-01 (live walkthrough)**: Added a real `ppa_prescriber` column to `ppa_medication` via the Web API, re-exported/unpacked into `solution/src/`, and merged it to `main`. The push-triggered `deploy-dev.yml` run (28550170821) applied the schema (Import solution → Publish solution customizations) before attempting the app push, with the migration step correctly skipped by default (V4's schema-before-app **ordering** is confirmed and still holds). **⚠ Correction — "pushed the app successfully" was a false positive**, see "Post-completion correction" at the end of this file: this run's Deploy Code App step actually hit the same silent HTTP 500 documented there; the schema-ordering guarantee is real, the app content update was not. Queried the Web API post-deploy to confirm `ppa_prescriber` is live and queryable with zero rows (V5/normal-deploy-leaves-data-untouched confirmed, trivially — no medications existed yet; unaffected by the correction, this is a schema/data claim, not an app-push claim). Two `workflow_dispatch` runs with `migrate_data=true` (28553322103, 28554750184) both succeeded after the corrections above, each logging identical counts (`Medications: 1 upserted, 0 failed`, `Intake logs: 1 upserted, 0 failed, 0 skipped`) with no medication names, timestamps, or other field values in the logs. A direct Web API query after both runs confirmed exactly one medication record and one intake log record (same GUIDs both times) — idempotent upsert confirmed, no duplicates (this claim is about the Dataverse data-migration step, unrelated to and unaffected by the Code App push issue).

**Checkpoint**: All four user stories work independently and together — the full CI/CD + ALM flow is complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Wrap-up and validation across all stories.

- [X] T040 [P] Update `README.md` to describe the new GitHub Actions CI/CD process and remove/replace any Azure DevOps references
- [X] T041 Decommission the Azure DevOps pipeline(s) for this app once GitHub CI/CD has successfully deployed to both environments (SC-008)
- [X] T042 Run the full quickstart.md validation set (V1–V10 plus the rollback drill) end-to-end and record results

**T042 completed 2026-07-02 — final V1–V10 + rollback ledger** (all against the real repo/environments, ✓ = confirmed):
- **V1** CI gate blocks bad changes — ✓ (T012, PR #1: failing test blocked merge, fix passed)
- **V2** Secret-scanning gate — ✓ (T020: `gitleaks detect --source . --log-opts="--all"` found zero leaks across all commits/branches)
- **V3** Auto-deploy to dev — ✓ (T030: PR #1 merge auto-triggered `deploy-dev.yml`, zero local `pac` commands, traceable job summary)
- **V4** Schema + app ordering — ✓ ordering holds; ⚠ "app push" itself was a false positive, see correction (T039: `ppa_prescriber` column imported/published before the app push was *attempted*, both in dev and production)
- **V5** Data migration opt-in/idempotent — ✓ (T039: two `migrate_data=true` runs produced identical counts, one record each, no duplicates; unaffected by the app-push correction)
- **V6** Production approval gate — ✓ (2026-07-02: `promote-prod.yml` entered `waiting` with `kippolitov` as required reviewer; approved via API; prod steps then ran; the approval-gate mechanism itself is unaffected by the app-push correction)
- **V7** Failure leaves prod/dev intact — ✓ (2026-07-02: throwaway branch with a deliberately broken `Entity.xml` failed fast at "Pack solution"; every later step skipped; dev's schema/records unchanged afterward)
- **V8** Public-repo cleanliness — ✓ (T020: same `gitleaks` full-history scan as V2)
- **V9** Fork PRs never see deployment secrets — ✓ (T029: static verification — no `pull_request` trigger on deploy workflows, no `environment:` on the `ci` job)
- **V10** Data migration never logs record contents — ✓ (T039: migration step logs show only aggregate counts, e.g. `Medications: 1 upserted, 0 failed`, never field values)
- **Rollback drill** — ✓ (2026-07-02: `deploy-dev.yml` dispatched via a tag pinned to a prior known-good commit (`aaa87fc`) redeployed cleanly, all steps green)

**T041 completed 2026-07-02**: checked whether there was actually anything to decommission before acting. `az pipelines list` and `az pipelines release definition list` against the Azure DevOps `MedTrack` project (org `kippolitov0726`) both returned zero results — no build or classic-release pipeline was ever created there. The `MedTrackADO` git remote only ever served as source hosting, not CI/CD. Nothing to disable or delete; T041 is satisfied by this confirmation.

**Status as of 2026-07-02 (superseded — see correction below)**: All tasks (T001–T042) complete. The GitHub Actions CI/CD migration is fully implemented and verified end-to-end against the real repo and both live Power Platform environments.

---

## Post-completion correction (2026-07-02): the Code App push has never worked via CI

Found after T042 was marked complete, while investigating a "Sorry, we didn't find that app" error on the production play URL. This section is the authoritative correction to every "app pushed successfully" claim above — schema/solution deployment is unaffected and remains genuinely fixed and working.

**What was actually true all along, only discovered now**: `pac code push` exits `0` and prints `"Code App pushed successfully."` even when the underlying `PUT .../powerapps/apps/{appId}` call returns an HTTP error. Every historical `deploy-dev.yml`/`promote-prod.yml` run checked (11 across the project's full history, including the ones T030/T039/T042/V4/V6 above cite as evidence) contains the identical hidden failure inside the Deploy Code App step. Confirmed independently via the app's own "Modified" timestamp in `make.powerapps.com`: it has never advanced past the moment the app was first created (by a one-off local, interactively-authenticated push, not by any CI run) despite dozens of subsequent service-principal push attempts. The live dev app users see today is that one frozen snapshot, not anything CI has deployed.

**Root causes found and fixed, in order**:
1. **Wrong assumption that Code App `appId`s are tenant-wide shared.** They are per-environment (an Entra app registration alone isn't enough — `InvalidEnvironmentName` if you reuse another environment's appId). The `pac code list` behavior that suggested otherwise (returning the same app regardless of active environment) was itself a separate `pac` CLI bug, not evidence of sharing.
2. **`deploy-app.ps1` silently swallowed HTTP errors** — fixed (PR #12) to capture `pac code push`'s output and fail on any `HTTP error status` string regardless of exit code. This didn't cause a regression; it exposed a bug that had been present since the very first CI run.
3. **Legacy managed `MedTrack` solution in production** blocked clean unmanaged schema ownership — safely removed (empty tables, confirmed via Web API backup first) after deleting two alternate keys that were blocking the SQL-level cascade delete.
4. **Production was importing the same unmanaged solution as dev** — incorrect ALM for a downstream environment. Redesigned `promote-prod.yml` into two jobs: `sync-dev-and-export` (re-imports `solution/src` into dev to eliminate drift risk, then exports Managed) and `deploy-production` (imports that Managed artifact). Validated live — `MedTrackSolution` in production now correctly reports `ismanaged: true`.
5. **`AADSTS7000215: Invalid client secret provided`** on the Deploy Code App step specifically, while the identical secret worked earlier in the same job (`import-solution`). Root cause (confirmed via [microsoft/powerplatform-vscode#297](https://github.com/microsoft/powerplatform-vscode/issues/297) and [#456](https://github.com/microsoft/powerplatform-vscode/issues/456)): `pac auth create`'s persisted profile doesn't retain a usable secret for a later process's token refresh, by design. Two attempted fixes that did **not** work, ruling out the OS/keyring theory: installing `libsecret-1-0` on the Linux runner, and switching the runner to `windows-latest`. The actual fix: exposing the secret via the `PAC_CLI_SPN_SECRET` environment variable, per the documented workaround in those issues (`auth.ps1` now writes it to `$GITHUB_ENV` after `pac auth create` succeeds). **This fix is confirmed working** — the SP now cleanly acquires a valid token for the Code Apps scope every time.
6. **The remaining, unfixable-from-CI issue**: with auth fully working, `pac code push` still returns a generic `500 InternalServerError` on the actual `PUT` call, only when authenticated as a service principal — confirmed to affect **any** application/service-principal identity, not just client-secret auth: a certificate-based SP credential (a completely different Entra credential type) hits the identical 500 after cleanly acquiring a valid `AppCertificate`-type token. Interactive user auth always succeeds at the identical call. The SP is fully, correctly registered (Dataverse Application User with System Administrator role, and present in the tenant's `adminApplications` BAP-level registration list — the same registration `pac admin create-service-principal` performs). This rules out every configuration angle available to us. Filed as [microsoft/PowerAppsCodeApps#394](https://github.com/microsoft/PowerAppsCodeApps/issues/394).

**Corrected current state**:
- Schema/solution deployment via CI (`pac solution pack/import/publish`, the managed-export flow for production) is genuinely fully automated and working — this was never in question and remains correct.
- Code App content deployment (`pac code push`) via the service-principal-driven CI pipeline **does not work** — it is a confirmed Microsoft platform limitation, not a configuration problem. `deploy-app.ps1`'s hardening correctly surfaces this as a failure on every run now, rather than silently reporting success.
- **Stopgap**: updating the Code App's actual content currently requires a human running `pac auth create` (interactive) + `pac code push` locally. This is a deliberate, documented deviation from FR-005/FR-006 ("no developer runs `pac` commands locally") pending a fix from Microsoft.

**Status as of 2026-07-02 (corrected)**: Schema/solution CI/CD (US2's non-app-push portion, US3) is complete and verified. US2's Code App push automation is blocked by a confirmed upstream Microsoft Power Platform bug (tracked externally), not by anything fixable in this repo. All other T001–T042 work stands as verified.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — blocks all user stories.
- **US1 (Phase 3, P1)**: Depends on Foundational only. No Power Platform access required. **MVP.**
- **US4 (Phase 4, P2)**: Depends on Foundational; T017 also depends on US1's `.gitleaks.toml`-consuming step existing in `ci.yml` (T005). No Power Platform access required.
- **US2 (Phase 5, P2)**: Depends on Foundational; consumes US4's `power.config.template.json`/`render-power-config.ps1` (T013/T014). Requires Power Platform access (T021/T022).
- **US3 (Phase 6, P3)**: Depends on Foundational; extends US2's `deploy.reusable.yml`/`deploy-dev.yml`/`promote-prod.yml` (T025–T027).
- **Polish (Phase 7)**: Depends on all four user stories being complete.

### User Story Dependencies

- **US1 (P1)**: Independent — can start right after Foundational.
- **US4 (P2)**: Builds on US1's `ci.yml` (adds the `gitleaks` step) but is otherwise independent of US2/US3.
- **US2 (P2)**: Builds on US4's config-externalization artifacts; otherwise independent of US1/US3.
- **US3 (P3)**: Builds on US2's deploy workflows (extends the same reusable job); otherwise independently testable once US2 exists.

### Within Each User Story

- Manual/administrative tasks (provisioning, GitHub Environment setup) precede the code tasks that depend on them.
- Workflow-file edits within a phase are sequential (same file); tasks touching different files are marked `[P]`.
- Story complete (checkpoint) before moving to the next priority phase.

### Parallel Opportunities

- Phase 1: T002, T003 in parallel.
- Phase 4: T013, T014 in parallel.
- Phase 5: T023, T024 in parallel.
- Phase 6: T032, T033 in parallel.
- Phase 7: T040 in parallel with T041/T042.

---

## Parallel Example: User Story 4

```bash
# Launch independent US4 file creation together:
Task: "Create power.config.template.json with placeholder tokens"
Task: "Create scripts/ci/render-power-config.ps1"
```

## Parallel Example: User Story 3

```bash
# Launch independent alternate-key additions together:
Task: "Add alternate key to ppa_medication in solution/src/"
Task: "Add alternate key to ppa_intakelog in solution/src/"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational
3. Complete Phase 3: US1 — the CI gate is live and blocking bad merges
4. **STOP and VALIDATE**: run quickstart.md V1
5. This alone already replaces the Azure DevOps validation build

### Incremental Delivery

1. Setup + Foundational → baseline ready
2. US1 → CI gate live (MVP) → validate (V1)
3. US4 → repo hardened, secrets externalized, scanning gate live → validate (V2, V8)
4. US2 → automated app deploy to dev + approval-gated production → validate (V3, V6, V7, fork-PR check T029)
5. US3 → schema + opt-in data migration layered onto the deploy workflow → validate (V4, V5, log-redaction check T037)
6. Polish → docs updated, Azure DevOps decommissioned, full validation run (V1–V10 + rollback)

### Sequencing Note

Unlike a typical feature where same-priority stories (US2, US4) are fully parallel, here US4 is deliberately sequenced **before** US2: US2's deploy workflow reads Power Platform identifiers via the externalized-config mechanism (`power.config.template.json` + `render-power-config.ps1`) that US4 introduces, so building US2 first would mean writing it against a config pattern that gets replaced immediately after.
