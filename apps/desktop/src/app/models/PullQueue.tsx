import React, { useState } from 'react';
import { Btn, IconBtn, Item, SegList, WavyProgress } from '../../m3';
import { useModelsText } from './locale';
import { batchEstimate } from './model-state.mjs';
import { modelsRequest, modelError, modelBytes, type Model, type ModelJob } from './service';

export function PullQueue({ names, models, jobs, healthy, allowed, setNames, refresh, onJob }: { names: string[]; models: Model[]; jobs: ModelJob[]; healthy: boolean; allowed: boolean; setNames: (names: string[] | ((previous: string[]) => string[])) => void; refresh: () => Promise<void>; onJob: (job: ModelJob) => void }) {
  const t = useModelsText();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const estimate = batchEstimate(names, models);
  const active = (name: string) => jobs.some(j => j.model === name && ['queued','running','pulling','cancelling'].includes(j.state));
  const unknown = names.some(name => !models.some(model => model.name === name && model.localAvailable !== false));
  async function pull(tags: string[]) {
    if (busy || !healthy || !allowed) return;
    setBusy(true); setError(''); setMessage('');
    const accepted: string[] = [];
    try {
      for (const model of tags) {
        if (!models.some(item => item.name === model && item.localAvailable !== false)) throw new Error('A queued tag is absent from the current verified inventory. Refresh the catalogue before pulling it.');
        if (active(model)) continue;
        const job = await modelsRequest('pull', { model, operationId: crypto.randomUUID() }); accepted.push(model); if (job?.id) onJob(job);
      }
      setMessage('Operation accepted; completion is reported by the service.');
    } catch (e) { setError(modelError(e)); }
    finally { if (accepted.length) setNames(previous => previous.filter(name => !accepted.includes(name))); await refresh(); setBusy(false); }
  }
  async function cancel(id: string) { setBusy(true); setError(''); try { await modelsRequest('cancel', { id }); await refresh(); } catch (e) { setError(modelError(e)); } finally { setBusy(false); } }
  return <aside className="pane low models-panel models-queue" aria-label={t('Pull queue')}>
    <h2 className="title-l">{t('Pull queue')} ({names.length})</h2><p>{t('Free model transfers only. This queue does not involve payment.')}</p>
    <SegList>{names.map(name => <Item key={name} title={name} support={`${t('Size')}: ${modelBytes(models.find(m => m.name === name)?.size,t('Unknown'))} · ${t('Hardware fit')}: ${t('Unknown')}`} trailing={<IconBtn icon="close" label={`${t('Remove from queue')} ${name}`} disabled={busy} onClick={() => setNames(previous => previous.filter(n => n !== name))} />} />)}</SegList>
    {!names.length && <p>{t('Queue is empty')}</p>}
    <p>{t('Known download total')}: {modelBytes(estimate.bytes,t('Unknown'))} · {t('Unknown sizes')}: {estimate.unknown}</p>
    <p>{t('Additional storage and free destination space are unverified. Download size is not a promise of total installed storage.')}</p><p>{t('Pulls contact the official model registry through the local runtime. Review each exact tag before starting.')}</p>
    {unknown && <p role="status">{t('A queued tag is absent from the current verified inventory. Refresh the catalogue before pulling it.')}</p>}
    {!healthy && <p>{t('The service is not healthy. Open Runtime and help, refresh status and complete the available recovery action.')}</p>}
    {!allowed && <p>{t('This action is not provided by the native service.')}</p>}
    <div className="models-actions"><Btn icon="download" disabled={busy || !healthy || !allowed || !names.length || unknown || names.every(active)} onClick={() => void pull(names)}>{t('Start selected pulls')}</Btn><Btn variant="text" disabled={busy} onClick={() => void refresh()}>{t('Refresh operations')}</Btn></div>
    {jobs.map(job => {
      const complete = job.progress?.completed;
      const total = job.progress?.total;
      const known = typeof complete === 'number' && typeof total === 'number' && total > 0;
      const working = ['queued','running','pulling','cancelling'].includes(job.state);
      return <section key={job.id} className="card outlined models-job"><strong>{job.model}</strong><span>{t(job.cancellationRequested && working ? 'cancelling' : job.state)}</span>{job.progress?.status && <small>{t(job.progress.status)}</small>}{working && <WavyProgress label={`${job.model} ${t('Pull queue')}`} value={known ? complete / total : 0} indeterminate={!known} />}{typeof complete === 'number' && <small>{t('Observed bytes')}: {complete} · {t('Total bytes')}: {total ?? t('Unknown')}</small>}{job.errorCode && <p className="models-error">{job.errorCode}</p>}<div className="models-actions">{working && <Btn variant="text" disabled={busy || job.state === 'cancelling' || job.cancellationRequested} onClick={() => void cancel(job.id)}>{t('Cancel pull')}</Btn>}{['failed','cancelled','interrupted'].includes(job.state) && <Btn variant="outlined" disabled={busy || !healthy || !allowed || !models.some(m => m.name === job.model)} onClick={() => void pull([job.model])}>{t('Retry pull')}</Btn>}</div></section>;
    })}
    {error && <p role="alert" className="models-error">{t(error)}</p>}{message && <p role="status">{t(message)}</p>}
  </aside>;
}
