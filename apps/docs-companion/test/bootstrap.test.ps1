$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot '../scripts/ensure-node.ps1') -FunctionsOnly
$fixture=Join-Path ([IO.Path]::GetTempPath()) ('handbook-bootstrap-'+[guid]::NewGuid().ToString('N'))
$source=Join-Path $fixture 'source/node-v26.4.0-win-x64'
$cache=Join-Path $fixture 'cache/node-v26.4.0-win-x64'
$archive=Join-Path $fixture 'node.zip'
$sentinel=Join-Path $fixture 'executed.txt'
$passed=0
function Expect-Rejection([scriptblock]$Action,[string]$Name) {
  $rejected=$false
  try { & $Action } catch {
    if($_.Exception.Message -notmatch 'Managed Node.js (cache|archive)'){throw}
    $rejected=$true
  }
  if(-not $rejected){throw "Expected rejection: $Name"}
  if(Test-Path -LiteralPath $sentinel){throw 'Modified cached code executed.'}
  $script:passed++
  Write-Host "PASS: $Name rejected before tool execution."
}
try {
  New-Item -ItemType Directory -Force -Path (Join-Path $source 'node_modules/npm/bin'),(Split-Path $cache -Parent) | Out-Null
  [IO.File]::WriteAllText((Join-Path $source 'node.exe'),'Non-executable fixture: must never run.')
  [IO.File]::WriteAllText((Join-Path $source 'npm.cmd'),"@echo off`r`necho fixture`r`n")
  [IO.File]::WriteAllText((Join-Path $source 'node_modules/npm/bin/npm-cli.js'),'console.log("fixture");')
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $zip=[IO.Compression.ZipFile]::Open($archive,[IO.Compression.ZipArchiveMode]::Create)
  try {
    $base=Split-Path $source -Parent
    foreach($file in (Get-ChildItem -LiteralPath $source -Recurse -File)) {
      $entry=$zip.CreateEntry($file.FullName.Substring($base.Length+1).Replace('\','/'))
      $input=[IO.File]::OpenRead($file.FullName);$output=$entry.Open()
      try{$input.CopyTo($output)}finally{$input.Dispose();$output.Dispose()}
    }
  }finally{$zip.Dispose()}
  $expected=(Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
  Expand-Archive -LiteralPath $archive -DestinationPath (Split-Path $cache -Parent)
  Assert-ManagedNodeCache -Archive $archive -Destination $cache -ExpectedHash $expected
  $passed++;Write-Host 'PASS: complete unchanged cache accepted.'
  [IO.File]::WriteAllText((Join-Path $cache 'npm.cmd'),"@echo off`r`necho executed > `"$sentinel`"`r`n")
  Expect-Rejection { Invoke-VerifiedManagedNode -Archive $archive -Destination $cache -ExpectedHash $expected -Version '26.4.0' } 'Modified npm.cmd with unchanged ZIP'
  Copy-Item -LiteralPath (Join-Path $source 'npm.cmd') -Destination (Join-Path $cache 'npm.cmd') -Force
  [IO.File]::WriteAllText((Join-Path $cache 'node_modules/npm/bin/npm-cli.js'),'console.log("altered");')
  Expect-Rejection { Invoke-VerifiedManagedNode -Archive $archive -Destination $cache -ExpectedHash $expected -Version '26.4.0' } 'Modified npm module with unchanged ZIP'
  Copy-Item -LiteralPath (Join-Path $source 'node_modules/npm/bin/npm-cli.js') -Destination (Join-Path $cache 'node_modules/npm/bin/npm-cli.js') -Force
  [IO.File]::WriteAllText((Join-Path $cache 'extra.cmd'),'unexpected')
  Expect-Rejection { Invoke-VerifiedManagedNode -Archive $archive -Destination $cache -ExpectedHash $expected -Version '26.4.0' } 'Unexpected cached script'
  Remove-Item -LiteralPath (Join-Path $cache 'extra.cmd')
  Assert-ManagedNodeCache -Archive $archive -Destination $cache -ExpectedHash $expected
  $passed++;Write-Host 'PASS: restored cache accepted.'
  Expect-Rejection { Invoke-VerifiedManagedNode -Archive $archive -Destination $cache -ExpectedHash ('0'*64) -Version '26.4.0' } 'Archive digest mismatch'
  if((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected){throw 'Fixture ZIP unexpectedly changed.'}
  Write-Host "Bootstrap verification: $passed passed, 0 failed."
} finally {
  $resolved=[IO.Path]::GetFullPath($fixture)
  if($resolved.StartsWith([IO.Path]::GetFullPath([IO.Path]::GetTempPath()),[StringComparison]::OrdinalIgnoreCase) -and (Split-Path $resolved -Leaf) -like 'handbook-bootstrap-*') { Remove-Item -LiteralPath $resolved -Recurse -Force }
}
