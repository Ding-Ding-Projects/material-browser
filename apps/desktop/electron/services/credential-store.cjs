'use strict';
const {spawn} = require('node:child_process');
const path = require('node:path');
const crypto = require('node:crypto');
// The helper accepts only this application's targets and exchanges values over pipes.
const HELPER = String.raw`
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public class MaterialBrowserCredentials {
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)] public struct Credential { public UInt32 Flags,Type; public string TargetName,Comment; public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten; public UInt32 CredentialBlobSize; public IntPtr CredentialBlob; public UInt32 Persist,AttributeCount; public IntPtr Attributes; public string TargetAlias,UserName; }
 [DllImport("advapi32.dll",EntryPoint="CredWriteW",CharSet=CharSet.Unicode,SetLastError=true)] public static extern bool Write(ref Credential value, UInt32 flags);
 [DllImport("advapi32.dll",EntryPoint="CredReadW",CharSet=CharSet.Unicode,SetLastError=true)] public static extern bool Read(string target, UInt32 type, UInt32 flags, out IntPtr value);
 [DllImport("advapi32.dll",EntryPoint="CredDeleteW",CharSet=CharSet.Unicode,SetLastError=true)] public static extern bool Delete(string target, UInt32 type, UInt32 flags);
 [DllImport("advapi32.dll")] public static extern void CredFree(IntPtr value);
}
'@
$r=[Console]::In.ReadLine() | ConvertFrom-Json
if($r.target -notmatch '^MaterialBrowser.SettingsHistory.v1/(primary|test-[a-f0-9-]{36})$'){throw 'INVALID_TARGET'}
if($r.operation -eq 'read') {
 $p=[IntPtr]::Zero
 if(-not [MaterialBrowserCredentials]::Read($r.target,1,0,[ref]$p)) { if([Runtime.InteropServices.Marshal]::GetLastWin32Error() -eq 1168){[Console]::Out.Write('{"ok":true,"missing":true}');exit 0};throw 'VAULT_UNAVAILABLE' }
 try { $c=[Runtime.InteropServices.Marshal]::PtrToStructure($p,[type][MaterialBrowserCredentials+Credential]);if($c.CredentialBlobSize -ne 32){throw 'INVALID_KEY'};$bytes=New-Object byte[] 32;[Runtime.InteropServices.Marshal]::Copy($c.CredentialBlob,$bytes,0,32);[Console]::Out.Write((@{ok=$true;value=[Convert]::ToBase64String($bytes)}|ConvertTo-Json -Compress));[Array]::Clear($bytes,0,32) } finally {[MaterialBrowserCredentials]::CredFree($p)}
} elseif($r.operation -eq 'write') {
 $bytes=[Convert]::FromBase64String($r.value);if($bytes.Length -ne 32){throw 'INVALID_KEY'};$p=[Runtime.InteropServices.Marshal]::AllocHGlobal(32)
 try { [Runtime.InteropServices.Marshal]::Copy($bytes,0,$p,32);$c=New-Object MaterialBrowserCredentials+Credential;$c.Type=1;$c.TargetName=$r.target;$c.CredentialBlobSize=32;$c.CredentialBlob=$p;$c.Persist=2;$c.UserName='Material Browser';if(-not [MaterialBrowserCredentials]::Write([ref]$c,0)){throw 'VAULT_UNAVAILABLE'};[Console]::Out.Write('{"ok":true}') } finally {for($i=0;$i -lt 32;$i++){[Runtime.InteropServices.Marshal]::WriteByte($p,$i,0)};[Runtime.InteropServices.Marshal]::FreeHGlobal($p);[Array]::Clear($bytes,0,32)}
} elseif($r.operation -eq 'delete') {if(-not [MaterialBrowserCredentials]::Delete($r.target,1,0) -and [Runtime.InteropServices.Marshal]::GetLastWin32Error() -ne 1168){throw 'VAULT_UNAVAILABLE'};[Console]::Out.Write('{"ok":true}') } else {throw 'INVALID_OPERATION'}
`;
function createCredentialStore(options = {}) {
  const {namespace = 'primary', platform = process.platform, launch = spawn, timeoutMs = 10000} = options;
  if (!/^(primary|test-[a-f0-9-]{36})$/.test(namespace) || !Number.isInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 30000) throw new Error('INVALID_CREDENTIAL_OPTIONS');
  const target = `MaterialBrowser.SettingsHistory.v1/${namespace}`;
  async function execute(operation, value) {
    if (platform !== 'win32') throw new Error('CREDENTIAL_VAULT_UNAVAILABLE');
    return new Promise((resolve,reject) => {
      let child, output = '', done = false;
      const finish = (error,result) => {if(done)return;done=true;clearTimeout(timer);error?reject(new Error(error)):resolve(result);};
      const timer = setTimeout(()=>{child?.kill();finish('CREDENTIAL_VAULT_TIMEOUT');},timeoutMs);
      try {
        child=launch(path.join(process.env.SystemRoot || 'C:\\Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoLogo','-NoProfile','-NonInteractive','-Command',HELPER],{windowsHide:true,shell:false,stdio:['pipe','pipe','ignore']});
        child.on('error',()=>finish('CREDENTIAL_VAULT_UNAVAILABLE'));
        child.stdin.on('error',()=>finish('CREDENTIAL_VAULT_UNAVAILABLE'));
        child.stdout.on('data',chunk=>{output+=chunk.toString('utf8');if(output.length>4096){child.kill();finish('CREDENTIAL_VAULT_INVALID_RESPONSE');}});
        child.on('close',code=>{if(code!==0)return finish('CREDENTIAL_VAULT_UNAVAILABLE');try {const result=JSON.parse(output);if(result.ok!==true)throw new Error();finish(null,result);}catch{finish('CREDENTIAL_VAULT_INVALID_RESPONSE');}output='';});
        child.stdin.end(JSON.stringify({operation,target,...(value?{value:value.toString('base64')}:{})})+'\n');
      } catch {finish('CREDENTIAL_VAULT_UNAVAILABLE');}
    });
  }
  return Object.freeze({
    async withKey(callback, {create = false} = {}) {
      if(typeof callback!=='function')throw new Error('INVALID_KEY_CALLBACK');
      let response=await execute('read');
      if(response.missing && create) {const generated=crypto.randomBytes(32);try{await execute('write',generated);}finally{generated.fill(0);}response=await execute('read');}
      if(response.missing)throw new Error('HISTORY_KEY_MISSING');
      const key=Buffer.from(response.value || '', 'base64');response.value='';
      if(key.length!==32){key.fill(0);throw new Error('HISTORY_KEY_INVALID');}
      try{return await callback(key);}finally{key.fill(0);}
    },
    // Only test-owned namespaces can delete, production recovery must preserve its key.
    async deleteTestKey(){if(!namespace.startsWith('test-'))throw new Error('INVALID_CREDENTIAL_OPERATION');await execute('delete');}
  });
}
module.exports={createCredentialStore};
