param([ValidateSet('Desktop','HostingWizard')][string]$Component='Desktop')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
$buildComponent=if($Component -eq 'Desktop'){'All'}else{'HostingWizard'}
& (Join-Path $root 'build.bat') -Component $buildComponent
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
$packageDirectory=if($Component -eq 'Desktop'){'apps/desktop'}else{'apps/hosting-wizard'}
$packageCommand=if($Component -eq 'Desktop'){'make'}else{'package'}
Push-Location (Join-Path $root $packageDirectory)
try {
  & npm.cmd run $packageCommand
  if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
} finally { Pop-Location }
