# Contract: Deploy Workflows (`deploy-dev.yml`, `promote-prod.yml`, `deploy.reusable.yml`)

Deploys the Code App + Dataverse schema (+ opt-in data) to a target Power Platform environment.

## `deploy.reusable.yml` (reusable workflow — the shared deploy job)

### Inputs
| Input | Type | Required | Notes |
|---|---|---|---|
| `environment` | string | yes | GitHub Environment name (`dev` \| `production`). Selects secrets/variables + approval. |
| `migrate_data` | boolean | no (default `false`) | Opt-in operational data migration (FR-016). |

### Secrets/Variables consumed (from the named GitHub Environment)
`PP_CLIENT_ID`, `PP_CLIENT_SECRET`, `PP_TENANT_ID` (secrets); `PP_ENVIRONMENT_URL`, `PP_ENVIRONMENT_ID`, `PP_APP_ID` (variables). See data-model.md.

### Job contract (`environment: ${{ inputs.environment }}`, `concurrency: deploy-${{ inputs.environment }}` with `cancel-in-progress: false`)
| Step | Contract |
|---|---|
| Checkout | source at release commit. |
| Install `pac` | via `microsoft/powerplatform-actions/actions/install` or dotnet tool. |
| Authenticate | `pac auth create` with SP secrets → target `PP_ENVIRONMENT_URL`. Fail fast with clear message if secrets missing/invalid; never prompt (FR-006, edge case "Secrets missing"). |
| Build | `npm ci` + `npm run build:ci` (or download CI artifact). |
| Render config | `scripts/ci/render-power-config.*` → `power.config.json` from template + `PP_ENVIRONMENT_ID`/`PP_APP_ID` (FR-020). |
| **Schema** | `pac solution pack` (`solution/src`) → `import-solution` (SP auth) → `publish-solution`. Runs **before** app push (FR-007). |
| **App** | `pac code push` (`scripts/deploy/deploy-app.*`, `--log-to-console`) (FR-005). |
| **Data (conditional)** | `if: inputs.migrate_data` → `pac data import` with `data/data-schema.xml` (idempotent upsert by alternate key). Skipped entirely when false (FR-016). |
| Record | Emit deployment summary (commit, environment, actor, outcome, data flag) (FR-009). |

### Ordering & failure guarantees
- Order: **schema → app → (data)**. On any step failure, stop and report; do not proceed; prior live version/data preserved (FR-010).

## `deploy-dev.yml`
- **Trigger**: `push` to `main` (post-merge) and `workflow_dispatch` (with `migrate_data` input).
- Calls `deploy.reusable.yml` with `environment: dev`. No approval gate. Auto-deploys (FR-017).

## `promote-prod.yml`
- **Trigger**: `workflow_dispatch` (choose the dev-validated commit/tag; `migrate_data` input) — human-initiated promotion (FR-017).
- Calls `deploy.reusable.yml` with `environment: production`. The `production` GitHub Environment's **required reviewers** enforce the approval gate before any prod step runs (FR-014).

## Fork / untrusted-PR safety
- Deploy workflows never trigger on `pull_request`. Only `push`/`workflow_dispatch`. Secrets are environment-scoped and unreachable from PR runs (FR-012).

## Rollback (FR-015)
- Re-run `deploy-dev.yml`/`promote-prod.yml` via `workflow_dispatch` pinned to the last-known-good commit/tag to redeploy that artifact + prior solution version.

## Acceptance (maps to spec)
- US2 (app deploy), US3 (schema + opt-in data), FR-005–FR-017, SC-003, SC-004, SC-005, SC-007, SC-011.
- **Verify**: merge to main deploys to dev with no local `pac` command; a normal run leaves data untouched; `migrate_data=true` upserts without duplicates; a prod promotion waits for reviewer approval.
