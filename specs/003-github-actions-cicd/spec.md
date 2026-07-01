# Feature Specification: GitHub Actions CI/CD Migration

**Feature Branch**: `003-github-actions-cicd`

**Created**: 2026-07-01

**Status**: Draft

**Input**: User description: "My goal is to switch from Azure DevOps to GitHub. I would like to create GitHub actions that would build, test, package the source code, and then deploy it to a power platform environment, together with Dataverse schema and data changes"

## Clarifications

### Session 2026-07-01

- Q: How should data migration be controlled, given it must be OFF by default and selectable per run? → A: Opt-in toggle per run — migration is skipped by default; a manual workflow run exposes a boolean input that performs data migration only when explicitly set.
- Q: The repo already has a committed private key (localhost-key.pem) and real env/app GUIDs in git history. Before making the repo public, how should that be handled? → A: Rewrite history + rotate — purge the private key and identifiers from git history, rotate/regenerate anything real, and gitignore them going forward.
- Q: How should environment-specific identifiers (environmentId, appId in power.config.json) be handled for the public repo + CI deploys? → A: Externalize to secrets/variables — keep IDs out of committed files and inject per-environment (dev vs prod) values at build/deploy time.
- Q: Should CI enforce automated secret scanning to keep sensitive data out of the public repo? → A: Yes — add a CI secret-scanning gate that fails the build when keys, tokens, or credentials are detected.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Automated build and test on every change (Priority: P1)

As a developer, when I push a commit or open a pull request, an automated pipeline installs dependencies, lints, type-checks, builds the app, and runs the full test suite, so I know within minutes whether my change is safe to merge — without relying on Azure DevOps or anyone running checks manually.

**Why this priority**: This is the safety net the whole migration depends on. Even with no deployment automation, a reliable CI gate on every change immediately replaces the Azure DevOps validation build and delivers standalone value by preventing broken code from reaching the main branch.

**Independent Test**: Open a pull request containing a deliberately failing test (or lint error) and confirm the pipeline reports failure and blocks merge; then push a passing commit and confirm the pipeline reports success. No deployment is required to validate this story.

**Acceptance Scenarios**:

1. **Given** a pull request targeting the main branch, **When** the pipeline runs, **Then** it installs dependencies, runs lint, type-check, build, and the test suite, and reports a single overall pass/fail status back to the pull request.
2. **Given** a commit that fails linting, type-checking, the build, or any test, **When** the pipeline runs, **Then** the pipeline fails, the failing step is clearly identified, and the change is prevented from being merged.
3. **Given** a pipeline run that produces a successful build, **When** the run completes, **Then** the packaged application artifact is retained and available for a later deployment stage.

---

### User Story 2 - Deploy the application to a Power Platform environment (Priority: P2)

As a release owner, when a validated change lands on the main branch, the pipeline packages the built application and deploys it to the target Power Platform environment automatically, so releasing no longer requires a developer to run `pac code push` from their own machine.

**Why this priority**: Automating app deployment removes the main manual, error-prone step and is the core reason for the migration. It builds directly on the P1 validation gate and delivers the "push to deploy" outcome, but it depends on the CI foundation existing first.

**Independent Test**: Merge an approved change to the main branch and confirm the running app in the target Power Platform environment reflects the change, with a deployment record showing which commit was deployed, when, and by which run — with no manual `pac` command executed by a person.

**Acceptance Scenarios**:

1. **Given** a change merged to the main branch that passed all CI checks, **When** the deployment stage runs, **Then** the built app is published to the configured target Power Platform environment using non-interactive service credentials.
2. **Given** a deployment run, **When** it completes, **Then** the run records which commit/version was deployed and the outcome (success/failure) in a traceable history.
3. **Given** a deployment that fails partway, **When** the failure occurs, **Then** the pipeline reports failure clearly and the previously deployed working version remains the live version (no partially-updated app is left as the released state).

---

### User Story 3 - Deploy Dataverse schema and data changes alongside the app (Priority: P3)

As a release owner, when a release includes changes to Dataverse tables/columns (schema) and required reference/configuration data, the pipeline applies those changes to the target environment as part of the same release, so the deployed app and its backing data model always stay in sync.

**Why this priority**: Schema and data drift between environments is a top cause of "works in dev, broken in prod" incidents. Automating it completes the migration goal, but it is the most sensitive step (data safety), so it is sequenced last and gated behind working app deployment.

**Independent Test**: Introduce a schema change (e.g., a new column on a medication table) and an accompanying reference-data update, run the pipeline against a non-production target, and confirm both the schema change and the data change are present in the target environment and the app functions against them — verified without hand-editing the target environment.

**Acceptance Scenarios**:

1. **Given** a release that includes Dataverse schema changes, **When** the deployment stage runs, **Then** the schema changes are applied to the target environment before the app that depends on them is published.
2. **Given** a release that includes reference/configuration data changes, **When** the deployment stage runs, **Then** those data changes are applied to the target environment in a repeatable, idempotent way (re-running does not create duplicates).
3. **Given** a schema or data step that fails, **When** the failure occurs, **Then** the release stops, the failure is reported, and existing environment data is not left in a corrupt or half-migrated state.

---

### User Story 4 - Make the repository safe to be public (Priority: P2)

As the project owner, before opening the repository to the public I need every secret, private key, and environment identifier removed from both the working tree and git history, with automated scanning preventing new ones, so the source can be shared publicly without leaking credentials or environment details.

**Why this priority**: The repository is going public as part of this migration. A single leaked key or environment identifier in code or history is a security incident, so this hardening must land alongside the deployment automation (which is what introduces the externalized-secrets model) — not after the repo is already exposed.

**Independent Test**: Scan the full repository and its entire git history and confirm zero private keys, credentials, or hardcoded environment/app identifiers are present; then attempt to add a file containing a fake secret and confirm the CI secret-scanning gate blocks it.

**Acceptance Scenarios**:

1. **Given** the repository before going public, **When** its working tree and full history are scanned, **Then** no private keys, credentials, or hardcoded Power Platform environment/app/tenant identifiers are found.
2. **Given** a previously committed private key and identifiers in history, **When** the history-purge and rotation step completes, **Then** those values no longer appear in any commit and any real key/credential has been rotated so the exposed value is invalid.
3. **Given** a pull request that adds a file containing a key or token, **When** CI runs, **Then** the secret-scanning gate fails the run and the change cannot merge.
4. **Given** the deploy pipeline, **When** it needs an environment identifier or credential, **Then** it reads it from GitHub secrets/variables rather than any committed file.

---

### Edge Cases

- **Secrets missing or expired**: What happens when the service credentials used to deploy are absent, invalid, or expired? The pipeline must fail fast with a clear, actionable message and must never fall back to prompting for interactive login.
- **Concurrent releases**: How does the system handle two deployments targeting the same environment at once? Deployments to a given environment must be serialized so one release cannot overwrite another mid-flight.
- **Non-blocking vs blocking checks**: What happens when only a non-essential step (e.g., artifact upload) fails after tests pass? The pipeline defines which steps block a release and which are advisory.
- **Schema change that is destructive**: How does the system handle a schema change that would delete a column or table containing data? Destructive schema operations must be surfaced and require explicit human approval before running against protected environments.
- **Fork / untrusted pull requests**: How does the pipeline prevent deployment secrets from being exposed to pull requests from forks? Deploy stages must not run with access to secrets for untrusted contributions.
- **Data volume**: What happens when a data change targets a large number of records? The data step must complete within the pipeline time budget or be explicitly scoped to reference/configuration data only.
- **Rollback**: When a bad release reaches the target environment, how does the team revert? The process for returning to the last-known-good app version is defined and documented.
- **Accidental data migration**: What happens on a normal deploy? Existing operational records MUST be left untouched — data migration only runs when a release owner explicitly opts in on a manual run, so a routine merge can never overwrite production data.
- **Secret committed to a public repo**: What happens when a commit or pull request introduces a key, token, or credential? The secret-scanning gate MUST fail the run before the change merges, keeping the material out of the public repository.
- **Sensitive value already in history**: How is the pre-existing committed private key / identifier handled? It MUST be purged from history and rotated before the repo is made public, and re-adding it MUST be caught by the scanning gate.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The CI/CD process MUST run automatically on GitHub in response to pull requests targeting the main branch and to merges/pushes on the main branch, with no dependency on Azure DevOps.
- **FR-002**: On every pull request, the pipeline MUST install dependencies and run linting, type-checking, the production build, and the automated test suite, and MUST report a single aggregated pass/fail status back to the pull request.
- **FR-003**: The pipeline MUST fail and block merging whenever linting, type-checking, the build, or any test fails, and MUST clearly identify which step failed.
- **FR-004**: On a successful build, the pipeline MUST produce a packaged, deployable application artifact and retain it for use by the deployment stage.
- **FR-005**: The pipeline MUST deploy the packaged application to a configured target Power Platform environment automatically when a validated change lands on the main branch, without any developer running deployment commands locally.
- **FR-006**: All deployment authentication MUST use non-interactive service credentials (service principal / app registration) stored as protected secrets; the pipeline MUST NOT contain hardcoded credentials, environment URLs, tenant IDs, or app IDs, and MUST NOT rely on interactive login.
- **FR-007**: The pipeline MUST apply Dataverse schema changes to the target environment as part of a release, and MUST apply them before publishing the app version that depends on them.
- **FR-008**: The pipeline MUST apply required reference/configuration data changes to the target environment in a repeatable, idempotent manner such that re-running a release does not create duplicate or conflicting records.
- **FR-009**: Every deployment MUST be traceable: the system MUST record which commit/version was deployed, to which environment, when, the triggering actor, and the outcome.
- **FR-010**: When any deployment step (app, schema, or data) fails, the pipeline MUST stop the release, report the failure clearly, and leave the target environment's previously working version and existing data intact (no partially-applied release as the accepted state).
- **FR-011**: Deployments to a given target environment MUST be serialized so concurrent runs cannot overwrite one another mid-deployment.
- **FR-012**: Deployment stages MUST NOT expose deployment secrets to pull requests originating from untrusted sources (e.g., forks).
- **FR-013**: The system MUST support environment-specific configuration (target environment URL/ID and credentials) so the same pipeline definition can target different Power Platform environments without code changes. (FR-020 states the stricter, public-repo-driven form of this requirement: those identifiers specifically MUST NOT be committed to the repository.)
- **FR-014**: The production environment MUST be treated as protected: any deployment to production — and in particular any destructive schema or data operation against it — MUST require explicit human approval before executing. Non-production (dev) deployments run automatically without an approval gate.
- **FR-015**: The team MUST have a defined, documented way to return the target environment to the last-known-good application version after a bad release.
- **FR-016**: Operational data migration (medications and intake logs) MUST be OFF by default: a normal deploy MUST NOT re-import or overwrite existing records. Migration MUST run only when a release owner explicitly opts in via a per-run boolean input on a manually triggered run. When enabled, migration MUST be applied idempotently (records matched and upserted by a stable key, not blindly re-inserted), MUST be traceable, MUST respect the production approval gate (FR-014), and MUST NOT expose or log record contents beyond what is needed to report success/failure.
- **FR-017**: The pipeline MUST implement a two-stage promotion: a validated merge to the main branch deploys automatically to the dev Power Platform environment, and promotion from dev to the production environment occurs as a separate, human-approved stage. The same pipeline definition MUST target each stage's environment through per-environment configuration (FR-013).
- **FR-018**: Because the repository will be PUBLIC, the working tree MUST contain no sensitive material: no private keys/certificates (e.g., the current `localhost-key.pem`/`localhost.pem`), no credentials, and no secret tokens. Such files MUST be removed from tracking and added to `.gitignore`; developers MUST be able to regenerate any local dev artifacts (e.g., localhost certs) without committing them.
- **FR-019**: Sensitive material already present in git history (the committed private key and real environment/app identifiers) MUST be purged from the entire history before the repository is made public, and any real credential or key exposed in history MUST be rotated/regenerated so previously-committed values are no longer valid.
- **FR-020**: Environment-specific identifiers (Power Platform `environmentId`, `appId`, environment URL, tenant ID) MUST NOT be committed to the repository; they MUST be supplied at build/deploy time from GitHub Actions secrets/variables, with separate values per stage (dev vs production), so the same committed configuration works for every environment. (This is the public-repo-driven refinement of the general environment-configuration requirement in FR-013.)
- **FR-021**: CI MUST include an automated secret-scanning gate that inspects changes (commits/pull requests) for keys, tokens, and credentials and FAILS the run when any are detected, preventing sensitive data from entering the public repository.

### Key Entities *(include if feature involves data)*

- **Pipeline Run**: A single execution of the CI/CD process. Attributes: trigger (PR vs main-branch merge), commit/version, status per stage, overall outcome, timestamps, triggering actor, produced artifact reference.
- **Application Artifact**: The packaged, deployable output of a successful build tied to a specific commit/version, retained for deployment and rollback reference.
- **Target Environment**: A Power Platform environment the pipeline can deploy to. Attributes: identifier/URL, protection level (protected vs non-protected), associated deployment credentials, promotion order.
- **Deployment Record**: A traceable entry describing a deployment: what version, to which environment, when, by whom/what, and the outcome (success/failure).
- **Schema Change Set**: The Dataverse table/column/metadata changes bundled into a release and applied to a target environment.
- **Data Change Set**: The operational data records (medications, intake logs) optionally migrated to a target environment. Attributes: enabled flag (default off / per-run opt-in), stable matching key for idempotent upsert, source and target environment.
- **Sensitive Material**: Any private key, credential, token, or environment/app/tenant identifier that must never reside in the public repository or its history; governed by history purge, rotation, externalized secrets, and the secret-scanning gate.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of pull requests to the main branch automatically run lint, type-check, build, and tests, and cannot be merged while any of those checks fail.
- **SC-002**: The full CI validation (dependencies, lint, type-check, build, tests) completes in under 10 minutes for a typical change.
- **SC-003**: Releasing a change to the target Power Platform environment requires zero manual command-line steps by a developer — a merge to the main branch is sufficient to trigger deployment.
- **SC-004**: Application and Dataverse schema changes for a release reach the target environment together automatically, with zero manual environment edits required to make the deployed app functional; operational data changes reach the target environment only when explicitly opted in for that run (see FR-016).
- **SC-005**: 100% of deployments produce a traceable record identifying the deployed version, environment, actor, and outcome.
- **SC-006**: Zero credentials, environment identifiers, or tenant/app identifiers are stored in source; all are provided through protected secrets/configuration.
- **SC-007**: A failed deployment never leaves the target environment on a partially-applied release; the last working version remains live and recoverable in 100% of failure cases.
- **SC-008**: All release automation runs on GitHub; the team can decommission Azure DevOps CI/CD for this app with no loss of build, test, or deploy capability.
- **SC-009**: A scan of the repository's working tree and full git history returns zero private keys, credentials, or hardcoded environment/app/tenant identifiers before the repo is made public.
- **SC-010**: 100% of pull requests are scanned for secrets, and any change introducing a key, token, or credential is blocked from merging.
- **SC-011**: A routine deploy never re-imports or overwrites existing operational records; data migration occurs only on explicit per-run opt-in (0 unintended data overwrites).

## Assumptions

- The application is the existing MedTrack Power Apps Code App (React + TypeScript + Vite) backed by Dataverse, deployed today via `pac code push`; the migration re-implements that flow (plus schema/data) as GitHub-hosted automation.
- The Azure DevOps setup being replaced provides build/test/deploy for this app; equivalent capability on GitHub is considered success even though no Azure DevOps pipeline definition is committed to this repository.
- A Power Platform service principal (app registration) with rights to deploy to the target environment(s) can be provisioned by an administrator; the pipeline consumes it via secrets rather than creating it.
- "Package the source code" means producing the deployable Code App build output (the `dist/` bundle) plus whatever Power Platform packaging the deploy tooling requires — not distributing raw source.
- Dataverse schema is managed as a solution (or equivalent exportable definition) so it can be versioned and applied to a target environment programmatically.
- Two Power Platform environments are in scope: a dev environment (auto-deploy target) and production (approval-gated target). The environment in `power.config.json` today is treated as one of these stage targets.
- Operational data migration (medications and intake logs) is OFF by default and only runs on explicit per-run opt-in; when enabled it is applied idempotently via a stable matching key and relies on the production approval gate for safety. Routine deploys never touch existing records.
- The repository will be made PUBLIC. History rewriting to purge the already-committed private key and identifiers is acceptable and coordinated with the team (force-push after rewrite); the current `localhost*.pem` dev certificates can be regenerated locally by developers and are not needed in source.
- GitHub secret scanning (or an equivalent scanning action) and per-environment secrets/variables are available in the repository plan being used.
- The main branch is the release branch; GitHub branch protection can be configured to require the CI checks.
- Secrets management, environment protection rules, and required-reviewer approvals are available in the GitHub organization/repository plan being used.
- Network access from GitHub-hosted runners to the target Power Platform environment and Dataverse Web API is permitted.
