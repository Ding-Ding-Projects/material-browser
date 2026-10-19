param(
  [ValidateSet('All','Core','Engine','Host','Desktop','Storage','StorageWeb','HostingWizard','BrowserNative','Docs','DocsCompanion')][string]$Component='All',
  [ValidateSet('chromium','firefox')][string]$NativeEngine='chromium',
  [switch]$AcquireOnly,
  [switch]$NativeCookieSnapshotTests,
  [switch]$NativeChromiumChannelTests
)
$ErrorActionPreference='Stop'
# A batch launch can inherit module paths for a different PowerShell edition.
# Resolve the built-in utility manifest from this host before invoking helpers.
Import-Module (Join-Path $PSHOME 'Modules/Microsoft.PowerShell.Utility/Microsoft.PowerShell.Utility.psd1') -Global -Force -ErrorAction Stop
if($NativeChromiumChannelTests -and ($Component -ne 'BrowserNative' -or $NativeEngine -ne 'chromium' -or $AcquireOnly -or $NativeCookieSnapshotTests -or $env:MATERIAL_BROWSER_NATIVE_BASELINE_ONLY -eq '1')){
  throw 'NativeChromiumChannelTests requires Chromium BrowserNative without AcquireOnly, NativeCookieSnapshotTests or baseline-only diagnostics.'
}
if($NativeCookieSnapshotTests -and ($Component -ne 'BrowserNative' -or $NativeEngine -ne 'firefox' -or $AcquireOnly -or $env:MATERIAL_BROWSER_NATIVE_BASELINE_ONLY -eq '1')){
  throw 'NativeCookieSnapshotTests requires a Firefox BrowserNative production build without AcquireOnly or baseline-only diagnostics.'
}
$root=Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
  if($Component -in @('All','Desktop','DocsCompanion')) {
    & (Join-Path $root 'apps/docs-companion/scripts/ensure-node.ps1')
  }
  if($Component -in @('All','Desktop')) {
    $historyRuntimeJson = & (Join-Path $root 'scripts/ensure-history-git.ps1') | Out-String
    $historyRuntime = $historyRuntimeJson | ConvertFrom-Json
    if($historyRuntime.schemaVersion -ne 1 -or $historyRuntime.payloadFileCount -ne 373 -or
       $historyRuntime.version -cne '2.56.0.windows.2' -or
       -not [IO.Path]::IsPathRooted($historyRuntime.gitExecutable)) {
      throw 'The verified history runtime descriptor is invalid.'
    }
    Write-Host 'Verified portable history runtime: Git for Windows 2.56.0.windows.2, 373 files.'
  }
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
      & node (Join-Path $root 'engines/prepare-runtime.mjs')
      if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
      if($env:MATERIAL_BROWSER_BUNDLE_ONLY -eq '1'){ & npm.cmd run build:bundle }
      else { & npm.cmd run build }
      if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
    } finally { Pop-Location }
  }
  if($Component -in @('All','Docs','DocsCompanion')) {
    if(-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)){throw 'Node.js is required for documentation.'}
    Push-Location (Join-Path $root 'apps/docs')
    try {
      & npm.cmd ci --no-audit --no-fund
      if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
      & npm.cmd run build
      if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
    } finally { Pop-Location }
  }
  if($Component -eq 'DocsCompanion') {
    Push-Location (Join-Path $root 'apps/docs-companion')
    try {
      & npm.cmd ci --no-audit --no-fund
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
    & docker build --tag material-browser-storage:local --file apps/storage/Dockerfile .
    if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
  }
  if($Component -eq 'BrowserNative') {
    $nativeArgs=@{Engine=$NativeEngine}
    if($AcquireOnly){$nativeArgs.AcquireOnly=$true}
    if($NativeCookieSnapshotTests){$nativeArgs.CookieSnapshotTests=$true}
    if($NativeChromiumChannelTests){$nativeArgs.ChromiumChannelTests=$true}
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
