$ErrorActionPreference = "Stop"

function New-TextFromCodePoints([int[]]$codes) {
  return -join ($codes | ForEach-Object { [char]$_ })
}

$appName = New-TextFromCodePoints @(35821, 38899, 26085, 21382, 24037, 20855)
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$distDir = Join-Path $root "dist"
$sourceExe = Join-Path $distDir ($appName + ".exe")
$payloadDir = Join-Path $root "build\installer_payload"
$payloadExe = Join-Path $payloadDir "VoiceCalendar.exe"
$pythonExe = "D:\voice_cal_venv\Scripts\python.exe"

if (-not (Test-Path $sourceExe)) {
  throw "Please run build.bat before building the installer."
}

if (-not (Test-Path $pythonExe)) {
  throw "PyInstaller Python runtime was not found: $pythonExe"
}

New-Item -ItemType Directory -Force -Path $payloadDir | Out-Null
Copy-Item -LiteralPath $sourceExe -Destination $payloadExe -Force

Push-Location $root
try {
  & $pythonExe -m PyInstaller installer.spec --clean --noconfirm
  if ($LASTEXITCODE -ne 0) {
    throw "PyInstaller failed with exit code $LASTEXITCODE"
  }
} finally {
  Pop-Location
}

$setupExe = Join-Path $distDir ($appName + "-Setup.exe")
if (-not (Test-Path $setupExe)) {
  throw "Installer build failed."
}

Write-Host ("Installer created: " + $setupExe)
