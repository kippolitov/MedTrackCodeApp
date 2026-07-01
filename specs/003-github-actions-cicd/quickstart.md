# Quickstart & Validation: GitHub Actions CI/CD Migration

Runnable checks that prove the feature works end to end. See [contracts/](./contracts/) and
[data-model.md](./data-model.md) for the detailed shapes referenced here.

## Prerequisites

- Repo hosted on GitHub with Actions enabled.
- A Power Platform **service principal** (Entra app registration) registered as an application user in **both** the dev and production environments, with rights to import solutions and push the Code App.
- GitHub **Environments** `dev` and `production` created, `production` with required reviewers.
- Secrets/variables populated per [contracts/secrets-and-environments.contract.md](./contracts/secrets-and-environments.contract.md).
- A source-controlled solution exported to `solution/src/` (tables `ppa_medication`, `ppa_intakelog`).
- Alternate keys present on both tables **if** data migration will be used (see data-model.md).

## Setup (one-time)

1. Externalize config: create `power.config.template.json`, add `power.config.json` + `localhost*.pem` to `.gitignore`, add the render step. (contracts)
2. Make `vite.config.ts` HTTPS conditional so `npm run dev` runs without committed certs.
3. Add `build:ci` script (`tsc -b && vite build`) to `package.json`.
4. Purge history + rotate the app secret using `scripts/security/history-purge-runbook.md` **before** making the repo public.

## Validation Scenarios

### V1 — CI gate blocks bad changes (US1)
- Open a PR that adds a failing test. **Expect**: `ci` fails at the test step; PR merge blocked.
- Push a fix. **Expect**: `ci` passes; merge allowed.
- Full run completes in **< 10 min** (SC-002).

### V2 — Secret-scanning gate (US4)
- In a branch, add a file containing a fake key (e.g. `AKIA...`). Open a PR.
- **Expect**: `gitleaks` step fails `ci`; merge blocked (FR-021, SC-010).

### V3 — Auto-deploy to dev (US2)
- Merge a validated change to `main`.
- **Expect**: `deploy-dev.yml` runs with **no local `pac` command**; schema imports then app pushes; the change is live in the dev environment; a deployment summary records commit/environment/actor/outcome (SC-003, SC-005).

### V4 — Schema + app ordering (US3)
- Include a schema change (e.g., a new column in `solution/src`) with an app change that uses it.
- **Expect**: schema import/publish completes **before** app push; app functions against the new column with no manual environment edit (FR-007, SC-004).

### V5 — Data migration is opt-in and idempotent (US3, FR-016)
- Run `deploy-dev.yml` normally (no input). **Expect**: existing records untouched; no data step runs.
- Re-run via `workflow_dispatch` with `migrate_data=true`, twice. **Expect**: records upsert by alternate key; **no duplicates** after the second run (SC-011).

### V6 — Production approval gate (US2/US4, FR-014)
- Trigger `promote-prod.yml` for the dev-validated commit.
- **Expect**: the run pauses for a required reviewer; prod steps run only after approval.

### V7 — Failure leaves prod intact (FR-010)
- Force a deploy step to fail (e.g., invalid solution).
- **Expect**: run stops, reports the failing step; prior live app version and data remain (SC-007).

### V8 — Public-repo cleanliness (US4, SC-009)
- Scan the working tree and **full history** (e.g., `gitleaks detect` over all commits).
- **Expect**: zero private keys, credentials, or hardcoded environment/app/tenant identifiers.

### V9 — Fork PRs never see deployment secrets (US2, FR-012)
- Confirm `deploy-dev.yml` and `promote-prod.yml` have no `pull_request` trigger.
- Open a PR from a fork (or simulate one) so only `ci.yml` runs.
- **Expect**: the `ci` run has no access to the `dev`/`production` GitHub Environment secrets; no deploy workflow executes for the fork PR.

### V10 — Data migration never logs record contents (US3, FR-016)
- Run `deploy-dev.yml` with `migrate_data=true` against a dev environment containing sample medications/intake logs.
- **Expect**: the run's logs show only aggregate success/failure and record counts for the `pac data import` step — no medication names, timestamps, or other field values appear in the workflow output.

## Rollback drill (FR-015)
- Re-run the deploy workflow via `workflow_dispatch` pinned to the last-known-good commit/tag.
- **Expect**: prior artifact + solution version redeployed; environment restored.

## Future hardening (noted, not required)
- Migrate `pac` auth from stored client secret to **OIDC / workload-identity federation** to remove `PP_CLIENT_SECRET` entirely (R2).
