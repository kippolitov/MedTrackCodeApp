# Dataverse solution (source-controlled schema)

**Status: not yet populated.** This directory is where the unpacked Dataverse solution
(`ppa_medication`, `ppa_intakelog` and their relationships) belongs, per
specs/003-github-actions-cicd/plan.md and tasks.md T031–T033.

Populating `solution/src/` requires the Power Platform CLI (`pac`) and an authenticated
connection to a Dataverse environment — neither is available in this working copy, so this step
could not be completed here. It is not safe to hand-write placeholder solution XML: Dataverse
solution files are Dataverse-generated exports, and fabricated ones would not import correctly and
could mislead a future deploy.

## To complete T031–T033 (do this with real `pac` access)

```bash
# 1. Install pac CLI if not already present:
dotnet tool install --global Microsoft.PowerApps.CLI.Tool
# or: pac install latest  (if pac is already on PATH)

# 2. Authenticate to the dev environment (interactive is fine for this one-time export):
pac auth create --environment https://<your-dev-org>.crm.dynamics.com

# 3. Export the solution containing ppa_medication and ppa_intakelog
#    (create it first in the maker portal if it doesn't exist yet, add both tables to it):
pac solution export --name MedTrackCore --path ./MedTrackCore.zip --managed false

# 4. Unpack it into this directory:
pac solution unpack --zipfile ./MedTrackCore.zip --folder ./solution/src --packagetype Unmanaged

# 5. Add the alternate keys needed for idempotent data migration (T032/T033) —
#    either via the maker portal (Table → Keys → Add alternate key) then re-export/unpack,
#    or by hand-editing the relevant Entity.xml under solution/src/ if you're comfortable
#    with the raw solution format. See data/README.md for the exact keys needed.

# 6. Commit the resulting solution/src/ contents.
```

Once populated, `.github/workflows/deploy.reusable.yml` already references `solution/src/` for
`pac solution pack` — no workflow changes are needed after this step.
