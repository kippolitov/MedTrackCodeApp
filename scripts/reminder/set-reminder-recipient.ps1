#Requires -Version 7.0
<#
.SYNOPSIS
  Sets the address the daily reminder is sent to, in one environment.

.DESCRIPTION
  Local use only, with the owner's own sign-in (`az login`). Never run in CI.

  Prompts for the address with hidden input, checks its shape, and creates or
  updates the current value of the environment variable
  ppa_ReminderRecipientEmail.

  The address is deliberately handled so that it cannot reach the repository:
    - It is read only from the prompt. It is not a parameter, because a
      parameter would land in shell history.
    - It is never printed and never written to a file.
    - The value row is created WITHOUT the MSCRM.SolutionUniqueName header.
      This is a deliberate exception to the project rule (research R8): a
      value that is a component of MedTrackSolution would be written into the
      exported solution zip, which promote-prod.yml uploads as an artifact.

  Run once per environment, and again to change the address. A change can
  take up to an hour to reach the flow.

.PARAMETER EnvironmentUrl
  Power Platform environment URL. Required -- there is no default, so the
  environment is always a conscious choice.

.EXAMPLE
  pwsh scripts/reminder/set-reminder-recipient.ps1 -EnvironmentUrl https://org9c89b427.crm.dynamics.com
#>
param(
    [Parameter(Mandatory)]
    [string]$EnvironmentUrl
)

$ErrorActionPreference = 'Stop'
$envUrl       = $EnvironmentUrl.TrimEnd('/')
$apiBase      = "$envUrl/api/data/v9.2"
$variableName = 'ppa_ReminderRecipientEmail'

if ($env:CI -or $env:GITHUB_ACTIONS) {
    throw "set-reminder-recipient.ps1 is for local use only and must not run in CI."
}

Write-Host ""
Write-Host "MedTrack reminder recipient → $envUrl"
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── Prompt (hidden, typed twice because it cannot be seen) ───────────────────
function Read-Hidden {
    param([string]$Prompt)
    $secure = Read-Host -Prompt $Prompt -AsSecureString
    return [System.Net.NetworkCredential]::new('', $secure).Password.Trim()
}

$address = Read-Hidden 'Reminder address (input is hidden)'
if ($address -notmatch '^[^@\s]+@[^@\s]+\.[^@\s.]{2,}$' -or $address.Length -gt 254) {
    throw "That does not look like an email address. Nothing was changed."
}
if ((Read-Hidden 'Type it again to confirm') -cne $address) {
    throw "The two entries do not match. Nothing was changed."
}

# ── Auth ─────────────────────────────────────────────────────────────────────
Write-Host "→ Acquiring access token (az account get-access-token)..."
$token = az account get-access-token --resource "$envUrl/" --query accessToken -o tsv 2>&1
if (-not $token -or $token -like '*ERROR*') {
    throw "Token acquisition failed. Run 'az login' and try again. Detail: $token"
}

# No MSCRM.SolutionUniqueName header -- see the description above.
$headers = @{
    Authorization   = "Bearer $token"
    'OData-Version' = '4.0'
    Accept          = 'application/json'
    'Content-Type'  = 'application/json; charset=utf-8'
}

# Reports the HTTP status only. The request body holds the address, so no
# part of the request or the response body is ever echoed.
function Invoke-Quiet {
    param([string]$Method, [string]$Uri, [hashtable]$Body = $null, [string]$What)
    $p = @{ Method = $Method; Uri = $Uri; Headers = $headers }
    if ($Body) { $p.Body = ($Body | ConvertTo-Json -Compress) }
    try {
        return Invoke-RestMethod @p
    } catch {
        $status = $_.Exception.Response.StatusCode.value__
        throw "$What failed (HTTP $status). Nothing else was changed."
    }
}

$definitions = Invoke-Quiet -Method Get -What 'Reading the environment variable definition' `
    -Uri ("$apiBase/environmentvariabledefinitions?" + '$select=environmentvariabledefinitionid&$filter=' + "schemaname eq '$variableName'")
if ($definitions.value.Count -eq 0) {
    throw "Environment variable $variableName does not exist in $envUrl. Deploy the solution (or run scripts/reminder/create-reminder-schema.ps1 in dev) first."
}
$definitionId = $definitions.value[0].environmentvariabledefinitionid

$values = Invoke-Quiet -Method Get -What 'Reading the current value' `
    -Uri ("$apiBase/environmentvariablevalues?" + '$select=environmentvariablevalueid&$filter=' + "_environmentvariabledefinitionid_value eq $definitionId")

if ($values.value.Count -gt 0) {
    Invoke-Quiet -Method Patch -What 'Updating the value' `
        -Uri "$apiBase/environmentvariablevalues($($values.value[0].environmentvariablevalueid))" `
        -Body @{ value = $address } | Out-Null
    $action = 'updated'
} else {
    Invoke-Quiet -Method Post -What 'Creating the value' `
        -Uri "$apiBase/environmentvariablevalues" `
        -Body @{
            value                                         = $address
            'EnvironmentVariableDefinitionId@odata.bind' = "/environmentvariabledefinitions($definitionId)"
        } | Out-Null
    $action = 'created'
}

$address = $null

Write-Host ""
Write-Host "✓  $variableName $action. The address was not printed or saved anywhere else."
Write-Host "   A change can take up to an hour to reach the flow."
Write-Host ""
