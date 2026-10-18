param([ValidateSet('Desktop','HostingWizard','DocsCompanion')][string]$Component='Desktop')
$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot -Parent
if($Component -eq 'DocsCompanion') { & (Join-Path $root 'apps/docs-companion/scripts/ensure-node.ps1') }
$buildComponent=if($Component -eq 'Desktop'){'All'}else{$Component}
& (Join-Path $root 'build.bat') -Component $buildComponent
if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
$packageDirectory=switch($Component){'Desktop'{'apps/desktop'}'HostingWizard'{'apps/hosting-wizard'}'DocsCompanion'{'apps/docs-companion'}}
$packageCommand=if($Component -eq 'Desktop'){'make'}else{'package'}
Push-Location (Join-Path $root $packageDirectory)
try {
  & npm.cmd run $packageCommand
  if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
} finally { Pop-Location }
