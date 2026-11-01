import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Btn, Ms } from '../../m3';
import { SearchBar, useSearch } from '../../m3/search';
import { useApp } from '../context';
import { serverRequest, errorText, targetNames, type Server, type Capabilities } from './service';
import { CreateServer } from './CreateServer';
import { ServerDetail } from './ServerDetail';
import './servers.css';

export function ServersPage() {
  const { t } = useApp();
  const [servers, setServers] = useState<Server[]>([]);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const [selected, setSelected] = useState('');
  const [target, setTarget] = useState('all');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fresh, setFresh] = useState(false);
  const generation = useRef(0);
  const search = useSearch(servers.map(s => `${s.name} ${s.version} ${s.target} ${s.status}`));
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    setLoading(true);
    try {
      const [caps, rows] = await Promise.all([serverRequest('capabilities'), serverRequest('list')]);
      if (current !== generation.current) return;
      setCapabilities(caps); setServers(rows); setFresh(true); setError('');
      setSelected(value => rows.some((s: Server) => s.id === value) ? value : rows[0]?.id || '');
    } catch (e) { if (current === generation.current) { setError(errorText(e)); setFresh(false); } }
    finally { if (current === generation.current) setLoading(false); }
  }, []);
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 5000); return () => { generation.current++; clearInterval(timer); }; }, [refresh]);
  useEffect(() => { const create = () => setCreating(true); window.addEventListener('servers-create', create); return () => window.removeEventListener('servers-create', create); }, []);
  const server = servers.find(s => s.id === selected);
  return <div className="servers-workspace scroll">
    <section className="pane server-list" aria-label={t('Servers')}><div className="server-actions"><Ms name="dns" /><h1 className="headline-s">{t('Minecraft servers')}</h1></div><SearchBar {...search} t={t} label={t('Search servers')} /><div className="server-actions">{['all', ...Object.keys(targetNames)].map(id => <button type="button" className={`chip sl ${id === target ? 'on' : ''}`} key={id} aria-pressed={id === target} onClick={() => setTarget(id)}>{t(id === 'all' ? 'All targets' : targetNames[id])}</button>)}</div><div className="server-actions"><Btn icon="add" disabled={!capabilities || !fresh} onClick={() => setCreating(true)}>{t('New server')}</Btn><Btn variant="outlined" disabled={loading} onClick={() => void refresh()}>{t('Refresh')}</Btn></div>
    {error && <p role="alert" className="server-error">{t(error)} · {t('Status is stale; lifecycle actions are unavailable.')}</p>}
    <div className="seglist">{search.indices.map(i => servers[i]).filter(s => target === 'all' || s.target === target).map(s => <button type="button" key={s.id} className={`li tall sl ${selected === s.id ? 'sel' : ''}`} aria-pressed={selected === s.id} onClick={() => setSelected(s.id)}><Ms name="dns" /><span className="txt"><strong>{s.name}</strong><small>{t(targetNames[s.target] || s.target)} · {s.version}</small></span><span>{t(fresh ? s.status : 'Unknown')}</span></button>)}</div>{!servers.length && <p>{t(loading ? 'Loading servers' : 'No managed servers. Create one to get started.')}</p>}
    </section>
    {server && fresh ? <ServerDetail key={server.id} server={server} refresh={refresh} /> : <section className="pane low server-detail"><h2>{t('Server details')}</h2><p>{t('Select a server to manage its lifecycle and configuration.')}</p></section>}
    {creating && capabilities && <CreateServer capabilities={capabilities} onClose={() => setCreating(false)} onCreated={s => { setSelected(s.id); setCreating(false); void refresh(); }} />}
  </div>;
}
