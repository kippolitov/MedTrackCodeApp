#Requires -Version 7.0
<#
Pushes the built Code App using the pac CLI. Assumes:
  - `pac auth create` has already run (scripts/deploy/auth.ps1)
  - power.config.json has already been rendered (scripts/ci/render-power-config.ps1)
  - dist/ contains the production build (npm run build:ci)

--log-to-console surfaces pac diagnostics directly in the (ephemeral) runner's
job log, per Microsoft's guidance for GitHub-hosted runners.
#>

$ErrorActionPreference = 'Stop'

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '../..')
$configPath = Join-Path $repoRoot 'power.config.json'

if (-not (Test-Path $configPath)) {
    throw "power.config.json not found at $configPath. Run scripts/ci/render-power-config.ps1 first."
}

Write-Host "Pushing Code App using $configPath..."

pac --log-to-console code push

if ($LASTEXITCODE -ne 0) {
    throw "pac code push failed (exit code $LASTEXITCODE)."
}

Write-Host "Code App pushed successfully."
