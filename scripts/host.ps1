param([switch]$detached,[switch]$logs,[switch]$newPairingCode,[switch]$JsonSetup)
$ErrorActionPreference='Stop'
function Progress($stage,$state){if($JsonSetup){[Console]::Out.WriteLine((@{type='progress';stage=$stage;state=$state}|ConvertTo-Json -Compress))}else{Write-Host "$stage : $state"}}
function DockerCommand([string[]]$arguments){$output=& docker @arguments 2>&1;if($LASTEXITCODE -ne 0){throw 'Docker operation failed. Existing storage data was preserved.'};if(-not $JsonSetup){$output|ForEach-Object{Write-Host $_}}}
try {
  $root=Split-Path $PSScriptRoot -Parent
  Set-Location -LiteralPath $root
  Progress 'validate' 'running'
  $inputData=$null
  if($JsonSetup){
    $line=[Console]::In.ReadLine()
    if(-not $line -or $line.Length -gt 16384){throw 'Setup input must be one bounded JSON object.'}
    try{$inputData=$line|ConvertFrom-Json -ErrorAction Stop}catch{throw 'Invalid setup JSON.'}
    $line=$null
    if($inputData -is [Array] -or $inputData -is [string] -or $null -eq $inputData){throw 'Setup input must be a JSON object.'}
    foreach($key in $inputData.PSObject.Properties.Name){if($key -notin @('port','storageDir','pairingCode','rotatePairingCode')){throw 'Unsupported setup field.'}}
    if($null -ne $inputData.rotatePairingCode -and $inputData.rotatePairingCode -isnot [bool]){throw 'rotatePairingCode must be boolean.'}
    $newPairingCode=$inputData.rotatePairingCode -eq $true
    $detached=$true
  }
  $configDir=Join-Path $root '.storage-config'
  if(Test-Path -LiteralPath $configDir){if((Get-Item -LiteralPath $configDir).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Configuration directory must not be a link.'}}
  else{New-Item -ItemType Directory -Path $configDir|Out-Null}
  $identity=[System.Security.Principal.WindowsIdentity]::GetCurrent().Name
  & icacls $configDir /inheritance:r /grant:r "${identity}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' 2>&1|Out-Null
  if($LASTEXITCODE -ne 0){throw 'Unable to protect configuration.'}
  $settingsFile=Join-Path $configDir 'host-settings.json'
  $previous=if(Test-Path -LiteralPath $settingsFile){Get-Content -Raw -LiteralPath $settingsFile|ConvertFrom-Json}else{$null}
  $port=if($null -ne $inputData.port){$parsed=0;if(-not[int]::TryParse([string]$inputData.port,[ref]$parsed)){throw 'Port must be an integer.'};$parsed}elseif($previous){[int]$previous.port}elseif($env:STORAGE_PORT){[int]$env:STORAGE_PORT}else{8174}
  if($port -lt 1024 -or $port -gt 65535){throw 'Port must be between 1024 and 65535.'}
  $storageDir=if($inputData.storageDir){[string]$inputData.storageDir}elseif($previous){[string]$previous.storageDir}else{''}
  if($storageDir){
    if(-not[IO.Path]::IsPathRooted($storageDir) -or $storageDir.StartsWith('\\') -or $storageDir -match '[\r\n\x00]'){throw 'Storage directory must be an absolute local path.'}
    $storageDir=[IO.Path]::GetFullPath($storageDir).TrimEnd('\','/')
    if($storageDir -eq [IO.Path]::GetPathRoot($storageDir).TrimEnd('\','/')){throw 'A drive root cannot be used for storage.'}
    if($previous -and $previous.storageDir -ne $storageDir){throw 'Changing an existing storage destination requires a separate reviewed migration.'}
    if(Test-Path -LiteralPath $storageDir){if(-not $previous -and @(Get-ChildItem -LiteralPath $storageDir -Force).Count){throw 'New storage destination must be empty. Existing files were preserved.'};if((Get-Item -LiteralPath $storageDir).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Storage directory must not be a link.'}}
    else{New-Item -ItemType Directory -Path $storageDir|Out-Null}
  }elseif($previous -and $previous.storageDir){throw 'Existing storage destination cannot be removed.'}
  Progress 'validate' 'complete'
  Progress 'runtime' 'running'
  if(-not(Get-Command docker -ErrorAction SilentlyContinue)){throw 'Docker Desktop with Compose is required.'}
  DockerCommand -arguments @('info','--format','{{.ServerVersion}}')
  DockerCommand -arguments @('compose','version')
  Progress 'runtime' 'complete'
  if(-not $detached -and -not $logs){Write-Host '[D] Start in background  [L] Start and open live status';do{$choice=[Console]::ReadKey($true).Key}until($choice -in @('D','L'));$logs=$choice -eq 'L'}
  $ips=@(Get-NetIPAddress -AddressFamily IPv4|Where-Object {$_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.AddressState -eq 'Preferred'}|Select-Object -ExpandProperty IPAddress -Unique)
  if(-not $ips.Count){throw 'No LAN IPv4 address found.'}
  Progress 'configuration' 'running'
  $configFile=Join-Path $configDir 'config.json'
  $config=if(Test-Path -LiteralPath $configFile){Get-Content -Raw -LiteralPath $configFile|ConvertFrom-Json}else{$null}
  if($newPairingCode -or -not $config){
    if($JsonSetup){$plain=[string]$inputData.pairingCode;$inputData.pairingCode=$null}
    else{Write-Host 'Choose a unique one-use administration pairing code. It is never printed.';$secret=Read-Host 'One-use pairing code' -AsSecureString;$ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret);try{$plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)}}
    try{if($plain.Length -lt 20 -or $plain.Length -gt 256){throw 'A bounded one-use pairing code is required.'};$sha=[Security.Cryptography.SHA256]::Create();try{$hash=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($plain)))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}finally{$plain=$null}
  }else{$hash=$config.bootstrapHash;if($inputData){$inputData.pairingCode=$null}}
  $hosts=@('127.0.0.1:8174',"localhost:$port")+@($ips|ForEach-Object{"${_}:$port"})
  @{bootstrapHash=$hash;allowedHosts=$hosts}|ConvertTo-Json|Set-Content -LiteralPath "$configFile.pending" -Encoding Ascii
  if(Test-Path -LiteralPath $configFile){Copy-Item -LiteralPath $configFile -Destination "$configFile.previous" -Force}
  if(Test-Path -LiteralPath $settingsFile){Copy-Item -LiteralPath $settingsFile -Destination "$settingsFile.previous" -Force}
  Move-Item -LiteralPath "$configFile.pending" -Destination $configFile -Force
  $hash=$null
  @{port=$port;storageDir=$storageDir}|ConvertTo-Json|Set-Content -LiteralPath $settingsFile -Encoding Ascii
  $env:STORAGE_CONFIG_DIR=$configDir;$env:STORAGE_PORT=[string]$port
  $composeArgs=@('compose','-f',(Join-Path $root 'compose.yaml'))
  if($storageDir){$override=Join-Path $configDir 'storage.compose.json';@{services=@{storage=@{volumes=@(@{type='bind';source=$storageDir;target='/data'})}}}|ConvertTo-Json -Depth 8|Set-Content -LiteralPath $override -Encoding Ascii;$composeArgs+=@('-f',$override)}
  Progress 'configuration' 'complete'
  Progress 'pull' 'running';DockerCommand ($composeArgs+@('pull'));Progress 'pull' 'complete'
  Progress 'start' 'running'
  $startArgs=$composeArgs+@('up','-d','--wait','--wait-timeout','90');if($newPairingCode -or ($previous -and [int]$previous.port -ne $port)){$startArgs+='--force-recreate'}
  DockerCommand $startArgs;Progress 'start' 'complete'
  Progress 'health' 'running'
  $urls=@()
  foreach($ip in $ips){$url="http://${ip}:$port/";try{$result=Invoke-WebRequest -UseBasicParsing -Uri "${url}health" -TimeoutSec 5;if($result.StatusCode -eq 200){$urls+=$url}}catch{}}
  if(-not $urls.Count){throw 'No host LAN endpoint passed health verification. Containers remain running for diagnosis.'}
  Progress 'health' 'complete'
  if($JsonSetup){[Console]::Out.WriteLine((@{type='result';ok=$true;port=$port;urls=$urls}|ConvertTo-Json -Compress));exit 0}
  $urls|ForEach-Object{Write-Host "Verified host LAN endpoint: $_"}
  if($logs){$follow=$true;do{Clear-Host;Write-Host 'Material Browser Storage | storage | [F] follow/pause [R] refresh [Q] leave (keeps running)';& docker @composeArgs ps;& docker @composeArgs logs --tail 18 --no-color storage;$until=[DateTime]::UtcNow.AddSeconds(3);do{if([Console]::KeyAvailable){$key=[Console]::ReadKey($true).Key;if($key -eq 'Q'){return};if($key -eq 'F'){$follow=-not $follow};if($key -eq 'R'){break}};Start-Sleep -Milliseconds 100}while(-not $follow -or [DateTime]::UtcNow -lt $until)}while($true)}
  exit 0
}catch{
  if($JsonSetup){[Console]::Out.WriteLine((@{type='result';ok=$false;error='Setup failed. No storage data was deleted. Check configuration, Docker availability, published image access and LAN health.'}|ConvertTo-Json -Compress))}else{Write-Error $_}
  exit 1
}
