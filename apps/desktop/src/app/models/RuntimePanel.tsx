import React, { useState } from 'react';
import { Btn, Dialog, Item, SegList } from '../../m3';
import { useModelsText } from './locale';
import { modelsRequest, modelError, type ModelStatus, type ModelCapabilities } from './service';

export function RuntimePanel({ status, capabilities, refresh }: { status: ModelStatus | null; capabilities: ModelCapabilities | null; refresh: () => Promise<void> }) {
  const t = useModelsText();
  const [plan, setPlan] = useState<any>(null);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const supports = (action: string) => capabilities?.actions?.includes(action) === true;
  async function run(action: string) {
    if (pending) return;
    setPending(action); setError(''); setMessage('');
    try {
      const result = await modelsRequest(action);
      if (action === 'installerPlan') setPlan(result);
      else { setMessage(result?.id ? 'Operation accepted; completion is reported by the service.' : 'Request returned. Refresh status to verify the result.'); await refresh(); }
    } catch (e) { setError(modelError(e)); } finally { setPending(''); }
  }
  return <section className="card outlined models-panel" aria-label={t('Runtime status')}>
    <h2 className="title-l">{t('Runtime status')}</h2>
    <SegList><Item title={t('Installed runtime')} support={status?.installed?.found === true ? status.installed.version || t('Installed') : status?.installed?.found === false ? t('Not installed') : t('Unknown')} /><Item title={t('Service health')} support={`${t(status?.state || 'Unknown')}${status?.version ? ` · ${status.version}` : ''}`} /><Item title={t('Checked')} support={status?.checkedAt ? new Date(status.checkedAt).toLocaleString() : t('Unknown')} /></SegList>
    {status?.reason && <p>{t(status.reason)}</p>}
    <div className="models-actions"><Btn icon="install_desktop" disabled={!!pending || !supports('installerPlan')} onClick={() => void run('installerPlan')}>{t(status?.installed?.found ? 'Review managed installation' : 'Install Ollama')}</Btn><Btn variant="tonal" disabled={!!pending || !supports('start')} onClick={() => void run('start')}>{t('Start runtime')}</Btn><Btn variant="outlined" disabled={!!pending || !supports('stop')} onClick={() => void run('stop')}>{t('Stop owned runtime')}</Btn><Btn variant="text" disabled={!!pending} onClick={() => void refresh()}>{t('Refresh status')}</Btn></div>
    {['installerPlan', 'start', 'stop'].filter(a => !supports(a)).map(action => <p key={action}><code>{action}</code>: {t(capabilities?.reasons?.[action] || 'This action is not provided by the native service.')}</p>)}
    <p>{t('Installation and startup are separate actions. Existing installations and models must be preserved.')}</p>
    <p>{t('Refresh status first. If the service is stopped, use Start runtime when available. If installation is missing, review the managed installation plan.')}</p>
    <p>{t('Registered launch profiles, snapshots and restore are not available from this service yet. No arbitrary program can be launched here.')}</p>
    {pending && <p role="status">{t('Working')} · {pending}</p>}{pending && <p role="status">{t('Working')} · {pending}</p>}{error && <p role="alert" className="models-error">{t(error)}</p>}{message && <p role="status">{t(message)}</p>}
    {plan && <Dialog title={t('Managed installation plan')} onClose={() => { if (!pending) setPlan(null); }} dismissible={!pending} actions={<><Btn variant="text" disabled={!!pending} onClick={() => setPlan(null)}>{t('Close')}</Btn><Btn disabled={!!pending || !plan.available || !supports('install')} onClick={() => void run('install')}>{t('Install verified payload')}</Btn></>}>
      <SegList>{[['Version',plan.version],['Architecture',plan.architecture],['Expected bytes',plan.bytes ?? plan.size],['SHA-256',plan.sha256],['Source',plan.url]].map(([label,value]) => <Item key={String(label)} title={t(String(label))} support={value === undefined ? t('Unknown') : String(value)} />)}</SegList>
      {!plan.available && <p>{t('Managed installation is unavailable until the native admission checks pass.')}</p>}{(Array.isArray(plan.reasons) ? plan.reasons : plan.reason ? [plan.reason] : []).map((reason: string,i: number) => <p key={i}>{t(reason)}</p>)}<p>{t('No arbitrary download address or shell command is accepted here.')}</p>{pending && <p role="status">{t('Working')} · {pending}</p>}{error && <p role="alert" className="models-error">{t(error)}</p>}{message && <p role="status">{t(message)}</p>}
    </Dialog>}
  </section>;
}
