[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$PetId = 'gureum-bichon'
$codexRoot = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$target = Join-Path (Join-Path $codexRoot 'pets') $PetId

if (-not (Test-Path -LiteralPath $target)) {
    Write-Host 'Gureum Bichon is not installed.'
    exit 0
}

$disabledRoot = Join-Path $codexRoot 'pets-disabled'
$destination = Join-Path $disabledRoot "$PetId-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
New-Item -ItemType Directory -Force -Path $disabledRoot | Out-Null
Move-Item -LiteralPath $target -Destination $destination
Write-Host 'Gureum Bichon was disabled without deleting it.' -ForegroundColor Yellow
Write-Host "Recoverable copy: $destination"
