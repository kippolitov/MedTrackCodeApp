# Contract: Secrets, Environments & Repository Hardening

Defines the GitHub configuration and one-time hardening required for a **public** repository.

## GitHub Environments

| Environment | Reviewers (approval gate) | Deploy trigger | Purpose |
|---|---|---|---|
| `dev` | none | auto on push to `main` | Continuous dev/test target (FR-017) |
| `production` | **required reviewers** (release owners) | manual `workflow_dispatch` promotion | Approval-gated prod (FR-014, FR-017) |

Each environment holds the secrets/variables in data-model.md. Values may differ per environment.

## Branch protection on `main`
- Require the `ci` status check to pass before merge (SC-001).
- Require PR review (recommended).
- Optional: require secret-scan/push-protection.

## Repository hardening (one-time, before going public)

### `.gitignore` additions
```
power.config.json
localhost*.pem
*.pfx
*.key
```

### History purge + rotation (runbook: `scripts/security/history-purge-runbook.md`)
1. Backup/mirror the repo.
2. `git filter-repo` to remove `localhost-key.pem`, `localhost.pem`, and prior `power.config.json` values from ALL history (FR-019).
3. Force-push rewritten history; coordinate re-clone with all collaborators.
4. **Rotate** the Power Platform app-registration client secret so any previously exposed value is invalid (FR-019).
5. Regenerate local dev certs (`localhost*.pem`) on each dev machine; never commit.

### Code changes enabling secret-free repo
- `power.config.json` → replaced by committed `power.config.template.json` (placeholders `__ENVIRONMENT_ID__`, `__APP_ID__`); real file rendered at deploy time (FR-020).
- `vite.config.ts` → make the `server.https` block conditional on the presence of `localhost*.pem` (or an env flag) so `npm run dev` works without committed certs.

## Secret-scanning gate
- `gitleaks` step in `ci.yml` (required, blocks merge on detection — FR-021, SC-010) with `.gitleaks.toml` allowlist for known non-secrets.
- Enable GitHub-native secret scanning + push protection on the public repo (defense in depth).

## Acceptance (maps to spec)
- US4 scenarios 1–4; FR-006, FR-011, FR-012, FR-014, FR-018–FR-021; SC-006, SC-009, SC-010.
- **Verify**: full-history scan finds zero secrets/identifiers; a PR adding a fake key is blocked; prod promotion requires reviewer approval; concurrent deploys to one environment queue rather than overlap.
