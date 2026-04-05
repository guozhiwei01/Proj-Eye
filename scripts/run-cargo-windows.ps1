param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]] $Args
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Quote-BatchArg {
  param([string] $Value)

  if ([string]::IsNullOrEmpty($Value)) {
    return '""'
  }

  if ($Value -notmatch '[\s"&|<>^()]') {
    return $Value
  }

  return '"' + ($Value -replace '"', '""') + '"'
}

function Resolve-VcvarsPath {
  $vswherePath = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
  if (Test-Path $vswherePath) {
    $installPath = & $vswherePath -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if ($LASTEXITCODE -eq 0 -and $installPath) {
      $candidate = Join-Path $installPath.Trim() "VC\Auxiliary\Build\vcvars64.bat"
      if (Test-Path $candidate) {
        return $candidate
      }
    }
  }

  $fallback = "C:\BuildTools\VC\Auxiliary\Build\vcvars64.bat"
  if (Test-Path $fallback) {
    return $fallback
  }

  throw "Unable to locate vcvars64.bat. Install Visual Studio Build Tools with MSVC."
}

$cargoBin = Join-Path $env:USERPROFILE ".cargo\bin"
$cargoExe = Join-Path $cargoBin "cargo.exe"
if (-not (Test-Path $cargoExe)) {
  throw "Cargo is not installed at $cargoExe."
}

$vcvarsPath = Resolve-VcvarsPath
$srcTauriRoot = Join-Path (Split-Path -Parent $PSScriptRoot) "src-tauri"
$cargoArgs = @($cargoExe) + $Args
$commandLine = ($cargoArgs | ForEach-Object { Quote-BatchArg $_ }) -join " "
$tempScript = Join-Path $env:TEMP ("proj-eye-cargo-" + [guid]::NewGuid().ToString("N") + ".cmd")

@"
@echo off
cd /d "$srcTauriRoot"
call "$vcvarsPath"
if errorlevel 1 exit /b %errorlevel%
set "PATH=$cargoBin;%PATH%"
$commandLine
exit /b %errorlevel%
"@ | Set-Content -Path $tempScript -Encoding ASCII

try {
  & cmd.exe /c $tempScript
  exit $LASTEXITCODE
} finally {
  Remove-Item -LiteralPath $tempScript -Force -ErrorAction SilentlyContinue
}
