import { ServerConfiguration } from "./ServerConfiguration";
import { ServerContent } from "./ServerContent";
import React, { useState } from 'react';
import { Btn, Dialog, Tabs, TextField } from '../../m3';
import { useApp } from '../context';
import { serverRequest, errorText, type Server } from './service';

export function ServerDetail({ server, refresh }: { server: Server; refresh: () => Promise<void> }) {
  const { t } = useApp();
  const [section, setSection] = useState('overview');
  const [javaPath, setJavaPath] = useState('');
  const [configurationRevision, setConfigurationRevision] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  const [backups, setBackups] = useState<any[]>([]);
  const [restoreId, setRestoreId] = useState('');
  const [pending, setPending] = useState('');
  const [contentBusy, setContentBusy] = useState(false);
  const busy = !!pending || contentBusy;
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const stopped = server.status === 'stopped';
  const running = server.status === 'running';
  const remote = server.target.startsWith('ssh-');
  const needsJava = server.target === 'local-process';
  const runtimeParams = needsJava ? { javaPath } : {};
  async function run(action: string, params: Record<string, unknown> = {}, after?: (result: any) => void) {
    if (busy) return;
    setPending(action); setError(''); setMessage('');
    try { const result = await serverRequest(action, { id: server.id, ...params }); after?.(result); if (action === 'restore') setConfigurationRevision(value => value + 1); await refresh(); setMessage('Operation completed'); }
    catch (e) { setError(errorText(e)); } finally { setPending(''); }
  }
  return <section className="pane low server-detail" aria-label={t('Server details')}>
    <div><h2 className="headline-s">{server.name}</h2><p>{server.edition} · {server.version} · {server.flavour} · {t(server.status)}</p></div>
    {needsJava && <TextField label={t('Java executable path')} value={javaPath} onChange={setJavaPath} mono supporting={t('Use the absolute path to the required Java executable. The service validates it before starting.')} />}
    <div className="server-actions"><Btn icon="play_arrow" disabled={busy || !stopped || (needsJava && !javaPath.trim())} onClick={() => void run('start', runtimeParams)}>{t('Start')}</Btn><Btn icon="stop" variant="tonal" disabled={busy || !['starting', 'running', 'stopping'].includes(server.status)} onClick={() => void run('stop')}>{t('Stop gracefully')}</Btn><Btn icon="restart_alt" variant="outlined" disabled={busy || !running || (needsJava && !javaPath.trim())} onClick={() => void run('restart', runtimeParams)}>{t('Restart server')}</Btn></div>
    <Tabs label={t('Server sections')} value={section} onChange={setSection} idPrefix="server-details" tabs={['overview', 'configuration', 'players', 'content'].map(id => [id, t({ overview: 'Overview', configuration: 'Configuration', players: 'Players', content: 'Plugins and worlds' }[id]!)])} />
    <div id={`server-details-panel-${section}`} role="tabpanel" aria-labelledby={`server-details-tab-${section}`} className="server-stack">
      {section === 'overview' && <><div className="server-stats">{['Players', 'Memory usage', 'Ticks per second'].map(label => <div className="card filled" key={label}><span>{t(label)}</span><strong>{t('Unavailable')}</strong></div>)}</div><dl className="server-facts"><dt>{t('Server file SHA-1')}</dt><dd className="mono">{server.integrity?.sha1 || t('Unavailable')}</dd><dt>{t('Required Java')}</dt><dd>{server.runtime?.javaMajor ?? t('Unknown')}</dd><dt>{t('Configured port')}</dt><dd>{server.port}</dd><dt>{t('Owned process')}</dt><dd>{server.pid ?? t('Unavailable')}</dd><dt>{t('Memory limit (MiB)')}</dt><dd>{server.memoryMb}</dd></dl><p>{t('Metrics and typed commands are not available for this server adapter.')}</p><Btn variant="outlined" disabled={busy} onClick={() => void run('logs', {}, result => setLogs(result.lines || []))}>{t('Read server log')}</Btn><pre className="server-log" aria-label={t('Server log')}>{logs.length ? logs.join('\n') : t('No log loaded')}</pre></>}
      <div hidden={section !== 'configuration'}><ServerConfiguration key={configurationRevision} id={server.id} stopped={stopped} disabled={busy} onBusy={setContentBusy} refresh={refresh} /></div>
      {section === 'players' && <><h3>{t('Players and permissions')}</h3><p>{t('Player identities, allowlist, operators, bans and game rules are not available for this adapter. No permissions have been changed.')}</p></>}
      {section === 'content' && <>{remote ? <p>{t('Remote content and backup storage operations are not available.')}</p> : <ServerContent id={server.id} stopped={stopped} disabled={busy} onBusy={setContentBusy} />}<h3>{t('Worlds and backups')}</h3><p>{t('Backups and restores require a stopped server. Restore preserves the current files as a rollback backup. Automatic scheduling is not available.')}</p><div className="server-actions"><Btn disabled={busy || !stopped || remote} onClick={() => void run('backup', {}, result => setBackups(all => [...all, result]))}>{t('Back up now')}</Btn><Btn variant="outlined" disabled={busy || remote} onClick={() => void run('listBackups', {}, setBackups)}>{t('Load restore points')}</Btn></div>{backups.map(backup => <div className="card outlined server-backup" key={backup.id}><span><strong>{backup.id}</strong><small>{backup.createdAt ? new Date(backup.createdAt).toLocaleString() : t('Unknown')} · {backup.total} {t('bytes')}</small></span><Btn variant="text" disabled={busy || !stopped} onClick={() => setRestoreId(backup.id)}>{t('Restore')}</Btn></div>)}</>}
    </div>
    {pending && <p role="status">{t('Working')} · {pending}</p>}{message && <p role="status">{t(message)}</p>}{error && <p role="alert" className="server-error">{t(error)}</p>}
    {restoreId && <Dialog title={t('Restore server backup?')} onClose={() => setRestoreId('')} actions={<><Btn variant="text" onClick={() => setRestoreId('')}>{t('Cancel')}</Btn><Btn disabled={!stopped || busy} onClick={() => { const backupId = restoreId; setRestoreId(''); void run('restore', { backupId }); }}>{t('Restore')}</Btn></>}><p>{t('The selected backup replaces this server’s files. The service verifies its hashes and preserves a rollback backup first.')}</p><p>{server.name} · {restoreId}</p></Dialog>}
  </section>;
}
