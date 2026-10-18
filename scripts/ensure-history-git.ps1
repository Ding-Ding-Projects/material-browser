param([string]$CacheRoot,[string]$PayloadRoot,[switch]$VerifyOnly,[switch]$FunctionsOnly)
$ErrorActionPreference='Stop'

function Assert-HistoryGitEntry {
  param([string]$Path)
  $item=Get-Item -LiteralPath $Path -Force
  if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -or $item.LinkType){throw 'History runtime contains a linked entry; no runtime executed.'}
  return $item
}
function Assert-HistoryGitAncestors {
  param([string]$Path)
  $cursor=[IO.Path]::GetFullPath($Path)
  while($cursor){
    if(Test-Path -LiteralPath $cursor){$null=Assert-HistoryGitEntry $cursor}
    $parent=Split-Path $cursor -Parent
    if($parent -eq $cursor){break};$cursor=$parent
  }
}
function Read-HistoryGitLock {
  $file=Join-Path (Split-Path $PSScriptRoot -Parent) 'engines/runtime/history-git.lock.json'
  $lock=Get-Content -LiteralPath $file -Raw|ConvertFrom-Json
  if($lock.schemaVersion -ne 1 -or $lock.repository -cne 'git-for-windows/git' -or
    $lock.release -cne 'v2.56.0.windows.2' -or $lock.asset -cne 'MinGit-2.56.0.2-64-bit.zip' -or
    $lock.archiveSha256 -cne 'da35e72aa21c005a5a0d298cfbae110bc1609a815730ea0dde84b01a1b3cd3be' -or
    $lock.executable -cne 'cmd/git.exe' -or $lock.license -cne 'LICENSE.txt' -or $lock.files.Count -ne 373){throw 'Invalid trusted history runtime lock.'}
  return $lock
}
function Get-HistoryGitInventory {
  param($Lock)
  $files=New-Object 'Collections.Generic.Dictionary[string,object]' ([StringComparer]::OrdinalIgnoreCase)
  $directories=New-Object 'Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
  foreach($entry in $Lock.files){
    if($entry.path -notmatch '^[A-Za-z0-9_.+@/-]+$' -or [IO.Path]::IsPathRooted($entry.path) -or
      ($entry.path -split '/') -contains '..' -or ($entry.path -split '/') -contains '.' -or
      $entry.path.Contains('//') -or $entry.sha256 -notmatch '^[a-f0-9]{64}$' -or $entry.size -lt 0 -or
      $files.ContainsKey($entry.path)){throw 'Invalid history runtime inventory.'}
    $files.Add($entry.path,$entry)
    $parent=$entry.path
    while($parent.Contains('/')){$parent=$parent.Substring(0,$parent.LastIndexOf('/'));$null=$directories.Add($parent)}
  }
  if(-not $files.ContainsKey($Lock.executable) -or -not $files.ContainsKey($Lock.license)){throw 'History runtime inventory is incomplete.'}
  return @{files=$files;directories=$directories}
}
function Assert-HistoryGitPayload {
  param([string]$Root,$Lock)
  $rootPath=[IO.Path]::GetFullPath($Root).TrimEnd('\','/')
  Assert-HistoryGitAncestors $rootPath
  if(-not(Test-Path -LiteralPath $rootPath -PathType Container)){throw 'History runtime payload is missing.'}
  $inventory=Get-HistoryGitInventory $Lock
  $pending=New-Object 'Collections.Generic.Stack[string]';$pending.Push($rootPath)
  $count=0
  while($pending.Count){
    foreach($child in Get-ChildItem -LiteralPath $pending.Pop() -Force){
      $item=Assert-HistoryGitEntry $child.FullName
      $relative=$item.FullName.Substring($rootPath.Length+1).Replace('\','/')
      if($item.PSIsContainer){
        if(-not $inventory.directories.Contains($relative)){throw 'History runtime has an unexpected directory; no runtime executed.'}
        $pending.Push($item.FullName);continue
      }
      if(-not $inventory.files.ContainsKey($relative)){throw 'History runtime has an unexpected file; no runtime executed.'}
      $expected=$inventory.files[$relative]
      if($item.Length -ne $expected.size -or (Get-FileHash -LiteralPath $item.FullName -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expected.sha256){throw 'History runtime file verification failed; cache retained and no runtime executed.'}
      $count++
    }
  }
  if($count -ne $inventory.files.Count){throw 'History runtime payload is incomplete; no runtime executed.'}
  return [pscustomobject]@{schemaVersion=1;version=$Lock.version;payloadRoot=$rootPath;gitExecutable=(Join-Path $rootPath $Lock.executable);gitSha256=$inventory.files[$Lock.executable].sha256;payloadFileCount=$count;licensePath=(Join-Path $rootPath $Lock.license)}
}
function Assert-HistoryGitArchive {
  param([string]$Archive,$Lock)
  $item=Assert-HistoryGitEntry $Archive
  if($item.Length -ne $Lock.archiveSize -or (Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Lock.archiveSha256){throw 'Official history runtime archive verification failed; retained without execution.'}
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip=[IO.Compression.ZipFile]::OpenRead($Archive)
  try {
    $inventory=Get-HistoryGitInventory $Lock
    $seen=New-Object 'Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach($entry in $zip.Entries){
      $name=$entry.FullName
      if($name.EndsWith('/')){if(-not $inventory.directories.Contains($name.TrimEnd('/'))){throw 'Unexpected archive directory.'};continue}
      if(-not $inventory.files.ContainsKey($name) -or -not $seen.Add($name) -or
        (($entry.ExternalAttributes -shr 16) -band 0xF000) -eq 0xA000 -or $entry.Length -ne $inventory.files[$name].size){throw 'Unexpected history runtime archive entry.'}
    }
    if($seen.Count -ne $inventory.files.Count){throw 'Incomplete history runtime archive.'}
  } finally {$zip.Dispose()}
}
function Ensure-HistoryGit {
  param([string]$Root)
  $lock=Read-HistoryGitLock
  $cache=[IO.Path]::GetFullPath($Root)
  Assert-HistoryGitAncestors $cache
  New-Item -ItemType Directory -Path $cache -Force|Out-Null
  $archive=Join-Path $cache $lock.asset
  $destination=Join-Path $cache $lock.release
  if(-not(Test-Path -LiteralPath $archive)){
    if(-not(Get-Command gh -ErrorAction SilentlyContinue)){throw 'GitHub CLI is required to acquire the pinned official history runtime.'}
    $download=Join-Path $cache ('download-'+[guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $download|Out-Null
    & gh release download $lock.release --repo $lock.repository --pattern $lock.asset --dir $download
    if($LASTEXITCODE -ne 0){throw 'Official history runtime acquisition failed; no payload executed.'}
    $temporary=Join-Path $download $lock.asset
    Assert-HistoryGitArchive $temporary $lock
    Move-Item -LiteralPath $temporary -Destination $archive
  }
  Assert-HistoryGitArchive $archive $lock
  if(-not(Test-Path -LiteralPath $destination)){
    $stage=Join-Path $cache ('extract-'+[guid]::NewGuid().ToString('N'))
    Expand-Archive -LiteralPath $archive -DestinationPath $stage
    $null=Assert-HistoryGitPayload $stage $lock
    Move-Item -LiteralPath $stage -Destination $destination
  }
  $descriptor=Assert-HistoryGitPayload $destination $lock
  Invoke-HistoryGitVersion $descriptor $lock.version
  return $descriptor
}
function Invoke-HistoryGitVersion {
  param($Descriptor,[string]$Version)
  $actual=& $Descriptor.gitExecutable --version
  if($LASTEXITCODE -ne 0 -or $actual -cne ('git version '+$Version)){throw 'Verified history runtime did not report its pinned version.'}
}
if($FunctionsOnly){return}
if($env:OS -ne 'Windows_NT'){throw 'The history runtime supports Windows x64 only.'}
if($VerifyOnly){
  if(-not $PayloadRoot){throw 'VerifyOnly requires the exact trusted payload root.'}
  Assert-HistoryGitPayload $PayloadRoot (Read-HistoryGitLock)|ConvertTo-Json -Compress
} else {
  if($PayloadRoot){throw 'PayloadRoot is read-only and requires VerifyOnly.'}
  if(-not $CacheRoot){$CacheRoot=Join-Path (Split-Path $PSScriptRoot -Parent) '.cache/history-git'}
  Ensure-HistoryGit $CacheRoot|ConvertTo-Json -Compress
}
