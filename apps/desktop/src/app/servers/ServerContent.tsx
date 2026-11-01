import React, { useState } from 'react';
import { Btn, Dialog } from '../../m3';
import { useApp } from '../context';
import { serverRequest, errorText } from './service';

export function ServerContent({ id, stopped, disabled, onBusy }: { id: string; stopped: boolean; disabled: boolean; onBusy: (busy: boolean) => void }) {
  const { t } = useApp();
  const [rows, setRows] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<any>(null);
  async function run(task: () => Promise<void>) { if (disabled || pending) return; setPending(true); onBusy(true); setError(''); try { await task(); } catch (e) { setError(errorText(e)); } finally { setPending(false); onBusy(false); } }
  const refresh = async () => setRows(await serverRequest('listContent', { id }));
  async function install() {
    if (!file || !acknowledged || !stopped) return;
    if (!file.name.toLowerCase().endsWith('.zip') || file.size > 32 * 1024 * 1024 || !file.size) throw new Error('Choose a ZIP file up to 32 MiB');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const sha256 = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    await serverRequest('installContent', { id, kind: 'datapack', bytesBase64: btoa(binary), sha256, compatibilityAcknowledged: true });
    setFile(null); setAcknowledged(false); await refresh();
  }
  return <div className="server-stack"><h3>{t('Data packs')}</h3><p>{t('File-added data packs have unknown compatibility. Only install files you trust. Plugins and mods are not supported by this adapter.')}</p><label>{t('Choose data pack ZIP')}<input type="file" accept=".zip" disabled={disabled || pending || disabled || !stopped} onChange={e => { setFile(e.target.files?.[0] || null); setAcknowledged(false); }} /></label><label><input type="checkbox" checked={acknowledged} disabled={!file || pending || disabled} onChange={e => setAcknowledged(e.target.checked)} />{t('I understand compatibility is unknown')}</label><div className="server-actions"><Btn disabled={!file || !acknowledged || pending || disabled || !stopped} onClick={() => void run(install)}>{t('Install data pack')}</Btn><Btn variant="outlined" disabled={disabled || pending || disabled} onClick={() => void run(refresh)}>{t('Refresh content')}</Btn></div>{file && <p>{file.name} · {file.size} {t('bytes')}</p>}{rows.map(row => <div className="card outlined server-backup" key={row.id}><span><strong>{row.name}</strong><small>{row.size} {t('bytes')} · {t('Compatibility unknown')} · {t(row.managed ? 'Managed' : 'Unmanaged')}</small><small className="mono">{row.sha256 || t('Hash unavailable')}</small></span><Btn variant="outlined" disabled={disabled || pending || !stopped || !row.managed} onClick={() => setRemoving(row)}>{t('Remove')}</Btn></div>)}<p>{t('World import/export and plugin catalogues are not available.')}</p>{error && <p role="alert" className="server-error">{t(error)}</p>}{pending && <p role="status">{t('Working')}</p>}{removing && <Dialog title={t('Remove data pack?')} onClose={() => setRemoving(null)} actions={<><Btn variant="text" onClick={() => setRemoving(null)}>{t('Cancel')}</Btn><Btn disabled={disabled || pending || disabled || !stopped} onClick={() => { const contentId = removing.id; setRemoving(null); void run(async () => { await serverRequest('removeContent', { id, contentId }); await refresh(); }); }}>{t('Remove')}</Btn></>}><p>{removing.name}</p><p>{t('The service backs up the stopped server before removing an unchanged managed file.')}</p></Dialog>}</div>;
}
