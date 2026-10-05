#Requires -Version 7.0
<#
.SYNOPSIS
  Creates the Dataverse components the daily email reminder needs, inside
  MedTrackSolution, using the current Azure CLI user session.

.DESCRIPTION
  Local developer use against the dev environment -- not for CI. Other
  environments receive these components through the solution import in the
  pipeline. Idempotent: every component is looked up first and created only
  when it is missing, so the script is safe to re-run.

  What gets created (specs/004-schedule-page-reminders/data-model.md):
    Table                 ppa_ReminderRun (user-owned; notes, activities and
                          auditing off), its columns and the alternate key
                          ppa_reminderrun_date on ppa_name
    Environment variables ppa_ReminderRecipientEmail (definition only -- no
                          default and no value), ppa_ReminderTimeZone
                          (default UTC)
    Connection references ppa_MedTrackDataverse, ppa_MedTrackMail

  Table name, column types and ownership type are permanent in Dataverse.

  The reminder address itself is never handled here. Set it per environment
  with scripts/reminder/set-reminder-recipient.ps1.

.PARAMETER EnvironmentUrl
  Power Platform environment URL. Defaults to MedTrackDev.

.EXAMPLE
  pwsh scripts/reminder/create-reminder-schema.ps1
#>
param(
    [string]$EnvironmentUrl = 'https://org9c89b427.crm.dynamics.com'
)

$ErrorActionPreference = 'Stop'
$envUrl       = $EnvironmentUrl.TrimEnd('/')
$apiBase      = "$envUrl/api/data/v9.2"
$solutionName = 'MedTrackSolution'
$tableLogical = 'ppa_reminderrun'

Write-Host ""
Write-Host "MedTrack reminder schema → $envUrl"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Auth ─────────────────────────────────────────────────────────────────────
Write-Host "→ Acquiring access token (az account get-access-token)..."
$token = az account get-access-token --resource "$envUrl/" --query accessToken -o tsv 2>&1
if (-not $token -or $token -like '*ERROR*') {
    throw "Token acquisition failed. Run 'az login' and try again. Detail: $token"
}

$readHeaders = @{
    Authorization   = "Bearer $token"
    'OData-Version' = '4.0'
    Accept          = 'application/json'
}
# Every component is created as part of MedTrackSolution.
$writeHeaders = $readHeaders + @{
    'Content-Type'             = 'application/json; charset=utf-8'
    'MSCRM.SolutionUniqueName' = $solutionName
}

function Get-DVErrorReason {
    param($ErrorRecord)
    $reason = $ErrorRecord.Exception.Message
    if ($ErrorRecord.ErrorDetails.Message) {
        try {
            $parsed = $ErrorRecord.ErrorDetails.Message | ConvertFrom-Json
            if ($parsed.error.message) { $reason = $parsed.error.message }
        } catch {
            # Response body wasn't JSON; fall back to the exception message.
        }
    }
    return $reason
}

# GET that returns $null on 404 instead of throwing.
function Get-DVOrNull {
    param([string]$Uri)
    try {
        return Invoke-RestMethod -Method Get -Uri $Uri -Headers $readHeaders
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 404) { return $null }
        throw "GET $Uri failed: $(Get-DVErrorReason $_)"
    }
}

function New-DV {
    param([string]$Uri, [hashtable]$Body, [string]$What)
    try {
        Invoke-RestMethod -Method Post -Uri $Uri -Headers $writeHeaders -Body ($Body | ConvertTo-Json -Depth 20 -Compress) | Out-Null
    } catch {
        throw "Creating $What failed: $(Get-DVErrorReason $_)"
    }
}

function New-Label {
    param([string]$Text)
    return @{
        '@odata.type'   = 'Microsoft.Dynamics.CRM.Label'
        LocalizedLabels = @(
            @{ '@odata.type' = 'Microsoft.Dynamics.CRM.LocalizedLabel'; Label = $Text; LanguageCode = 1033 }
        )
    }
}

# ── 0. Solution must exist ───────────────────────────────────────────────────
$solution = Get-DVOrNull ("$apiBase/solutions?" + '$select=solutionid&$filter=' + "uniquename eq '$solutionName'")
if (-not $solution -or $solution.value.Count -eq 0) {
    throw "Solution '$solutionName' was not found in $envUrl."
}

# ── 1. Table ─────────────────────────────────────────────────────────────────
$tableUri = "$apiBase/EntityDefinitions(LogicalName='$tableLogical')"
if (Get-DVOrNull ($tableUri + '?$select=MetadataId')) {
    Write-Host "  = table ppa_ReminderRun already exists"
} else {
    Write-Host "→ Creating table ppa_ReminderRun..."
    New-DV -Uri "$apiBase/EntityDefinitions" -What 'table ppa_ReminderRun' -Body @{
        '@odata.type'         = 'Microsoft.Dynamics.CRM.EntityMetadata'
        SchemaName            = 'ppa_ReminderRun'
        DisplayName           = New-Label 'Reminder Run'
        DisplayCollectionName = New-Label 'Reminder Runs'
        Description           = New-Label 'One row per day recording the outcome of the daily reminder check.'
        OwnershipType         = 'UserOwned'
        HasNotes              = $false
        HasActivities         = $false
        IsActivity            = $false
        IsAuditEnabled        = @{ Value = $false }
        Attributes            = @(
            @{
                '@odata.type' = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
                SchemaName    = 'ppa_name'
                DisplayName   = New-Label 'Run Date'
                Description   = New-Label 'The local date of the run, yyyy-MM-dd.'
                IsPrimaryName = $true
                RequiredLevel = @{ Value = 'ApplicationRequired' }
                MaxLength     = 10
                FormatName    = @{ Value = 'Text' }
            }
        )
    }
    Write-Host "  ✓ table ppa_ReminderRun"
}

# ── 2. Columns ───────────────────────────────────────────────────────────────
function New-Option {
    param([int]$Value, [string]$Text)
    return @{ Value = $Value; Label = New-Label $Text }
}

function New-WholeNumber {
    param([string]$SchemaName, [string]$Display, [string]$Description, [int]$Min, [int]$Max)
    return @{
        '@odata.type' = 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata'
        SchemaName    = $SchemaName
        DisplayName   = New-Label $Display
        Description   = New-Label $Description
        RequiredLevel = @{ Value = 'ApplicationRequired' }
        Format        = 'None'
        MinValue      = $Min
        MaxValue      = $Max
    }
}

$columns = @(
    @{
        '@odata.type' = 'Microsoft.Dynamics.CRM.PicklistAttributeMetadata'
        SchemaName    = 'ppa_Outcome'
        DisplayName   = New-Label 'Outcome'
        Description   = New-Label 'What the daily check did.'
        RequiredLevel = @{ Value = 'ApplicationRequired' }
        OptionSet     = @{
            '@odata.type' = 'Microsoft.Dynamics.CRM.OptionSetMetadata'
            IsGlobal      = $false
            OptionSetType = 'Picklist'
            Options       = @(
                (New-Option 894250000 'Started')
                (New-Option 894250001 'Sent')
                (New-Option 894250002 'Nothing To Send')
                (New-Option 894250003 'Failed')
            )
        }
    }
    (New-WholeNumber 'ppa_DueCount' 'Due Count' 'Medications listed as due today.' 0 1000)
    (New-WholeNumber 'ppa_FollowUpCount' 'Follow-up Count' 'Medications listed as follow-ups.' 0 1000)
    @{
        '@odata.type' = 'Microsoft.Dynamics.CRM.MemoAttributeMetadata'
        SchemaName    = 'ppa_Summary'
        DisplayName   = New-Label 'Summary'
        Description   = New-Label 'Names of the Medications listed, in two labelled groups.'
        RequiredLevel = @{ Value = 'None' }
        Format        = 'TextArea'
        MaxLength     = 4000
    }
    @{
        '@odata.type' = 'Microsoft.Dynamics.CRM.StringAttributeMetadata'
        SchemaName    = 'ppa_ErrorStep'
        DisplayName   = New-Label 'Error Step'
        Description   = New-Label 'Name and status code of the step that failed. Never raw error text.'
        RequiredLevel = @{ Value = 'None' }
        MaxLength     = 200
        FormatName    = @{ Value = 'Text' }
    }
    (New-WholeNumber 'ppa_Attempts' 'Attempts' '1 on the first run, plus 1 on each retry after a failure.' 1 24)
)

foreach ($column in $columns) {
    $logical = $column.SchemaName.ToLowerInvariant()
    if (Get-DVOrNull ("$tableUri/Attributes(LogicalName='$logical')" + '?$select=MetadataId')) {
        Write-Host "  = column $($column.SchemaName) already exists"
        continue
    }
    New-DV -Uri "$tableUri/Attributes" -What "column $($column.SchemaName)" -Body $column
    Write-Host "  ✓ column $($column.SchemaName)"
}

# ── 3. Alternate key: one row per day ────────────────────────────────────────
$keyName = 'ppa_reminderrun_date'
function Get-Key {
    $keys = Get-DVOrNull ("$tableUri/Keys" + '?$select=SchemaName,EntityKeyIndexStatus')
    return $keys.value | Where-Object { $_.SchemaName -eq $keyName }
}

if (Get-Key) {
    Write-Host "  = alternate key $keyName already exists"
} else {
    New-DV -Uri "$tableUri/Keys" -What "alternate key $keyName" -Body @{
        SchemaName    = $keyName
        DisplayName   = New-Label 'Run Date'
        KeyAttributes = @('ppa_name')
    }
    Write-Host "  ✓ alternate key $keyName"
}

# The key's index is built asynchronously. The flow's guard relies on it, so
# wait until it is Active rather than reporting success early.
Write-Host "→ Waiting for the alternate key index..."
$keyStatus = $null
for ($i = 0; $i -lt 36; $i++) {
    $keyStatus = (Get-Key).EntityKeyIndexStatus
    if ($keyStatus -eq 'Active') { break }
    if ($keyStatus -eq 'Failed') { throw "Alternate key $keyName failed to build. Check for duplicate ppa_name values." }
    Start-Sleep -Seconds 5
}
if ($keyStatus -ne 'Active') {
    throw "Alternate key $keyName is still '$keyStatus' after 3 minutes. Re-run the script to check again."
}
Write-Host "  ✓ alternate key $keyName is Active"

# ── 4. Environment variable definitions ──────────────────────────────────────
# ppa_ReminderRecipientEmail deliberately has no default value and no current
# value here: the address must never be a component of the solution.
$variables = @(
    @{
        schemaname  = 'ppa_ReminderRecipientEmail'
        displayname = 'Reminder Recipient Email'
        description = 'Address the daily reminder is sent to. Set per environment with scripts/reminder/set-reminder-recipient.ps1; never give it a default value.'
        type        = 100000000
    }
    @{
        schemaname   = 'ppa_ReminderTimeZone'
        displayname  = 'Reminder Time Zone'
        description  = 'Windows time zone name that defines "today" and "midnight" for the daily reminder.'
        type         = 100000000
        defaultvalue = 'UTC'
    }
)

foreach ($variable in $variables) {
    $existing = Get-DVOrNull ("$apiBase/environmentvariabledefinitions?" + '$select=environmentvariabledefinitionid&$filter=' + "schemaname eq '$($variable.schemaname)'")
    if ($existing.value.Count -gt 0) {
        Write-Host "  = environment variable $($variable.schemaname) already exists"
        continue
    }
    New-DV -Uri "$apiBase/environmentvariabledefinitions" -What "environment variable $($variable.schemaname)" -Body $variable
    Write-Host "  ✓ environment variable $($variable.schemaname)"
}

# ── 5. Connection references ─────────────────────────────────────────────────
$connectionReferences = @(
    @{
        connectionreferencelogicalname = 'ppa_MedTrackDataverse'
        connectionreferencedisplayname = 'MedTrack Dataverse'
        description                    = 'The owner''s Dataverse connection used by the daily reminder flow.'
        connectorid                    = '/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps'
    }
    @{
        connectionreferencelogicalname = 'ppa_MedTrackMail'
        connectionreferencedisplayname = 'MedTrack Mail'
        description                    = 'Office 365 Outlook connection used to send the daily reminder.'
        connectorid                    = '/providers/Microsoft.PowerApps/apis/shared_office365'
    }
)

foreach ($reference in $connectionReferences) {
    $name     = $reference.connectionreferencelogicalname
    $existing = Get-DVOrNull ("$apiBase/connectionreferences?" + '$select=connectionreferenceid,connectorid&$filter=' + "connectionreferencelogicalname eq '$name'")
    if ($existing.value.Count -gt 0) {
        $current = $existing.value[0]
        if ($current.connectorid -eq $reference.connectorid) {
            Write-Host "  = connection reference $name already exists"
            continue
        }
        # Created for another connector (the Mail connector, before it was replaced).
        # The old connection stays attached until the owner picks a new one.
        try {
            Invoke-RestMethod -Method Patch -Uri "$apiBase/connectionreferences($($current.connectionreferenceid))" -Headers $writeHeaders -Body (@{
                connectorid = $reference.connectorid
                description = $reference.description
            } | ConvertTo-Json -Compress) | Out-Null
        } catch {
            throw "Could not move connection reference $name to $($reference.connectorid): $(Get-DVErrorReason $_)"
        }
        Write-Host "  ✓ connection reference $name moved to $($reference.connectorid) — pick a connection for it"
        continue
    }
    New-DV -Uri "$apiBase/connectionreferences" -What "connection reference $name" -Body $reference
    Write-Host "  ✓ connection reference $name"
}

# ── 6. Publish ───────────────────────────────────────────────────────────────
Write-Host "→ Publishing..."
try {
    Invoke-RestMethod -Method Post -Uri "$apiBase/PublishXml" -Headers $writeHeaders -Body (@{
        ParameterXml = "<importexportxml><entities><entity>$tableLogical</entity></entities></importexportxml>"
    } | ConvertTo-Json -Compress) | Out-Null
} catch {
    throw "PublishXml failed: $(Get-DVErrorReason $_)"
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
Write-Host "✓  Reminder schema is in place in $solutionName."
Write-Host ""
Write-Host "   Next: the owner creates the two connections and runs"
Write-Host "   scripts/reminder/set-reminder-recipient.ps1 (tasks T028, T029)."
Write-Host ""
