param([string]$Rive = "$env:USERPROFILE/.rive/bin/rive.exe")
$ErrorActionPreference = 'Stop'
$repo = Split-Path $PSScriptRoot -Parent
$project = Join-Path $repo 'design/rive/drop'
foreach ($mode in @('--verify', '--once')) {
    $report = & $Rive $project $mode --format=json | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or $report.success -ne $true) {
        throw "Rive $mode failed; bundled asset was not replaced."
    }
}
Copy-Item -LiteralPath (Join-Path $project 'build/drop-rive.riv') -Destination (Join-Path $repo 'assets/rive/drop.riv')
Write-Output 'Verified and rebuilt assets/rive/drop.riv locally. No upload or signing request.'
