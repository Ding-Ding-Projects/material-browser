param([string]$TestRoot)
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'ensure-history-git.ps1') -FunctionsOnly
if(-not $TestRoot){$TestRoot=Join-Path (Split-Path $PSScriptRoot -Parent) ('.cache/history-git-tests/'+[guid]::NewGuid().ToString('N'))}
New-Item -ItemType Directory -Path $TestRoot -Force|Out-Null
$before=$env:PATH
$cold=Join-Path $TestRoot 'cold'
$descriptor=Ensure-HistoryGit $cold
if($descriptor.payloadFileCount -ne 373 -or -not(Test-Path -LiteralPath $descriptor.licensePath)){throw 'Incomplete official payload.'}
if($env:PATH -cne $before){throw 'Bootstrap changed PATH.'}
$archive=Join-Path $cold 'MinGit-2.56.0.2-64-bit.zip'
$archiveTime=(Get-Item -LiteralPath $archive).LastWriteTimeUtc
$reused=Ensure-HistoryGit $cold
if($reused.gitSha256 -cne $descriptor.gitSha256 -or (Get-Item -LiteralPath $archive).LastWriteTimeUtc -ne $archiveTime){throw 'Verified cache was not reused.'}
$lock=Read-HistoryGitLock
$originalProbe=(Get-Item Function:Invoke-HistoryGitVersion).ScriptBlock
$script:executionAttempted=$false
function Invoke-HistoryGitVersion { $script:executionAttempted=$true;throw 'Unexpected runtime execution.' }
$cases=0
foreach($kind in @('executable','support-file','unexpected-file','missing-license','archive','hardlink')){
  $fixture=Join-Path $TestRoot $kind
  New-Item -ItemType Directory -Path $fixture|Out-Null
  Copy-Item -LiteralPath $archive -Destination $fixture
  $payload=Join-Path $fixture $lock.release
  Copy-Item -LiteralPath $descriptor.payloadRoot -Destination $payload -Recurse
  switch($kind){
    'executable' {[IO.File]::AppendAllText((Join-Path $payload 'cmd/git.exe'),'tampered')}
    'support-file' {[IO.File]::AppendAllText((Join-Path $payload 'etc/gitconfig'),'tampered')}
    'unexpected-file' {[IO.File]::WriteAllText((Join-Path $payload 'unexpected.dll'),'not trusted')}
    'missing-license' {Move-Item -LiteralPath (Join-Path $payload 'LICENSE.txt') -Destination (Join-Path $fixture 'preserved-license.txt')}
    'archive' {[IO.File]::AppendAllText((Join-Path $fixture $lock.asset),'tampered')}
    'hardlink' {
      $file=Join-Path $payload 'cmd/git.exe';$preserved=Join-Path $fixture 'preserved-git.exe'
      Move-Item -LiteralPath $file -Destination $preserved
      New-Item -ItemType HardLink -Path $file -Target $preserved|Out-Null
    }
  }
  $blocked=$false
  try {$null=Ensure-HistoryGit $fixture} catch {$blocked=$true}
  if(-not $blocked -or $script:executionAttempted){throw 'Tampered cache reached the runtime execution boundary.'}
  $cases++
}
Set-Item Function:Invoke-HistoryGitVersion $originalProbe
$verified=Assert-HistoryGitPayload $descriptor.payloadRoot $lock
Invoke-HistoryGitVersion $verified $lock.version
if($env:PATH -cne $before){throw 'Verification changed PATH.'}
Write-Output "PASS: official cold acquisition, complete 373-file inventory and licenses, real pinned command, cache reuse, $cases tamper refusals before execution, and unchanged PATH."
