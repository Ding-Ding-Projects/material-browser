$ErrorActionPreference='Stop'
$existing=Get-Command node.exe -ErrorAction SilentlyContinue
if($existing -and (Get-Command npm.cmd -ErrorAction SilentlyContinue)) {
  $version=& $existing.Source --version
  if($LASTEXITCODE -eq 0 -and $version -match '^v(2[4-9]|[3-9][0-9])\.') { Write-Host "Using compatible Node.js $version"; return }
}
$version='26.4.0'
$expected='5f87d038c6ec442aa46b9126f8ca170acbd2f3b9b9152ca798cf54596a31e214'
$tools=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MaterialBrowser/BuildTools'
$archive=Join-Path $tools "node-v$version-win-x64.zip"
$destination=Join-Path $tools "node-v$version-win-x64"
New-Item -ItemType Directory -Force -Path $tools | Out-Null
if(-not(Test-Path -LiteralPath $archive) -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) {
  $temporary=$archive+'.download'
  Invoke-WebRequest -UseBasicParsing -Uri "https://nodejs.org/dist/v$version/node-v$version-win-x64.zip" -OutFile $temporary
  if((Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected){throw 'Node.js download hash verification failed.'}
  Move-Item -LiteralPath $temporary -Destination $archive -Force
}
if(-not(Test-Path -LiteralPath (Join-Path $destination 'node.exe'))){Expand-Archive -LiteralPath $archive -DestinationPath $tools -Force}
$env:PATH=$destination+';'+$env:PATH
$actual=& (Join-Path $destination 'node.exe') --version
if($LASTEXITCODE -ne 0 -or $actual -ne "v$version"){throw 'Portable Node.js did not pass version verification.'}
& (Join-Path $destination 'npm.cmd') --version
if($LASTEXITCODE -ne 0){throw 'Portable npm is unavailable.'}
Write-Host "Verified user-scoped Node.js $actual. No administrator access or persistent PATH change was required."
