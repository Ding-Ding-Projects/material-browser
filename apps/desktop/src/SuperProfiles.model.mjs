// Drafts contain configuration only and survive reload within the same window.
export function readSuperProfileDraft(serialized) {
  if (typeof serialized !== 'string' || serialized.length > 65536) throw new Error('INVALID_DRAFT');
  const d = JSON.parse(serialized);
  if (!d || typeof d.name !== 'string' || d.name.length > 256 || !['chromium','firefox'].includes(d.engine) || !d.settings || !['wsl2','windows-sandbox'].includes(d.settings.backend) || !['terminal','browser','desktop'].includes(d.settings.launchMode)) throw new Error('INVALID_DRAFT');
  for (const key of ['rootfsPath','rootfsSha256','workspacePath']) if (d.settings[key] !== undefined && (typeof d.settings[key] !== 'string' || d.settings[key].length > 4096)) throw new Error('INVALID_DRAFT');
  for (const key of ['setupCommands','startupCommands','installers']) if (d.settings[key] !== undefined && (!Array.isArray(d.settings[key]) || d.settings[key].some(v => typeof v !== 'string'))) throw new Error('INVALID_DRAFT');
  if (d.settings.passwordManager !== undefined && d.settings.passwordManager !== null) {
    const pm = d.settings.passwordManager;
    if (!pm || typeof pm !== 'object' || pm.provider !== 'keepassxc' || pm.source !== 'wsl' || pm.wslDistribution !== 'guest' || !pm.database || typeof pm.database.path !== 'string' || pm.database.path.length > 1024 || typeof pm.extension !== 'boolean' || typeof pm.passkeys !== 'boolean') throw new Error('INVALID_DRAFT');
  }
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
