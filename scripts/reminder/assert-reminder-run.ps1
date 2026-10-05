#Requires -Version 7.0
<#
.SYNOPSIS
  Checks today's Reminder Run row against the outcome and the Medications
  the daily reminder was expected to list.

.DESCRIPTION
  Local developer use -- the acceptance check for the "MedTrack – Daily
  Reminder" flow. Reads the ppa_reminderrun row whose ppa_name is today's
  local date, parses ppa_summary

      Due: <name>; <name>; …
      Follow-up: <name>; <name>; …

  (a group with no entries is written as "–"), and compares the decision-table
  ids at the start of each name ("S01 Daily pill…" → S01) with the expected
  ids. Exits 1 with a diff when anything differs.

  Medications that are not from the seed set (no S<nn> prefix) are reported
  and ignored, so the check also works in an environment that holds other
  Medications. Pass -Strict to fail when any are listed.

.PARAMETER EnvironmentUrl
  Power Platform environment URL. Defaults to MedTrackDev.

.PARAMETER TimeZone
  Time zone that defines "today" (Windows or IANA name). Defaults to this
  machine's zone; must match ppa_ReminderTimeZone.

.PARAMETER ExpectOutcome
  Started, Sent, NothingToSend or Failed. Defaults to Sent.

.PARAMETER ExpectDue
  Decision-table ids expected under "Due", e.g. S01,S03,S04.

.PARAMETER ExpectFollowUp
  Decision-table ids expected under "Follow-up".

.EXAMPLE
  pwsh scripts/reminder/assert-reminder-run.ps1 -ExpectOutcome Sent -ExpectDue S01,S03,S04,S12,S17,S18,S25,S27,S29 -ExpectFollowUp S06,S08,S09,S13,S21,S23,S26
  pwsh scripts/reminder/assert-reminder-run.ps1 -ExpectOutcome NothingToSend
#>
param(
    [string]$EnvironmentUrl = 'https://org9c89b427.crm.dynamics.com',
    [string]$TimeZone,
    [ValidateSet('Started', 'Sent', 'NothingToSend', 'Failed')]
    [string]$ExpectOutcome = 'Sent',
    [string[]]$ExpectDue = @(),
    [string[]]$ExpectFollowUp = @(),
    [switch]$Strict
)

$ErrorActionPreference = 'Stop'
$envUrl  = $EnvironmentUrl.TrimEnd('/')
$apiBase = "$envUrl/api/data/v9.2"

$OutcomeNames = @{ 894250000 = 'Started'; 894250001 = 'Sent'; 894250002 = 'NothingToSend'; 894250003 = 'Failed' }

# `pwsh file.ps1 -ExpectDue S01,S03` passes one string, not an array, when it
# is started from a non-PowerShell shell; accept both forms.
function Split-Ids {
    param([string[]]$Values)
    return @($Values | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ } | Sort-Object -Unique)
}
# @(...) keeps an empty result an empty array; a function returning no items yields $null.
$dueExpected      = @(Split-Ids $ExpectDue)
$followUpExpected = @(Split-Ids $ExpectFollowUp)

$zone  = if ($TimeZone) { [TimeZoneInfo]::FindSystemTimeZoneById($TimeZone) } else { [TimeZoneInfo]::Local }
$today = [TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $zone).ToString('yyyy-MM-dd')

$token = az account get-access-token --resource "$envUrl/" --query accessToken -o tsv 2>&1
if (-not $token -or $token -like '*ERROR*') {
    throw "Token acquisition failed. Run 'az login' and try again. Detail: $token"
}
$headers = @{
    Authorization   = "Bearer $token"
    'OData-Version' = '4.0'
    Accept          = 'application/json'
}

$uri  = "$apiBase/ppa_reminderruns?" + '$select=ppa_name,ppa_outcome,ppa_duecount,ppa_followupcount,ppa_summary,ppa_errorstep,ppa_attempts&$filter=' + "ppa_name eq '$today'"
$rows = @((Invoke-RestMethod -Method Get -Uri $uri -Headers $headers).value)

Write-Host ""
Write-Host "Reminder Run for $today ($($zone.Id)) in $envUrl"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if ($rows.Count -eq 0) {
    Write-Host "✗  No Reminder Run row for $today. The flow has not run, or could not reach Dataverse."
    exit 1
}
$run = $rows[0]

# "Due: a; b" → @('a', 'b'); "Due: –" → @()
function Get-Group {
    param([string]$Summary, [string]$Label)
    foreach ($line in ($Summary -split "\r?\n")) {
        if ($line -match "^\s*$([regex]::Escape($Label)):\s*(.*)$") {
            $value = $Matches[1].Trim()
            if ($value -in @('', '–', '-')) { return @() }
            return @($value -split ';' | ForEach-Object { $_.Trim() } | Where-Object { $_ })
        }
    }
    return @()
}

# Names from the seed set start with their decision-table id.
function Split-Names {
    param([string[]]$Names)
    $ids   = @()
    $other = @()
    foreach ($name in $Names) {
        if ($name -match '^(S\d{2})\b') { $ids += $Matches[1] } else { $other += $name }
    }
    return @{ Ids = @($ids | Sort-Object -Unique); Other = $other }
}

$dueNames      = Get-Group -Summary $run.ppa_summary -Label 'Due'
$followUpNames = Get-Group -Summary $run.ppa_summary -Label 'Follow-up'
$due           = Split-Names $dueNames
$followUp      = Split-Names $followUpNames
$actualOutcome = $OutcomeNames[[int]$run.ppa_outcome]

$problems = @()

function Compare-Ids {
    param([string]$Group, [string[]]$Expected, [string[]]$Actual)
    $missing    = @($Expected | Where-Object { $_ -and $_ -notin $Actual })
    $unexpected = @($Actual | Where-Object { $_ -and $_ -notin $Expected })
    $found = @()
    if ($missing.Count -gt 0)    { $found += "$Group — expected but not listed: $($missing -join ', ')" }
    if ($unexpected.Count -gt 0) { $found += "$Group — listed but not expected: $($unexpected -join ', ')" }
    return $found
}

if ($actualOutcome -ne $ExpectOutcome) {
    $detail = if ($run.ppa_errorstep) { " (error step: $($run.ppa_errorstep))" } else { '' }
    $problems += "Outcome — expected $ExpectOutcome, got $actualOutcome$detail"
}
$problems += Compare-Ids -Group 'Due' -Expected $dueExpected -Actual $due.Ids
$problems += Compare-Ids -Group 'Follow-up' -Expected $followUpExpected -Actual $followUp.Ids

# The counts on the row must agree with the names in its own summary.
if ([int]$run.ppa_duecount -ne $dueNames.Count) {
    $problems += "Due count — row says $($run.ppa_duecount), summary lists $($dueNames.Count)"
}
if ([int]$run.ppa_followupcount -ne $followUpNames.Count) {
    $problems += "Follow-up count — row says $($run.ppa_followupcount), summary lists $($followUpNames.Count)"
}
$both = @($due.Ids | Where-Object { $_ -in $followUp.Ids })
if ($both.Count -gt 0) {
    $problems += "Listed under both Due and Follow-up: $($both -join ', ')"
}

$otherCount = $due.Other.Count + $followUp.Other.Count
if ($otherCount -gt 0) {
    Write-Host "   $otherCount listed Medication(s) are not from the seed set$(if ($Strict) { '' } else { ' (ignored)' })."
    if ($Strict) { $problems += "-Strict: $otherCount listed Medication(s) are not from the seed set" }
}

Write-Host "   Outcome   : $actualOutcome (attempts: $($run.ppa_attempts))"
Write-Host "   Due       : $($due.Ids.Count) from the seed set — $($due.Ids -join ', ')"
Write-Host "   Follow-up : $($followUp.Ids.Count) from the seed set — $($followUp.Ids -join ', ')"
Write-Host ""

if ($problems.Count -gt 0) {
    Write-Host "✗  Reminder Run does not match:"
    foreach ($problem in $problems) { Write-Host "   - $problem" }
    Write-Host ""
    exit 1
}

Write-Host "✓  Reminder Run matches."
Write-Host ""
