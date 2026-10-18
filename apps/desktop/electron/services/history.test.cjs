'use strict';
const { test: nativeTest } = require('node:test');
const test = (name, callback) => nativeTest(name, { skip: process.platform !== 'win32' }, callback);
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync, spawn } = require('node:child_process');
const { createHistoryService } = require('./history.cjs');
async function fixture() {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'material-history-test-'));
    const gitExecutable = execFileSync(process.platform === 'win32' ? 'where.exe' : 'which', ['git'], { encoding: 'utf8' }).trim().split(/\r?\n/)[0];
    const gitSha256 = crypto.createHash('sha256').update(await fs.readFile(gitExecutable)).digest('hex');
    const key = crypto.randomBytes(32);
    const options = { appDataRoot: root, historyRoot: path.join(root, 'settings-history'), gitExecutable, gitSha256, credentialStore: { withKey: async (fn) => fn(key) }, validatePreferences: value => {
            if (Object.keys(value).some(k => !['theme', 'nextAction'].includes(k)) || !['light', 'dark'].includes(value.theme))
                throw new Error('INVALID_PREFERENCES');
            return { ...value };
        }, validateSchedule: () => {
            throw new Error('INVALID_SCHEDULE');
        } };
    return { root, key, options, service: createHistoryService(options), dispose: async () => {
            key.fill(0);
            await fs.rm(root, { recursive: true, force: true });
        } };
}
const snapshot = (theme = 'light') => ({ schemaVersion: 1, preferences: { theme, nextAction: 'local private text' }, schedules: [] });
test('real local history authenticates independently, encrypts, records no-ops and restores append-only', async () => {
    const f = await fixture();
    try {
        assert.equal((await f.service.list()).error.code, 'HISTORY_NOT_CONFIGURED');
        assert.equal((await f.service.setup('fixture-only-password')).ok, true);
        const first = await f.service.recordSettings({ after: snapshot() });
        assert.equal(first.recorded, true);
        assert.equal((await f.service.recordSettings({ before: snapshot(), after: snapshot() })).unchanged, true);
        const second = await f.service.recordSettings({ before: snapshot(), after: snapshot('dark') });
        assert.equal(second.recorded, true);
        assert.deepEqual((await f.service.diff(second.revision)).changedKeys, ['theme']);
        await f.service.lock();
        assert.equal((await f.service.list()).error.code, 'HISTORY_LOCKED');
        assert.equal((await f.service.verify('fixture-only-password')).verified, true);
        assert.equal((await f.service.status()).unlocked, false);
        assert.equal((await f.service.unlock('incorrect')).error.code, 'HISTORY_AUTH_FAILED');
        assert.equal((await f.service.unlock('fixture-only-password')).ok, true);
        assert.equal((await f.service.label(first.revision, 'A private label')).ok, true);
        let restored;
        const receipt = await f.service.restore(first.revision, {expected:snapshot('dark'),expectedNativeRevision:0}, value => {
            restored = value;
        });
        assert.equal(receipt.recorded, true);
        assert.equal(restored.preferences.theme, 'light');
        const exported = await f.service.exportRedacted();
        assert.ok(!JSON.stringify(exported).includes('local private text'));
        assert.ok(!JSON.stringify(exported).includes('A private label'));
        const files = await fs.readdir(path.join(f.options.historyRoot, 'repository/events'));
        for (const file of files) {
            const content = await fs.readFile(path.join(f.options.historyRoot, 'repository/events', file), 'utf8');
            assert.ok(!content.includes('local private text'));
            assert.ok(!content.includes('A private label'));
        }
        const restarted = createHistoryService(f.options);
        assert.equal((await restarted.status()).unlocked, false);
        await restarted.unlock('fixture-only-password');
        assert.equal((await restarted.list()).revisions.length, 3);
        assert.equal((await restarted.setRetention({ visibleDays: 30 })).logicalOnly, true);
    }
    finally {
        await f.dispose();
    }
});
const WORKER = String.raw `
const fs=require('node:fs');const input=JSON.parse(fs.readFileSync(0,'utf8'));const {createHistoryService}=require(input.module);const key=Buffer.from(input.key,'base64');
let temps=0;const options={...input.options,credentialStore:{withKey:async fn=>fn(key)},validatePreferences:v=>({...v}),validateSchedule:v=>({...v}),onTransition:async phase=>{if(phase==='temp-synced')temps++;if(phase===input.stop&&(!input.tempNumber||temps===input.tempNumber)){if(input.overlap)fs.writeFileSync(input.overlap,'transient fixture');process.stdout.write('STOPPED\n');await new Promise(()=>{});}}};
const service=createHistoryService(options);(async()=>{if(input.restore){await service.unlock('fixture-only-password');console.log(JSON.stringify(await service.restore(input.restore,{expected:{schemaVersion:1,preferences:{theme:'light',nextAction:'local private text'},schedules:[]},expectedNativeRevision:0},async()=>{})));}else console.log(JSON.stringify(await service.recordSettings({after:{schemaVersion:1,preferences:{theme:input.theme,nextAction:'worker text'},schedules:[]}})));})().catch(()=>{process.exitCode=1});setInterval(()=>{},1000).unref();
`;
function worker(f, extra = {}) {
    const child = spawn(process.execPath, ['-e', WORKER], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', data => stdout += data);
    child.stderr.on('data', data => stderr += data);
    const done = new Promise((resolve, reject) => {
        child.on('error', reject);
        child.on('exit', code => resolve({ code, stdout, stderr }));
    });
    child.stdin.end(JSON.stringify({ module: require.resolve('./history.cjs'), options: { appDataRoot: f.root, historyRoot: f.options.historyRoot, gitExecutable: f.options.gitExecutable, gitSha256: f.options.gitSha256 }, key: f.key.toString('base64'), ...extra }));
    return { child, done, stopped: () => new Promise((resolve, reject) => {
            if (stdout.includes('STOPPED'))
                return resolve();
            const timer = setTimeout(() => {
                child.kill();
                reject(new Error('WORKER_TIMEOUT'));
            }, 15000);
            child.stdout.on('data', () => {
                if (stdout.includes('STOPPED')) {
                    clearTimeout(timer);
                    resolve();
                }
            });
        }) };
}
test('real concurrent processes serialize local commits without losing either writer', async () => {
    const f = await fixture();
    try {
        await f.service.setup('fixture-only-password');
        const a = worker(f, { theme: 'light' }), b = worker(f, { theme: 'dark' });
        const results = await Promise.all([a.done, b.done]);
        for (const result of results) {
            assert.equal(result.code, 0, result.stderr);
            assert.equal(JSON.parse(result.stdout).recorded, true);
        }
        assert.equal((await f.service.list()).revisions.length, 2);
    }
    finally {
        await f.dispose();
    }
});
test('a reader waits for an active writer before inspecting changing repository files', async () => {
    const f = await fixture();
    let child, timer;
    const originalLstat = fs.lstat;
    try {
        await f.service.setup('fixture-only-password');
        const first = await f.service.recordSettings({ after: snapshot() });
        const transient = path.join(f.options.historyRoot, 'repository/.git/objects/transient-overlap');
        const waiting = worker(f, { restore: first.revision, stop: 'prepared-committed', overlap: transient });
        child = waiting.child;
        await waiting.stopped();
        fs.lstat = async (target, ...args) => {
            if (target === transient) await fs.unlink(transient).catch(() => {});
            return originalLstat(target, ...args);
        };
        timer = setTimeout(async () => {
            await fs.unlink(transient).catch(() => {});
            child.kill();
        }, 250);
        const result = await createHistoryService(f.options).status();
        assert.equal(result.ok, true, 'The reader must wait instead of reporting a transient missing file');
        assert.equal(result.recoveryPending, true);
    }
    finally {
        clearTimeout(timer);
        fs.lstat = originalLstat;
        child?.kill();
        if (child) await new Promise(resolve => child.exitCode !== null || child.signalCode !== null ? resolve() : child.once('exit', resolve));
        await f.dispose();
    }
});
test('kernel lock releases after real process termination at restore transaction boundaries', async () => {
    for (const stop of ['journal-prepared', 'prepared-committed', 'applied']) {
        const f = await fixture();
        let child;
        try {
            await f.service.setup('fixture-only-password');
            const first = await f.service.recordSettings({ after: snapshot() });
            const waiting = worker(f, { restore: first.revision, stop });
            child = waiting.child;
            await waiting.stopped();
            child.kill();
            await waiting.done;
            const restarted = createHistoryService(f.options);
            assert.equal((await restarted.status()).recoveryPending, true, stop);
            await restarted.unlock('fixture-only-password');
            assert.equal((await restarted.recover('retry', async () => {
            })).recovered, true, stop);
            assert.equal((await restarted.status()).recoveryPending, false);
        }
        finally {
            child?.kill();
            await f.dispose();
        }
    }
});
test('unknown snapshot fields, key loss and Git tampering never claim recording', async () => {
    const f = await fixture();
    try {
        await f.service.setup('fixture-only-password');
        const unknown = snapshot();
        unknown.preferences.personalVocabulary = { entries: {} };
        assert.equal((await f.service.recordSettings({ after: unknown })).recorded, false);
        const bad = createHistoryService({ ...f.options, gitSha256: '0'.repeat(64) });
        const failed = await bad.recordSettings({ after: snapshot() });
        assert.equal(failed.recorded, false);
        assert.equal(failed.warning, 'HISTORY_GIT_MISMATCH');
        const lost = createHistoryService({ ...f.options, credentialStore: { withKey: async () => {
                    throw new Error('HISTORY_KEY_MISSING');
                } } });
        assert.equal((await lost.unlock('fixture-only-password')).error.code, 'HISTORY_KEY_MISSING');
        assert.equal((await f.service.recordSettings({ after: snapshot(), protectedMutation: true })).warning, 'PROTECTED_TRANSACTION_REQUIRED');
    }
    finally {
        await f.dispose();
    }
});
test('interrupted restore remains pending across restart and requires deliberate recovery', async () => {
    const f = await fixture();
    try {
        await f.service.setup('fixture-only-password');
        const first = await f.service.recordSettings({ after: snapshot() });
        const failed = await f.service.restore(first.revision, {expected:snapshot(),expectedNativeRevision:0}, () => {
            throw new Error('simulated apply interruption');
        });
        assert.equal(failed.error.code, 'HISTORY_RECOVERY_REQUIRED');
        const restarted = createHistoryService(f.options);
        assert.equal((await restarted.status()).recoveryPending, true);
        assert.equal((await restarted.recover('retry', () => {
        })).error.code, 'HISTORY_LOCKED');
        await restarted.unlock('fixture-only-password');
        let restored;
        assert.equal((await restarted.recover('retry', value => {
            restored = value;
        })).recovered, true);
        assert.equal(restored.preferences.theme, 'light');
        assert.equal((await restarted.status()).recoveryPending, false);
    }
    finally {
        await f.dispose();
    }
});
test('display-name mutations require independent authentication, reject stale state, and restore encrypted identity', async () => {
    const f = await fixture();
    try {
        await f.service.setup('fixture-only-password');
        await f.service.lock();
        let live = null;
        const apply = async (value, { expected } = {}) => {
            if (expected)
                assert.equal(live, expected.displayName);
            live = value.displayName;
        };
        assert.equal((await f.service.transactDisplayName({ expectedNativeRevision:0, before: null, after: 'A private display name', action: 'created' }, apply)).error.code, 'HISTORY_LOCKED');
        await f.service.unlock('fixture-only-password');
        const first = await f.service.transactDisplayName({ expectedNativeRevision:0, before: null, after: 'A private display name', action: 'created' }, apply);
        assert.equal(first.recorded, true);
        assert.equal(live, 'A private display name');
        assert.equal((await f.service.transactDisplayName({ expectedNativeRevision:0, before: null, after: 'Wrong stale name' }, apply)).error.code, 'HISTORY_STATE_CONFLICT');
        const rename = await f.service.transactDisplayName({ expectedNativeRevision:0, before: live, after: 'Another private name' }, apply);
        assert.equal(rename.applied, true);
        const deleted = await f.service.transactDisplayName({ expectedNativeRevision:0, before: live, after: null, action: 'deleted' }, apply);
        assert.equal(deleted.applied, true);
        assert.equal(live, null);
        const restored = await f.service.restore(first.revision, {expected:{schemaVersion:1,kind:'display-name',recordId:'application-display-name-v1',displayName:null},expectedNativeRevision:0}, apply);
        assert.equal(restored.restored, true);
        assert.equal(live, 'A private display name');
        assert.equal((await f.service.diff(first.revision)).recordKind, 'display-name');
        assert.ok(!JSON.stringify(await f.service.exportRedacted()).includes('A private display name'));
        const files = await fs.readdir(path.join(f.options.historyRoot, 'repository/events'));
        for (const name of files)
            assert.ok(!(await fs.readFile(path.join(f.options.historyRoot, 'repository/events', name), 'utf8')).includes('A private display name'));
    }
    finally {
        await f.dispose();
    }
});
test('protected write and recovery never apply before a successful preparation commit', async () => {
    const f = await fixture();
    try {
        await f.service.setup('fixture-only-password');
        const broken = createHistoryService({ ...f.options, gitSha256: '0'.repeat(64) });
        await broken.unlock('fixture-only-password');
        let applies = 0;
        const result = await broken.transactDisplayName({ expectedNativeRevision:0, before: null, after: 'Protected fixture name', action: 'created' }, () => {
            applies++;
        });
        assert.equal(result.ok, false);
        assert.equal(applies, 0);
        assert.equal((await broken.recover('retry', () => {
            applies++;
        })).ok, false);
        assert.equal(applies, 0);
        assert.equal((await f.service.recover('retry', () => {
            applies++;
        })).recovered, true);
        assert.equal(applies, 1);
    }
    finally {
        await f.dispose();
    }
});
test('local configuration, attributes and hooks cannot execute helpers', async () => {
    for (const variant of ['fsmonitor', 'filter', 'post-commit', 'managed-hook', 'include', 'config-prefix', 'info-attributes']) {
        const f = await fixture();
        try {
            await f.service.setup('fixture-only-password');
            const repository = path.join(f.options.historyRoot, 'repository'), admin = path.join(repository, '.git'), marker = path.join(f.root, 'execution-marker.txt'), script = path.join(f.root, 'marker.sh');
            await fs.writeFile(script, '#!/bin/sh\nprintf executed > "' + marker.replaceAll('\\', '/') + '"\n');
            const config = path.join(admin, 'config');
            const original = await fs.readFile(config, 'utf8');
            if (variant === 'fsmonitor')
                await fs.appendFile(config, '\n[core]\nfsmonitor = ' + script.replaceAll('\\', '/') + '\n');
            if (variant === 'filter') {
                await fs.appendFile(config, '\n[filter "unsafe"]\nclean = sh "' + script.replaceAll('\\', '/') + '"\nrequired = true\n');
                await fs.writeFile(path.join(repository, '.gitattributes'), 'events/*.json filter=unsafe\n');
            }
            if (variant === 'post-commit') {
                await fs.mkdir(path.join(admin, 'hooks'));
                await fs.writeFile(path.join(admin, 'hooks/post-commit'), await fs.readFile(script));
            }
            if (variant === 'managed-hook')
                await fs.writeFile(path.join(f.options.historyRoot, 'no-hooks/post-commit'), await fs.readFile(script));
            if (variant === 'include')
                await fs.appendFile(config, '\n[include]\npath = ' + script.replaceAll('\\', '/') + '\n');
            if (variant === 'config-prefix')
                await fs.writeFile(config, '[core]\nrepositoryformatversion = 0\nbare = false\nfsmonitor = sh ' + script.replaceAll('\\', '/') + '\n' + original);
            if (variant === 'info-attributes') {
                await fs.mkdir(path.join(admin, 'info'));
                await fs.writeFile(path.join(admin, 'info/attributes'), 'events/*.json filter=unsafe\n');
            }
            const before = await fs.readFile(config);
            const result = await f.service.recordSettings({ after: snapshot() });
            assert.equal(result.ok, false, variant);
            assert.ok(result.error.code.startsWith('UNSAFE_HISTORY_'), variant);
            assert.deepEqual(await fs.readFile(config), before);
            await assert.rejects(fs.access(marker), { code: 'ENOENT' });
            assert.equal((await fs.readdir(path.join(repository, 'events'))).length, 0);
        }
        finally {
            await f.dispose();
        }
    }
});
test('managed linked paths are rejected before writes and unrelated victims remain unchanged', async () => {
    for (const variant of ['empty-config', 'no-hooks', 'events', 'auth.json', 'pending.json', 'temp']) {
        const f = await fixture();
        try {
            const history = f.options.historyRoot;
            await fs.mkdir(path.join(history, 'repository'), { recursive: true });
            const victim = path.join(f.root, 'victim');
            await fs.mkdir(victim);
            const victimFile = path.join(victim, 'original.txt');
            await fs.writeFile(victimFile, 'unchanged victim');
            let target;
            if (variant === 'events')
                target = path.join(history, 'repository/events');
            else if (variant === 'temp')
                target = path.join(history, 'auth.json.' + crypto.randomUUID() + '.tmp');
            else
                target = path.join(history, variant);
            await fs.symlink(['no-hooks', 'events'].includes(variant) ? victim : victimFile, target, ['no-hooks', 'events'].includes(variant) ? 'junction' : 'file');
            const result = await f.service.status();
            assert.equal(result.ok, false, variant);
            assert.ok(result.error.code.startsWith('UNSAFE_HISTORY_'), variant);
            assert.equal(await fs.readFile(victimFile, 'utf8'), 'unchanged victim');
            assert.deepEqual(await fs.readdir(victim), ['original.txt']);
            assert.ok((await fs.lstat(target)).isSymbolicLink());
        }
        finally {
            await f.dispose();
        }
    }
});
test('crash after temporary journal fsync preserves inert originals and permits durable recovery', async () => {
    const f = await fixture();
    let child;
    try {
        await f.service.setup('fixture-only-password');
        const first = await f.service.recordSettings({ after: snapshot() });
        const waiting = worker(f, { restore: first.revision, stop: 'temp-synced', tempNumber: 2 });
        child = waiting.child;
        await waiting.stopped();
        child.kill();
        await waiting.done;
        const names = (await fs.readdir(f.options.historyRoot)).filter(name => name.endsWith('.tmp'));
        assert.equal(names.length, 1);
        const preserved = await fs.readFile(path.join(f.options.historyRoot, names[0]));
        const restarted = createHistoryService(f.options);
        const status = await restarted.status();
        assert.equal(status.ok, true);
        assert.equal(status.abandonedTempCount, 1);
        assert.equal(status.recoveryPending, true);
        assert.equal((await restarted.unlock('fixture-only-password')).ok, true);
        assert.equal((await restarted.recover('retry', async () => {
        })).recovered, true);
        assert.deepEqual(await fs.readFile(path.join(f.options.historyRoot, names[0])), preserved);
        assert.equal((await restarted.status()).abandonedTempCount, 1);
    }
    finally {
        child?.kill();
        await f.dispose();
    }
});
test('password change revokes other instances while preserving encrypted revisions and pending recovery', async () => {
    const f = await fixture();
    try {
        await f.service.setup('fixture-only-password');
        const first = await f.service.recordSettings({ after: snapshot() });
        await f.service.restore(first.revision, {expected:snapshot(),expectedNativeRevision:0}, async () => { throw new Error('SIMULATED_APPLY'); });
        const other = createHistoryService(f.options);
        await other.unlock('fixture-only-password');
        const event = path.join(f.options.historyRoot, 'repository/events', first.revision + '.json');
        const eventBytes = await fs.readFile(event);
        const journalBytes = await fs.readFile(path.join(f.options.historyRoot, 'pending.json'));
        const auth = path.join(f.options.historyRoot, 'auth.json');
        const authBytes = await fs.readFile(auth);
        assert.equal((await f.service.changePassword('incorrect-old-password', 'new-fixture-password')).error.code, 'HISTORY_AUTH_FAILED');
        assert.ok((await fs.readFile(auth)).equals(authBytes));
        assert.equal((await f.service.changePassword('fixture-only-password', 'new-fixture-password')).changed, true);
        assert.ok((await fs.readFile(event)).equals(eventBytes));
        assert.ok((await fs.readFile(path.join(f.options.historyRoot, 'pending.json'))).equals(journalBytes));
        assert.equal((await other.list()).error.code, 'HISTORY_SESSION_REVOKED');
        assert.equal((await other.unlock('fixture-only-password')).error.code, 'HISTORY_AUTH_FAILED');
        assert.equal((await other.unlock('new-fixture-password')).ok, true);
        assert.equal((await other.recover('retry', async () => {})).recovered, true);
    }
    finally { await f.dispose(); }
});
test('interrupted auth update keeps the old credential active and preserves inert temporary bytes', async () => {
    const f = await fixture();
    try {
        await f.service.setup('fixture-only-password');
        const interrupted = createHistoryService({ ...f.options, onTransition: async (phase, detail) => {
            if (phase === 'temp-synced' && detail.target === 'auth.json') throw new Error('SIMULATED_AUTH_WRITE');
        } });
        assert.equal((await interrupted.changePassword('fixture-only-password', 'new-fixture-password')).ok, false);
        const restarted = createHistoryService(f.options);
        assert.equal((await restarted.status()).abandonedTempCount, 1);
        assert.equal((await restarted.unlock('fixture-only-password')).ok, true);
        assert.equal((await restarted.verify('new-fixture-password')).error.code, 'HISTORY_AUTH_FAILED');
        assert.equal((await f.service.status()).unlocked, true);
    }
    finally { await f.dispose(); }
});
test('legacy authentication records migrate on password change without losing history', async () => {
    const f = await fixture();
    try {
        await f.service.setup('fixture-only-password');
        const authPath = path.join(f.options.historyRoot, 'auth.json');
        const auth = JSON.parse(await fs.readFile(authPath, 'utf8'));
        delete auth.generation; auth.version = 1;
        await fs.writeFile(authPath, JSON.stringify(auth));
        const legacy = createHistoryService(f.options);
        assert.equal((await legacy.unlock('fixture-only-password')).ok, true);
        assert.equal((await legacy.changePassword('fixture-only-password', 'new-fixture-password')).changed, true);
        assert.equal(JSON.parse(await fs.readFile(authPath, 'utf8')).version, 2);
        assert.equal((await legacy.list()).ok, true);
    }
    finally { await f.dispose(); }
});
test('password generation revokes an authenticated session in another real process', async () => {
    const f = await fixture();
    let child;
    try {
        await f.service.setup('fixture-only-password');
        const code = String.raw`
const input=JSON.parse(require('node:fs').readFileSync(0,'utf8'));
const key=Buffer.from(input.key,'base64');
const service=require(input.module).createHistoryService({...input.options,credentialStore:{withKey:async fn=>fn(key)},validatePreferences:v=>v,validateSchedule:v=>v});
(async()=>{
 const result=await service.unlock(input.secret);process.send({ready:result.ok});
 process.once('message',async()=>{const result=await service.list();process.send({code:result.error?.code||'UNEXPECTED_SUCCESS'});key.fill(0);process.disconnect();});
})().catch(()=>{process.exitCode=1;process.disconnect();});
`;
        child = spawn(process.execPath, ['-e', code], { windowsHide: true, stdio: ['pipe', 'ignore', 'ignore', 'ipc'] });
        const done = new Promise(resolve => child.once('exit', resolve));
        const nextMessage = () => new Promise((resolve, reject) => {
            const timer = setTimeout(() => { child.kill(); reject(new Error('SESSION_WORKER_TIMEOUT')); }, 15000);
            child.once('message', message => { clearTimeout(timer); resolve(message); });
            child.once('error', error => { clearTimeout(timer); reject(error); });
        });
        const ready = nextMessage();
        child.stdin.end(JSON.stringify({ module: require.resolve('./history.cjs'), options: { appDataRoot: f.root, historyRoot: f.options.historyRoot, gitExecutable: f.options.gitExecutable, gitSha256: f.options.gitSha256 }, key: f.key.toString('base64'), secret: 'fixture-only-password' }));
        assert.equal((await ready).ready, true);
        assert.equal((await f.service.changePassword('fixture-only-password', 'new-fixture-password')).changed, true);
        const response = nextMessage(); child.send({ probe: true });
        assert.equal((await response).code, 'HISTORY_SESSION_REVOKED');
        await done;
    }
    finally {
        child?.kill();
        await f.dispose();
    }
});
test('restore rejects missing, malformed and mixed-kind expected context before applying', async () => {
    const f = await fixture();
    try {
        await f.service.setup('fixture-only-password');
        const first = await f.service.recordSettings({ after: snapshot() });
        let calls = 0;
        for (const context of [undefined, {}, { expected: snapshot(), expectedNativeRevision: -1 }, { expected: snapshot(), expectedNativeRevision: 1.5 }, { expected: snapshot(), expectedNativeRevision: '1' }, { expected: snapshot(), expectedNativeRevision: 0, unknown: true }, { expected: { schemaVersion: 1, kind: 'display-name', recordId: 'application-display-name-v1', displayName: null }, expectedNativeRevision: 0 }]) {
            assert.equal((await f.service.restore(first.revision, context, async () => { calls++; })).error.code, 'INVALID_RESTORE_EXPECTATION');
        }
        assert.equal(calls, 0);
        assert.equal((await f.service.status()).recoveryPending, false);
    }
    finally { await f.dispose(); }
});
test('stale restore and restarted recovery keep identical expected CAS context and preserve current data', async () => {
    const f = await fixture();
    try {
        await f.service.setup('fixture-only-password');
        const first = await f.service.recordSettings({ after: snapshot() });
        const expected = { expected: snapshot(), expectedNativeRevision: 7 };
        let live = snapshot('dark'), revision = 8, calls = 0;
        const apply = async (desired, context) => {
            calls++;
            assert.deepEqual(context.expected, expected.expected);
            assert.equal(context.expectedNativeRevision, expected.expectedNativeRevision);
            if (JSON.stringify(live) === JSON.stringify(desired)) return;
            if (revision !== context.expectedNativeRevision || JSON.stringify(live) !== JSON.stringify(context.expected)) throw new Error('SETTINGS_CONFLICT');
            live = desired; revision++;
        };
        assert.equal((await f.service.restore(first.revision, expected, apply)).error.code, 'HISTORY_STATE_CONFLICT');
        const restarted = createHistoryService(f.options); await restarted.unlock('fixture-only-password');
        assert.equal((await restarted.recover('retry', apply)).error.code, 'HISTORY_STATE_CONFLICT');
        assert.equal(live.preferences.theme, 'dark'); assert.equal(revision, 8); assert.equal(calls, 2);
        assert.equal((await restarted.status()).recoveryPending, true);
    }
    finally { await f.dispose(); }
});
test('already-applied recovery is idempotent with the original semantic and native expectations', async () => {
    const f = await fixture();
    try {
        await f.service.setup('fixture-only-password');
        const first = await f.service.recordSettings({ after: snapshot() });
        const expected = { expected: snapshot('dark'), expectedNativeRevision: 12 };
        let live = snapshot('dark'), revision = 12;
        assert.equal((await f.service.restore(first.revision, expected, async (desired, context) => {
            assert.deepEqual(context, expected); live = desired; revision++;
            throw new Error('SIMULATED_AFTER_NATIVE_REPLACEMENT');
        })).error.code, 'HISTORY_RECOVERY_REQUIRED');
        const restarted = createHistoryService(f.options); await restarted.unlock('fixture-only-password');
        const result = await restarted.recover('retry', async (desired, context) => {
            assert.deepEqual(context, { ...expected, recovery: true });
            if (JSON.stringify(live) === JSON.stringify(desired)) return;
            throw new Error('SETTINGS_CONFLICT');
        });
        assert.equal(result.recovered, true); assert.equal(revision, 13);
    }
    finally { await f.dispose(); }
});
test('historical pending restore without expectations stays incomplete until explicit authenticated discard', async () => {
    const f = await fixture();
    try {
        await f.service.setup('fixture-only-password');
        const first = await f.service.recordSettings({ after: snapshot() });
        await f.service.restore(first.revision, { expected: snapshot(), expectedNativeRevision: 0 }, async () => { throw new Error('SIMULATED_APPLY'); });
        const file = path.join(f.options.historyRoot, 'pending.json');
        const envelope = JSON.parse(await fs.readFile(file, 'utf8'));
        const aad = Buffer.from('material-browser:settings-history:v1:' + envelope.recordId + ':pending');
        const decipher = crypto.createDecipheriv('aes-256-gcm', f.key, Buffer.from(envelope.nonce, 'base64')); decipher.setAAD(aad); decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
        const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]);
        const pending = JSON.parse(plaintext.toString('utf8')); plaintext.fill(0); delete pending.previous; delete pending.expectedNativeRevision;
        const nonce = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', f.key, nonce); cipher.setAAD(aad);
        const data = Buffer.concat([cipher.update(JSON.stringify(pending)), cipher.final()]);
        await fs.writeFile(file, JSON.stringify({ ...envelope, nonce: nonce.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') }));
        const original = await fs.readFile(file), restarted = createHistoryService(f.options); await restarted.unlock('fixture-only-password');
        assert.equal((await restarted.status()).needsExplicitDiscard, true);
        let calls = 0; assert.equal((await restarted.recover('retry', async () => { calls++; })).error.code, 'HISTORY_RECOVERY_EXPECTATION_REQUIRED');
        assert.equal(calls, 0); assert.ok((await fs.readFile(file)).equals(original));
        assert.equal((await restarted.recover('discard')).discarded, true);
    }
    finally { await f.dispose(); }
});
