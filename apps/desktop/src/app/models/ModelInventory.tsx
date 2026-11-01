import React, { useEffect, useState } from 'react';
import { Btn, Dialog, Dropdown, Item, SegList, TextField } from '../../m3';
import { SearchBar, useSearch } from '../../m3/search';
import { useModelsText } from './locale';
import { modelsRequest, modelError, modelBytes, type Model } from './service';

export function ModelInventory({ models, installedOnly, healthy, runningKnown, inventoryKnown, actions, queue, onQueue, refresh }: { models: Model[]; installedOnly: boolean; healthy: boolean; runningKnown: boolean; inventoryKnown: boolean; actions: string[]; queue: string[]; onQueue: (name: string) => void; refresh: () => Promise<void> }) {
  const t = useModelsText();
  const [family, setFamily] = useState('all');
  const [quant, setQuant] = useState('all');
  const [capability, setCapability] = useState('all');
  const [state, setState] = useState('all');
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Model | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [action, setAction] = useState<'remove'|'copy'|null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const search = useSearch(models.map(m => `${m.name} ${m.details?.family || ''} ${m.details?.quantization_level || ''} ${(m.capabilities || []).join(' ')}`));
  const families = [...new Set(models.flatMap(m => typeof m.details?.family === 'string' ? [m.details.family] : []))];
  const quants = [...new Set(models.flatMap(m => typeof m.details?.quantization_level === 'string' ? [m.details.quantization_level] : []))];
  const capabilities = [...new Set(models.flatMap(m => m.capabilities || []))];
  const shown = search.indices.map(i => models[i]).filter(m => (!installedOnly || m.installed) && (state === 'all' || state === 'installed' && m.installed || state === 'running' && m.running) && (family === 'all' || m.details?.family === family) && (quant === 'all' || m.details?.quantization_level === quant) && (capability === 'all' || m.capabilities?.includes(capability))).sort((a,b) => sort === 'name' ? a.name.localeCompare(b.name) : a.size === undefined ? 1 : b.size === undefined ? -1 : sort === 'size-up' ? a.size-b.size : b.size-a.size);
  useEffect(() => setPage(0), [family, quant, capability, state, sort, search.query]);
  const pageCount = Math.max(1, Math.ceil(shown.length / 100));
  const currentPage = Math.min(page, pageCount - 1);
  async function inspect(model: Model) { setSelected(model); setMetadata(null); setError(''); setBusy(true); try { setMetadata(await modelsRequest('show', { model: model.name })); } catch (e) { setError(modelError(e)); } finally { setBusy(false); } }
  async function mutate() {
    if (!selected || !action || busy) return;
    setBusy(true); setError('');
    try { await modelsRequest(action, action === 'remove' ? { model: selected.name, confirmed: true } : { source: selected.name, destination, confirmed: true }); setAction(null); setSelected(null); await refresh(); }
    catch (e) { setError(modelError(e)); } finally { setBusy(false); }
  }
  return <div className="models-stack"><SearchBar {...search} label={t(installedOnly ? 'Search installed models' : 'Search models and tags')} t={t} />
    <div className="models-actions"><Dropdown label={t('Model family')} value={family} options={[[ 'all',t('All families')],...families.map(f => [f,f] as [string,string])]} onChange={setFamily} /><Dropdown label={t('Quantization')} value={quant} options={[[ 'all',t('All quantizations')],...quants.map(q => [q,q] as [string,string])]} onChange={setQuant} /><Dropdown label={t('Capability')} value={capability} options={[[ 'all',t('All capabilities')],...capabilities.map(c => [c,c] as [string,string])]} onChange={setCapability} /><Dropdown label={t('All models')} value={state} options={[[ 'all',t('All models')],['installed',t('Installed only')],['running',t('Running only')]]} onChange={setState} /><Dropdown label={t('Sort models')} value={sort} options={[[ 'name',t('Name')],['size-up',t('Size ascending')],['size-down',t('Size descending')]]} onChange={setSort} /></div>
    <p>{t('Fit is unknown because verified hardware and model requirements are unavailable.')}</p>
    <SegList>{shown.slice(currentPage * 100, (currentPage + 1) * 100).map(model => <Item key={model.name} icon="neurology" title={model.name} support={`${modelBytes(model.size,t('Unknown'))} · ${model.details?.quantization_level || t('Unknown')} · ${!inventoryKnown ? t('Unknown') : model.installed ? t('Installed') : t('Not installed')} · ${!runningKnown ? t('Unknown') : model.running ? t('Running') : t('Not running')}`} trailing={<div className="models-actions"><Btn size="xs" variant="tonal" disabled={queue.includes(model.name) || queue.length >= 50 || model.localAvailable === false} onClick={() => onQueue(model.name)}>{t('Queue pull')}</Btn><Btn size="xs" variant="outlined" disabled={busy || !healthy || !model.installed || !actions.includes('show')} onClick={() => void inspect(model)}>{t('Inspect model')}</Btn></div>} />)}</SegList>
    <div className="models-actions"><Btn variant="text" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{t('Previous page')}</Btn><span>{currentPage + 1}/{pageCount} · {shown.length} {t('matching tags')}</span><Btn variant="text" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}>{t('Next page')}</Btn></div><p>{t('Cloud-only variants cannot be queued for local use. Choose a local variant.')}</p>{!shown.length && <p>{t('No matching models')}</p>}{!healthy && <p>{t('The service is not healthy. Open Runtime and help, refresh status and complete the available recovery action.')}</p>}
    {selected && <Dialog title={t('Model details')} width={640} onClose={() => { if (!busy) setSelected(null); }} dismissible={!busy} actions={<><Btn variant="text" disabled={busy} onClick={() => setSelected(null)}>{t('Close')}</Btn><Btn variant="outlined" disabled={busy || !healthy || !actions.includes('copy')} onClick={() => { setDestination(''); setAction('copy'); }}>{t('Copy model')}</Btn><Btn variant="error" disabled={busy || !healthy || !actions.includes('remove')} onClick={() => { setConfirmation(''); setAction('remove'); }}>{t('Remove model')}</Btn></>}>
      <SegList>{[['Exact tag',selected.name],['Size',modelBytes(selected.size,t('Unknown'))],['Model family',metadata?.details?.family || selected.details?.family],['Parameters',metadata?.details?.parameter_size || selected.details?.parameter_size],['Quantization',metadata?.details?.quantization_level || selected.details?.quantization_level],['Capabilities',Array.isArray(metadata?.capabilities) ? metadata.capabilities.join(', ') : undefined],['Digest',selected.digest]].map(([label,value]) => <Item key={String(label)} title={t(String(label))} support={value || t('Unknown')} />)}</SegList>
      {!metadata && !busy && <p>{t('Model metadata has not been loaded. Select Inspect model for an installed model.')}</p>}{busy && <p role="status">{t('Working')}</p>}{error && <p role="alert" className="models-error">{t(error)}</p>}
    </Dialog>}
    {action && selected && <Dialog title={t(action === 'remove' ? 'Confirm removal' : 'Copy model')} onClose={() => { if (!busy) setAction(null); }} dismissible={!busy} actions={<><Btn variant="text" disabled={busy} onClick={() => setAction(null)}>{t('Cancel')}</Btn><Btn variant={action === 'remove' ? 'error' : 'filled'} disabled={busy || !healthy || (action === 'remove' ? confirmation !== selected.name : !destination.trim() || destination === selected.name || models.some(model => model.installed && model.name === destination))} onClick={() => void mutate()}>{t(action === 'remove' ? 'Remove model' : 'Copy model')}</Btn></>}>
      <p>{selected.name}</p>{action === 'copy' && models.some(model => model.installed && model.name === destination) && <p role="status">{t('Destination already exists. Choose a new tag.')}</p>}<p>{t(action === 'remove' ? 'Type the exact model tag to confirm removal from the local model store. Other models are not removed.' : 'Copy preserves the source model. Choose a distinct valid destination tag.')}</p><TextField label={t(action === 'remove' ? 'Exact tag' : 'Destination tag')} value={action === 'remove' ? confirmation : destination} onChange={action === 'remove' ? setConfirmation : setDestination} maxLength={256} disabled={busy} />{error && <p role="alert" className="models-error">{t(error)}</p>}
    </Dialog>}
  </div>;
}
