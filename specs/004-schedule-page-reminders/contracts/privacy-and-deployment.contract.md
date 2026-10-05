# Contract: Reminder Privacy & Deployment

How the reminder is kept free of personal addresses and environment identifiers in this
public repository, and how the flow and its configuration move through the existing
pipeline. Covers FR-028 to FR-031, SC-011, SC-012, and extends
[specs/003-github-actions-cicd/contracts/secrets-and-environments.contract.md](../../003-github-actions-cicd/contracts/secrets-and-environments.contract.md).

**Changed 2026-10-05**: the reminder is a Microsoft Teams message, not an email
(research R7). It goes to the user behind the Dataverse connection, read from Dataverse at
run time. There is therefore **no reminder address to store**: the environment variable
`ppa_ReminderRecipientEmail` and `scripts/reminder/set-reminder-recipient.ps1` are gone.
The repository rules and automated checks below stay, because they also keep environment
values and any other address out.

## Where each piece of configuration lives

| Item | Lives in | Reaches the repository? | Reaches GitHub? |
|---|---|---|---|
| Who is notified | Nowhere: the flow looks up the Dataverse connection's own user on each run | No | No |
| Time zone | GitHub Environment variable `REMINDER_TIME_ZONE` → deployment settings → environment variable value | No | Yes (not public) |
| App link | Built from GitHub Environment variables `PP_ENVIRONMENT_ID` and `PP_APP_ID` → deployment settings → value of `ppa_MedTrackAppUrl` | No | Yes (not public) |
| `ppa_ReminderTimeZone`, `ppa_MedTrackAppUrl` definitions (defaults `UTC`, `not-configured`) | `solution/src` | Yes — names and defaults only | Yes |
| Connection ids | GitHub Environment variables `PP_CONN_DATAVERSE_ID`, `PP_CONN_TEAMS_ID` | No | Yes (not public) |
| Connections (credentials) | Created by the owner in each environment | No | No |

GitHub Environment variables are set separately for `dev` and `production`.

## Repository rules

1. `solution/src` contains no `environmentvariablevalues.json` file.
2. No committed file contains an email address outside the allowlist: `example.com`,
   `example.org`, `users.noreply.github.com`, and the commit co-author `noreply` address.
   OData annotations (`…@odata.bind`, `@OData.…`, `@Microsoft.…`) and `git@github.com` are
   not email addresses and are excluded from the pattern.
3. Documentation, tests, seed data and examples use `reminder@example.com`.
4. `solution/deployment-settings.json` (rendered) is git-ignored; only
   `solution/deployment-settings.template.json` with `__PLACEHOLDER__` tokens is committed.
5. No personal address is written in commit messages, branch names, issues or pull
   requests. No tool enforces this rule.

## Run history

- The step that looks up the user (`Me`) has Secure Outputs on; the step that posts the
  message (`SendReminder`) has Secure Inputs and Secure Outputs on. The account name and
  the Medication names in the message cannot be opened from run history.
- The Reminder Run row stores Medication names in `ppa_Summary` (by design, FR-020) and
  never an address.

## Automated checks

| Check | Where it runs | Fails when |
|---|---|---|
| gitleaks rule `email-address` | `ci.yml`, every pull request | A non-allowlisted email address is committed |
| `scripts/ci/assert-no-envvar-values.ps1 -Path solution/src` | `ci.yml`, every pull request | Rule 1 or 2 is broken inside the solution source |
| `scripts/ci/assert-no-envvar-values.ps1 -Zip out/MedTrackCore_managed.zip` | `promote-prod.yml`, after export and **before** the artifact upload | The exported zip contains an environment variable value file or a non-allowlisted email address |

The third check stops the only automated step that publishes solution content from
publishing an environment's values (time zone, app link) or an address.

## Deployment changes

### One-time setup per environment (owner)

1. Create a Microsoft Dataverse connection and a Microsoft Teams connection, both signed
   in as the owner.
2. Share each with the deployment service principal, permission "Can use".
3. Record the two connection ids and the time zone as GitHub Environment variables.
4. After the first deploy, open the flow's Details page and confirm it is not reported as
   unlicensed. The service principal owns the flow and the Dataverse connector is premium;
   see research R10 for what to do if it is flagged.
5. Install Microsoft Teams on the phone, signed in with the same account.

### `deploy.reusable.yml` (dev)

- Before **Import solution**: render `solution/deployment-settings.json` from the template
  with `scripts/ci/render-deployment-settings.ps1`.
- **Import solution**: pass the rendered file as the deployment settings file.
- After **Publish solution customizations**: run
  `scripts/deploy/configure-reminder-flow.ps1` to confirm the flow is owned by the service
  principal and turned on.

### `promote-prod.yml` (production)

- `sync-dev-and-export`: same render and settings file on the dev re-import; then the zip
  check before **Upload managed solution artifact**.
- `deploy-production`: render with the production variables, import the managed zip with
  the settings file, then `configure-reminder-flow.ps1`.

### Script contracts

| Script | Inputs (environment) | Behaviour |
|---|---|---|
| `scripts/ci/render-deployment-settings.ps1` | `PP_CONN_DATAVERSE_ID`, `PP_CONN_TEAMS_ID`, `REMINDER_TIME_ZONE`, `PP_ENVIRONMENT_ID`, `PP_APP_ID` | Writes `solution/deployment-settings.json`. Fails if any input is missing. Prints no values |
| `scripts/ci/assert-no-envvar-values.ps1` | `-Path` or `-Zip` | Exit 1 with the offending file **path** only — never the matched text |
| `scripts/deploy/configure-reminder-flow.ps1` | `PP_*` service principal credentials, `PP_ENVIRONMENT_URL` | Idempotent. Finds the flow by its unique name, checks the service principal owns it, turns it on if it is off. Changes no ownership. Fails loudly if the flow is missing or cannot be turned on |

All three follow the repository convention: PowerShell 7, a fresh token per run, no secrets
echoed, non-zero exit on failure.

## Acceptance

| Spec item | Check |
|---|---|
| FR-028, SC-011 | `gitleaks git` over full history returns no email-address findings; the latest `promote-prod` artifact contains no environment variable value and no address |
| FR-029, SC-012 | Superseded: there is no address to change. A different person is notified by changing whose Dataverse connection the flow uses |
| FR-030 | Planted-address test: a branch that adds a real-looking address to a doc fails CI |
| FR-031 | README and quickstart.md describe the setup, with `reminder@example.com` as the only example address anywhere |
| Artifact path | Temporarily add a value to `MedTrackSolution` in dev → `promote-prod` fails at the zip check and uploads nothing; then remove it |
