// Drafts contain configuration only and survive reload within the same window.
export function readSuperProfileDraft(serialized) {
  if (typeof serialized !== 'string' || serialized.length > 65536) throw new Error('INVALID_DRAFT');
  const d = JSON.parse(serialized);
  if (!d || typeof d.name !== 'string' || d.name.length > 256 || !['chromium','firefox'].includes(d.engine) || !d.settings || !['wsl2','windows-sandbox'].includes(d.settings.backend) || !['terminal','browser','desktop'].includes(d.settings.launchMode)) throw new Error('INVALID_DRAFT');
  for (const key of ['rootfsPath','rootfsSha256','workspacePath']) if (d.settings[key] !== undefined && (typeof d.settings[key] !== 'string' || d.settings[key].length > 4096)) throw new Error('INVALID_DRAFT');
  for (const key of ['setupCommands','startupCommands','installers']) if (d.settings[key] !== undefined && (!Array.isArray(d.settings[key]) || d.settings[key].some(v => typeof v !== 'string'))) throw new Error('INVALID_DRAFT');
  if (d.settings.configurations !== undefined) {
    if (!d.settings.configurations || typeof d.settings.configurations !== 'object' || Array.isArray(d.settings.configurations)) throw new Error('INVALID_DRAFT');
    for (const [backend,config] of Object.entries(d.settings.configurations)) {
      if (!['wsl2','windows-sandbox'].includes(backend) || !config || typeof config !== 'object' || Object.hasOwn(config,'configurations')) throw new Error('INVALID_DRAFT');
      readSuperProfileDraft(JSON.stringify({...d,settings:{...config,backend}}));
    }
  }
  return {name:d.name,engine:d.engine,settings:d.settings,step:Number.isInteger(d.step)?Math.max(0,Math.min(3,d.step)):0};
}

// Persist only safe resume metadata. Paths, scripts and other guest contents are
// deliberately excluded from the unencrypted browser preference store.
export function superProfileResumeMetadata(draft) {
  return {name:draft.name,engine:draft.engine,settings:{backend:draft.settings.backend,launchMode:draft.settings.launchMode},step:draft.step};
}

export function switchSuperProfileBackend(settings, backend) {
  if (!['wsl2','windows-sandbox'].includes(backend)) throw new Error('INVALID_BACKEND');
  const {configurations = {}, backend: previousBackend, ...current} = settings;
  const saved = {...configurations, [previousBackend]: current};
  const next = saved[backend] || {launchMode:backend === 'windows-sandbox'?'browser':'terminal'};
  return {...next, backend, configurations:saved};
}
export function persistSuperProfileConfiguration(settings) {
  const {configurations = {},backend,...current} = settings;
  for (const key of ['rootfsPath','rootfsSha256','workspacePath']) if (current[key] === '') delete current[key];
  return {...current,backend,configurations:{...configurations,[backend]:current}};
}

export async function finishSuperProfileMutation({kind,result,clearSelection,refresh}) {
  if (kind === 'remove') clearSelection();
  let refreshFailed = false;
  try { await refresh(); } catch { refreshFailed = true; }
  if (result?.saved === true) return result.cleanupPending
    ? 'Data saved. Cleanup is incomplete; retry Discard and close.'
    : refreshFailed ? 'Data saved. The view could not refresh; retry Refresh.' : 'Data saved and session closed.';
  if (result?.state === 'collecting') return 'Save collection started. Watch session progress for the final result.';
  if (result?.state === 'provisioning') return 'Provisioning started. Watch session progress for readiness.';
  if (result?.state === 'cancelling') return 'Cancellation requested. Watch session progress for confirmation.';
  return refreshFailed ? 'Action completed. The view could not refresh; retry Refresh.' : 'Completed';
}

const healthDetails = new Set([
  'Waiting for the Sandbox guest heartbeat',
  'Waiting for a guest workspace observation',
  'Guest observation was invalid',
  'No fresh guest observation is available',
  'Guest process observation only',
  'Observation state is unavailable',
  'Guest observation stopped for an explicit lifecycle operation',
  'Host restarted; guest observation ownership must be recovered explicitly',
]);
export function superSessionPresentation(session) {
  const status = ['unknown','starting','ready','exited'].includes(session.health?.status)
    ? session.health.status : 'unknown';
  return {
    healthStatus: status,
    healthDetail: healthDetails.has(session.health?.detail) ? session.health.detail : 'Observation state is unavailable',
    canStop: ['running','launched','starting','recovery-required','disposed-unexported','provisioning','collecting'].includes(session.state),
    canSave: session.state === 'stopped' || (status === 'ready' && ['running','launched','starting'].includes(session.state)),
    canDiscard: ['running','launched','starting','stopped','saved','cleanup-required','recovery-required','disposed-unexported','save-ready'].includes(session.state),
    retained: ['recovery-required','disposed-unexported'].includes(session.state),
  };
}

// Iteration combines valid pairs while retaining lone surrogate code points.
function wellFormedBookmarkText(value) {
  if (typeof value !== 'string') return false;
  for (const character of value) {
    const code = character.codePointAt(0);
    if (code >= 0xd800 && code <= 0xdfff) return false;
  }
  return true;
}

export function parsePortableBookmarkBytes(bytes) {
  if (!(bytes instanceof ArrayBuffer) && !ArrayBuffer.isView(bytes)) throw new Error('INVALID_PORTABLE_BOOKMARKS');
  if (bytes.byteLength > 65536) throw new Error('INVALID_PORTABLE_BOOKMARKS');
  let text;
  try { text = new TextDecoder('utf-8', {fatal:true}).decode(bytes); }
  catch { throw new Error('INVALID_PORTABLE_BOOKMARKS'); }
  return parsePortableBookmarks(text);
}

// Validate the complete portable document before applying any part of it.
export function parsePortableBookmarks(text) {
  const fail = () => { throw new Error('INVALID_PORTABLE_BOOKMARKS'); };
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > 65536) fail();
  let document; try { document = JSON.parse(text); } catch { fail(); }
  const record = value => value && typeof value === 'object' && !Array.isArray(value);
  const keys = (value, allowed) => record(value) && Object.keys(value).every(key => allowed.includes(key));
  const name = value => wellFormedBookmarkText(value) && value.length > 0 && [...value].length <= 256 && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
  if (!keys(document,['version','folderName','bookmarks']) || document.version !== 1 || !name(document.folderName) || !Array.isArray(document.bookmarks)) fail();
  let count = 0, links = 0;
  const visit = (nodes, depth) => {
    if (depth > 8) fail();
    for (const node of nodes) {
      if (++count > 500 || !record(node) || !name(node.name)) fail();
      if (Object.hasOwn(node,'url')) {
        if (!keys(node,['name','url']) || !wellFormedBookmarkText(node.url) || [...node.url].length > 4096 || /[\u0000-\u001f\u007f-\u009f]/u.test(node.url)) fail();
        let url; try { url = new URL(node.url); } catch { fail(); }
        if (!['http:','https:'].includes(url.protocol) || node.url.trim() !== node.url || !url.hostname || url.username || url.password || node.url.includes('\\') || !node.url.includes('://') || node.url.split('://')[1].split(/[/?#]/)[0].includes('@')) fail();
        links++;
      } else {
        if (!keys(node,['name','children']) || !Array.isArray(node.children)) fail();
        visit(node.children,depth+1);
      }
    }
  };
  visit(document.bookmarks,1);
  return {document,count,links};
}

export function superProfileWizardSave(draft, progress, fallbackName) {
  const settings = persistSuperProfileConfiguration({...draft.settings,engine:draft.engine});
  // Draft state belongs to the template, never to a retained backend configuration.
  settings.configurations = Object.fromEntries(Object.entries(settings.configurations).map(([backend,value])=>{const config={...value};delete config.setupDraft;delete config.draftStep;return [backend,config];}));
  delete settings.setupDraft; delete settings.draftStep;
  if (progress) { settings.setupDraft = true; settings.draftStep = draft.step; }
  return {name:draft.name.trim() || fallbackName,engine:draft.engine,settings};
}
