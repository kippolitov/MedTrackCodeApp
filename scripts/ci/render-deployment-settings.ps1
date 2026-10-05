#Requires -Version 7.0
<#
Renders solution/deployment-settings.json from
solution/deployment-settings.template.json by substituting the
__CONN_DATAVERSE_ID__ / __CONN_MAIL_ID__ / __REMINDER_TIME_ZONE__ placeholders
with values from the PP_CONN_DATAVERSE_ID / PP_CONN_MAIL_ID /
REMINDER_TIME_ZONE environment variables. Run this immediately before the
solution import in a deploy job, and pass the rendered file to the import.

The rendered file is git-ignored. No value is printed.

There is deliberately no placeholder for ppa_ReminderRecipientEmail: the
reminder address never passes through GitHub (see
specs/004-schedule-page-reminders/contracts/privacy-and-deployment.contract.md).
#>

$ErrorActionPreference = 'Stop'

$repoRoot     = Resolve-Path (Join-Path $PSScriptRoot '../..')
$templatePath = Join-Path $repoRoot 'solution/deployment-settings.template.json'
$outputPath   = Join-Path $repoRoot 'solution/deployment-settings.json'

if (-not (Test-Path $templatePath)) {
    throw "Template not found at $templatePath"
}

$placeholders = [ordered]@{
    '__CONN_DATAVERSE_ID__'  = 'PP_CONN_DATAVERSE_ID'
    '__CONN_MAIL_ID__'       = 'PP_CONN_MAIL_ID'
    '__REMINDER_TIME_ZONE__' = 'REMINDER_TIME_ZONE'
}

$missing = $placeholders.Values | Where-Object { [string]::IsNullOrWhiteSpace((Get-Item -Path "env:$_" -ErrorAction SilentlyContinue).Value) }
if ($missing.Count -gt 0) {
    throw "Missing required variable(s): $($missing -join ', '). Set them as GitHub Environment variables for the target stage."
}

$content = Get-Content -Path $templatePath -Raw
foreach ($placeholder in $placeholders.Keys) {
    $value = (Get-Item -Path "env:$($placeholders[$placeholder])").Value.Trim()
    # JSON-escape the value so it cannot break out of its string.
    $escaped = ($value | ConvertTo-Json -Compress)
    $content = $content.Replace($placeholder, $escaped.Substring(1, $escaped.Length - 2))
}

if ($content -match '__[A-Z_]+__') {
    throw "The rendered settings still contain an unresolved placeholder. Check $templatePath against this script."
}
# Fail here, not at import time, if the result is not valid JSON.
$null = $content | ConvertFrom-Json

Set-Content -Path $outputPath -Value $content -NoNewline
Write-Host "Rendered solution/deployment-settings.json ($($placeholders.Count) values substituted)."
