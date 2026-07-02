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

# `pac code push` can print an HTTP error (e.g. the app's appId belonging to a
# different environment) and still exit 0 -- found live 2026-07-02 when a
# reused appId hit "InvalidEnvironmentName" but the step still reported
# success. Capture output and fail on either a non-zero exit code or a
# surfaced HTTP error, rather than trusting the exit code alone.
pac --log-to-console code push 2>&1 | Tee-Object -Variable capturedOutput | ForEach-Object { Write-Host $_ }

if ($LASTEXITCODE -ne 0) {
    throw "pac code push failed (exit code $LASTEXITCODE)."
}
if ($capturedOutput -match 'HTTP error status') {
    throw "pac code push reported an HTTP error but exited 0 -- treating as a failure. See the output above for details."
}

Write-Host "Code App pushed successfully."
