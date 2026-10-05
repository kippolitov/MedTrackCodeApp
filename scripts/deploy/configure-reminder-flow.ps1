#Requires -Version 7.0
<#
Confirms the "MedTrack – Daily Reminder" cloud flow is in place after a
solution import: it exists, the deployment service principal owns it, and it
is turned on. Turns it on when it is off. Changes no ownership.

Run after "Publish solution customizations" in a deploy job. A solution
import can leave a flow turned off (for example when a connection reference
was not bound), and a flow that is off sends no reminders without any error
anywhere -- so this step fails the deploy instead.

Idempotent. Authenticates independently via OAuth client-credentials rather
than depending on `pac auth create`'s CLI profile (see auth.ps1's ordering
note). Prints no secrets.

Required environment variables:
  PP_CLIENT_ID       Service principal application (client) ID
  PP_CLIENT_SECRET   Service principal client secret
  PP_TENANT_ID       Entra tenant ID
  PP_ENVIRONMENT_URL Target Power Platform environment URL
#>
param(
    # The flow's unique name in Dataverse (workflow.uniquename).
    [string]$FlowUniqueName = 'ppa_MedTrackDailyReminder'
)

$ErrorActionPreference = 'Stop'

$required = @('PP_CLIENT_ID', 'PP_CLIENT_SECRET', 'PP_TENANT_ID', 'PP_ENVIRONMENT_URL')
$missing = $required | Where-Object { [string]::IsNullOrWhiteSpace((Get-Item -Path "env:$_" -ErrorAction SilentlyContinue).Value) }
if ($missing.Count -gt 0) {
    throw "Missing required Power Platform environment variable(s): $($missing -join ', ')."
}

$envUrl  = $env:PP_ENVIRONMENT_URL.TrimEnd('/')
$apiBase = "$envUrl/api/data/v9.2"

Write-Host "Acquiring Dataverse access token for $envUrl..."
$tokenResponse = Invoke-RestMethod -Method Post `
    -Uri "https://login.microsoftonline.com/$($env:PP_TENANT_ID)/oauth2/v2.0/token" `
    -ContentType 'application/x-www-form-urlencoded' `
    -Body @{
        grant_type    = 'client_credentials'
        client_id     = $env:PP_CLIENT_ID
        client_secret = $env:PP_CLIENT_SECRET
        scope         = "$envUrl/.default"
    }

$headers = @{
    Authorization   = "Bearer $($tokenResponse.access_token)"
    'OData-Version' = '4.0'
    Accept          = 'application/json'
}

# HTTP status + Dataverse error message from a failed request.
function Get-SafeErrorReason {
    param($ErrorRecord)
    $status = $ErrorRecord.Exception.Response.StatusCode
    $reason = $ErrorRecord.Exception.Message
    if ($ErrorRecord.ErrorDetails.Message) {
        try {
            $parsed = $ErrorRecord.ErrorDetails.Message | ConvertFrom-Json
            if ($parsed.error.message) { $reason = $parsed.error.message }
        } catch {
            # Response body wasn't JSON; fall back to the exception message.
        }
    }
    return "[$status] $reason"
}

# The service principal's own application user in this environment.
$servicePrincipalUserId = (Invoke-RestMethod -Method Get -Uri "$apiBase/WhoAmI" -Headers $headers).UserId

# category 5 = modern (cloud) flow
$flowQuery = "$apiBase/workflows?" + '$select=workflowid,name,statecode,_ownerid_value&$filter=' + "category eq 5 and uniquename eq '$FlowUniqueName'"
$flows = @((Invoke-RestMethod -Method Get -Uri $flowQuery -Headers $headers).value)

if ($flows.Count -eq 0) {
    throw "Cloud flow '$FlowUniqueName' was not found in $envUrl. The solution import did not bring it in."
}
if ($flows.Count -gt 1) {
    throw "Found $($flows.Count) cloud flows with the unique name '$FlowUniqueName'; expected exactly one."
}
$flow = $flows[0]
Write-Host "Found flow '$($flow.name)'."

if ($flow._ownerid_value -ne $servicePrincipalUserId) {
    throw "Flow '$($flow.name)' is not owned by the deployment service principal. Ownership is not changed by this script; reassign it deliberately or re-import the solution as the service principal."
}
Write-Host "Owner is the deployment service principal."

# statecode 1 = Activated (on), 0 = Draft (off)
if ($flow.statecode -eq 1) {
    Write-Host "Flow is already on."
    return
}

Write-Host "Flow is off -- turning it on..."
try {
    Invoke-RestMethod -Method Patch -Uri "$apiBase/workflows($($flow.workflowid))" `
        -Headers ($headers + @{ 'Content-Type' = 'application/json; charset=utf-8' }) `
        -Body (@{ statecode = 1; statuscode = 2 } | ConvertTo-Json -Compress) | Out-Null
} catch {
    throw "Could not turn the flow on: $(Get-SafeErrorReason $_). Check that both connection references are bound and that the connections are shared with the service principal."
}

$stateQuery = "$apiBase/workflows($($flow.workflowid))" + '?$select=statecode'
if ((Invoke-RestMethod -Method Get -Uri $stateQuery -Headers $headers).statecode -ne 1) {
    throw "The flow did not stay on after being activated."
}
Write-Host "Flow is on."
