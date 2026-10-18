param([switch]$FunctionsOnly)
$ErrorActionPreference='Stop'

function Assert-ManagedNodeCache {
  param([string]$Archive,[string]$Destination,[string]$ExpectedHash)
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $destinationPath=[IO.Path]::GetFullPath($Destination).TrimEnd('\','/')
  $prefix=(Split-Path $destinationPath -Leaf)+'/'
  $stream=[IO.File]::Open($Archive,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  $zip=$null
  try {
    $sha=[Security.Cryptography.SHA256]::Create()
    try {$actual=([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant()} finally {$sha.Dispose()}
    if($actual -ne $ExpectedHash){throw 'Managed Node.js archive hash verification failed.'}
    $stream.Position=0
    $zip=New-Object IO.Compression.ZipArchive($stream,[IO.Compression.ZipArchiveMode]::Read,$true)
    $expectedFiles=New-Object 'Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    $cursor=$destinationPath
    while($cursor) {
      if(Test-Path -LiteralPath $cursor) {
        if((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Managed Node.js cache contains a linked directory.'}
      }
      $parent=Split-Path $cursor -Parent
      if($parent -eq $cursor){break};$cursor=$parent
    }
    foreach($entry in $zip.Entries) {
      $name=$entry.FullName
      if(-not $name.StartsWith($prefix,[StringComparison]::Ordinal) -or $name.Contains('\') -or $name.Contains(':') -or $name.Contains([char]0)){throw 'Managed Node.js archive contains an invalid path.'}
      $relative=$name.Substring($prefix.Length)
      if(-not $relative){continue}
      if(($relative -split '/') -contains '..' -or ($relative -split '/') -contains '.'){throw 'Managed Node.js archive contains traversal.'}
      if($name.EndsWith('/')){continue}
      if(-not $expectedFiles.Add($relative)){throw 'Managed Node.js archive contains duplicate paths.'}
      $file=Join-Path $destinationPath $relative
      if(-not(Test-Path -LiteralPath $file -PathType Leaf)){throw 'Managed Node.js cache is incomplete. Retained for review; no cached tools executed.'}
      $cursor=$file
      while($cursor.Length -gt $destinationPath.Length) {
        if((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Managed Node.js cache contains a linked file or directory.'}
        $cursor=Split-Path $cursor -Parent
      }
      $disk=[IO.File]::Open($file,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
      $packed=$entry.Open();$sha=[Security.Cryptography.SHA256]::Create()
      try {
        if($disk.Length -ne $entry.Length){throw 'Managed Node.js cache differs from the verified archive. Retained for review; no cached tools executed.'}
        $diskHash=[BitConverter]::ToString($sha.ComputeHash($disk))
        $packedHash=[BitConverter]::ToString($sha.ComputeHash($packed))
        if($diskHash -ne $packedHash){throw 'Managed Node.js cache differs from the verified archive. Retained for review; no cached tools executed.'}
      } finally {$disk.Dispose();$packed.Dispose();$sha.Dispose()}
    }
    if(-not $expectedFiles.Contains('node.exe') -or -not $expectedFiles.Contains('npm.cmd')){throw 'Managed Node.js archive is missing its entrypoints.'}
    $allEntries=@(Get-ChildItem -LiteralPath $destinationPath -Force -Recurse)
    if($allEntries | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }){throw 'Managed Node.js cache contains a linked entry.'}
    $actualFiles=@($allEntries | Where-Object { -not $_.PSIsContainer })
    foreach($file in $actualFiles) {
      $relative=$file.FullName.Substring($destinationPath.Length+1).Replace('\','/')
      if(-not $expectedFiles.Contains($relative)){throw 'Managed Node.js cache contains an unexpected file. Retained for review; no cached tools executed.'}
    }
    if($actualFiles.Count -ne $expectedFiles.Count){throw 'Managed Node.js cache inventory does not match its archive.'}
    Write-Host "Verified all $($expectedFiles.Count) managed Node.js files against the pinned archive."
  } finally {if($zip){$zip.Dispose()};$stream.Dispose()}
}

function Invoke-VerifiedManagedNode {
  param([string]$Archive,[string]$Destination,[string]$ExpectedHash,[string]$Version)
  Assert-ManagedNodeCache -Archive $Archive -Destination $Destination -ExpectedHash $ExpectedHash
  $actual=& (Join-Path $Destination 'node.exe') --version
  if($LASTEXITCODE -ne 0 -or $actual -ne "v$Version"){throw 'Portable Node.js did not pass version verification.'}
  & (Join-Path $Destination 'npm.cmd') --version
  if($LASTEXITCODE -ne 0){throw 'Portable npm is unavailable.'}
  $env:PATH=$Destination+';'+$env:PATH
  Write-Host "Verified user-scoped Node.js $actual. No administrator access or persistent PATH change was required."
}

if($FunctionsOnly){return}
$version='26.4.0'
$expected='5f87d038c6ec442aa46b9126f8ca170acbd2f3b9b9152ca798cf54596a31e214'
$tools=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'MaterialBrowser/BuildTools'
$existing=Get-Command node.exe -ErrorAction SilentlyContinue
$npm=Get-Command npm.cmd -ErrorAction SilentlyContinue
$managedPrefix=[IO.Path]::GetFullPath($tools).TrimEnd('\')+'\'
# A managed cache on PATH must still pass archive verification. Only external
# installations use the separately trusted existing-installation route.
if($existing -and $npm -and -not $existing.Source.StartsWith($managedPrefix,[StringComparison]::OrdinalIgnoreCase) -and -not $npm.Source.StartsWith($managedPrefix,[StringComparison]::OrdinalIgnoreCase)) {
  $installedVersion=& $existing.Source --version
  if($LASTEXITCODE -eq 0 -and $installedVersion -match '^v(2[4-9]|[3-9][0-9])\.') { Write-Host "Using separately trusted installed Node.js $installedVersion"; return }
}
$archive=Join-Path $tools "node-v$version-win-x64.zip"
$destination=Join-Path $tools "node-v$version-win-x64"
New-Item -ItemType Directory -Force -Path $tools | Out-Null
if(-not(Test-Path -LiteralPath $archive) -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) {
  $temporary=$archive+'.download'
  Invoke-WebRequest -UseBasicParsing -Uri "https://nodejs.org/dist/v$version/node-v$version-win-x64.zip" -OutFile $temporary
  if((Get-FileHash -LiteralPath $temporary -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected){throw 'Node.js download hash verification failed.'}
  Move-Item -LiteralPath $temporary -Destination $archive -Force
}
# Never overlay an existing cache. Any drift is rejected before Node or npm runs.
if(-not(Test-Path -LiteralPath $destination)){Expand-Archive -LiteralPath $archive -DestinationPath $tools}
Invoke-VerifiedManagedNode -Archive $archive -Destination $destination -ExpectedHash $expected -Version $version
