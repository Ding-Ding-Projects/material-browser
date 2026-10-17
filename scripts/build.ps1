param(
  [ValidateSet('All','Core','Engine','Host','Desktop','Storage','StorageWeb','HostingWizard','BrowserNative')][string]$Component='All',
  [ValidateSet('chromium','firefox')][string]$NativeEngine='chromium',
  [switch]$AcquireOnly
)
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
  if($Component -in @('All','Core','Engine','Host')) {
    if(-not (Get-Command cargo -ErrorAction SilentlyContinue)){throw 'Rust is required. Bootstrap is not yet available on this host.'}
    $packages=@{Core='material-browser-core';Engine='material-browser-engine';Host='material-browser'}
    if($Component -eq 'All'){ & cargo build --release --workspace }
    else { & cargo build --release -p $packages[$Component] }
    if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
  }
  if($Component -in @('All','Desktop')) {
    if(-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)){throw 'Node.js is required. Bootstrap is not yet available on this host.'}
    Push-Location (Join-Path $root 'apps/desktop')
    try {
      if(Test-Path 'package-lock.json'){ & npm.cmd ci --no-audit --no-fund }else{ & npm.cmd install --no-audit --no-fund }
      if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
      & npm.cmd run build
      if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
    } finally { Pop-Location }
  }
  if($Component -in @('Storage','StorageWeb','HostingWizard')) {
    if(-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)){throw 'Node.js is required for the storage interface.'}
    Push-Location (Join-Path $root 'apps/storage/web')
    try {
      if(Test-Path 'package-lock.json'){ & npm.cmd ci --no-audit --no-fund }else{ & npm.cmd install --no-audit --no-fund }
      if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
      & npm.cmd run build
      if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
    } finally { Pop-Location }
  }
  if($Component -eq 'Storage') {
    if(-not (Get-Command docker -ErrorAction SilentlyContinue)){throw 'Container runtime is unavailable.'}
    & docker build --tag material-browser-storage:local --file apps/storage/Dockerfile apps/storage
    if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
  }
  if($Component -eq 'BrowserNative') {
    $nativeArgs=@{Engine=$NativeEngine}
    if($AcquireOnly){$nativeArgs.AcquireOnly=$true}
    & (Join-Path $root 'engines/build-native.ps1') @nativeArgs
    if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
  }
  if($Component -eq 'HostingWizard') {
    Push-Location (Join-Path $root 'apps/hosting-wizard')
    try {
      if(Test-Path 'package-lock.json'){ & npm.cmd ci --no-audit --no-fund }else{ & npm.cmd install --no-audit --no-fund }
      if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
      & npm.cmd run build
      if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
    } finally { Pop-Location }
  }
} finally { Pop-Location }
