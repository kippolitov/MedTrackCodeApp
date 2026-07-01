# Opt-in operational data migration

`ppa_medication.json` and `ppa_intakelog.json` are plain-JSON record sets migrated between Power
Platform environments by `scripts/deploy/migrate-data.ps1` via the Dataverse Web API. It is
**never run automatically**.

`pac data import`/`export` (Configuration Migration) do not exist in the PAC CLI — the only
related tool, `pac tool CMT`, is a Windows GUI executable with no headless mode, so it can't run
on a GitHub-hosted Linux runner. `migrate-data.ps1` replaces that mechanism with a self-contained
Web API upsert.

## Alternate keys

Both alternate keys (`ppa_medication` on `ppa_name`; `ppa_intakelog` on `ppa_medication` +
`ppa_scheduledfor`) already exist and are Active in Dataverse (created 2026-07-01, tracked in
`solution/src/`), so the migration script upserts by key instead of creating duplicates on re-run.
Because Dataverse GUIDs aren't stable across environments, `ppa_intakelog.json` references its
medication by name (`medicationName`) rather than by GUID — the script resolves that name to the
medication's GUID (upserted in the same run) before addressing the intake log's composite key.

## Triggering a migration

Data migration only runs when explicitly requested on a manual workflow run:

1. Go to **Actions → Deploy to Dev** (or **Promote to Production**) → **Run workflow**.
2. Set `migrate_data` to `true`.
3. Run. The workflow's `Migrate operational data (opt-in)` step runs only for that invocation —
   routine push-triggered deploys never touch existing records (FR-016).

Migration output is intentionally quiet: only aggregate success/failure and record counts are
logged, never individual field values (medication names, timestamps, notes), per FR-016.
