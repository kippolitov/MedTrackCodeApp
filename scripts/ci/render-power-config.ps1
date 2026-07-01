#Requires -Version 7.0
<#
Renders power.config.json from power.config.template.json by substituting the
__ENVIRONMENT_ID__ / __APP_ID__ placeholders with values from the
PP_ENVIRONMENT_ID / PP_APP_ID environment variables. Run this immediately
before `pac code push` in a deploy job.
#>

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '../..')
$templatePath = Join-Path $repoRoot 'power.config.template.json'
$outputPath = Join-Path $repoRoot 'power.config.json'

if (-not (Test-Path $templatePath)) {
    throw "Template not found at $templatePath"
}

if ([string]::IsNullOrWhiteSpace($env:PP_ENVIRONMENT_ID)) {
    throw "PP_ENVIRONMENT_ID is not set. Set it as a GitHub Environment variable for the target stage."
}

if ([string]::IsNullOrWhiteSpace($env:PP_APP_ID)) {
    throw "PP_APP_ID is not set. Set it as a GitHub Environment variable for the target stage."
}

$content = Get-Content -Path $templatePath -Raw
$content = $content.Replace('__ENVIRONMENT_ID__', $env:PP_ENVIRONMENT_ID)
$content = $content.Replace('__APP_ID__', $env:PP_APP_ID)

Set-Content -Path $outputPath -Value $content -NoNewline
Write-Host "Rendered $outputPath for environment $($env:PP_ENVIRONMENT_ID)"
