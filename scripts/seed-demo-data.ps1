#Requires -Version 7.0
<#
.SYNOPSIS
  Seeds realistic demo data (6 medications + 90 days of intake history) into
  a Dataverse environment using the current Azure CLI user session.

.DESCRIPTION
  Designed for local developer use — not for CI. Authenticates via
  `az account get-access-token` (interactive user credentials) rather than a
  service principal. All upserts are idempotent: safe to re-run without
  creating duplicate records.

  What gets imported:
    Medications (6):  Metformin, Insulin Glargine, Vitamin D3, Amlodipine,
                      Fluticasone (all active daily), Ibuprofen (paused, as-needed)
    Intake logs:      One log per daily medication per day for the past 90 days,
                      skipping today so the dashboard shows realistic overdue/
                      upcoming states. Status pattern: improving trend over time,
                      with a clean streak in the most recent 14 days.

.PARAMETER EnvironmentUrl
  Power Platform environment URL.  Defaults to MedTrackDev.

.EXAMPLE
  pwsh scripts/seed-demo-data.ps1
  pwsh scripts/seed-demo-data.ps1 -EnvironmentUrl https://orgfff21ac2.crm.dynamics.com
#>
param(
    [string]$EnvironmentUrl = 'https://org9c89b427.crm.dynamics.com'
)

$ErrorActionPreference = 'Stop'
$envUrl  = $EnvironmentUrl.TrimEnd('/')
$apiBase = "$envUrl/api/data/v9.2"

Write-Host ""
Write-Host "MedTrack demo data seed → $envUrl"
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

# ── Option set constants (matches src/generated/models/) ─────────────────────
$Freq   = @{ Daily = 894250000; Weekly = 894250001; Biweekly = 894250002; AsNeeded = 894250003 }
$Method = @{ Pill = 894250000; Injection = 894250001; Topical = 894250002; Inhaler = 894250003; Liquid = 894250004 }
$Status = @{ Taken = 894250000; Skipped = 894250001; Missed = 894250002 }
# RightHip, LeftHip, AbdominalRight, AbdominalCenter, AbdominalLeft
$Sites  = @(894250000, 894250001, 894250002, 894250003, 894250004)

# ── 1. Medications ───────────────────────────────────────────────────────────
$medications = @(
    @{ ppa_name = 'Metformin';        ppa_dosage = '500mg';        ppa_frequency = $Freq.Daily;    ppa_method = $Method.Pill;      ppa_remindertime = '08:00'; ppa_isactive = $true;  ppa_instructions = 'Take with food.' }
    @{ ppa_name = 'Insulin Glargine'; ppa_dosage = '10 units/mL';  ppa_frequency = $Freq.Daily;    ppa_method = $Method.Injection; ppa_remindertime = '21:00'; ppa_isactive = $true;  ppa_instructions = 'Rotate injection sites. Keep refrigerated.' }
    @{ ppa_name = 'Vitamin D3';       ppa_dosage = '2000 IU';       ppa_frequency = $Freq.Daily;    ppa_method = $Method.Pill;      ppa_remindertime = '09:00'; ppa_isactive = $true }
    @{ ppa_name = 'Amlodipine';       ppa_dosage = '5mg';           ppa_frequency = $Freq.Daily;    ppa_method = $Method.Pill;      ppa_remindertime = '08:00'; ppa_isactive = $true }
    @{ ppa_name = 'Fluticasone';      ppa_dosage = '100mcg/dose';   ppa_frequency = $Freq.Daily;    ppa_method = $Method.Inhaler;   ppa_remindertime = '07:30'; ppa_isactive = $true;  ppa_instructions = 'Rinse mouth after use.' }
    @{ ppa_name = 'Ibuprofen';        ppa_dosage = '400mg';         ppa_frequency = $Freq.AsNeeded; ppa_method = $Method.Pill;                                  ppa_isactive = $false; ppa_instructions = 'Take as needed for pain. Do not exceed 3 consecutive days.' }
)

Write-Host "→ Upserting $($medications.Count) medications..."
$medIdByName = @{}

foreach ($med in $medications) {
    $encoded = [uri]::EscapeDataString($med.ppa_name)
    $result  = Invoke-DV -Method Patch -Uri "$apiBase/ppa_medications(ppa_name='$encoded')" -Body $med
    $medIdByName[$med.ppa_name] = $result.ppa_medicationid
    $activeLabel = if ($med.ppa_isactive) { 'active' } else { 'paused' }
    Write-Host "  ✓ $($med.ppa_name) ($activeLabel)"
}

# ── 2. Intake logs — 90 days, daily active medications only ─────────────────
$today     = [DateTime]::UtcNow.Date
$startDate = $today.AddDays(-90)
$dailyMeds = $medications | Where-Object { $_.ppa_frequency -eq $Freq.Daily -and $_.ppa_isactive }

# Track injection site rotation per medication
$siteIdx = @{}
foreach ($med in $dailyMeds) { $siteIdx[$med.ppa_name] = 0 }

$logSuccess = 0
$logFailure = 0

Write-Host "→ Generating intake logs for $($dailyMeds.Count) medications × 90 days..."
Write-Host "  (skipping today → leaves doses overdue/upcoming on the dashboard)"
Write-Host ""

foreach ($med in $dailyMeds) {
    $medId          = $medIdByName[$med.ppa_name]
    $reminderHour   = [int]($med.ppa_remindertime.Split(':')[0])
    $reminderMinute = [int]($med.ppa_remindertime.Split(':')[1])

    for ($d = 0; $d -lt 90; $d++) {
        $date         = $startDate.AddDays($d)
        $scheduledFor = $date.AddHours($reminderHour).AddMinutes($reminderMinute)

        # Skip today — makes the dashboard show realistic scheduled/overdue states
        if ($scheduledFor.Date -ge $today) { continue }

        # Status pattern: gradually improving, perfect streak in last 14 days
        $status = if ($d -ge 76) {
            $Status.Taken                                                    # days 76-89: perfect
        } elseif ($d % 8 -eq 0) {
            $Status.Missed
        } elseif ($d % 6 -eq 0) {
            $Status.Skipped
        } else {
            $Status.Taken
        }

        # ppa_loggedat: shortly after the scheduled time
        if ($status -eq $Status.Missed) {
            $offset = [TimeSpan]::FromHours(6 + ($d % 3))
        } elseif ($status -eq $Status.Skipped) {
            $offset = [TimeSpan]::FromMinutes(2 + ($d % 10))
        } else {
            $offset = [TimeSpan]::FromMinutes(5 + ($d % 15))
        }
        $loggedAt = $scheduledFor.Add($offset)

        $body = @{
            ppa_status   = $status
            ppa_loggedat = $loggedAt.ToString('yyyy-MM-ddTHH:mm:ssZ')
        }

        # Rotate injection sites for injectable medications (Taken doses only)
        if ($med.ppa_method -eq $Method.Injection -and $status -eq $Status.Taken) {
            $body.ppa_injectionsite    = $Sites[$siteIdx[$med.ppa_name] % $Sites.Count]
            $siteIdx[$med.ppa_name]++
        }

        $sfStr = $scheduledFor.ToString('yyyy-MM-ddTHH:mm:ssZ')
        $uri   = "$apiBase/ppa_intakelogs(ppa_scheduledfor=$sfStr,_ppa_medication_value=$medId)"
        try {
            Invoke-DV -Method Patch -Uri $uri -Body $body | Out-Null
            $logSuccess++
        } catch {
            $logFailure++
            $reason = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
            Write-Host "  ✗ $($med.ppa_name) $sfStr — $($reason.error.message ?? $_.Exception.Message)"
        }
    }

    Write-Host "  ✓ $($med.ppa_name) — done"
}

Write-Host ""
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
$icon = if ($logFailure -eq 0) { '✓' } else { '⚠' }
Write-Host "$icon  Medications : $($medications.Count) upserted"
Write-Host "$icon  Intake logs : $logSuccess upserted, $logFailure failed"
Write-Host ""
Write-Host "   Open the app → the dashboard should show overdue doses for today"
Write-Host "   and ~14-day streak with improving adherence in analytics."
Write-Host ""

if ($logFailure -gt 0) {
    throw "Seed completed with $logFailure log failure(s) — see output above."
}
