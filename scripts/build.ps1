param([ValidateSet('All','Core','Engine','Host','Desktop')][string]$Component='All')
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
} finally { Pop-Location }
