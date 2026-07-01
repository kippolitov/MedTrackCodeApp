#Requires -Version 7.0
<#
Opt-in operational data migration (US3, FR-016): idempotent upsert of
ppa_medication / ppa_intakelog records from data/*.json into the target
Dataverse environment via the Web API. Invoked only when migrate_data=true
(deploy.reusable.yml). Never logs record field values — only aggregate
counts per entity, per FR-016.

`pac data import`/`pac data export` do not exist in the PAC CLI (verified
against v2.7.4 — the only related tool is `pac tool CMT`, a Windows GUI
executable that cannot run headlessly on a GitHub-hosted Linux runner).
This script replaces that non-existent step with a small, self-contained
Web API upsert. It authenticates independently via OAuth client-credentials
rather than depending on `pac auth create`'s CLI profile, since that profile
is not reliably present across steps (see auth.ps1's ordering note).

Medications upsert by the `ppa_name` alternate key. Intake logs upsert by
the composite `ppa_scheduledfor` + medication-lookup alternate key; because
Dataverse GUIDs are not stable across environments, data/ppa_intakelog.json
references its medication by name (`medicationName`), which this script
resolves to the just-upserted medication's GUID before addressing the
lookup half of the composite key (`_ppa_medication_value`).

Required environment variables:
  PP_CLIENT_ID       Service principal application (client) ID
  PP_CLIENT_SECRET   Service principal client secret
  PP_TENANT_ID       Entra tenant ID
  PP_ENVIRONMENT_URL Target Power Platform environment URL
#>

$ErrorActionPreference = 'Stop'

$required = @('PP_CLIENT_ID', 'PP_CLIENT_SECRET', 'PP_TENANT_ID', 'PP_ENVIRONMENT_URL')
$missing = $required | Where-Object { [string]::IsNullOrWhiteSpace((Get-Item -Path "env:$_" -ErrorAction SilentlyContinue).Value) }
if ($missing.Count -gt 0) {
    throw "Missing required Power Platform environment variable(s): $($missing -join ', ')."
}

$envUrl = $env:PP_ENVIRONMENT_URL.TrimEnd('/')
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '../..')
$dataDir = Join-Path $repoRoot 'data'
$apiBase = "$envUrl/api/data/v9.2"

Write-Host "Acquiring Dataverse access token for $envUrl..."
$tokenResponse = Invoke-RestMethod -Method Post `
    -Uri "https://login.microsoftonline.com/$($env:PP_TENANT_ID)/oauth2/v2.0/token" `
    -ContentType 'application/x-www-form-urlencoded' `
    -Body @{
        grant_type    = 'client_credentials'
        client_id     = $env:PP_CLIENT_ID
        client_secret = $env:PP_CLIENT_SECRET
        scope         = "$envUrl/.default"
    }

$headers = @{
    Authorization   = "Bearer $($tokenResponse.access_token)"
    'OData-Version' = '4.0'
    Accept          = 'application/json'
}
$writeHeaders = $headers + @{
    'Content-Type' = 'application/json; charset=utf-8'
    Prefer         = 'return=representation'
}

function Read-DataFile {
    param([string]$FileName)
    $path = Join-Path $dataDir $FileName
    if (-not (Test-Path $path)) { return @() }
    $content = Get-Content $path -Raw | ConvertFrom-Json
    if ($null -eq $content) { return @() }
    return @($content)
}

function ConvertTo-PlainHashtable {
    param($Object, [string[]]$Exclude = @())
    $table = @{}
    foreach ($prop in $Object.PSObject.Properties) {
        if ($Exclude -notcontains $prop.Name) { $table[$prop.Name] = $prop.Value }
    }
    return $table
}

# Surfaces the HTTP status + Dataverse error code/message from a failed request —
# operational diagnostics only, never the record payload that was sent (FR-016).
function Get-SafeErrorReason {
    param($ErrorRecord)
    $status = $ErrorRecord.Exception.Response.StatusCode
    $reason = $ErrorRecord.Exception.Message
    if ($ErrorRecord.ErrorDetails.Message) {
        try {
            $parsed = $ErrorRecord.ErrorDetails.Message | ConvertFrom-Json
            if ($parsed.error.message) { $reason = $parsed.error.message }
        } catch {
            # Response body wasn't JSON; fall back to the exception message.
        }
    }
    return "[$status] $reason"
}

# --- Medications: upsert by the ppa_name alternate key ---
$medications = Read-DataFile 'ppa_medication.json'
$medIdByName = @{}
$medSuccess = 0
$medFailure = 0

for ($i = 0; $i -lt $medications.Count; $i++) {
    $med = $medications[$i]
    $encodedName = [uri]::EscapeDataString($med.ppa_name)
    $uri = "$apiBase/ppa_medications(ppa_name='$encodedName')"
    $body = ConvertTo-PlainHashtable -Object $med | ConvertTo-Json -Depth 5 -Compress
    try {
        $result = Invoke-RestMethod -Method Patch -Uri $uri -Headers $writeHeaders -Body $body
        $medIdByName[$med.ppa_name] = $result.ppa_medicationid
        $medSuccess++
    } catch {
        $medFailure++
        Write-Host "Medication record #$i failed: $(Get-SafeErrorReason $_)"
    }
}
Write-Host "Medications: $medSuccess upserted, $medFailure failed (of $($medications.Count))"

# --- Intake logs: upsert by the (ppa_scheduledfor, medication) composite alternate key ---
$intakeLogs = Read-DataFile 'ppa_intakelog.json'
$logSuccess = 0
$logFailure = 0
$logSkipped = 0

for ($i = 0; $i -lt $intakeLogs.Count; $i++) {
    $log = $intakeLogs[$i]
    $medicationId = $medIdByName[$log.medicationName]
    if (-not $medicationId) {
        $logSkipped++
        continue
    }
    $uri = "$apiBase/ppa_intakelogs(ppa_scheduledfor=$($log.ppa_scheduledfor),_ppa_medication_value=$medicationId)"
    $body = ConvertTo-PlainHashtable -Object $log -Exclude @('medicationName', 'ppa_scheduledfor') | ConvertTo-Json -Depth 5 -Compress
    try {
        Invoke-RestMethod -Method Patch -Uri $uri -Headers $writeHeaders -Body $body | Out-Null
        $logSuccess++
    } catch {
        $logFailure++
        Write-Host "Intake log record #$i failed: $(Get-SafeErrorReason $_)"
    }
}
Write-Host "Intake logs: $logSuccess upserted, $logFailure failed, $logSkipped skipped - unresolved medication (of $($intakeLogs.Count))"

if ($medFailure -gt 0 -or $logFailure -gt 0) {
    throw "Data migration completed with failures: $medFailure medication record(s), $logFailure intake log record(s). See counts above (record contents are never logged, per FR-016)."
}

Write-Host "Data migration completed successfully."
