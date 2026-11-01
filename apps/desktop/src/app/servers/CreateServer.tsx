import React, { useEffect, useRef, useState } from 'react';
import { Btn, Dialog, TextField } from '../../m3';
import { SearchBar, useSearch } from '../../m3/search';
import { useApp } from '../context';
import { serverRequest, errorText, targetNames, type Capabilities, type Version, type Server } from './service';

const draftKey = 'servers.create.draft.v1';
const initial = { name: '', target: 'local-process', edition: 'java', version: '', memoryMb: '2048', port: '25565', imageDigest: '' };
export function CreateServer({ capabilities, onClose, onCreated }: { capabilities: Capabilities; onClose: () => void; onCreated: (server: Server) => void }) {
  const { t } = useApp();
  const [draft, setDraft] = useState(() => { try { const saved = JSON.parse(localStorage.getItem(draftKey) || '{}'); return Object.fromEntries(Object.entries(initial).map(([key, value]) => [key, typeof saved[key] === 'string' ? saved[key] : value])) as typeof initial; } catch { return initial; } });
  const [step, setStep] = useState(0);
  const [versions, setVersions] = useState<Version[]>([]);
  const [retrieved, setRetrieved] = useState('');
  const [channel, setChannel] = useState('all');
  const [resolved, setResolved] = useState<any>(null);
  const [consent, setConsent] = useState(false);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const operation = useRef('');
  const sequence = useRef(0);
  const search = useSearch(versions.map(v => `${v.id} ${v.type}`));
  useEffect(() => { try { localStorage.setItem(draftKey, JSON.stringify(draft)); } catch { setError('Draft could not be saved'); } }, [draft]);
  const update = (key: keyof typeof initial, value: string) => { setDraft(d => ({ ...d, [key]: value, ...(key === 'edition' ? { version: '' } : {}) })); if (key === 'version' || key === 'edition') { sequence.current++; setResolved(null); } };
  async function discover() {
    const current = ++sequence.current;
    setPending('Loading versions'); setError(''); setResolved(null);
    try { const result = await serverRequest('discoverVersions', { edition: draft.edition }); if (current === sequence.current) { setVersions(result.versions); setRetrieved(result.retrievedAt); } }
    catch (e) { setError(errorText(e)); }
    finally { setPending(''); }
  }
  async function resolve() {
    const current = ++sequence.current;
    setPending('Checking server download'); setError('');
    try { const result = await serverRequest('resolveVersion', { version: draft.version, edition: draft.edition }); if (current === sequence.current) { setResolved(result); if (result.available) setStep(2); else setError(result.reason || 'Server download unavailable'); } }
    catch (e) { setError(errorText(e)); } finally { setPending(''); }
  }
  const validNumbers = Number.isInteger(Number(draft.memoryMb)) && Number(draft.memoryMb) >= 512 && Number(draft.memoryMb) <= 65536 && Number.isInteger(Number(draft.port)) && Number(draft.port) >= 1024 && Number(draft.port) <= 65535;
  async function create() {
    if (!consent || !resolved?.available || !validNumbers || !draft.name.trim()) return;
    operation.current = crypto.randomUUID(); setPending('Creating server'); setError(''); setStep(4);
    try {
      const server = await serverRequest('create', { ...draft, flavour: 'vanilla', memoryMb: Number(draft.memoryMb), port: Number(draft.port), eulaAccepted: true, operationId: operation.current });
      try { localStorage.removeItem(draftKey); } catch { /* Creation already succeeded; storage cleanup must not retry it. */ } onCreated(server);
    } catch (e) { setError(errorText(e)); } finally { setPending(''); operation.current = ''; }
  }
  return <Dialog title={t('New Minecraft server')} icon="dns" width={820} onClose={onClose} dismissible={!pending} actions={<>
    <Btn variant="text" disabled={!!pending} onClick={onClose}>{t('Close and keep draft')}</Btn>
    {step > 0 && <Btn variant="outlined" disabled={!!pending} onClick={() => setStep(step - 1)}>{t('Back')}</Btn>}
    {step === 0 && <Btn disabled={!!pending || !capabilities.targets.find(x => x.id === draft.target)?.available} onClick={() => { setStep(1); void discover(); }}>{t('Next')}</Btn>}
    {step === 1 && <Btn disabled={!!pending || !versions.some(v => v.id === draft.version)} onClick={() => void resolve()}>{t('Check download')}</Btn>}
    {step === 2 && <Btn disabled={!validNumbers || !draft.name.trim() || (draft.target === 'local-docker' && !/^eclipse-temurin@sha256:[a-f0-9]{64}$/.test(draft.imageDigest))} onClick={() => setStep(3)}>{t('Next')}</Btn>}
    {step === 3 && <Btn disabled={!consent || !!pending} onClick={() => void create()}>{t('Create server')}</Btn>}
    {step === 4 && pending && <Btn variant="outlined" onClick={() => void serverRequest('cancel', { operationId: operation.current }).catch(e => setError(errorText(e)))}>{t('Cancel operation')}</Btn>}
  </>}>
    <p className="label-l">{t(['Target', 'Version', 'Software and memory', 'Licence', 'Progress'][step])} · {step + 1}/5</p>
    {step === 0 && <div className="server-stack">{capabilities.targets.map(target => <button type="button" key={target.id} className="card outlined server-choice" aria-pressed={draft.target === target.id} disabled={!target.available} onClick={() => update('target', target.id)}><strong>{t(targetNames[target.id] || target.id)}</strong><span>{target.available ? t('Available') : t(target.reason || 'Not available in this build')}</span></button>)}</div>}
    {step === 1 && <div className="server-stack">
      <label>{t('Edition')}<select value={draft.edition} disabled={!!pending} onChange={e => { update('edition', e.target.value); setVersions([]); }}>{capabilities.editions.map(e => <option key={e.id} value={e.id} disabled={!e.available}>{e.id === 'java' ? 'Java' : 'Bedrock'}{!e.available ? ` · ${t('Unavailable')}` : ''}</option>)}</select></label>
      <div className="server-actions"><Btn variant="outlined" disabled={!!pending} onClick={() => void discover()}>{t('Refresh catalogue')}</Btn><label>{t('Release channel')}<select value={channel} onChange={e => setChannel(e.target.value)}>{['all', 'release', 'snapshot', 'old_beta', 'old_alpha'].map(c => <option key={c} value={c}>{t(c)}</option>)}</select></label></div>
      <SearchBar {...search} t={t} label={t('Search versions')} />
      <div className="server-versions" aria-label={t('Versions')}>{search.indices.map(i => versions[i]).filter(v => channel === 'all' || v.type === channel).map(v => <label key={v.id} className="server-choice"><input type="radio" name="server-version" checked={draft.version === v.id} disabled={!!pending} onChange={() => update('version', v.id)} /><span>{v.id} · {t(v.type)}<small>{t('Download checked when continuing')}</small></span></label>)}</div>
      <p className="body-s">{versions.length} {t('catalogue entries')} · {t('Retrieved')}: {retrieved ? new Date(retrieved).toLocaleString() : t('Unavailable')}</p>
    </div>}
    {step === 2 && <div className="server-stack">{draft.target === 'local-docker' && <TextField label={t('Container image digest')} value={draft.imageDigest} onChange={v => update('imageDigest', v)} supporting="eclipse-temurin@sha256:…" mono />}<TextField label={t('Server name')} value={draft.name} onChange={v => update('name', v)} maxLength={80} required /><p>Java · {draft.version} · Vanilla · {t('Required Java')}: {resolved?.javaMajor ?? t('Unknown')}</p><TextField label={t('Memory limit (MiB)')} type="number" value={draft.memoryMb} onChange={v => update('memoryMb', v)} supporting="512–65536 MiB" /><TextField label={t('Server port')} type="number" value={draft.port} onChange={v => update('port', v)} supporting="1024–65535" />{!validNumbers && <p role="alert">{t('Enter valid memory and port values')}</p>}<p>{t('Additional server software is not available in this build.')}</p></div>}
    {step === 3 && <div className="server-stack"><p>{t('Read the Minecraft EULA before creating this server. Consent is not saved in the draft.')}</p><a href="https://www.minecraft.net/eula" target="_blank" rel="noreferrer">{t('Read EULA')}</a><label className="server-choice"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />{t('I have read and accept the Minecraft EULA')}</label><p>{t('Creation downloads the verified server file. Starting the server is a separate action.')}</p></div>}
    {step === 4 && <p>{t('Wait for the service result. Cancellation may leave a draft or downloaded file; no server is reported ready until creation succeeds.')}</p>}
    {pending && <p role="status" aria-live="polite">{t(pending)}</p>}{error && <p role="alert" className="server-error">{t(error)}</p>}
  </Dialog>;
}
