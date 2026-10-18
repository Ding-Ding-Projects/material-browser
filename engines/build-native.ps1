param([Parameter(Mandatory=$true)][ValidateSet('chromium','firefox')][string]$Engine,[switch]$AcquireOnly,[switch]$CookieSnapshotTests,[switch]$ChromiumChannelTests)
$ErrorActionPreference='Stop'
if($ChromiumChannelTests -and ($Engine -ne 'chromium' -or $AcquireOnly -or $CookieSnapshotTests)){throw 'ChromiumChannelTests requires Chromium without AcquireOnly or CookieSnapshotTests.'}
if($CookieSnapshotTests -and ($Engine -ne 'firefox' -or $AcquireOnly -or $env:MATERIAL_BROWSER_NATIVE_BASELINE_ONLY -eq '1')){throw 'CookieSnapshotTests requires a Firefox production build without AcquireOnly or baseline-only diagnostics.'}
$pins=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'recipes/native-pins.json') -Raw | ConvertFrom-Json
$pin=$pins.$Engine
$baselineSetting=[Environment]::GetEnvironmentVariable('MATERIAL_BROWSER_NATIVE_BASELINE_ONLY','Process')
if($baselineSetting -and $baselineSetting -notin @('0','1')){throw 'MATERIAL_BROWSER_NATIVE_BASELINE_ONLY must be 0 or 1.'}
$baselineOnly=$baselineSetting -eq '1'
if($baselineOnly -and ($Engine -ne 'firefox' -or $AcquireOnly)){throw 'Baseline-only diagnostics require a Firefox production build.'}
$base=Join-Path ([Environment]::GetFolderPath('UserProfile')) '.material-browser/native'
if($base -match '\s'){throw 'The supported native source path must contain no spaces.'}
$sourceName=if($Engine -eq 'firefox'){'ff'}else{$Engine}
$nativeRoot=Join-Path $base "$sourceName-$($pin.revision.Substring(0,12))"
if($Engine -eq 'firefox' -and (Join-Path $nativeRoot 'src').Length -gt 62){
  throw 'The managed Firefox source path exceeds the upstream Windows limit of 62 characters.'
}
New-Item -ItemType Directory -Path $nativeRoot -Force | Out-Null
function Run([string]$Exe,[string[]]$Arguments) {
  & $Exe @Arguments
  if($LASTEXITCODE -ne 0){throw "$Exe exited with code $LASTEXITCODE"}
}
function FileSha256([string]$FilePath) {
  $stream=[IO.File]::OpenRead($FilePath)
  $sha=[Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant() }
  finally { $stream.Dispose(); $sha.Dispose() }
}
function NormalizedSha256([string]$FilePath) {
  $text=[IO.File]::ReadAllText($FilePath).Replace("`r`n","`n")
  $sha=[Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($text)))).Replace('-','').ToLowerInvariant() }
  finally { $sha.Dispose() }
}
function ChromiumSourceFilter([string]$Path,[string]$Depot) {
  $recipe=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'recipes/chromium-source-filter.json') -Raw | ConvertFrom-Json
  $patch=Join-Path $PSScriptRoot "recipes/$($recipe.patch)"
  $target=Join-Path $Path 'DEPS'
  $actualRevision=& git -C $Path rev-parse HEAD
  if($LASTEXITCODE -ne 0 -or $actualRevision -ne $recipe.revision -or $recipe.revision -ne $pins.chromium.revision){throw 'Chromium optional source filter revision mismatch'}
  if((NormalizedSha256 $patch) -ne $recipe.patchSha256){throw 'Chromium optional source filter patch hash mismatch'}
  $actual=NormalizedSha256 $target
  if($actual -notin @($recipe.baselineSha256,$recipe.patchedSha256)){throw 'Chromium DEPS differs from the reviewed baseline/filter; preserving it.'}
  if($actual -eq $recipe.baselineSha256){Run 'git' @('-C',$Path,'apply','--whitespace=error-all',$patch)}
  if((NormalizedSha256 $target) -ne $recipe.patchedSha256){throw 'Chromium optional source filter readback mismatch'}
  Run 'python' @('-B',(Join-Path $PSScriptRoot 'native/chromium/check_source_filter.py'),'--source',$Path,'--depot',$Depot)
}
function ChromiumProviderOverlay([string]$Path) {
  $recipe=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'recipes/chromium-provider.json') -Raw | ConvertFrom-Json
  $patch=Join-Path $PSScriptRoot "recipes/$($recipe.patch)"
  $actualRevision=& git -C $Path rev-parse HEAD
  if($LASTEXITCODE -ne 0 -or $actualRevision -ne $recipe.revision -or $recipe.revision -ne $pins.chromium.revision){throw 'Chromium provider revision mismatch'}
  if((NormalizedSha256 $patch) -ne $recipe.patchSha256){throw 'Chromium provider patch receipt mismatch'}
  foreach($entry in $recipe.files){
    $target=Join-Path $Path $entry.path
    if(Test-Path $target){
      $actual=NormalizedSha256 $target
      if($actual -ne $entry.baselineSha256 -and $actual -ne $entry.patchedSha256){throw "Chromium provider input differs: $($entry.path)"}
    } elseif($entry.baselineSha256){throw "Chromium provider baseline missing: $($entry.path)"}
  }
  foreach($entry in $recipe.files){
    $target=Join-Path $Path $entry.path
    if(-not (Test-Path $target) -or (NormalizedSha256 $target) -ne $entry.patchedSha256){Run 'git' @('-C',$Path,'apply','--whitespace=error-all',"--include=$($entry.path)",$patch)}
    if((NormalizedSha256 $target) -ne $entry.patchedSha256){throw "Chromium provider output mismatch: $($entry.path)"}
  }
  Write-Output 'Staged Chromium v2 profile key provider. Production broker and portability remain unverified and disabled.'
}
function FirefoxBackendOverlay([string]$Path,[switch]$CheckOnly) {
  $recipe=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'recipes/firefox-build-backend.json') -Raw | ConvertFrom-Json
  $patchPath=Join-Path $PSScriptRoot "recipes/$($recipe.patch)"
  $upgradePath=Join-Path $PSScriptRoot "recipes/$($recipe.upgradePatch)"
  $target=Join-Path $Path $recipe.path
  if($recipe.revision -ne $pins.firefox.revision -or (NormalizedSha256 $patchPath) -ne $recipe.patchSha256 -or (NormalizedSha256 $upgradePath) -ne $recipe.upgradePatchSha256){throw 'Firefox build backend patch receipt mismatch'}
  $actual=NormalizedSha256 $target
  if($actual -notin @($recipe.baselineSha256,$recipe.previousPatchedSha256,$recipe.patchedSha256)){throw 'Firefox build backend differs from the reviewed input; preserving it.'}
  if($CheckOnly){return}
  if($actual -eq $recipe.baselineSha256){Run 'git' @('-C',$Path,'apply','--whitespace=error-all',$patchPath)}
  elseif($actual -eq $recipe.previousPatchedSha256){Run 'git' @('-C',$Path,'apply','--whitespace=error-all',$upgradePath)}
  if((NormalizedSha256 $target) -ne $recipe.patchedSha256){throw 'Firefox build backend patch readback mismatch'}
  Write-Output 'Staged normalized absolute Firefox object prerequisites on Windows. Native rebuild verdict remains pending.'
}
function FirefoxCookieOverlay([string]$Path,[switch]$CheckOnly) {
  $recipe=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'recipes/firefox-cookie-pause.json') -Raw | ConvertFrom-Json
  $patchPath=Join-Path $PSScriptRoot 'recipes/firefox-158-cookie-pause.patch'
  if($recipe.revision -ne $pins.firefox.revision -or (NormalizedSha256 $patchPath) -ne $recipe.patchSha256){throw 'Firefox cookie patch receipt mismatch'}
  $sourceRevision=& git -C $Path rev-parse HEAD
  if($LASTEXITCODE -ne 0 -or $sourceRevision -ne $recipe.revision){throw 'Firefox cookie patch source revision mismatch'}
  # Admit every affected file before writing any of them. Resume an interrupted
  # application only when each file is exactly the reviewed baseline or result.
  foreach($entry in $recipe.files){
    $actual=NormalizedSha256 (Join-Path $Path $entry.path)
    if($actual -notin @($entry.baselineSha256,$entry.patchedSha256)){throw "Firefox cookie source differs from reviewed input: $($entry.path)"}
  }
  if($CheckOnly){return}
  foreach($entry in $recipe.files){
    $target=Join-Path $Path $entry.path
    if((NormalizedSha256 $target) -eq $entry.baselineSha256){
      Run 'git' @('-C',$Path,'apply','--whitespace=error-all',"--include=$($entry.path)",$patchPath)
    }
    if((NormalizedSha256 $target) -ne $entry.patchedSha256){throw "Firefox cookie patch readback mismatch: $($entry.path)"}
  }
  Write-Output 'Staged native cookie write-pause candidate. Whole-profile snapshot capability remains disabled.'
}
function AssertFirefoxBaseline([string]$Path) {
  $recipe=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'recipes/firefox-cookie-pause.json') -Raw | ConvertFrom-Json
  foreach($entry in $recipe.files){
    if((NormalizedSha256 (Join-Path $Path $entry.path)) -ne $entry.baselineSha256){
      throw 'Baseline-only diagnostics cannot replace an already patched or modified native source.'
    }
  }
}
function FirefoxOverlay([string]$Path,[switch]$CheckOnly) {
  $moduleName='MaterialSnapshotBarrier.sys.mjs'
  $relativeModule="browser/components/$moduleName"
  $manifestPath=Join-Path $Path 'browser/components/moz.build'
  $modulePath=Join-Path $Path $relativeModule
  $moduleSource=Join-Path $PSScriptRoot "native/firefox/$moduleName"
  $baseline=(& git -C $Path show HEAD:browser/components/moz.build) -join "`n"
  if($LASTEXITCODE -ne 0){throw 'Cannot read Firefox source manifest'}
  $anchor='    "DesktopActorRegistry.sys.mjs",'
  if(($baseline.Split(@($anchor),[StringSplitOptions]::None)).Count -ne 2){throw 'Firefox module manifest anchor mismatch'}
  $expected=$baseline.Replace($anchor,"$anchor`n    `"$moduleName`",")
  $existing=(Get-Content -LiteralPath $manifestPath -Raw).Replace("`r`n","`n").TrimEnd("`n")
  $changes=@(& git -C $Path status --porcelain --untracked-files=all)
  $cookieRecipe=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'recipes/firefox-cookie-pause.json') -Raw | ConvertFrom-Json
  $backendRecipe=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'recipes/firefox-build-backend.json') -Raw | ConvertFrom-Json
  $allowed=@('browser/components/moz.build',$relativeModule,$backendRecipe.path)+@($cookieRecipe.files | ForEach-Object {$_.path})
  foreach($change in $changes){
    if($change.Length -lt 4 -or $change.Substring(3) -notin $allowed){
      throw 'Native Firefox source has unrelated changes; preserving it.'
    }
  }
  $previous=$baseline.Replace('MOZ_SRC_FILES += [',"MOZ_SRC_FILES += [`n    `"$moduleName`",")
  if($existing -ne $baseline -and $existing -ne $expected -and $existing -ne $previous){throw 'Existing Firefox module manifest differs from the managed overlay'}
  if((Test-Path -LiteralPath $modulePath) -and (NormalizedSha256 $modulePath) -ne (NormalizedSha256 $moduleSource)){
    throw 'Existing Firefox snapshot module differs from the managed overlay; preserving it.'
  }
  FirefoxCookieOverlay $Path -CheckOnly
  FirefoxBackendOverlay $Path -CheckOnly
  if($CheckOnly){return}
  if($existing -ne $expected){[IO.File]::WriteAllText($manifestPath,"$expected`n",[Text.UTF8Encoding]::new($false))}
  if(-not (Test-Path -LiteralPath $modulePath)){Copy-Item -LiteralPath $moduleSource -Destination $modulePath}
  Write-Output 'Staged privileged Firefox snapshot coordinator. No storage providers or external control endpoint are enabled.'
}
function Checkout([string]$Path,[string]$Url,[string]$Revision,[bool]$ManagedFirefox=$false) {
  if(-not (Test-Path -LiteralPath (Join-Path $Path '.git'))){
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
    Run 'git' @('-C',$Path,'init')
    Run 'git' @('-C',$Path,'remote','add','origin',$Url)
  }
  $origin=& git -C $Path remote get-url origin
  if($LASTEXITCODE -ne 0 -or $origin -ne $Url){throw 'Native source origin mismatch'}
  $changes=& git -C $Path status --porcelain
  if($changes){
    if($ManagedFirefox){FirefoxOverlay $Path -CheckOnly}
    else {throw 'Native source has changes; preserving it instead of replacing it.'}
  }
  $current=& git -C $Path rev-parse --verify --quiet HEAD
  if($current -ne $Revision){
    Run 'git' @('-C',$Path,'fetch','--depth','1','origin',$Revision)
    Run 'git' @('-C',$Path,'checkout','--detach',$Revision)
  }
  $current=& git -C $Path rev-parse HEAD
  if($current -ne $Revision){throw 'Native source revision mismatch'}
}
if($Engine -eq 'chromium'){
  if($ChromiumChannelTests){
    $vswhere=Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
    if(-not (Test-Path $vswhere)){throw 'Visual Studio discovery is unavailable.'}
    $vs=& $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
    if(-not $vs){throw 'Visual Studio C++ tools are required.'}
    $vcvars=Join-Path $vs 'VC/Auxiliary/Build/vcvars64.bat'
    if(-not (Test-Path $vcvars)){throw 'Supported MSVC environment entrypoint is unavailable.'}
    $testRoot=Join-Path $nativeRoot 'channel-tests'
    New-Item -ItemType Directory -Path $testRoot -Force | Out-Null
    $fixture=Join-Path $PSScriptRoot 'native/chromium/profile_key_channel_test_win.cc'
    $exe=Join-Path $testRoot 'profile_key_channel_test.exe'
    $object=Join-Path $testRoot 'profile_key_channel_test.obj'
    $compile=Join-Path $testRoot 'compile.cmd'
    $commands=@('@echo off',('call "{0}"' -f $vcvars),'if errorlevel 1 exit /b %errorlevel%',('cl.exe /nologo /std:c++20 /EHsc /W4 /WX "{0}" /Fe:"{1}" /Fo:"{2}" /link advapi32.lib' -f $fixture,$exe,$object),'exit /b %errorlevel%')
    [IO.File]::WriteAllLines($compile,$commands,[Text.ASCIIEncoding]::new())
    Run $env:ComSpec @('/d','/c',$compile)
    Run $exe @()
    Write-Output "Synthetic channel fixture SHA256 $(FileSha256 $exe)"
    Write-Output 'Synthetic protected-channel tests passed. Chromium provider compilation and portable profile encryption remain unverified and disabled.'
    exit 0
  }
  $depot=Join-Path $base "depot_tools-$($pins.depotTools.revision.Substring(0,12))"
  Checkout $depot $pins.depotTools.url $pins.depotTools.revision
  $env:DEPOT_TOOLS_UPDATE='0'
  $env:DEPOT_TOOLS_WIN_TOOLCHAIN='0'
  $env:PATH="$depot;$env:PATH"
  $vswhere=Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio/Installer/vswhere.exe'
  if(-not (Test-Path $vswhere)){throw 'Visual Studio discovery is unavailable.'}
  $vs=& $vswhere -latest -products '*' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
  if(-not $vs){throw 'Visual Studio C++ tools are required.'}
  $env:vs2026_install=$vs
  Push-Location $nativeRoot
  try {
    # These optional branded x86 updater test fixtures are not used by x64 chrome.
    # Path-only custom_deps does not exclude CIPD registrations in this client.
    # Admit the exact source condition filter before any dependency acquisition.
    $chromiumSource=Join-Path $nativeRoot 'src'
    if(-not (Test-Path (Join-Path $chromiumSource '.git'))){Checkout $chromiumSource $pin.url $pin.revision}
    ChromiumSourceFilter $chromiumSource $depot
    $oldConfig="solutions = [{ 'name': 'src', 'url': '$($pin.url)', 'managed': False, 'custom_deps': {}, 'custom_vars': {} }]`ntarget_os = ['win']`n"
    $previousConfig="solutions = [{ 'name': 'src', 'url': '$($pin.url)', 'managed': False, 'custom_deps': { 'src/third_party/updater/chrome_win_x86/cipd': None }, 'custom_vars': {} }]`ntarget_os = ['win']`n"
    $config="solutions = [{ 'name': 'src', 'url': '$($pin.url)', 'managed': False, 'custom_deps': { 'src/third_party/updater/chrome_win_x86/cipd': None, 'src/third_party/updater/chrome_win_x86_sans_iid/cipd': None }, 'custom_vars': {} }]`ntarget_os = ['win']`n"
    $configPath=Join-Path $nativeRoot '.gclient'
    if(Test-Path $configPath){
      $existingConfig=Get-Content $configPath -Raw
      if($existingConfig -in @($oldConfig,$previousConfig)){[IO.File]::WriteAllText($configPath,$config,[Text.UTF8Encoding]::new($false))}
      elseif($existingConfig -ne $config){throw 'Existing native dependency configuration differs.'}
    } else { [IO.File]::WriteAllText($configPath,$config,[Text.UTF8Encoding]::new($false)) }
    Run (Join-Path $depot 'gclient.bat') @('sync','--no-history','--shallow','--nohooks','--revision',"src@$($pin.revision)")
    $actual=& git -C (Join-Path $nativeRoot 'src') rev-parse HEAD
    if($actual -ne $pin.revision){throw 'Chromium checkout revision mismatch'}
    if($AcquireOnly){Write-Output "Acquired pinned Chromium source at $nativeRoot"; exit 0}
    ChromiumProviderOverlay (Join-Path $nativeRoot 'src')
    Run (Join-Path $depot 'gclient.bat') @('runhooks')
    Push-Location (Join-Path $nativeRoot 'src')
    try {
      Run (Join-Path $depot 'gn.bat') @('gen','out/MaterialBrowserBaseline','--args=is_debug=false is_component_build=false symbol_level=0 blink_symbol_level=0 target_cpu="x64"')
      Run (Join-Path $depot 'autoninja.bat') @('-C','out/MaterialBrowserBaseline','chrome')
      $exe=Join-Path $nativeRoot 'src/out/MaterialBrowserBaseline/chrome.exe'
      if(-not (Test-Path $exe)){throw 'Chromium build did not produce chrome.exe'}
      Write-Output "$exe SHA256 $(FileSha256 $exe)"
      Write-Output 'Built upstream baseline only. Product encryption, snapshot and identity remain unverified and disabled.'
    } finally { Pop-Location }
  } finally { Pop-Location }
} else {
  Checkout (Join-Path $nativeRoot 'src') $pin.url $pin.revision $true
  if($AcquireOnly){Write-Output "Acquired pinned Firefox source at $nativeRoot"; exit 0}
  # MozillaBuild's supported installer selects this directory. Reuse and verify it.
  $mozbuild=Join-Path $env:SystemDrive 'mozilla-build'
  $python=Join-Path $mozbuild 'python3/python.exe'
  if(-not (Test-Path $python)){
    $installer=Join-Path $PSScriptRoot 'downloads/MozillaBuildSetup-4.2.1.exe'
    New-Item -ItemType Directory -Path (Split-Path $installer -Parent) -Force | Out-Null
    if(-not (Test-Path $installer)){Invoke-WebRequest -UseBasicParsing 'https://ftp.mozilla.org/pub/mozilla/libraries/win32/MozillaBuildSetup-4.2.1.exe' -OutFile $installer}
    if((FileSha256 $installer) -ne '8ef5b3d2087e4867dc75bf19f5e62f12e917f518239415723cc70896b6f1e3d8'){throw 'MozillaBuild installer hash mismatch'}
    if((Get-AuthenticodeSignature $installer).Status -ne 'Valid'){throw 'MozillaBuild publisher signature is invalid'}
    $install=Start-Process -FilePath $installer -ArgumentList @('/S') -WindowStyle Hidden -Wait -PassThru
    if($install.ExitCode -ne 0 -or -not (Test-Path $python)){throw "MozillaBuild installation did not complete: $($install.ExitCode)"}
  }
  if((Get-Content (Join-Path $mozbuild 'VERSION') -Raw).Trim() -ne '4.2.1'){throw 'MozillaBuild version does not match the reviewed toolchain'}
  $env:MOZILLABUILD=$mozbuild
  $env:PATH="$(Join-Path $mozbuild 'bin');$(Join-Path $mozbuild 'msys2/usr/bin');$(Join-Path $mozbuild 'python3');$env:PATH"
  Push-Location (Join-Path $nativeRoot 'src')
  try {
    # The supported option prevents bootstrap's antivirus-exclusion and host-configuration changes.
    Run $python @('mach','--no-interactive','bootstrap','--application-choice','browser','--no-system-changes')
    FirefoxOverlay (Join-Path $nativeRoot 'src')
    FirefoxBackendOverlay (Join-Path $nativeRoot 'src')
    if($baselineOnly){
      AssertFirefoxBaseline (Join-Path $nativeRoot 'src')
      Write-Output 'Baseline-only diagnostics selected. Native cookie candidate is not applied.'
    } else { FirefoxCookieOverlay (Join-Path $nativeRoot 'src') }
    $logDir=Join-Path $nativeRoot 'logs'
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
    $buildLog=Join-Path $logDir ("mach-build-{0}.jsonl" -f (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
    Write-Output "Native build diagnostic log: $buildLog"
    Run $python @('mach','--log-file',$buildLog,'build')
    if($CookieSnapshotTests){Run $python @('mach','gtest','TestCookieDBWriteQueue.SnapshotPause','--combine-suites')}
    $built=Get-ChildItem -Path (Join-Path $nativeRoot 'src/obj-*/dist/bin/firefox.exe') -ErrorAction SilentlyContinue
    if(-not $built){throw 'Firefox build did not produce firefox.exe'}
    $built | ForEach-Object {Write-Output "$($_.FullName) SHA256 $(FileSha256 $_.FullName)"}
    if($baselineOnly){Write-Output 'Built pinned Firefox baseline with disabled snapshot coordinator. Native cookie candidate was not applied.'}
    else {Write-Output 'Built pinned Firefox with restricted snapshot coordination and cookie pause candidate.'}
    Write-Output 'Product encryption, snapshot and identity remain unverified and disabled.'
  } finally { Pop-Location }
}
