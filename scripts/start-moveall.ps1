$ErrorActionPreference = "Stop"

$workspacePath = Split-Path -Parent $PSScriptRoot
$userProfilePath = [Environment]::GetFolderPath("UserProfile")
$runtimePath = Join-Path $userProfilePath ".cache\codex-runtimes\codex-primary-runtime\dependencies"
$nodePath = Join-Path $runtimePath "node\bin\node.exe"
$pnpmPath = Join-Path $runtimePath "bin\fallback\pnpm.cmd"
$appUrl = "http://localhost:8081/"

if (-not (Test-Path -LiteralPath $nodePath)) {
  throw "GROOV 실행에 필요한 Node.js를 찾지 못했습니다: $nodePath"
}

if (-not (Test-Path -LiteralPath $pnpmPath)) {
  throw "GROOV 실행에 필요한 pnpm을 찾지 못했습니다: $pnpmPath"
}

function Test-LocalPort {
  param([int]$Port)

  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $connectTask = $client.ConnectAsync("127.0.0.1", $Port)
    return $connectTask.Wait(350) -and $client.Connected
  }
  catch {
    return $false
  }
  finally {
    $client.Dispose()
  }
}

$env:AUTH_SECRET = "moveall-local-development-secret-2026"
$env:Path = "$(Split-Path -Parent $nodePath);$env:Path"

if (-not (Test-LocalPort -Port 3000)) {
  Start-Process `
    -FilePath $nodePath `
    -ArgumentList "apps/api/dist/server.js" `
    -WorkingDirectory $workspacePath `
    -WindowStyle Hidden
}

if (-not (Test-LocalPort -Port 8081)) {
  Start-Process `
    -FilePath $pnpmPath `
    -ArgumentList "--filter", "@moveall/mobile", "dev" `
    -WorkingDirectory $workspacePath `
    -WindowStyle Hidden
}

$deadline = [DateTime]::UtcNow.AddSeconds(35)
while ([DateTime]::UtcNow -lt $deadline) {
  if (Test-LocalPort -Port 3000 -and Test-LocalPort -Port 8081) {
    Start-Process -FilePath $appUrl
    exit 0
  }
  Start-Sleep -Milliseconds 500
}

throw "GROOV 서버가 제한 시간 안에 시작되지 않았습니다."
