param([Parameter(Mandatory=$true)][ValidateSet('chromium','firefox')][string]$Engine,[switch]$AcquireOnly)
$ErrorActionPreference='Stop'
$pins=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'recipes/native-pins.json') -Raw | ConvertFrom-Json
$pin=$pins.$Engine
$base=Join-Path ([Environment]::GetFolderPath('UserProfile')) '.material-browser/native'
if($base -match '\s'){throw 'The supported native source path must contain no spaces.'}
$nativeRoot=Join-Path $base "$Engine-$($pin.revision.Substring(0,12))"
New-Item -ItemType Directory -Path $nativeRoot -Force | Out-Null
function Run([string]$Exe,[string[]]$Arguments) {
  & $Exe @Arguments
  if($LASTEXITCODE -ne 0){throw "$Exe exited with code $LASTEXITCODE"}
}
function Checkout([string]$Path,[string]$Url,[string]$Revision) {
  if(-not (Test-Path -LiteralPath (Join-Path $Path '.git'))){
    New-Item -ItemType Directory -Path $Path -Force | Out-Null
    Run 'git' @('-C',$Path,'init')
    Run 'git' @('-C',$Path,'remote','add','origin',$Url)
  }
  $origin=& git -C $Path remote get-url origin
  if($LASTEXITCODE -ne 0 -or $origin -ne $Url){throw 'Native source origin mismatch'}
  $changes=& git -C $Path status --porcelain
  if($changes){throw 'Native source has changes; preserving it instead of replacing it.'}
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
    $config="solutions = [{ 'name': 'src', 'url': '$($pin.url)', 'managed': False, 'custom_deps': {}, 'custom_vars': {} }]`ntarget_os = ['win']`n"
    $configPath=Join-Path $nativeRoot '.gclient'
    if(Test-Path $configPath){
      if((Get-Content $configPath -Raw) -ne $config){throw 'Existing native dependency configuration differs.'}
    } else { [IO.File]::WriteAllText($configPath,$config,[Text.UTF8Encoding]::new($false)) }
    Run (Join-Path $depot 'gclient.bat') @('sync','--no-history','--shallow','--nohooks','--revision',"src@$($pin.revision)")
    $actual=& git -C (Join-Path $nativeRoot 'src') rev-parse HEAD
    if($actual -ne $pin.revision){throw 'Chromium checkout revision mismatch'}
    if($AcquireOnly){Write-Output "Acquired pinned Chromium source at $nativeRoot"; exit 0}
    Run (Join-Path $depot 'gclient.bat') @('runhooks')
    # No unreviewed prototype is silently applied or counted as a product build.
    throw 'Native source acquired. Product encryption, snapshot and identity patches are not integrated; native product build remains incomplete.'
  } finally { Pop-Location }
} else {
  Checkout (Join-Path $nativeRoot 'src') $pin.url $pin.revision
  if($AcquireOnly){Write-Output "Acquired pinned Firefox source at $nativeRoot"; exit 0}
  throw 'Native source acquired. MozillaBuild bootstrap and product encryption, snapshot and identity integration remain incomplete.'
}
