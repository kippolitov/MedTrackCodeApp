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

# --accept-cleartext-caching: GitHub-hosted runners have no OS keyring
# available, so pac auth create needs this to cache the token for reuse by
# later steps/processes in the same (ephemeral, single-use) runner.
pac auth create `
    --applicationId $env:PP_CLIENT_ID `
    --clientSecret $env:PP_CLIENT_SECRET `
    --tenant $env:PP_TENANT_ID `
    --environment $env:PP_ENVIRONMENT_URL `
    --accept-cleartext-caching

if ($LASTEXITCODE -ne 0) {
    throw "pac auth create failed (exit code $LASTEXITCODE). Verify the service principal is registered as an application user in the target environment and the secret has not expired."
}

Write-Host "Authenticated successfully."

# pac auth create's persisted profile does not retain a usable client secret
# by design (threat-model choice, not a bug) -- when a later `pac` process
# (e.g. `pac code push`) needs to refresh an access token via MSAL's
# ConfidentialClient, it has no refresh token and no secret, and fails with
# AADSTS7000215 "Invalid client secret provided". This reproduces identically
# regardless of OS/keyring (confirmed live 2026-07-02 on both ubuntu-latest
# and windows-latest runners). The documented fix, from a Microsoft
# powerplatform-vscode maintainer, is to expose the secret via a well-known
# env var that pac's internal refresh logic looks for:
# https://github.com/microsoft/powerplatform-vscode/issues/297#issuecomment-1663066345
# https://github.com/microsoft/powerplatform-vscode/issues/456
if ($env:GITHUB_ENV) {
    "PAC_CLI_SPN_SECRET=$($env:PP_CLIENT_SECRET)" | Out-File -FilePath $env:GITHUB_ENV -Append -Encoding utf8
}
