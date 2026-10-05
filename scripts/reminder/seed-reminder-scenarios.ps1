#Requires -Version 7.0
<#
.SYNOPSIS
  Seeds the schedule decision table (S01-S33) into a Dataverse environment so
  the "MedTrack – Daily Reminder" flow can be checked against it.

.DESCRIPTION
  Local developer use against the dev environment -- not for CI. Authenticates
  via `az account get-access-token` (the signed-in user), so the rows belong to
  that user, which is what the flow's owner filter expects.

  Reads tests/fixtures/schedule-cases.json -- the same file the Vitest suite
  uses -- and creates one Medication per case, named "<id> <label>", with its
  Intake Logs. Every offset in the file is resolved against today's local
  date, so today plays the part of "Mon 5 Oct" in
  specs/004-schedule-page-reminders/contracts/schedule-rules.contract.md.

  Idempotent: the script first deletes the rows it created on an earlier run
  (Medications whose name is exactly a case name, and their Intake Logs), then
  creates them again. Nothing else in the environment is touched.

  Run it on the day the flow is tested: the dates are fixed when the rows are
  created, so rows seeded yesterday no longer match the table today.

.PARAMETER EnvironmentUrl
  Power Platform environment URL. Defaults to MedTrackDev.

.PARAMETER TimeZone
  Time zone that defines "today" (Windows or IANA name). Defaults to this
  machine's zone. It must be the zone held in ppa_ReminderTimeZone, or the
  flow and the seed will disagree about what day it is.

.PARAMETER Remove
  Delete the seeded rows and stop.

.PARAMETER AllowNonDev
  Required to seed any environment other than the default one. The seed adds
  33 test Medications, and the daily reminder would email them.

.EXAMPLE
  pwsh scripts/reminder/seed-reminder-scenarios.ps1
  pwsh scripts/reminder/seed-reminder-scenarios.ps1 -Remove
#>
param(
    [string]$EnvironmentUrl = 'https://org9c89b427.crm.dynamics.com',
    [string]$TimeZone,
    [switch]$Remove,
    [switch]$AllowNonDev
)

$ErrorActionPreference = 'Stop'
$devUrl      = 'https://org9c89b427.crm.dynamics.com'
$envUrl      = $EnvironmentUrl.TrimEnd('/')
if (-not $Remove -and $envUrl -ne $devUrl -and -not $AllowNonDev) {
    throw "Refusing to seed ${envUrl}: it is not the dev environment. Pass -AllowNonDev if this is intended."
}
$apiBase     = "$envUrl/api/data/v9.2"
$repoRoot    = Resolve-Path (Join-Path $PSScriptRoot '../..')
$fixturePath = Join-Path $repoRoot 'tests/fixtures/schedule-cases.json'

if (-not (Test-Path $fixturePath)) {
    throw "Fixture not found at $fixturePath"
}
$cases = @((Get-Content $fixturePath -Raw | ConvertFrom-Json).cases)

Write-Host ""
Write-Host "MedTrack reminder scenarios → $envUrl"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Auth ─────────────────────────────────────────────────────────────────────
Write-Host "→ Acquiring access token (az account get-access-token)..."
$token = az account get-access-token --resource "$envUrl/" --query accessToken -o tsv 2>&1
if (-not $token -or $token -like '*ERROR*') {
    throw "Token acquisition failed. Run 'az login' and try again. Detail: $token"
}

$headers = @{
    Authorization   = "Bearer $token"
    'OData-Version' = '4.0'
    Accept          = 'application/json'
    'Content-Type'  = 'application/json; charset=utf-8'
    Prefer          = 'return=representation'
}

function Invoke-DV {
    param([string]$Method, [string]$Uri, [hashtable]$Body = $null)
    $p = @{ Method = $Method; Uri = $Uri; Headers = $headers }
    if ($Body) { $p.Body = ($Body | ConvertTo-Json -Depth 5 -Compress) }
    return Invoke-RestMethod @p
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

# ── Option set constants (matches src/generated/models/) ─────────────────────
$Freq   = @{ Daily = 894250000; Weekly = 894250001; Biweekly = 894250002; AsNeeded = 894250003 }
$Method = @{ Pill = 894250000; Injection = 894250001 }
$Status = @{ Taken = 894250000; Skipped = 894250001; Missed = 894250002 }
# ppa_scheduledday by .NET DayOfWeek (Sunday = 0)
$DayEnum = @(894250006, 894250000, 894250001, 894250002, 894250003, 894250004, 894250005)

# ── Today, in the reminder's time zone ───────────────────────────────────────
$zone     = if ($TimeZone) { [TimeZoneInfo]::FindSystemTimeZoneById($TimeZone) } else { [TimeZoneInfo]::Local }
$nowUtc   = [DateTime]::UtcNow
$today    = [TimeZoneInfo]::ConvertTimeFromUtc($nowUtc, $zone).Date
Write-Host "→ Today is $($today.ToString('yyyy-MM-dd')) ($($today.DayOfWeek)) in $($zone.Id)"

# A local wall-clock time on today + offset, as a UTC instant.
function Get-UtcInstant {
    param([int]$DayOffset, [string]$Time)
    $local = [DateTime]::SpecifyKind($today.AddDays($DayOffset).Add([TimeSpan]::Parse($Time)), [DateTimeKind]::Unspecified)
    return [TimeZoneInfo]::ConvertTimeToUtc($local, $zone)
}

function Format-Utc {
    param([DateTime]$Instant)
    return $Instant.ToString('yyyy-MM-ddTHH:mm:ssZ')
}

$caseNames = @{}
foreach ($case in $cases) { $caseNames["$($case.id) $($case.label)"] = $true }

# ── 1. Remove rows from an earlier run ───────────────────────────────────────
Write-Host "→ Removing rows from an earlier run..."
$removedMeds = 0
$removedLogs = 0
$existing = Invoke-DV -Method Get -Uri ("$apiBase/ppa_medications?" + '$select=ppa_medicationid,ppa_name')
foreach ($med in @($existing.value | Where-Object { $caseNames.ContainsKey($_.ppa_name) })) {
    # Intake Logs first: a Medication with logs cannot be deleted.
    $logs = Invoke-DV -Method Get -Uri ("$apiBase/ppa_intakelogs?" + '$select=ppa_intakelogid&$filter=' + "_ppa_medication_value eq $($med.ppa_medicationid)")
    foreach ($log in @($logs.value)) {
        Invoke-DV -Method Delete -Uri "$apiBase/ppa_intakelogs($($log.ppa_intakelogid))" | Out-Null
        $removedLogs++
    }
    Invoke-DV -Method Delete -Uri "$apiBase/ppa_medications($($med.ppa_medicationid))" | Out-Null
    $removedMeds++
}
Write-Host "  ✓ removed $removedMeds medications and $removedLogs intake logs"

if ($Remove) {
    Write-Host ""
    Write-Host "✓  Seeded rows removed."
    Write-Host ""
    return
}

# ── 2. Navigation property for the Intake Log → Medication lookup ────────────
# Read from metadata rather than assumed: @odata.bind fails on the wrong case.
$relationships = Invoke-DV -Method Get -Uri ("$apiBase/EntityDefinitions(LogicalName='ppa_intakelog')/ManyToOneRelationships?" + '$select=ReferencingAttribute,ReferencingEntityNavigationPropertyName')
$medicationNav = ($relationships.value | Where-Object { $_.ReferencingAttribute -eq 'ppa_medication' }).ReferencingEntityNavigationPropertyName
if (-not $medicationNav) {
    throw "Could not find the navigation property for ppa_intakelog.ppa_medication."
}

# ── 3. Create Medications and Intake Logs ────────────────────────────────────
Write-Host "→ Creating $($cases.Count) medications..."
$medCount   = 0
$logCount   = 0
$failures   = 0

foreach ($case in $cases) {
    $name        = "$($case.id) $($case.label)"
    $isInjection = $case.method -eq 'Injection'

    # Every POST carries the primary name column (ppa_name).
    $body = @{
        ppa_name         = $name
        ppa_dosage       = '1 unit'
        ppa_frequency    = $Freq[$case.frequency]
        ppa_method       = $Method[$case.method]
        ppa_isactive     = [bool]$case.active
        ppa_remindertime = if ($isInjection) { '21:00' } else { '08:00' }
    }
    if ($null -ne $case.scheduledDayOffset) {
        $body.ppa_scheduledday = $DayEnum[[int]$today.AddDays($case.scheduledDayOffset).DayOfWeek]
    }
    if ($null -ne $case.startDateOffset) {
        # Date-only column: the calendar date as text, never a UTC instant.
        $body.ppa_startdate = $today.AddDays($case.startDateOffset).ToString('yyyy-MM-dd')
    }
    if ($case.createdOffset -lt 0) {
        # createdon is the schedule anchor when no start date is set, so a row
        # "created on 1 Sep" must really carry that created date.
        $body.overriddencreatedon = Format-Utc (Get-UtcInstant -DayOffset $case.createdOffset -Time '12:00')
    }

    try {
        $created = Invoke-DV -Method Post -Uri "$apiBase/ppa_medications" -Body $body
        $medCount++
    } catch {
        $failures++
        Write-Host "  ✗ $name — $(Get-DVErrorReason $_)"
        continue
    }

    foreach ($log in @($case.logs)) {
        $instant = Get-UtcInstant -DayOffset $log.dayOffset -Time $log.time
        # A log "today at 07:00" must already have happened when the flow runs.
        if ($log.dayOffset -eq 0 -and $instant -gt $nowUtc) {
            $instant = $nowUtc.AddMinutes(-1)
            if ([TimeZoneInfo]::ConvertTimeFromUtc($instant, $zone).Date -ne $today) {
                Write-Host "  ⚠ $name — too close to midnight to place a log earlier today; re-run in a few minutes"
            }
        }
        $stamp   = Format-Utc $instant
        $logBody = @{
            ppa_logname               = $name
            ppa_loggedat              = $stamp
            ppa_scheduledfor          = $stamp
            ppa_status                = $Status[$log.status]
            "$medicationNav@odata.bind" = "/ppa_medications($($created.ppa_medicationid))"
        }
        if ($null -ne $log.site) { $logBody.ppa_injectionsite = [int]$log.site }

        try {
            Invoke-DV -Method Post -Uri "$apiBase/ppa_intakelogs" -Body $logBody | Out-Null
            $logCount++
        } catch {
            $failures++
            Write-Host "  ✗ $name log ($($log.status), day $($log.dayOffset)) — $(Get-DVErrorReason $_)"
        }
    }
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
$icon = if ($failures -eq 0) { '✓' } else { '⚠' }
Write-Host "$icon  Medications : $medCount created (of $($cases.Count))"
Write-Host "$icon  Intake logs : $logCount created"
Write-Host ""
Write-Host "   Next: delete today's Reminder Run if one exists, test the flow,"
Write-Host "   then run scripts/reminder/assert-reminder-run.ps1."
Write-Host ""

if ($failures -gt 0) {
    throw "Seed completed with $failures failure(s) — see output above."
}
