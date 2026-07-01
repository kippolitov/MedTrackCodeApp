#Requires -Version 7.0
<#
Non-interactive Power Platform authentication via a service principal.
Fails fast with a clear message if required secrets/variables are missing or
auth fails — never falls back to interactive login (FR-006).

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
    throw "Missing required Power Platform auth environment variable(s): $($missing -join ', '). Configure them as secrets on the target GitHub Environment."
}

Write-Host "Authenticating to $($env:PP_ENVIRONMENT_URL) via service principal $($env:PP_CLIENT_ID)..."

pac auth create `
    --applicationId $env:PP_CLIENT_ID `
    --clientSecret $env:PP_CLIENT_SECRET `
    --tenant $env:PP_TENANT_ID `
    --environment $env:PP_ENVIRONMENT_URL

if ($LASTEXITCODE -ne 0) {
    throw "pac auth create failed (exit code $LASTEXITCODE). Verify the service principal is registered as an application user in the target environment and the secret has not expired."
}

Write-Host "Authenticated successfully."
