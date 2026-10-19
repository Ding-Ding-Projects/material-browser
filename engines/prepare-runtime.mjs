import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync } from 'node:fs';
import { mkdir, readFile, readdir, lstat, copyFile, cp, rename, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cache = path.join(root, 'engines/downloads');
const builds = path.join(root, 'engines/builds');
const lock = JSON.parse(await readFile(path.join(root, 'engines/runtime/browser-binaries.lock.json'), 'utf8'));
if (process.platform !== 'win32' || process.arch !== 'x64')
    throw Error('Browser runtime packaging requires Windows x64.');
if (lock.schemaVersion !== 1 || lock.archives.length !== 5)
    throw Error('Invalid browser runtime lock.');
const sevenZip = path.join(root, 'apps/desktop/node_modules/electron-winstaller/vendor/7z.exe');
if (!existsSync(sevenZip))
    throw Error('The locked desktop packaging dependency must provide 7-Zip before browser staging.');
async function sha(file) {
    const hash = createHash('sha256');
    for await (const bytes of createReadStream(file)) hash.update(bytes);
    return hash.digest('hex');
}
function run(executable, args, timeout = 120000) {
    const result = spawnSync(executable, args, {
        encoding: 'utf8', windowsHide: true, timeout, maxBuffer: 16 * 1024 * 1024,
    });
    if (result.error || result.status !== 0) {
        throw Error(`Runtime preparation command failed: ${path.basename(executable)}`);
    }
    return result.stdout;
}
function within(base, relative) {
    if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) ||
        relative.split(/[\\/]/).some(p => p === '..' || p === '.' || p.includes(':'))) {
        throw Error('Unsafe browser runtime path.');
    }
    const resolved = path.resolve(base, relative);
    if (!resolved.startsWith(path.resolve(base) + path.sep)) {
        throw Error('Browser runtime path escapes its root.');
    }
    return resolved;
}
async function files(directory, prefix = '') {
    const result = [];
    for (const item of await readdir(directory, { withFileTypes: true })) {
        const rel = prefix ? `${prefix}/${item.name}` : item.name;
        const absolute = path.join(directory, item.name);
        const info = await lstat(absolute);
        if (info.isSymbolicLink() || !(info.isDirectory() || info.isFile())) {
            throw Error('Linked or special browser payload entry.');
        }
        if (info.isDirectory()) result.push(...await files(absolute, rel));
        else result.push({ path: rel, bytes: info.size, sha256: await sha(absolute) });
    }
    return result.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
async function acquire(pin) {
    if (!/^[A-Za-z0-9._-]+$/.test(pin.file) || !/^[a-f0-9]{64}$/.test(pin.sha256) || !Number.isSafeInteger(pin.bytes) || pin.bytes <= 0)
        throw Error('Invalid pinned browser archive.');
    const destination = within(cache, pin.file);
    if (!existsSync(destination)) {
        const url = new URL(pin.url);
        if (url.protocol !== 'https:' || url.username || url.password || !['storage.googleapis.com', 'archive.mozilla.org', 'nodejs.org', 'github.com'].includes(url.hostname))
            throw Error('Browser archive source is not approved.');
        if (pin.github) {
            run('gh', ['release', 'download', pin.github.tag, '--repo', pin.github.repository, '--pattern', pin.github.asset, '--dir', cache], 1200000);
            if (pin.github.asset !== pin.file)
                throw Error('GitHub archive filename must match its lock.');
        }
        else {
            const partial = destination + `.partial-${randomUUID()}`;
            const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(1200000) });
            if (!response.ok || !response.body)
                throw Error(`Browser archive download failed: HTTP ${response.status}`);
            await pipeline(Readable.fromWeb(response.body), createWriteStream(partial, { flags: 'wx' }));
            if ((await stat(partial)).size !== pin.bytes || await sha(partial) !== pin.sha256)
                throw Error('Downloaded browser archive does not match its lock; partial retained.');
            await rename(partial, destination);
        }
    }
    if ((await stat(destination)).size !== pin.bytes || await sha(destination) !== pin.sha256)
        throw Error(`Browser archive integrity mismatch: ${pin.file}. Preserved without execution.`);
    return destination;
}
async function extract(pin, archive, destination) {
    const listing = run(sevenZip, ['l', '-slt', archive]);
    const entries = listing.slice(listing.indexOf('----------') + 10);
    if (/^(?:Symbolic Link|Hard Link) = /m.test(entries))
        throw Error('Linked archive entries are not supported.');
    const names = [...entries.matchAll(/^Path = (.+)\r?$/gm)].map(match => match[1].trim());
    if (!names.length)
        throw Error('Browser archive has no inspectable payload.');
    const seen = new Set();
    for (const name of names) {
        within(destination, name);
        const key = name.replaceAll('\\', '/').toLowerCase();
        if (seen.has(key))
            throw Error('Duplicate browser archive entry.');
        seen.add(key);
    }
    await mkdir(destination, { recursive: true });
    run(sevenZip, ['x', archive, `-o${destination}`, '-y'], 600000);
    await files(destination);
    const payload = pin.source === '.' ? destination : within(destination, pin.source);
    const observed = await files(payload);
    const expected = pin.files;
    if (!Array.isArray(expected) || JSON.stringify(observed) !== JSON.stringify(expected))
        throw Error(`Extracted browser payload differs from reviewed inventory: ${pin.id}`);
    return payload;
}
await mkdir(cache, { recursive: true });
await mkdir(builds, { recursive: true });
const stage = path.join(builds, `staging-${randomUUID()}`);
await mkdir(stage);
const acquired = new Map();
for (const pin of lock.archives) {
    const archive = await acquire(pin);
    const extracted = path.join(stage, `acquire-${pin.id}`);
    acquired.set(pin.id, await extract(pin, archive, extracted));
    console.log(`Verified browser archive and complete payload: ${pin.id}`);
}
// Adapter dependencies come only from their checked-in npm lock, without install scripts.
const npmCli = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
run(process.execPath, [npmCli, 'ci', '--prefix', path.join(root, 'engines/adapters'), '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], 600000);
const engines = path.join(stage, 'engines');
for (const kind of ['chromium', 'firefox']) {
    const browser = lock.browsers[kind], bundle = path.join(engines, kind);
    await mkdir(path.join(bundle, 'automation'), { recursive: true });
    await cp(acquired.get(kind), path.join(bundle, 'browser'), { recursive: true, errorOnExist: true });
    await mkdir(path.join(bundle, 'drivers'), { recursive: true });
    const driver = lock.archives.find(pin => pin.id === browser.driverArchive);
    await cp(acquired.get(driver.id), path.join(bundle, 'drivers'), { recursive: true, errorOnExist: true });
    await copyFile(path.join(acquired.get('node'), 'node.exe'), path.join(bundle, 'automation/node.exe'));
    await copyFile(path.join(acquired.get('node'), 'LICENSE'), path.join(bundle, 'automation/NODE-LICENSE.txt'));
    await copyFile(path.join(root, 'engines/adapters/launch.cjs'), path.join(bundle, 'automation/launch.cjs'));
    await cp(path.join(root, 'engines/adapters/node_modules'), path.join(bundle, 'automation/node_modules'), { recursive: true, errorOnExist: true });
    const driverPath = within(bundle, `drivers/${browser.driverExecutable}`);
    const driverOutput = run(driverPath, ['--version'], 5000);
    if (!driverOutput.split(/\s+/).includes(browser.driverVersion))
        throw Error('Bundled driver version does not match its lock.');
    const manifest = {
        schemaVersion: 1, engine: kind, version: browser.version,
        executable: `browser/${browser.executable}`,
        executableSha256: await sha(within(bundle, `browser/${browser.executable}`)),
        upstreamRevision: browser.revision,
        capabilities: {
            portableEncryption: false, liveSnapshot: false, stableIdentity: false,
            selenium: true, puppeteer: true,
        },
    };
    const base = {
        node: 'automation/node.exe', nodeSha256: await sha(path.join(bundle, 'automation/node.exe')),
        helper: 'automation/launch.cjs', helperSha256: await sha(path.join(bundle, 'automation/launch.cjs')),
        driver: null, driverSha256: null, driverVersion: null, browserVersion: browser.version,
    };
    const adapters = {
        puppeteer: base,
        selenium: {
            ...base, driver: `drivers/${browser.driverExecutable}`,
            driverSha256: await sha(driverPath), driverVersion: browser.driverVersion,
        },
    };
    await writeFile(path.join(bundle, 'manifest.json'), JSON.stringify(manifest, null, 2));
    await writeFile(path.join(bundle, 'adapters.json'), JSON.stringify(adapters, null, 2));
    await writeFile(path.join(bundle, 'payload-inventory.json'), JSON.stringify({ schemaVersion: 1, files: await files(bundle) }, null, 2));
}
const output = path.join(builds, 'packaged/engines');
await copyFile(path.join(root, 'engines/runtime/NOTICES.md'), path.join(engines, 'NOTICES.md'));
await cp(path.join(root, 'engines/runtime/licenses'), path.join(engines, 'licenses'), { recursive: true, errorOnExist: true });
await mkdir(path.dirname(output), { recursive: true });
// Preserve earlier generated candidates rather than deleting a directory another
// packaging operation may still be reading. Each build gets an immutable source.
if (existsSync(output))
    await rename(output, path.join(builds, `previous-engines-${randomUUID()}`));
await rename(engines, output);
await writeFile(path.join(output, 'bundle-receipt.json'), JSON.stringify({ schemaVersion: 1, lockSha256: await sha(path.join(root, 'engines/runtime/browser-binaries.lock.json')), adapterLockSha256: await sha(path.join(root, 'engines/adapters/package-lock.json')), browsers: lock.browsers, producedAt: new Date().toISOString() }, null, 2));
console.log('Prepared Chromium and Firefox with bundled offline automation runtimes.');
