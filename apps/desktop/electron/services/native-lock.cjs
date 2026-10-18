'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');
const LOCK_HELPER = String.raw `
$ErrorActionPreference='Stop'
$r=[Console]::In.ReadLine()|ConvertFrom-Json
if($r.id -notmatch '^[a-f0-9]{64}$' -or $r.timeout -lt 50 -or $r.timeout -gt 30000){exit 2}
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
$security=New-Object Security.AccessControl.MutexSecurity
$security.SetAccessRuleProtection($true,$false)
$security.SetOwner($sid)
$security.AddAccessRule((New-Object Security.AccessControl.MutexAccessRule($sid,[Security.AccessControl.MutexRights]::FullControl,[Security.AccessControl.AccessControlType]::Allow)))
$created=$false
$mutex=New-Object System.Threading.Mutex($false,('Global\MaterialBrowser.SettingsHistory.'+$sid.Value+'.'+$r.id),[ref]$created,$security)
$actual=$mutex.GetAccessControl()
$rules=$actual.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])
if($actual.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value -or -not $actual.AreAccessRulesProtected -or $rules.Count -ne 1 -or $rules[0].IdentityReference.Value -ne $sid.Value -or $rules[0].AccessControlType -ne [Security.AccessControl.AccessControlType]::Allow -or $rules[0].MutexRights -ne [Security.AccessControl.MutexRights]::FullControl){$mutex.Dispose();exit 4}
$held=$false
try {try{$held=$mutex.WaitOne([int]$r.timeout)}catch [System.Threading.AbandonedMutexException]{$held=$true};if(-not $held){exit 3};[Console]::Out.WriteLine('LOCKED');[Console]::Out.Flush();[void][Console]::In.ReadLine()}finally{if($held){$mutex.ReleaseMutex()};$mutex.Dispose()}
`;
async function withNativeLock(id, callback, { timeoutMs = 30000 } = {}) {
    if (process.platform !== 'win32' || !/^[a-f0-9]{64}$/.test(id) || typeof callback !== 'function')
        throw new Error('HISTORY_LOCK_UNAVAILABLE');
    if (!Number.isInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 30000)
        throw new Error('INVALID_LOCK_TIMEOUT');
    const child = spawn(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe'), ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', LOCK_HELPER], { windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'ignore'] });
    let held = false, lost = false, output = '';
    child.on('exit', () => {
        lost = true;
    });
    child.stdin.on('error', () => {
        lost = true;
    });
    try {
        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                child.kill();
                reject(new Error('HISTORY_LOCK_TIMEOUT'));
            }, timeoutMs + 2000);
            const fail = () => {
                clearTimeout(timer);
                reject(new Error('HISTORY_LOCK_UNAVAILABLE'));
            };
            child.once('error', fail);
            child.once('exit', () => {
                if (!held)
                    fail();
            });
            child.stdout.on('data', chunk => {
                output += chunk.toString('utf8');
                if (output.length > 128) {
                    child.kill();
                    fail();
                }
                else if (output === 'LOCKED\r\n' || output === 'LOCKED\n') {
                    held = true;
                    clearTimeout(timer);
                    resolve();
                }
            });
            child.stdin.write(JSON.stringify({ id, timeout: timeoutMs }) + '\n');
        });
        const assertHeld = () => {
            if (lost || !held)
                throw new Error('HISTORY_LOCK_LOST');
        };
        assertHeld();
        return await callback({ assertHeld });
    }
    finally {
        held = false;
        child.stdin.end('\n');
        if (!lost)
            await new Promise(resolve => {
                const timer = setTimeout(() => {
                    child.kill();
                    resolve();
                }, 2000);
                child.once('exit', () => {
                    clearTimeout(timer);
                    resolve();
                });
            });
    }
}

module.exports = { withNativeLock };
