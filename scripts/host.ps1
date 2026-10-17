param([switch]$detached,[switch]$logs,[switch]$newPairingCode)
$ErrorActionPreference='Stop'
try {
  $root=Split-Path $PSScriptRoot -Parent
  Set-Location -LiteralPath $root
  if(-not(Get-Command docker -ErrorAction SilentlyContinue)){throw 'Docker Desktop with Compose is required. No installation was changed.'}
  & docker info --format '{{.ServerVersion}}' | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Docker is not available.'}
  & docker compose version | Out-Null
  if($LASTEXITCODE -ne 0){throw 'Docker Compose is not available.'}
  if(-not $detached -and -not $logs){Write-Host '[D] Start in background  [L] Start and open live status'; do{$choice=[Console]::ReadKey($true).Key}until($choice -in @('D','L')); $logs=$choice -eq 'L'}
  $port=if($env:STORAGE_PORT){[int]$env:STORAGE_PORT}else{8174}
  if($port -lt 1024 -or $port -gt 65535){throw 'STORAGE_PORT must be between 1024 and 65535.'}
  $ips=@(Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -notmatch '^(127\.|169\.254\.)' -and $_.AddressState -eq 'Preferred'} | Select-Object -ExpandProperty IPAddress -Unique)
  if(-not $ips.Count){throw 'No reachable LAN IPv4 address found.'}
  $configDir=Join-Path $root '.storage-config'
  if(-not(Test-Path -LiteralPath $configDir)){
    New-Item -ItemType Directory -Path $configDir | Out-Null
    $identity=[System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    & icacls $configDir /inheritance:r /grant:r "${identity}:(OI)(CI)F" 'SYSTEM:(OI)(CI)F' | Out-Null
    if($LASTEXITCODE -ne 0){throw 'Unable to protect bootstrap configuration.'}
  }
  $configFile=Join-Path $configDir 'config.json'
  if($newPairingCode -or -not(Test-Path -LiteralPath $configFile)){
    Write-Host 'Choose a unique one-use administration pairing code. It stays local and is never printed.'
    $secret=Read-Host 'One-use pairing code (at least 20 characters)' -AsSecureString
    $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
    try{$plain=[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr); if($plain.Length -lt 20){throw 'Pairing secret must have at least 20 characters.'}; $sha=[Security.Cryptography.SHA256]::Create(); try{$hash=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($plain)))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}finally{[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr);$plain=$null}
    $hosts=@("127.0.0.1:8174","localhost:$port")+@($ips|ForEach-Object{"${_}:$port"})
    @{bootstrapHash=$hash;allowedHosts=$hosts}|ConvertTo-Json|Set-Content -LiteralPath $configFile -Encoding Ascii
    $hash=$null
  }
  $env:STORAGE_CONFIG_DIR=$configDir
  & docker compose -f (Join-Path $root 'compose.yaml') pull
  if($LASTEXITCODE -ne 0){throw 'Published image pull failed. Existing containers were preserved.'}
  $startArgs=@('compose','-f',(Join-Path $root 'compose.yaml'),'up','-d','--wait','--wait-timeout','90')
  if($newPairingCode){$startArgs+='--force-recreate'}
  & docker @startArgs
  if($LASTEXITCODE -ne 0){throw 'Container startup or health verification failed.'}
  $verified=0
  foreach($ip in $ips){$url="http://${ip}:$port/"; try{$result=Invoke-WebRequest -UseBasicParsing -Uri "${url}health" -TimeoutSec 5; if($result.StatusCode -eq 200){$verified++;Write-Host "Verified host LAN endpoint: $url"}}catch{Write-Warning "LAN endpoint not verified: $url"}}
  if($verified -eq 0){throw 'No host LAN endpoint passed HTTP health verification. Containers remain running for diagnosis.'}
  if($logs){
    $follow=$true
    do{
      Clear-Host
      Write-Host 'Material Browser Storage | service: storage | [F] follow/pause [R] refresh [Q] leave (keeps running)'
      & docker compose ps
      & docker compose logs --tail 18 --no-color storage
      $until=[DateTime]::UtcNow.AddSeconds(3)
      do{if([Console]::KeyAvailable){$key=[Console]::ReadKey($true).Key;if($key -eq 'Q'){return};if($key -eq 'F'){$follow=-not $follow};if($key -eq 'R'){break}};Start-Sleep -Milliseconds 100}while(-not $follow -or [DateTime]::UtcNow -lt $until)
    }while($true)
  }
  exit 0
}catch{Write-Error $_;exit 1}
