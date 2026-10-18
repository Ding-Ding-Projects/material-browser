param([Parameter(Mandatory=$true)][ValidateSet('chromium','firefox')][string]$Engine,[switch]$AcquireOnly)
$ErrorActionPreference='Stop'
$pins=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'recipes/native-pins.json') -Raw | ConvertFrom-Json
$pin=$pins.$Engine
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
  foreach($change in $changes){
    if($change.Length -lt 4 -or $change.Substring(3) -notin @('browser/components/moz.build',$relativeModule)){
      throw 'Native Firefox source has unrelated changes; preserving it.'
    }
  }
  $previous=$baseline.Replace('MOZ_SRC_FILES += [',"MOZ_SRC_FILES += [`n    `"$moduleName`",")
  if($existing -ne $baseline -and $existing -ne $expected -and $existing -ne $previous){throw 'Existing Firefox module manifest differs from the managed overlay'}
  if((Test-Path -LiteralPath $modulePath) -and (FileSha256 $modulePath) -ne (FileSha256 $moduleSource)){
    throw 'Existing Firefox snapshot module differs from the managed overlay; preserving it.'
  }
  if($CheckOnly){return}
  [IO.File]::WriteAllText($manifestPath,"$expected`n",[Text.UTF8Encoding]::new($false))
  Copy-Item -LiteralPath $moduleSource -Destination $modulePath
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
    # This branded x86 updater test fixture is not used by the unbranded x64 chrome target.
    # Preserve the scanner verdict; do not retrieve or alter the excluded payload.
    $oldConfig="solutions = [{ 'name': 'src', 'url': '$($pin.url)', 'managed': False, 'custom_deps': {}, 'custom_vars': {} }]`ntarget_os = ['win']`n"
    $config="solutions = [{ 'name': 'src', 'url': '$($pin.url)', 'managed': False, 'custom_deps': { 'src/third_party/updater/chrome_win_x86/cipd': None }, 'custom_vars': {} }]`ntarget_os = ['win']`n"
    $configPath=Join-Path $nativeRoot '.gclient'
    if(Test-Path $configPath){
      $existingConfig=Get-Content $configPath -Raw
      if($existingConfig -eq $oldConfig){[IO.File]::WriteAllText($configPath,$config,[Text.UTF8Encoding]::new($false))}
      elseif($existingConfig -ne $config){throw 'Existing native dependency configuration differs.'}
    } else { [IO.File]::WriteAllText($configPath,$config,[Text.UTF8Encoding]::new($false)) }
    Run (Join-Path $depot 'gclient.bat') @('sync','--no-history','--shallow','--nohooks','--revision',"src@$($pin.revision)")
    $actual=& git -C (Join-Path $nativeRoot 'src') rev-parse HEAD
    if($actual -ne $pin.revision){throw 'Chromium checkout revision mismatch'}
    if($AcquireOnly){Write-Output "Acquired pinned Chromium source at $nativeRoot"; exit 0}
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
    Run $python @('mach','build')
    $built=Get-ChildItem -Path (Join-Path $nativeRoot 'src/obj-*/dist/bin/firefox.exe') -ErrorAction SilentlyContinue
    if(-not $built){throw 'Firefox build did not produce firefox.exe'}
    $built | ForEach-Object {Write-Output "$($_.FullName) SHA256 $(FileSha256 $_.FullName)"}
    Write-Output 'Built upstream baseline only. Product encryption, snapshot and identity remain unverified and disabled.'
  } finally { Pop-Location }
}
