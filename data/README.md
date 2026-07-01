# Opt-in operational data migration

`data-schema.xml` is a Configuration Migration schema for migrating `ppa_medication` and
`ppa_intakelog` records between Power Platform environments. It is **never run automatically**.

## Alternate keys

Both alternate keys (`ppa_medication` on `ppa_name`; `ppa_intakelog` on `ppa_medication` +
`ppa_scheduledfor`) already exist and are Active in Dataverse (created 2026-07-01, tracked in
`solution/src/`), so `pac data import` upserts by key instead of creating duplicates on re-run.

## Triggering a migration

Data migration only runs when explicitly requested on a manual workflow run:

1. Go to **Actions → Deploy to Dev** (or **Promote to Production**) → **Run workflow**.
2. Set `migrate_data` to `true`.
3. Run. The workflow's `pac data import` step runs only for that invocation — routine
   push-triggered deploys never touch existing records (FR-016).

Migration output is intentionally quiet: only aggregate success/failure and record counts are
logged, never individual field values (medication names, timestamps, notes), per FR-016.
