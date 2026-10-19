$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
foreach($name in @('GITHUB_REPOSITORY','GITHUB_SHA','GITHUB_RUN_ID','GITHUB_RUN_NUMBER','GITHUB_RUN_ATTEMPT')) {
  if(-not [Environment]::GetEnvironmentVariable($name)){throw "Missing workflow context: $name"}
}
if($env:GITHUB_SHA -notmatch '^[a-f0-9]{40}$'){throw 'Invalid source commit.'}
$root=Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
  $files=@(Get-ChildItem 'apps/desktop/out/make/squirrel.windows/x64' -File | Where-Object { $_.Name -eq 'RELEASES' -or $_.Extension -in @('.exe','.nupkg') })
  if(-not ($files | Where-Object Extension -eq '.exe') -or -not ($files | Where-Object Name -eq 'RELEASES') -or -not ($files | Where-Object Name -like '*-full.nupkg')) {throw 'Incomplete Squirrel.Windows output.'}
  $handbooks=@(Get-ChildItem 'apps/docs-companion/release/Material-Browser-Handbook-*.exe' -File)
  if($handbooks.Count -ne 1){throw 'Expected exactly one portable handbook executable.'}
  $files+= $handbooks
  $manifest=@($files | ForEach-Object { @{name=$_.Name; bytes=$_.Length; sha256=(Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()} })
  if(@($manifest | Where-Object bytes -le 0).Count){throw 'Empty release asset.'}
  $manifest | ConvertTo-Json -Depth 4 | Set-Content '.agent/release/assets.json'
  $tag="build-$($env:GITHUB_RUN_NUMBER)-$($env:GITHUB_RUN_ID)-$($env:GITHUB_RUN_ATTEMPT)"
  $started=[DateTimeOffset]::Parse((Get-Content '.agent/release/started.txt' -Raw).Trim())
  $notes=@"
Material Browser automated Windows build from commit $env:GITHUB_SHA.

Includes the unsigned Squirrel.Windows desktop installer, update packages and single-file offline handbook. Windows may show an unknown-publisher or SmartScreen warning. These are development builds of an incomplete product, not a claim of runtime acceptance.

No tests, lint or standalone type checks ran in this workflow. Packaging success does not establish application correctness, native browser capabilities or installation verification.

Workflow started: $($started.ToUniversalTime().ToString('o'))
Workflow completed: pending publication readback
Workflow duration: pending publication readback

No dim-sum code name is assigned because an unused catalog identity and published photo have not been verified for this build.
"@
  $notes | Set-Content '.agent/release/notes.txt'
  $assets=@($files.FullName)+@((Join-Path $root '.agent/release/assets.json'))
  & gh release create $tag @assets --repo $env:GITHUB_REPOSITORY --target $env:GITHUB_SHA --title "Material Browser $tag" --notes-file '.agent/release/notes.txt' --latest=false
  if($LASTEXITCODE -ne 0){throw 'Release publication failed.'}
  $releaseJson=& gh release view $tag --repo $env:GITHUB_REPOSITORY --json isDraft,isPrerelease,assets,url
  if($LASTEXITCODE -ne 0){throw 'Release readback failed.'}
  $release=$releaseJson | ConvertFrom-Json
  if($release.isDraft -or $release.isPrerelease){throw 'Release must be normal, not draft or prerelease.'}
  foreach($asset in $manifest) {
    $found=@($release.assets | Where-Object name -eq $asset.name)
    if($found.Count -ne 1 -or $found[0].size -ne $asset.bytes){throw "Release asset mismatch: $($asset.name)"}
  }
  $tagJson=& gh api "repos/$env:GITHUB_REPOSITORY/git/ref/tags/$tag"
  if($LASTEXITCODE -ne 0){throw 'Release tag readback failed.'}
  $ref=$tagJson | ConvertFrom-Json
  if($ref.object.type -ne 'commit' -or $ref.object.sha -ne $env:GITHUB_SHA){throw 'Release tag does not identify the exact source commit.'}
  $completed=[DateTimeOffset]::UtcNow
  $elapsed=$completed-$started
  $duration='{0:00}:{1:00}:{2:00}' -f [Math]::Floor($elapsed.TotalHours),$elapsed.Minutes,$elapsed.Seconds
  $notes=$notes.Replace('Workflow completed: pending publication readback',"Workflow completed: $($completed.ToString('o'))").Replace('Workflow duration: pending publication readback',"Workflow duration: $duration")
  $notes | Set-Content '.agent/release/notes.txt'
  & gh release edit $tag --repo $env:GITHUB_REPOSITORY --notes-file '.agent/release/notes.txt'
  if($LASTEXITCODE -ne 0){throw 'Release timing update failed.'}
  $releaseJson | Set-Content '.agent/release/published.json'
  "Release: $($release.url)" >> $env:GITHUB_STEP_SUMMARY
  "Source: $env:GITHUB_SHA. Tests and runtime acceptance were not run." >> $env:GITHUB_STEP_SUMMARY
} finally {Pop-Location}
