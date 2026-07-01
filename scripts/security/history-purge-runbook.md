# History Purge & Rotation Runbook

**One-time procedure.** Run this before the repository is made public, and before pushing to any
new GitHub remote. See spec.md FR-018–FR-019 and quickstart.md V8 for the requirements this
satisfies.

## What's being purged

Currently tracked in git history (as of the `003-github-actions-cicd` branch):

| Path | What it is | Sensitivity |
|---|---|---|
| `localhost-key.pem` | Self-signed TLS private key for the local Vite dev server | Low real-world risk (localhost-only dev cert), but a private key must never sit in a public repo |
| `localhost.pem` | Matching self-signed cert | Low risk, paired with the key above |
| `power.config.json` (historical versions) | Contains real `environmentId` and `appId` GUIDs for the MedTrack Power Platform environment | Identifiers, not credentials — but per FR-020 must not be discoverable in a public repo |

**Note**: no Power Platform service-principal client secret has ever been committed to this repo.
"Rotation" in FR-019 is a precaution for *whatever turns out to have been exposed*; based on this
audit, there is no PP client secret to rotate — only the dev TLS cert (regenerate, don't reuse) and
the identifiers above (already externalized by `power.config.template.json` +
`scripts/ci/render-power-config.ps1`, see T013/T014). If a future audit finds an actual PP secret in
history, rotate it via the Power Platform admin center / Entra ID app registration before proceeding.

## Prerequisites

- `git-filter-repo` installed: `brew install git-filter-repo` (macOS) or `pip install git-filter-repo`.
- Coordinate with every collaborator: after the rewrite, **all existing clones become invalid**.
  Everyone must re-clone (not `git pull`) after the force-push.
- Take a backup mirror first (see Step 1) in case anything needs to be recovered.

## Steps

1. **Backup mirror** (safety net, do this first):
   ```bash
   cd /path/to
   git clone --mirror <this-repo-url> medtrack-backup-mirror.git
   ```

2. **Run git-filter-repo** to strip the sensitive paths from all history:
   ```bash
   cd medtrackcodeapp
   git filter-repo --invert-paths \
     --path localhost-key.pem \
     --path localhost.pem \
     --path power.config.json
   ```
   `git filter-repo` requires a fresh clone or `--force` on a repo with an existing remote; follow
   its prompts. This rewrites every commit that touched those paths, including `initial commit`
   (`bc0932b`) and `fix for running locally` (`697ccb5`).

3. **Verify the purge** before pushing anywhere:
   ```bash
   git log --all --oneline -- localhost-key.pem localhost.pem power.config.json
   # Expect: no output
   git log --all -p | grep -E "environmentId|appId" | grep -v "__ENVIRONMENT_ID__\|__APP_ID__"
   # Expect: no output (only the template placeholders should remain)
   ```

4. **Re-add the remote** (git-filter-repo removes it as a safety measure) and force-push:
   ```bash
   git remote add origin <new-github-remote-url>
   git push origin --force --all
   git push origin --force --tags
   ```
   Only do this **after** the new GitHub repo exists and is still private/unpublished, so the
   rewritten history is what the public first sees — never push the un-purged history first.

5. **Notify all collaborators** to delete their local clones and re-clone fresh. Any old clone
   still contains the purged secrets in its local `.git` history.

6. **Regenerate local dev certs** on each developer machine (they're gitignored now, see T015/T016):
   ```bash
   # Example using mkcert (or any equivalent local CA tool):
   mkcert -install
   mkcert -key-file localhost-key.pem -cert-file localhost.pem localhost
   ```

7. **Rotate anything real found in step 3.** If the grep in step 3 turns up an actual credential
   (not just the identifiers already known here), rotate/regenerate it via the Power Platform
   admin center before making the repo public.

## Verification (quickstart.md V8)

```bash
gitleaks detect --source . --log-opts="--all"
```
Expect zero findings across the entire (rewritten) history.
