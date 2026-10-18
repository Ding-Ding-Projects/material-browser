'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const run = promisify(execFile);
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const stable = value => JSON.stringify(value);
function createHistoryStorage({ appDataRoot, historyRoot, gitExecutable, gitSha256, assertHeld, onTransition }) {
    const repo = path.join(historyRoot, 'repository'), events = path.join(repo, 'events'), authFile = path.join(historyRoot, 'auth.json'), journal = path.join(historyRoot, 'pending.json');
    let ready = false;
    async function noLinks(target) {
        let current = path.resolve(target);
        while (true) {
            try {
                const stat = await fs.lstat(current);
                if (stat.isSymbolicLink())
                    throw new Error('UNSAFE_HISTORY_PATH');
            }
            catch (error) {
                if (error.code !== 'ENOENT')
                    throw error;
            }
            const parent = path.dirname(current);
            if (parent === current)
                break;
            current = parent;
        }
    }
    async function checkedPath(target, type, { missing = true, maxBytes = Infinity } = {}) {
        await noLinks(target);
        try {
            const stat = await fs.lstat(target);
            if ((type === 'directory' && !stat.isDirectory()) || (type === 'file' && (!stat.isFile() || stat.nlink !== 1 || stat.size > maxBytes)))
                throw new Error('UNSAFE_HISTORY_PATH');
            return stat;
        }
        catch (error) {
            if (missing && error.code === 'ENOENT')
                return null;
            throw error;
        }
    }
    async function directory(target) {
        await checkedPath(target, 'directory');
        await fs.mkdir(target, { recursive: true, mode: 0o700 });
        await checkedPath(target, 'directory', { missing: false });
    }
    async function boundedRead(target, maxBytes) {
        await checkedPath(target, 'file', { missing: false, maxBytes });
        return fs.readFile(target);
    }
    async function verifyGitConfiguration() {
        const admin = path.join(repo, '.git');
        if (!await checkedPath(admin, 'directory'))
            return;
        const config = await boundedRead(path.join(admin, 'config'), 8192);
        let section = '', seen = new Set();
        const allowed = { repositoryformatversion: '0', filemode: ['true', 'false'], bare: 'false', logallrefupdates: 'true', symlinks: 'false', ignorecase: 'true' };
        for (const line of config.toString('utf8').split(/\r?\n/)) {
            const text = line.trim();
            if (!text || text.startsWith('#') || text.startsWith(';'))
                continue;
            if (text === '[core]') {
                if (section)
                    throw new Error('UNSAFE_HISTORY_GIT_CONFIG');
                section = 'core';
                continue;
            }
            const match = /^([a-z]+)\s*=\s*([a-z0-9]+)$/.exec(text);
            if (section !== 'core' || !match || !Object.hasOwn(allowed, match[1]) || seen.has(match[1]) || !(Array.isArray(allowed[match[1]]) ? allowed[match[1]].includes(match[2]) : allowed[match[1]] === match[2]))
                throw new Error('UNSAFE_HISTORY_GIT_CONFIG');
            seen.add(match[1]);
        }
        for (const required of ['repositoryformatversion', 'bare'])
            if (!seen.has(required))
                throw new Error('UNSAFE_HISTORY_GIT_CONFIG');
        const forbidden = ['config.worktree', 'commondir', 'gitdir', 'info/attributes', 'info/grafts', 'objects/info/alternates', 'objects/info/http-alternates', 'refs/replace', 'shallow'];
        for (const relative of forbidden) {
            const target = path.join(admin, relative);
            await noLinks(target);
            try {
                await fs.lstat(target);
                throw new Error('UNSAFE_HISTORY_GIT_STATE');
            }
            catch (error) {
                if (error.code !== 'ENOENT')
                    throw error;
            }
        }
        const legacyHooks = path.join(admin, 'hooks');
        if (await checkedPath(legacyHooks, 'directory'))
            for (const name of await fs.readdir(legacyHooks))
                if (!name.endsWith('.sample'))
                    throw new Error('UNSAFE_HISTORY_HOOKS');
        const pending = [admin];
        let entries = 0;
        while (pending.length) {
            const dir = pending.pop();
            await checkedPath(dir, 'directory', { missing: false });
            for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
                if (++entries > 30000)
                    throw new Error('HISTORY_CAPACITY_REACHED');
                const target = path.join(dir, entry.name);
                await noLinks(target);
                if (entry.isDirectory())
                    pending.push(target);
                else
                    await checkedPath(target, 'file', { missing: false, maxBytes: 16 * 1024 * 1024 });
            }
        }
    }
    async function verifyManagedPaths() {
        for (const target of [appDataRoot, historyRoot, repo, events, path.join(historyRoot, 'no-hooks')])
            await checkedPath(target, 'directory');
        for (const target of [authFile, journal])
            await checkedPath(target, 'file', { maxBytes: 400000 });
        const config = path.join(historyRoot, 'empty-config');
        if (await checkedPath(config, 'file', { maxBytes: 0 })) {
            if ((await boundedRead(config, 0)).length)
                throw new Error('UNSAFE_HISTORY_GIT_CONFIG');
        }
        const hooks = path.join(historyRoot, 'no-hooks');
        if (await checkedPath(hooks, 'directory'))
            if ((await fs.readdir(hooks)).length)
                throw new Error('UNSAFE_HISTORY_HOOKS');
        let abandonedTempCount = 0, abandonedBytes = 0;
        if (await checkedPath(historyRoot, 'directory'))
            for (const name of await fs.readdir(historyRoot)) {
                const target = path.join(historyRoot, name);
                if (/^(auth|pending)\.json\.[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.tmp$/.test(name)) {
                    const stat = await checkedPath(target, 'file', { missing: false, maxBytes: 400000 });
                    abandonedTempCount++;
                    abandonedBytes += stat.size;
                    if (abandonedTempCount > 128 || abandonedBytes > 8 * 1024 * 1024)
                        throw new Error('HISTORY_ABANDONED_TEMP_LIMIT');
                    continue;
                }
                if (!['repository', 'no-hooks', 'empty-config', 'auth.json', 'pending.json'].includes(name))
                    throw new Error('UNSAFE_HISTORY_MANAGED_STATE');
                await noLinks(target);
            }
        if (await checkedPath(repo, 'directory'))
            for (const name of await fs.readdir(repo)) {
                if (!['.git', 'events'].includes(name))
                    throw new Error('UNSAFE_HISTORY_ATTRIBUTES');
                await noLinks(path.join(repo, name));
            }
        if (await checkedPath(events, 'directory'))
            for (const name of await fs.readdir(events)) {
                if (!/^[a-f0-9-]{36}\.json$/.test(name))
                    throw new Error('UNSAFE_HISTORY_ATTRIBUTES');
                await checkedPath(path.join(events, name), 'file', { missing: false, maxBytes: 400000 });
            }
        await verifyGitConfiguration();
        return { abandonedTempCount };
    }
    async function atomic(file, value) {
        assertHeld();
        await verifyManagedPaths();
        await checkedPath(path.dirname(file), 'directory', { missing: false });
        await checkedPath(file, 'file', { maxBytes: 400000 });
        const temp = file + '.' + crypto.randomUUID() + '.tmp';
        await noLinks(temp);
        const handle = await fs.open(temp, 'wx', 0o600);
        try {
            await handle.writeFile(stable(value));
            await handle.sync();
        }
        finally {
            await handle.close();
        }
        await onTransition('temp-synced', { target: path.basename(file) });
        assertHeld();
        await checkedPath(path.dirname(file), 'directory', { missing: false });
        await checkedPath(file, 'file', { maxBytes: 400000 });
        await checkedPath(temp, 'file', { missing: false, maxBytes: 400000 });
        await fs.rename(temp, file);
        assertHeld();
    }
    async function git(args) {
        assertHeld();
        await verifyManagedPaths();
        if (digest(await fs.readFile(gitExecutable)) !== gitSha256)
            throw new Error('HISTORY_GIT_MISMATCH');
        const env = { ...process.env };
        for (const key of Object.keys(env))
            if (key.startsWith('GIT_'))
                delete env[key];
        Object.assign(env, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: path.join(historyRoot, 'empty-config'), GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0' });
        try {
            return (await run(gitExecutable, ['-c', 'core.hooksPath=' + path.join(historyRoot, 'no-hooks'), '-c', 'core.fsmonitor=false', '-c', 'protocol.allow=never', '-c', 'commit.gpgSign=false', '-c', 'user.name=Material Browser', '-c', 'user.email=local@invalid', '-C', repo, ...args], { env, windowsHide: true, shell: false, timeout: 10000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8' })).stdout.trim();
        }
        catch {
            throw new Error('HISTORY_GIT_FAILED');
        }
    }
    async function init() {
        await verifyManagedPaths();
        if (ready)
            return;
        await directory(historyRoot);
        await directory(repo);
        await directory(events);
        await directory(path.join(historyRoot, 'no-hooks'));
        const config = path.join(historyRoot, 'empty-config');
        if (!await checkedPath(config, 'file', { maxBytes: 0 }))
            await fs.writeFile(config, '', { flag: 'wx', mode: 0o600 });
        if (!await checkedPath(path.join(repo, '.git'), 'directory'))
            await git(['init', '--initial-branch=main', '--template=' + path.join(historyRoot, 'no-hooks')]);
        await verifyManagedPaths();
        ready = true;
    }
    return { noLinks, checkedPath, directory, boundedRead, verifyManagedPaths, atomic, git, init };
}
module.exports = { createHistoryStorage };
