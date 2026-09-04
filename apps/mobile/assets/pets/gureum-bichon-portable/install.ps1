[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$PetId = 'gureum-bichon'
$ExpectedHash = '7A83EF2D0B7C63DCD1244C5C0452AA7085ECBF37845114129AC0BD9A62F3C0C8'
$SourceSheet = Join-Path $PSScriptRoot 'spritesheet.webp'
$SourceManifest = Join-Path $PSScriptRoot 'pet.json'

foreach ($path in @($SourceSheet, $SourceManifest)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Required package file is missing: $path"
    }
}

$actualHash = (Get-FileHash -LiteralPath $SourceSheet -Algorithm SHA256).Hash
if ($actualHash -ne $ExpectedHash) {
    throw "spritesheet.webp failed SHA-256 verification. Expected $ExpectedHash, got $actualHash"
}

$manifest = Get-Content -LiteralPath $SourceManifest -Raw | ConvertFrom-Json
if ($manifest.id -ne $PetId -or $manifest.spriteVersionNumber -ne 2 -or $manifest.spritesheetPath -ne 'spritesheet.webp') {
    throw 'pet.json is not the expected Codex v2 Gureum Bichon manifest.'
}

$codexRoot = if ($env:CODEX_HOME) { $env:CODEX_HOME } else { Join-Path $env:USERPROFILE '.codex' }
$petsRoot = Join-Path $codexRoot 'pets'
$target = Join-Path $petsRoot $PetId
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $petsRoot "$PetId.backup-$stamp"
$staging = Join-Path $petsRoot ".$PetId.installing-$([Guid]::NewGuid().ToString('N'))"

New-Item -ItemType Directory -Force -Path $petsRoot | Out-Null
try {
    New-Item -ItemType Directory -Path $staging | Out-Null
    Copy-Item -LiteralPath $SourceManifest -Destination (Join-Path $staging 'pet.json')
    Copy-Item -LiteralPath $SourceSheet -Destination (Join-Path $staging 'spritesheet.webp')

    if (Test-Path -LiteralPath $target) {
        Move-Item -LiteralPath $target -Destination $backup
        Write-Host "Existing pet backed up to: $backup"
    }
    Move-Item -LiteralPath $staging -Destination $target
} catch {
    if (Test-Path -LiteralPath $staging) {
        Remove-Item -LiteralPath $staging -Recurse -Force
    }
    if (-not (Test-Path -LiteralPath $target) -and (Test-Path -LiteralPath $backup)) {
        Move-Item -LiteralPath $backup -Destination $target
    }
    throw
}

Write-Host ''
Write-Host 'Gureum Bichon installed successfully.' -ForegroundColor Green
Write-Host "Location: $target"
Write-Host 'Restart Codex if the pet list is already open.'
