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
- [ ] T029 [US2] Verify (quickstart.md V9): confirm `deploy-dev.yml` and `promote-prod.yml` have no `pull_request` trigger, and that a workflow run on a fork-originated PR (in `ci.yml`) has no access to the `dev`/`production` GitHub Environment secrets (e.g., inspect the run's environment context or attempt to reference a secret and confirm it resolves empty)
- [ ] T030 [US2] Verify (quickstart.md V3, V6, V7): merging to `main` deploys to dev automatically with no local `pac` command and a traceable record; `promote-prod.yml` pauses for reviewer approval before running production steps; a forced step failure leaves the prior working version live

**T021/T022 completed 2026-07-01 (live walkthrough)**: provisioned two service principals via `pac admin create-service-principal` (`MedTrack-GitHub-Actions-Dev` → MedTrackDev, `MedTrack-GitHub-Actions-Prod` → MedTrack); created GitHub Environments `dev` (no reviewers) and `production` (required reviewer) via the API; populated `PP_CLIENT_ID`/`PP_CLIENT_SECRET`/`PP_TENANT_ID` (secrets) and `PP_ENVIRONMENT_URL`/`PP_ENVIRONMENT_ID` (variables) in both via `gh secret set`/`gh variable set`. **`PP_APP_ID` is intentionally not yet set** in either environment — the Code App has never been pushed to MedTrackDev or MedTrack, so it has no `appId` there yet; that value can only be captured after each environment's first successful `pac code push` (see T030). **T029/T030 still open**: need a real triggered workflow run to verify against.

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
- [X] T034 [US3] Create `data/data-schema.xml`, a Configuration Migration schema declaring `ppa_medication`/`ppa_intakelog` and the alternate keys from T032/T033 for upsert-based migration
- [X] T035 [US3] Insert schema pack/import/publish steps (`pac solution pack` → `import-solution` action → `publish-solution` action, using `solution/src/`) into `deploy.reusable.yml` (T025), running **before** the existing app-push step
- [X] T036 [US3] Add a conditional data-migration step (`if: inputs.migrate_data`) to `deploy.reusable.yml` running `pac data import` with `data/data-schema.xml` (T034), fully skipped when `migrate_data` is false
- [X] T037 [US3] Configure the data-migration step from T036 to run with minimal/quiet output (avoid verbose per-record logging); verify per quickstart.md V10 that no record field values (e.g., medication names, intake timestamps) appear in the workflow's run logs — only aggregate success/failure and record counts (FR-016's "MUST NOT expose or log record contents" clause)
- [X] T038 [US3] Expose a `migrate_data` boolean `workflow_dispatch` input (default `false`) on `deploy-dev.yml` and `promote-prod.yml` (T026/T027), passed through to `deploy.reusable.yml`
- [ ] T039 [US3] Verify (quickstart.md V4, V5): a schema change (new column) is applied before the app push and the app functions against it; a normal deploy run leaves existing records untouched; re-running with `migrate_data=true` twice upserts records with no duplicates and no record contents appear in the run logs (T037)

**T031-T034 completed 2026-07-01 (live walkthrough)**: The project owner manually exported the unmanaged `MedTrackSolution` (containing `ppa_Medication`, `ppa_IntakeLog`) from the original environment and imported it into MedTrackDev. From there: exported + unpacked it into `solution/src/` via `pac solution export`/`pac solution unpack`; created both alternate keys (`ppa_medication_name_key` on `ppa_name`; `ppa_intakelog_medication_scheduledfor_key` on `ppa_medication`+`ppa_scheduledfor`) via the Dataverse Web API, confirmed `EntityKeyIndexStatus: Active` for both, published, then re-exported/re-unpacked so `solution/src/` reflects the real keys; updated `data/data-schema.xml` to reference them as active (no longer proposed/commented). Production (MedTrack) does not yet have this schema — it will receive it automatically the first time `promote-prod.yml` runs, since that's the pipeline's job.

**T039 still open**: needs a real triggered workflow run against dev to verify end-to-end.

**Checkpoint**: All four user stories work independently and together — the full CI/CD + ALM flow is complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Wrap-up and validation across all stories.

- [X] T040 [P] Update `README.md` to describe the new GitHub Actions CI/CD process and remove/replace any Azure DevOps references
- [ ] T041 Decommission the Azure DevOps pipeline(s) for this app once GitHub CI/CD has successfully deployed to both environments (SC-008)
- [ ] T042 Run the full quickstart.md validation set (V1–V10 plus the rollback drill) end-to-end and record results

**Blocked**: T041 is a manual Azure DevOps admin action that should only happen after GitHub deploys are proven working (T030/T039) — premature now. T042 needs the full chain (real GitHub repo, Power Platform environments, populated solution) to exist first.

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
