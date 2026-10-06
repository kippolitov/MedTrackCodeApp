#Requires -Version 7.0
<#
Publishes the built Code App with the npm-based Power Apps CLI (`pa`), signed
in as the deployment service principal. Never prompts and never falls back to
an interactive sign-in (FR-006).

This is Microsoft's supported path for a service principal:
https://learn.microsoft.com/power-apps/developer/code-apps/how-to/use-service-principal
It was given as the resolution of microsoft/PowerAppsCodeApps#394 and replaces
`pac code push --solutionName`, the workaround this pipeline used for the
HTTP 500 the PAC CLI returns under a service principal. Microsoft's guidance
is that the PAC CLI must not be used to publish a code app as a service
principal.

One-time prerequisite per environment, done by the app's owner and never by
this pipeline: share the app with the service principal with edit access.
From a folder whose power.config.json points at that environment's app:

  npx pa auth login
  npx pa app share --principal <enterprise-application-object-id> --access edit

Environment-level roles alone do not let a service principal update an
existing app, and a service principal cannot grant itself access.

Assumes:
  - `npm ci` has installed the pinned @microsoft/power-apps-cli
  - power.config.json has been rendered (scripts/ci/render-power-config.ps1)
  - dist/ contains the production build (npm run build:ci)

Required environment variables:
  PP_CLIENT_ID       Service principal application (client) ID
  PP_CLIENT_SECRET   Service principal client secret
  PP_TENANT_ID       Entra tenant ID
#>

$ErrorActionPreference = 'Stop'

$required = @('PP_CLIENT_ID', 'PP_CLIENT_SECRET', 'PP_TENANT_ID')
$missing = $required | Where-Object { [string]::IsNullOrWhiteSpace((Get-Item -Path "env:$_" -ErrorAction SilentlyContinue).Value) }
if ($missing.Count -gt 0) {
    throw "Missing required Power Platform auth environment variable(s): $($missing -join ', '). Configure them as secrets on the target GitHub Environment."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '../..')
$configPath = Join-Path $repoRoot 'power.config.json'

if (-not (Test-Path $configPath)) {
    throw "power.config.json not found at $configPath. Run scripts/ci/render-power-config.ps1 first."
}
$environmentId = (Get-Content -Path $configPath -Raw | ConvertFrom-Json).environmentId
if ([string]::IsNullOrWhiteSpace($environmentId)) {
    throw "power.config.json has no environmentId."
}

# These variables make the CLI sign in as the service principal instead of
# using a cached interactive account. They live only in this process.
$env:PA_CLI_USE_SP_AUTH      = 'true'
$env:PA_CLI_SP_CLIENT_ID     = $env:PP_CLIENT_ID
$env:PA_CLI_SP_CLIENT_SECRET = $env:PP_CLIENT_SECRET
$env:PA_CLI_SP_TENANT_ID     = $env:PP_TENANT_ID

Write-Host "Publishing Code App using $configPath as service principal $($env:PP_CLIENT_ID)..."

Push-Location $repoRoot
try {
    # --no: use the version npm ci installed; never download another one.
    # The earlier CLI could print an HTTP error and still exit 0 (found live
    # 2026-07-02), so the output is checked as well as the exit code.
    npx --no -- pa app push --non-interactive --no-color --environment-id $environmentId 2>&1 |
        Tee-Object -Variable capturedOutput | ForEach-Object { Write-Host $_ }
    $exitCode = $LASTEXITCODE
} finally {
    Pop-Location
}

$sharingHint = "If the service principal has never published this app, the app's owner must first share it: pa app share --principal <enterprise-application-object-id> --access edit (see this script's header)."
if ($exitCode -ne 0) {
    throw "pa app push failed (exit code $exitCode). $sharingHint"
}
if ($capturedOutput -match 'HTTP error status') {
    throw "pa app push reported an HTTP error but exited 0 -- treating as a failure. See the output above for details. $sharingHint"
}

Write-Host "Code App published successfully."
