'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { withNativeLock } = require('./native-lock.cjs');
const { createHistoryStorage } = require('./history-storage.cjs');
const scrypt = promisify(crypto.scrypt);
const KEYS = new Set('language funnyEnglish funnyCantonese dialogEmoji narration narratorLanguage voiceEnglish voiceCantonese speechRate speechPitch screenReaderMode theme density accent fontFamily fontScale fontWeight motion logoPreset accessibilityVisible textScale highContrast strongFocus largeTargets focus lowStimulation timeAwareness oneThing nextAction momentum idleMinutes snoozeMinutes toastSeconds quietEnabled quietStart quietEnd paletteSize'.split(' '));
const ACTIONS = new Set(['created', 'updated', 'deleted', 'reset', 'restored', 'imported', 'settings-changed', 'labelled', 'retention-changed']);
const OMITTED = ['Personal wording and file metadata', 'Credentials and vault data', 'Device paths', 'User-entered text, schedule labels and voice identifiers'];
const stable = value => JSON.stringify(value);
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const validId = value => typeof value === 'string' && /^[a-f0-9-]{36}$/.test(value);
function createHistoryService(options) {
    const { appDataRoot, historyRoot, gitExecutable, gitSha256, credentialStore, validatePreferences, validateSchedule, onTransition = async () => {
    } } = options || {};
    if (!path.isAbsolute(appDataRoot || '') || historyRoot !== path.join(appDataRoot, 'settings-history') || !path.isAbsolute(gitExecutable || '') || !/^[a-f0-9]{64}$/.test(gitSha256 || '') || typeof credentialStore?.withKey !== 'function' || typeof validatePreferences !== 'function' || typeof validateSchedule !== 'function')
        throw new Error('INVALID_HISTORY_OPTIONS');
    const repo = path.join(historyRoot, 'repository'), events = path.join(repo, 'events'), authFile = path.join(historyRoot, 'auth.json'), journal = path.join(historyRoot, 'pending.json');
    let unlockedUntil = 0, sessionGeneration = null, queue = Promise.resolve(), lease;
    const lockIdentity = async () => {
        if (!await checkedPath(appDataRoot, 'directory')) {
            await verifyManagedPaths();
            await directory(appDataRoot);
        }
        const resolved = await fs.realpath(appDataRoot);
        return digest('history:' + path.join(resolved, 'settings-history').toLowerCase());
    };
    const assertHeld = () => {
        if (!lease)
            throw new Error('HISTORY_LOCK_REQUIRED');
        lease.assertHeld();
    };
    const { noLinks, checkedPath, directory, boundedRead, verifyManagedPaths, atomic, git, init } = createHistoryStorage({ appDataRoot, historyRoot, gitExecutable, gitSha256, assertHeld, onTransition });
    async function readAuth() {
        const auth = JSON.parse((await boundedRead(authFile, 8192)).toString('utf8'));
        const keys = auth.version === 1 ? ['version', 'salt', 'verifier'] : ['version', 'generation', 'salt', 'verifier'];
        if (![1, 2].includes(auth.version) || Object.keys(auth).some(key => !keys.includes(key)) ||
            typeof auth.salt !== 'string' || typeof auth.verifier !== 'string' ||
            Buffer.from(auth.salt, 'base64').length !== 16 || Buffer.from(auth.verifier, 'base64').length !== 32 ||
            (auth.version === 2 && (!Number.isSafeInteger(auth.generation) || auth.generation < 1))) {
            throw new Error('INVALID_HISTORY_AUTH');
        }
        return { ...auth, generation: auth.version === 1 ? 0 : auth.generation };
    }
    const active = async () => {
        if (Date.now() >= unlockedUntil)
            throw new Error('HISTORY_LOCKED');
        if ((await readAuth()).generation !== sessionGeneration) {
            unlockedUntil = 0;
            sessionGeneration = null;
            throw new Error('HISTORY_SESSION_REVOKED');
        }
    };
    const serial = fn => {
        const result = queue.then(fn);
        queue = result.catch(() => {
        });
        return result;
    };
    function project(input) {
        if (input?.kind === 'display-name') {
            if (input.schemaVersion !== 1 || input.recordId !== 'application-display-name-v1' || Object.keys(input).some(k => !['schemaVersion', 'kind', 'recordId', 'displayName'].includes(k)) || (input.displayName !== null && (typeof input.displayName !== 'string' || !input.displayName.trim() || input.displayName.length > 120 || /[\x00-\x1f\x7f]/.test(input.displayName))))
                throw new Error('INVALID_DISPLAY_NAME_RECORD');
            return { schemaVersion: 1, kind: 'display-name', recordId: 'application-display-name-v1', displayName: input.displayName };
        }
        if (!input || input.schemaVersion !== 1 || Object.keys(input).some(k => !['schemaVersion', 'preferences', 'schedules'].includes(k)) || !input.preferences || typeof input.preferences !== 'object' || Array.isArray(input.preferences) || Object.keys(input.preferences).some(k => !KEYS.has(k)) || !Array.isArray(input.schedules) || input.schedules.length > 200)
            throw new Error('INVALID_HISTORY_SNAPSHOT');
        // Both validators are trusted imports of the shared settings model, never renderer callbacks.
        const preferences = validatePreferences(input.preferences), schedules = input.schedules.map(validateSchedule);
        if (Object.keys(preferences).some(k => !KEYS.has(k)) || new Set(schedules.map(s => s.id)).size !== schedules.length)
            throw new Error('INVALID_HISTORY_SNAPSHOT');
        const snapshot = { schemaVersion: 1, preferences, schedules };
        if (Buffer.byteLength(stable(snapshot)) > 262144)
            throw new Error('HISTORY_SNAPSHOT_TOO_LARGE');
        return snapshot;
    }
    function expectedContext(context, desired) {
        if (!context || typeof context !== 'object' || Array.isArray(context) ||
            Object.keys(context).some(key => !['expected', 'expectedNativeRevision'].includes(key)) ||
            !Number.isSafeInteger(context.expectedNativeRevision) || context.expectedNativeRevision < 0)
            throw new Error('INVALID_RESTORE_EXPECTATION');
        let expected;
        try { expected = project(context.expected); }
        catch { throw new Error('INVALID_RESTORE_EXPECTATION'); }
        if (expected.kind !== desired.kind || expected.recordId !== desired.recordId)
            throw new Error('INVALID_RESTORE_EXPECTATION');
        return { expected, expectedNativeRevision: context.expectedNativeRevision };
    }
    async function seal(value, id) {
        return credentialStore.withKey(key => {
            const recordId = value.snapshot?.recordId || value.recordId || 'presentation-settings-v1';
            const nonce = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
            cipher.setAAD(Buffer.from('material-browser:settings-history:v1:' + recordId + ':' + id));
            const plaintext = Buffer.from(stable(value));
            try {
                const data = Buffer.concat([cipher.update(plaintext), cipher.final()]);
                return { version: 2, id, recordId, nonce: nonce.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') };
            }
            finally {
                plaintext.fill(0);
            }
        });
    }
    async function read(id) {
        if (!validId(id) && id !== 'pending')
            throw new Error('INVALID_REVISION');
        const file = id === 'pending' ? journal : path.join(events, id + '.json');
        const raw = await boundedRead(file, 400000);
        if (raw.length > 400000)
            throw new Error('INVALID_REVISION');
        const envelope = JSON.parse(raw);
        if (envelope.id !== id || ![1, 2].includes(envelope.version) || (envelope.version === 2 && !['presentation-settings-v1', 'application-display-name-v1'].includes(envelope.recordId)))
            throw new Error('INVALID_REVISION');
        return credentialStore.withKey(key => {
            const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.nonce, 'base64'));
            decipher.setAAD(Buffer.from('material-browser:settings-history:v1:' + (envelope.version === 2 ? envelope.recordId + ':' : '') + id));
            decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
            const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.data, 'base64')), decipher.final()]);
            try {
                return JSON.parse(plaintext.toString('utf8'));
            }
            finally {
                plaintext.fill(0);
            }
        });
    }
    async function append(payload) {
        await init();
        const files = await fs.readdir(events);
        if (files.length >= 2000)
            throw new Error('HISTORY_CAPACITY_REACHED');
        const id = crypto.randomUUID(), file = path.join(events, id + '.json');
        await checkedPath(events, 'directory', { missing: false });
        await noLinks(file);
        assertHeld();
        await fs.writeFile(file, stable(await seal({ ...payload, date: new Date().toISOString() }, id)), { flag: 'wx', mode: 0o600 });
        await git(['add', '--', 'events/' + id + '.json']);
        await git(['commit', '--no-verify', '-m', 'Record local settings history']);
        const commit = await git(['rev-parse', 'HEAD']);
        return { revision: id, commit };
    }
    async function configured() {
        await checkedPath(authFile, 'file', { maxBytes: 8192 });
        try {
            await fs.access(authFile);
            return true;
        }
        catch (error) {
            if (error.code === 'ENOENT')
                return false;
            throw error;
        }
    }
    async function requireAuth() {
        await init();
        if (!await configured())
            throw new Error('HISTORY_NOT_CONFIGURED');
    }
    async function rows() {
        await requireAuth();
        await active();
        const diskFiles = await fs.readdir(events);
        if (diskFiles.length > 2000)
            throw new Error('HISTORY_CAPACITY_REACHED');
        if (!diskFiles.length)
            return [];
        const files = (await git(['ls-tree', '--name-only', 'HEAD:events'])).split(/\r?\n/).filter(Boolean);
        const all = [];
        for (const file of files) {
            if (!/^[a-f0-9-]{36}\.json$/.test(file))
                throw new Error('INVALID_HISTORY_FILE');
            const id = file.slice(0, -5);
            all.push({ revision: id, ...await read(id) });
        }
        return all.sort((a, b) => b.date.localeCompare(a.date) || b.revision.localeCompare(a.revision));
    }
    const methods = {
        async status() {
            await init();
            const { abandonedTempCount } = await verifyManagedPaths();
            let recoveryPending = false;
            try {
                await fs.access(journal);
                recoveryPending = true;
            }
            catch {
            }
            const isConfigured = await configured();
            if (isConfigured && Date.now() < unlockedUntil && (await readAuth()).generation !== sessionGeneration) {
                unlockedUntil = 0;
                sessionGeneration = null;
            }
            let recoveryCode = recoveryPending ? 'HISTORY_RECOVERY_AUTH_REQUIRED' : null;
            if (recoveryPending && Date.now() < unlockedUntil) {
                const pending = await read('pending');
                try {
                    expectedContext({ expected: pending.previous, expectedNativeRevision: pending.expectedNativeRevision }, project(pending.snapshot));
                    recoveryCode = 'HISTORY_RECOVERY_REQUIRED';
                }
                catch { recoveryCode = 'HISTORY_RECOVERY_EXPECTATION_REQUIRED'; }
            }
            return { configured: isConfigured, unlocked: Date.now() < unlockedUntil, recoveryPending, recoveryCode, needsExplicitDiscard: recoveryCode === 'HISTORY_RECOVERY_EXPECTATION_REQUIRED', abandonedTempCount, physicalPruneAvailable: false };
        },
        async setup(secret) {
            return serial(async () => {
                await init();
                if (await configured())
                    throw new Error('HISTORY_ALREADY_CONFIGURED');
                if (typeof secret !== 'string' || secret.length < 6 || secret.length > 256)
                    throw new Error('INVALID_HISTORY_PASSWORD');
                const salt = crypto.randomBytes(16), derived = await scrypt(secret, salt, 32);
                try {
                    await credentialStore.withKey(() => {
                    }, { create: true });
                    await atomic(authFile, { version: 2, generation: 1, salt: salt.toString('base64'), verifier: derived.toString('base64') });
                    sessionGeneration = 1;
                    unlockedUntil = Date.now() + 10 * 60 * 1000;
                    return { configured: true, unlocked: true };
                }
                finally {
                    derived.fill(0);
                }
            });
        },
        async verify(secret) {
            await requireAuth();
            if (typeof secret !== 'string' || secret.length > 256)
                throw new Error('INVALID_HISTORY_PASSWORD');
            const auth = await readAuth();
            const derived = await scrypt(secret, Buffer.from(auth.salt, 'base64'), 32);
            try {
                if (!crypto.timingSafeEqual(derived, Buffer.from(auth.verifier, 'base64')))
                    throw new Error('HISTORY_AUTH_FAILED');
                await credentialStore.withKey(() => {
                });
                return { verified: true };
            }
            finally {
                derived.fill(0);
            }
        },
        async unlock(secret) {
            await methods.verify(secret);
            sessionGeneration = (await readAuth()).generation;
            unlockedUntil = Date.now() + 10 * 60 * 1000;
            return { unlocked: true };
        },
        async changePassword(oldSecret, newSecret) {
            await methods.verify(oldSecret);
            if (typeof newSecret !== 'string' || newSecret.length < 6 || newSecret.length > 256)
                throw new Error('INVALID_HISTORY_PASSWORD');
            const auth = await readAuth();
            if (auth.generation >= Number.MAX_SAFE_INTEGER)
                throw new Error('INVALID_HISTORY_AUTH');
            const generation = auth.generation + 1;
            const salt = crypto.randomBytes(16);
            const derived = await scrypt(newSecret, salt, 32);
            try {
                await atomic(authFile, { version: 2, generation, salt: salt.toString('base64'), verifier: derived.toString('base64') });
                sessionGeneration = generation;
                unlockedUntil = Date.now() + 10 * 60 * 1000;
                return { changed: true, unlocked: true, otherSessionsRevoked: true };
            }
            finally {
                derived.fill(0);
            }
        },
        async lock() {
            unlockedUntil = 0;
            sessionGeneration = null;
            return { unlocked: false };
        },
        async recordSettings({ before, after, action = 'settings-changed', protectedMutation = false }) {
            return serial(async () => {
                try {
                    await requireAuth();
                    if (protectedMutation)
                        throw new Error('PROTECTED_TRANSACTION_REQUIRED');
                    if (!ACTIONS.has(action))
                        throw new Error('INVALID_HISTORY_ACTION');
                    const snapshot = project(after);
                    if (snapshot.kind === 'display-name')
                        throw new Error('PROTECTED_TRANSACTION_REQUIRED');
                    if (before && stable(project(before)) === stable(snapshot))
                        return { recorded: false, unchanged: true };
                    return { recorded: true, ...await append({ action, recordId: 'presentation-settings-v1', snapshot }) };
                }
                catch (error) {
                    return { recorded: false, warning: /^[A-Z_]+$/.test(error.message) ? error.message : 'HISTORY_WRITE_FAILED' };
                }
            });
        },
        async transactDisplayName({ before, after, action = 'updated', expectedNativeRevision }, apply) {
            return serial(async () => {
                await requireAuth();
                await active();
                if (typeof apply !== 'function')
                    throw new Error('TRUSTED_APPLY_REQUIRED');
                if (!['created', 'updated', 'deleted', 'reset'].includes(action))
                    throw new Error('INVALID_HISTORY_ACTION');
                const snapshot = project({ schemaVersion: 1, kind: 'display-name', recordId: 'application-display-name-v1', displayName: after });
                const previous = project({ ...snapshot, displayName: before });
                const context = expectedContext({ expected: previous, expectedNativeRevision }, snapshot);
                if (stable(snapshot) === stable(previous))
                    return { recorded: false, unchanged: true };
                const latest = (await rows()).find(row => row.snapshot?.kind === 'display-name' && !row.prepared && row.action !== 'restore-prepared');
                if (latest && latest.snapshot.displayName !== before)
                    throw new Error('HISTORY_STATE_CONFLICT');
                try {
                    await fs.access(journal);
                    throw new Error('HISTORY_RECOVERY_REQUIRED');
                }
                catch (error) {
                    if (error.code !== 'ENOENT')
                        throw error;
                }
                const transaction = { operation: 'display-name', transactionId: crypto.randomUUID(), phase: 'prepared', action, snapshot, previous, expectedNativeRevision: context.expectedNativeRevision };
                await atomic(journal, await seal(transaction, 'pending'));
                await onTransition('journal-prepared');
                await append({ action: 'transaction-prepared', prepared: true, recordId: snapshot.recordId, snapshot });
                await onTransition('prepared-committed');
                transaction.phase = 'apply-started';
                await atomic(journal, await seal(transaction, 'pending'));
                try {
                    assertHeld();
                    await apply(snapshot, context);
                    await onTransition('applied');
                }
                catch (error) {
                    if (['SETTINGS_CONFLICT', 'DISPLAY_NAME_CONFLICT'].includes(error?.message)) throw new Error('HISTORY_STATE_CONFLICT');
                    throw new Error('HISTORY_RECOVERY_REQUIRED');
                }
                transaction.phase = 'applied';
                await atomic(journal, await seal(transaction, 'pending'));
                const receipt = await append({ action, recordId: snapshot.recordId, snapshot });
                await fs.unlink(journal);
                return { applied: true, recorded: true, ...receipt };
            });
        },
        async list({ actions = [], from = '', to = '', limit = 100 } = {}) {
            if (!Array.isArray(actions) || actions.some(a => !ACTIONS.has(a)) || !Number.isInteger(limit) || limit < 1 || limit > 500 || [from, to].some(x => x !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(x)))
                throw new Error('INVALID_HISTORY_FILTER');
            const all = await rows(), labels = new Map();
            for (const row of [...all].reverse())
                if (row.action === 'labelled')
                    labels.set(row.target, row.label);
            const policy = all.find(row => row.action === 'retention-changed'), cutoff = policy ? Date.now() - policy.visibleDays * 86400000 : 0;
            const revisions = all.filter(row => row.snapshot && !row.prepared && row.action !== 'restore-prepared' && Date.parse(row.date) >= cutoff && (!actions.length || actions.includes(row.action)) && (!from || row.date.slice(0, 10) >= from) && (!to || row.date.slice(0, 10) <= to)).slice(0, limit).map(row => ({ revision: row.revision, date: row.date, action: row.action, label: labels.get(row.revision) || '', recordId: row.recordId }));
            return { revisions, omitted: OMITTED, logicalRetentionDays: policy?.visibleDays || null, physicalPruneAvailable: false };
        },
        async diff(revision) {
            await requireAuth();
            await active();
            const row = await read(revision);
            if (!row.snapshot)
                throw new Error('INVALID_REVISION');
            if (row.snapshot.kind === 'display-name')
                return { recordKind: 'display-name', changed: true, omitted: OMITTED };
            const all = (await rows()).filter(r => r.snapshot && !r.prepared && r.action !== 'restore-prepared' && !r.snapshot.kind);
            const index = all.findIndex(r => r.revision === revision), previous = all[index + 1]?.snapshot;
            return { changedKeys: [...KEYS].filter(key => stable(previous?.preferences[key]) !== stable(row.snapshot.preferences[key])), scheduleCount: row.snapshot.schedules.length, previousScheduleCount: previous?.schedules.length || 0, omitted: OMITTED };
        },
        async label(revision, label) {
            return serial(async () => {
                await requireAuth();
                await active();
                await read(revision);
                if (typeof label !== 'string' || label.length > 120 || /[\x00-\x1f]/.test(label))
                    throw new Error('INVALID_HISTORY_LABEL');
                return append({ action: 'labelled', target: revision, label });
            });
        },
        async restore(revision, expected, apply) {
            return serial(async () => {
                await requireAuth();
                await active();
                if (typeof apply !== 'function')
                    throw new Error('TRUSTED_APPLY_REQUIRED');
                try {
                    await fs.access(journal);
                    throw new Error('HISTORY_RECOVERY_REQUIRED');
                }
                catch (error) {
                    if (error.code !== 'ENOENT')
                        throw error;
                }
                const row = await read(revision);
                if (!row.snapshot)
                    throw new Error('INVALID_REVISION');
                const snapshot = project(row.snapshot);
                const context = expectedContext(expected, snapshot);
                const transaction = { operation: 'restore', transactionId: crypto.randomUUID(), phase: 'prepared', source: revision, snapshot, previous: context.expected, expectedNativeRevision: context.expectedNativeRevision };
                await atomic(journal, await seal(transaction, 'pending'));
                await onTransition('journal-prepared');
                await append({ action: 'restore-prepared', recordId: snapshot.recordId || 'presentation-settings-v1', snapshot });
                await onTransition('prepared-committed');
                transaction.phase = 'apply-started';
                await atomic(journal, await seal(transaction, 'pending'));
                try {
                    assertHeld();
                    await apply(snapshot, context);
                    await onTransition('applied');
                }
                catch (error) {
                    if (['SETTINGS_CONFLICT', 'DISPLAY_NAME_CONFLICT'].includes(error?.message)) throw new Error('HISTORY_STATE_CONFLICT');
                    throw new Error('HISTORY_RECOVERY_REQUIRED');
                }
                transaction.phase = 'applied';
                await atomic(journal, await seal(transaction, 'pending'));
                const receipt = await append({ action: 'restored', recordId: snapshot.recordId || 'presentation-settings-v1', snapshot });
                await fs.unlink(journal);
                return { restored: true, recorded: true, ...receipt };
            });
        },
        async recover(decision, apply) {
            return serial(async () => {
                await requireAuth();
                await active();
                if (!['retry', 'discard'].includes(decision))
                    throw new Error('INVALID_RECOVERY_DECISION');
                const pending = await read('pending');
                if (!['restore', 'display-name'].includes(pending.operation))
                    throw new Error('INVALID_RECOVERY_RECORD');
                if (decision === 'retry') {
                    if (typeof apply !== 'function')
                        throw new Error('TRUSTED_APPLY_REQUIRED');
                    const snapshot = project(pending.snapshot);
                    let context;
                    try { context = expectedContext({ expected: pending.previous, expectedNativeRevision: pending.expectedNativeRevision }, snapshot); }
                    catch { throw new Error('HISTORY_RECOVERY_EXPECTATION_REQUIRED'); }
                    await append({ action: 'transaction-prepared', prepared: true, recordId: snapshot.recordId || 'presentation-settings-v1', snapshot });
                    try {
                        assertHeld();
                        await apply(snapshot, { ...context, recovery: true });
                    }
                    catch (error) {
                        if (['SETTINGS_CONFLICT', 'DISPLAY_NAME_CONFLICT'].includes(error?.message)) throw new Error('HISTORY_STATE_CONFLICT');
                        throw new Error('HISTORY_RECOVERY_REQUIRED');
                    }
                    const receipt = await append({ action: pending.operation === 'display-name' ? pending.action : 'restored', recordId: snapshot.recordId || 'presentation-settings-v1', snapshot });
                    await fs.unlink(journal);
                    return { recovered: true, recorded: true, ...receipt };
                }
                const receipt = await append({ action: 'transaction-discarded', source: pending.source || null });
                await fs.unlink(journal);
                return { recovered: true, discarded: true, ...receipt };
            });
        },
        async setRetention({ visibleDays }) {
            return serial(async () => {
                await requireAuth();
                await active();
                if (!Number.isInteger(visibleDays) || visibleDays < 1 || visibleDays > 36500)
                    throw new Error('INVALID_RETENTION');
                return { ...await append({ action: 'retention-changed', visibleDays }), logicalOnly: true, physicalPruneAvailable: false };
            });
        },
        async exportRedacted() {
            const { revisions } = await methods.list({ limit: 500 });
            return { schemaVersion: 1, revisions: revisions.map(({ label, ...row }) => row), omitted: OMITTED };
        }
    };
    const api = {};
    for (const [name, method] of Object.entries(methods))
        api[name] = async (...args) => {
            try {
                return await withNativeLock(await lockIdentity(), async (held) => {
                    lease = held;
                    try {
                    await verifyManagedPaths();
                        return { ok: true, ...await method(...args) };
                    }
                    finally {
                        lease = undefined;
                    }
                });
            }
            catch (error) {
                return { ok: false, error: { code: /^[A-Z_]+$/.test(error.message) ? error.message : 'HISTORY_UNAVAILABLE', message: 'Local history is unavailable or the request is invalid.' } };
            }
        };
    return Object.freeze(api);
}
module.exports = { createHistoryService };
