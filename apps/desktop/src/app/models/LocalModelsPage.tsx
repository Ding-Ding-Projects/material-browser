import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Btn, Ms, Tabs } from '../../m3';
import { useModelsText } from './locale';
import { modelsRequest, modelError, type Model, type ModelJob, type ModelStatus, type ModelCatalogue, type ModelCapabilities } from './service';
import { reconcileModels, readQueue, catalogueVariants } from './model-state.mjs';
import { ModelInventory } from './ModelInventory';
import { PullQueue } from './PullQueue';
import { RuntimePanel } from './RuntimePanel';
import './models.css';

const queueKey = 'local-models.pull-selection.v1';
export function LocalModelsPage() {
  const t = useModelsText();
  const [section, setSection] = useState('store');
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [capabilities, setCapabilities] = useState<ModelCapabilities | null>(null);
  const [catalogue, setCatalogue] = useState<ModelCatalogue | null>(null);
  const [installed, setInstalled] = useState<Model[]>([]);
  const [running, setRunning] = useState<Model[]>([]);
  const [inventoryAt, setInventoryAt] = useState('');
  const [jobs, setJobs] = useState<ModelJob[]>([]);
  const [queue, setQueueState] = useState<string[]>(() => { try { return readQueue(JSON.parse(localStorage.getItem(queueKey) || '[]')); } catch { return []; } });
  const queueRef = useRef(queue);
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [loading, setLoading] = useState(false);
  const [refreshingCatalogue, setRefreshingCatalogue] = useState(false);
  const epoch = useRef(0);
  const refreshing = useRef(false);
  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    const current = ++epoch.current;
    setLoading(true);
    const actions = ['capabilities','status','list','running','jobs','catalogue'];
    const results = await Promise.allSettled(actions.map(action => modelsRequest(action)));
    refreshing.current = false;
    if (current !== epoch.current) return;
    const failures: Record<string,string> = {};
    results.forEach((result,index) => {
      const action = actions[index];
      if (result.status === 'rejected') { failures[action] = modelError(result.reason); if (action === 'status') setStatus(null); if (action === 'capabilities') setCapabilities(null); return; }
      const value = result.value;
      if (action === 'capabilities') setCapabilities(value);
      if (action === 'status') setStatus(value);
      if (action === 'list') { setInstalled(value.models || []); setInventoryAt(value.checkedAt || ''); }
      if (action === 'running') setRunning(value.models || []);
      if (action === 'jobs') setJobs(Array.isArray(value) ? value : value.jobs || []);
      if (action === 'catalogue') setCatalogue(value);
    });
    setErrors(previous => ({ ...(previous.storage ? { storage: previous.storage } : {}), ...failures })); setLoading(false);
  }, []);
  useEffect(() => {
    void refresh(); const timer = setInterval(() => void refresh(), 10000);
    const off = window.materialBrowser?.onEvent((event: any) => {
      if (event?.type === 'local-models.job' && event.job?.id) setJobs(all => [...all.filter(job => job.id !== event.job.id),event.job]);
    });
    return () => { epoch.current++; clearInterval(timer); off?.(); };
  }, [refresh]);
  const setQueue = (names: string[] | ((previous: string[]) => string[])) => {
    const value = readQueue(typeof names === 'function' ? names(queueRef.current) : names); queueRef.current = value; setQueueState(value);
    try { localStorage.setItem(queueKey, JSON.stringify(value)); setErrors(old => { const next = {...old}; delete next.storage; return next; }); }
    catch { setErrors(old => ({ ...old, storage: 'The queue could not be saved locally.' })); }
  };
  async function refreshCatalogue() {
    if (refreshingCatalogue) return;
    setRefreshingCatalogue(true);
    try { setCatalogue(await modelsRequest('refreshCatalogue')); setErrors(old => { const next = {...old}; delete next.catalogue; return next; }); }
    catch (e) { setErrors(old => ({ ...old, catalogue: modelError(e) })); }
    finally { setRefreshingCatalogue(false); }
  }
  const healthy = status?.state === 'healthy' && !errors.status;
  const models: Model[] = reconcileModels(catalogueVariants(catalogue?.models || []), installed, errors.running ? [] : running);
  const actions = capabilities?.actions || [];
  return <div className="models-workspace scroll">
    <header className="models-actions"><Ms name="neurology" size={32} /><h1 className="headline-s">{t('Local models')}</h1><span className="chip">{t(status?.state || 'Unknown')}{status?.version ? ` · ${status.version}` : ''}</span><Btn variant="outlined" disabled={loading} onClick={() => void refresh()}>{t('Refresh status')}</Btn><Btn variant="text" onClick={() => setSection('runtime')}>{t('Open runtime help')}</Btn></header>
    <div className="models-layout"><section className="pane models-panel models-main">
      <Tabs label={t('Local models')} value={section} onChange={setSection} idPrefix="local-models" tabs={[[ 'store',t('Model store')],['installed',t('Installed')],['chat',t('Chat')],['runtime',t('Runtime and help')]]} />
      <div id="local-models-panel-store" role="tabpanel" aria-labelledby="local-models-tab-store" hidden={section !== 'store'}>
        <div className="models-stack"><div className="models-actions"><Btn variant="tonal" disabled={refreshingCatalogue || !actions.includes('refreshCatalogue')} onClick={() => void refreshCatalogue()}>{t('Refresh catalogue')}</Btn>{refreshingCatalogue && <Btn variant="outlined" onClick={() => void modelsRequest('cancel', { id: 'catalogue' }).catch(e => setErrors(old => ({ ...old, catalogue: modelError(e) })))}>{t('Cancel catalogue refresh')}</Btn>}<span>{t('Catalogue completeness')}: {t(catalogue?.complete ? 'Complete' : 'Incomplete')}</span></div>
        {catalogue ? <p className="models-provenance">{t('Source')}: {catalogue.source || t('Unknown')} · {t('Retrieved')}: {catalogue.retrievedAt ? new Date(catalogue.retrievedAt).toLocaleString() : t('Unknown')} · {t('Pages')}: {catalogue.pageCount ?? t('Unknown')}{catalogue.stale ? ` · ${t('Stale snapshot')}` : ''}{catalogue.reason ? ` · ${t(catalogue.reason)}` : ''}</p> : <p>{t('No catalogue snapshot is available. Installed models remain accessible when the local service responds.')}</p>}
        <ModelInventory models={models} installedOnly={false} healthy={!!healthy} runningKnown={!!status && !errors.running} inventoryKnown={!!inventoryAt && !errors.list} actions={actions} queue={queue} onQueue={name => setQueue(previous => [...previous,name])} refresh={refresh} /></div>
      </div>
      <div id="local-models-panel-installed" role="tabpanel" aria-labelledby="local-models-tab-installed" hidden={section !== 'installed'}><p>{inventoryAt ? `${t('Last successful installed inventory')}: ${new Date(inventoryAt).toLocaleString()}` : t('No installed inventory has been verified yet.')}</p><ModelInventory models={models} installedOnly healthy={!!healthy} runningKnown={!!status && !errors.running} inventoryKnown={!!inventoryAt && !errors.list} actions={actions} queue={queue} onQueue={name => setQueue(previous => [...previous,name])} refresh={refresh} /></div>
      <div id="local-models-panel-chat" role="tabpanel" aria-labelledby="local-models-tab-chat" hidden={section !== 'chat'}><p>{t('Local chat is not available from this service yet. No prompt or attachment is sent.')}</p><Btn variant="tonal" onClick={() => setSection('installed')}>{t('Installed')}</Btn></div>
      <div id="local-models-panel-runtime" role="tabpanel" aria-labelledby="local-models-tab-runtime" hidden={section !== 'runtime'}><RuntimePanel status={status} capabilities={capabilities} refresh={refresh} /></div>
      {Object.entries(errors).map(([action,error]) => <p key={action} role={action === 'storage' ? 'alert' : 'status'} className="models-error"><code>{action}</code>: {t(error)}</p>)}
    </section><PullQueue names={queue} models={models} jobs={jobs} healthy={!!healthy} allowed={actions.includes('pull')} setNames={setQueue} refresh={refresh} onJob={job => setJobs(all => [...all.filter(item => item.id !== job.id),job])} /></div>
  </div>;
}
