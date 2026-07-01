# Contract: CI Validation Workflow (`ci.yml`)

The PR/main quality gate. This is the required status check for branch protection.

## Triggers
- `pull_request` targeting `main`
- `push` to `main`

## Inputs
- Repository source at the triggering ref. **No environment secrets** (must run safely for fork PRs — FR-012).

## Job: `ci` (single aggregating job, `runs-on: ubuntu-latest`)

| Step | Command | Contract |
|---|---|---|
| Checkout | `actions/checkout@v4` | Full fetch depth not required for CI. |
| Setup Node | `actions/setup-node@v4` (node 20, `cache: npm`) | npm cache restored to keep run < 10 min (SC-002). |
| Install | `npm ci` | Fails the run on lockfile mismatch. |
| Lint | `npm run lint` | Zero errors required (Constitution I). |
| Type-check + build | `npm run build:ci` | New script = `tsc -b && vite build` (NO `pac code push`). Zero errors required. |
| Test | `npm run test` | `vitest run`; any failure fails the gate (Constitution II). |
| Secret scan | `gitleaks` action | Fails on any detected key/token/credential (FR-021, SC-010). |
| Workflow lint | `actionlint` | Validates all `.github/workflows/*.yml`. |

## Outputs / Guarantees
- **Single pass/fail status** reported to the PR (FR-002).
- Failure clearly identifies the failing step (FR-003).
- On success from a `push` to `main`, a build artifact is produced/available for the deploy workflow (FR-004). (Artifact may be rebuilt in the deploy workflow or uploaded here via `actions/upload-artifact` — decided at task time.)
- Never deploys and never consumes deployment secrets.

## Acceptance (maps to spec)
- US1 scenarios 1–3; SC-001, SC-002, SC-010.
- **Verify**: a PR with a failing test OR a planted fake secret fails `ci`; a clean PR passes.

## Required repo change
- Add `build:ci` script to `package.json`. Leave existing `build` (with `pac code push`) for local use or remove its push side-effect (task-time decision).
