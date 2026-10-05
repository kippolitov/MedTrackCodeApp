#Requires -Version 7.0
<#
Fails when solution content could publish the reminder address
(specs/004-schedule-page-reminders/contracts/privacy-and-deployment.contract.md):

  1. any environmentvariablevalues.json file -- environment variable *values*
     never belong in the solution, only their definitions; or
  2. any file containing an email address outside the allowlist.

Two modes:
  -Path <dir>   the unpacked solution source (solution/src), run on every
                pull request in ci.yml
  -Zip <file>   an exported solution zip, run in promote-prod.yml before the
                artifact is uploaded -- the one automated step that publishes
                solution content

On failure only the offending file path is printed, never the matched text:
this script's output lands in public workflow logs.

The address pattern and allowlist mirror the `email-address` rule in
.gitleaks.toml. Keep the two in step.
#>
[CmdletBinding(DefaultParameterSetName = 'Path')]
param(
    [Parameter(Mandatory, ParameterSetName = 'Path')]
    [string]$Path,

    [Parameter(Mandatory, ParameterSetName = 'Zip')]
    [string]$Zip
)

$ErrorActionPreference = 'Stop'

$valueFileName = 'environmentvariablevalues.json'
$emailPattern  = [regex]'[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}'

# Addresses that may be committed, and strings that only look like addresses.
$allowed = @(
    [regex]'(?i)@example\.(com|org)$'
    [regex]'(?i)@users\.noreply\.github\.com$'
    [regex]'(?i)^noreply@anthropic\.com$'
    # OData annotations: ppa_Medication@odata.bind, x@OData.Community.Display.V1.FormattedValue
    [regex]'(?i)@odata\.'
    # x@Microsoft.Dynamics.CRM.lookuplogicalname
    [regex]'@Microsoft\.'
    [regex]'^git@github\.com$'
)

function Test-HasDisallowedAddress {
    param([string]$Text)
    foreach ($match in $emailPattern.Matches($Text)) {
        $candidate = $match.Value
        if (-not ($allowed | Where-Object { $_.IsMatch($candidate) })) { return $true }
    }
    return $false
}

# Returns the reasons a file fails, given its display path and a way to read it.
function Get-Problems {
    param([string]$DisplayPath, [string]$FileName, [scriptblock]$ReadText)
    $problems = @()
    if ($FileName -ieq $valueFileName) {
        $problems += "${DisplayPath}: environment variable value file"
    }
    if (Test-HasDisallowedAddress (& $ReadText)) {
        $problems += "${DisplayPath}: contains an email address outside the allowlist"
    }
    return $problems
}

$problems = @()
$scanned  = 0

if ($PSCmdlet.ParameterSetName -eq 'Path') {
    if (-not (Test-Path $Path -PathType Container)) {
        throw "Directory not found: $Path"
    }
    $root = (Resolve-Path $Path).Path
    foreach ($file in Get-ChildItem -Path $root -Recurse -File -Force) {
        $relative  = [IO.Path]::GetRelativePath($root, $file.FullName).Replace('\', '/')
        $fullName  = $file.FullName
        $problems += Get-Problems -DisplayPath $relative -FileName $file.Name -ReadText { [IO.File]::ReadAllText($fullName) }
        $scanned++
    }
    $target = $Path
} else {
    if (-not (Test-Path $Zip -PathType Leaf)) {
        throw "Zip file not found: $Zip"
    }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [IO.Compression.ZipFile]::OpenRead((Resolve-Path $Zip).Path)
    try {
        foreach ($entry in $archive.Entries) {
            if ($entry.FullName.EndsWith('/')) { continue } # directory entry
            $current   = $entry
            $problems += Get-Problems -DisplayPath $entry.FullName -FileName $entry.Name -ReadText {
                $reader = [IO.StreamReader]::new($current.Open())
                try { $reader.ReadToEnd() } finally { $reader.Dispose() }
            }
            $scanned++
        }
    } finally {
        $archive.Dispose()
    }
    $target = $Zip
}

if ($problems.Count -gt 0) {
    Write-Host "Solution content check FAILED for $target ($($problems.Count) problem(s)):"
    foreach ($problem in $problems) { Write-Host "  - $problem" }
    Write-Host "Environment variable values and email addresses must not be part of the solution."
    Write-Host "See specs/004-schedule-page-reminders/contracts/privacy-and-deployment.contract.md."
    exit 1
}

Write-Host "Solution content check passed for $target ($scanned file(s) scanned)."
