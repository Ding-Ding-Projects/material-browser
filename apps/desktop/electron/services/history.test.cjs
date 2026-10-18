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
        const receipt = await f.service.restore(first.revision, value => {
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
let temps=0;const options={...input.options,credentialStore:{withKey:async fn=>fn(key)},validatePreferences:v=>({...v}),validateSchedule:v=>({...v}),onTransition:async phase=>{if(phase==='temp-synced')temps++;if(phase===input.stop&&(!input.tempNumber||temps===input.tempNumber)){process.stdout.write('STOPPED\n');await new Promise(()=>{});}}};
const service=createHistoryService(options);(async()=>{if(input.restore){await service.unlock('fixture-only-password');console.log(JSON.stringify(await service.restore(input.restore,async()=>{})));}else console.log(JSON.stringify(await service.recordSettings({after:{schemaVersion:1,preferences:{theme:input.theme,nextAction:'worker text'},schedules:[]}})));})().catch(()=>{process.exitCode=1});setInterval(()=>{},1000).unref();
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
        const failed = await f.service.restore(first.revision, () => {
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
        assert.equal((await f.service.transactDisplayName({ before: null, after: 'A private display name', action: 'created' }, apply)).error.code, 'HISTORY_LOCKED');
        await f.service.unlock('fixture-only-password');
        const first = await f.service.transactDisplayName({ before: null, after: 'A private display name', action: 'created' }, apply);
        assert.equal(first.recorded, true);
        assert.equal(live, 'A private display name');
        assert.equal((await f.service.transactDisplayName({ before: null, after: 'Wrong stale name' }, apply)).error.code, 'HISTORY_STATE_CONFLICT');
        const rename = await f.service.transactDisplayName({ before: live, after: 'Another private name' }, apply);
        assert.equal(rename.applied, true);
        const deleted = await f.service.transactDisplayName({ before: live, after: null, action: 'deleted' }, apply);
        assert.equal(deleted.applied, true);
        assert.equal(live, null);
        const restored = await f.service.restore(first.revision, apply);
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
        const result = await broken.transactDisplayName({ before: null, after: 'Protected fixture name', action: 'created' }, () => {
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
