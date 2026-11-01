import React, { useEffect, useState } from 'react';
import { Btn, Dialog, IconBtn, Switch, TextField } from '../../m3';
import { SearchBar, useSearch } from '../../m3/search';
import { useApp } from '../context';
import { serverRequest, errorText } from './service';
import { propertyChange } from './config-model.mjs';

export type PropertyDescriptor = {
  key: string; label: string; control: string; value: unknown; present: boolean; valid: boolean;
  available: boolean; unavailableReason?: string; validationMessage?: string; versionApplicability?: string;
  choices?: string[]; min?: number; max?: number; step?: number; unit?: string; maxLength?: number; pattern?: string;
  help?: string; default?: unknown; defaultKnown?: boolean; apply?: string; liveAvailable?: boolean;
};
type View = { descriptors: PropertyDescriptor[]; unknown?: { key: string; reason: string }[] };

function PropertyControl({ descriptor: d, value, disabled, onChange }: { descriptor: PropertyDescriptor; value: unknown; disabled: boolean; onChange: (value: unknown) => void }) {
  const { t } = useApp();
  if (!d.available) return <p>{t(d.unavailableReason || 'This property is unavailable for the selected version.')}</p>;
  if (d.control === 'switch') return typeof value === 'boolean' ? <Switch checked={value} onChange={onChange} disabled={disabled} label={t(d.label)} /> : <label>{t(d.label)}<select disabled={disabled} value="" onChange={e => onChange(e.target.value === 'true')}><option value="" disabled>{t('Choose a value')}</option><option value="true">{t('Enabled')}</option><option value="false">{t('Disabled')}</option></select></label>;
  if (d.control === 'choice') return <label>{t(d.label)}<select disabled={disabled} value={typeof value === 'string' ? value : ''} onChange={e => onChange(e.target.value)}><option value="" disabled>{t('Choose a value')}</option>{d.choices?.map(choice => <option key={choice} value={choice}>{t(choice)}</option>)}</select></label>;
  if (d.control === 'number') {
    const min = d.key === 'server-port' ? Math.max(1024, d.min ?? 1024) : d.min;
    const current = typeof value === 'number' ? value : Number(value);
    const usable = value !== null && value !== '' && Number.isFinite(current);
    const step = d.step ?? 1;
    return <div className="server-actions"><IconBtn icon="remove" label={`${t('Decrease')} ${t(d.label)}`} disabled={disabled || !usable || (min !== undefined && current - step < min)} onClick={() => onChange(current - step)} /><TextField label={t(d.label)} value={value === null || value === undefined ? '' : String(value)} onChange={onChange} type="number" disabled={disabled} supporting={`${min ?? '…'}–${d.max ?? '…'}${d.unit ? ` ${t(d.unit)}` : ''} · ${t('Step')} ${step}`} /><IconBtn icon="add" label={`${t('Increase')} ${t(d.label)}`} disabled={disabled || !usable || (d.max !== undefined && current + step > d.max)} onClick={() => onChange(current + step)} />{min !== undefined && d.max !== undefined && d.max - min <= 64 && usable && <input type="range" aria-label={`${t(d.label)} ${t('slider')}`} min={min} max={d.max} step={step} value={current} disabled={disabled} onChange={e => onChange(Number(e.target.value))} />}</div>;
  }
  if (d.control === 'text') return <TextField label={t(d.label)} value={typeof value === 'string' ? value : ''} onChange={onChange} disabled={disabled} maxLength={d.maxLength} supporting={d.pattern ? `${t('Required format')}: ${d.pattern}` : undefined} />;
  return <p>{t('No control for this setting')}</p>;
}

export function ServerConfiguration({ id, stopped, disabled, onBusy, refresh }: { id: string; stopped: boolean; disabled: boolean; onBusy: (busy: boolean) => void; refresh: () => Promise<void> }) {
  const { t } = useApp();
  const [view, setView] = useState<View | null>(null);
  const [changes, setChanges] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [help, setHelp] = useState<PropertyDescriptor | null>(null);
  const search = useSearch((view?.descriptors || []).map(d => `${d.key} ${t(d.label)}`));
  useEffect(() => { let active = true; serverRequest('readConfiguration', { id }).then(result => { if (active) setView(result); }).catch(e => { if (active) setError(errorText(e)); }); return () => { active = false; }; }, [id]);
  const validation = Object.entries(changes).map(([key, value]) => ({ key, result: propertyChange(view?.descriptors.find(d => d.key === key) || {}, value) }));
  const invalid = validation.some(v => v.result.error);
  async function save() {
    if (busy || disabled || !stopped || invalid || !validation.length) return;
    setBusy(true); onBusy(true); setError(''); setMessage('');
    try {
      await serverRequest('configure', { id, properties: Object.fromEntries(validation.map(v => [v.key, v.result.value])) });
      setChanges({}); setView(null);
      setView(await serverRequest('readConfiguration', { id })); await refresh();
      setMessage('Configuration saved. Changes apply at the next start.');
    } catch (e) { setError(errorText(e)); } finally { setBusy(false); onBusy(false); }
  }
  return <div className="server-stack"><p>{t('Configuration controls describe declared version support. Runtime behavior remains unverified. All changes are saved while stopped and apply at the next start.')}</p><SearchBar {...search} label={t('Search server properties')} t={t} />{!view && !error && <p role="status">{t('Reading server properties')}</p>}{view && <><div className="server-stack">{search.indices.map(i => view.descriptors[i]).filter(Boolean).map(d => {
    const changed = Object.hasOwn(changes, d.key);
    const value = changed ? changes[d.key] : d.value;
    const problem = changed ? propertyChange(d, value).error : !d.valid ? d.validationMessage || 'Existing value is invalid or unresolved.' : '';
    return <div className="card outlined server-property" key={d.key}><div className="server-actions"><strong>{t(d.label)}</strong><code>{d.key}</code><IconBtn icon="info" label={`${t('About')} ${t(d.label)}`} onClick={() => setHelp(d)} /></div><p className="body-s">{t(d.present ? 'Present in server.properties' : 'Not present; no value is written until you edit it')} · {t('Needs restart')}</p><PropertyControl descriptor={d} value={value} disabled={disabled || busy || !stopped} onChange={value => setChanges(all => ({ ...all, [d.key]: value }))} />{problem && <p role="status" className="server-error">{t(problem)}</p>}</div>;
  })}</div>{view.unknown?.length ? <details><summary>{t('Unknown properties are preserved')} ({view.unknown.length})</summary><p>{t('Values are hidden because unknown properties may contain sensitive data.')}</p><ul>{view.unknown.map((item, i) => <li key={i}><code>{item.key}</code> · {t(item.reason)}</li>)}</ul></details> : null}<div className="server-actions"><Btn disabled={busy || disabled || !stopped || invalid || !validation.length} onClick={() => void save()}>{t('Save configuration')} ({validation.length})</Btn><Btn variant="text" disabled={busy || disabled || !validation.length} onClick={() => setChanges({})}>{t('Undo edits')}</Btn></div></>}{!stopped && <p>{t('Stop the server before changing configuration.')}</p>}{error && <p role="alert" className="server-error">{t(error)}</p>}{message && <p role="status">{t(message)}</p>}{help && <Dialog title={t(help.label)} onClose={() => setHelp(null)} actions={<Btn onClick={() => setHelp(null)}>{t('Done')}</Btn>}><p>{t(help.help || 'No additional description is available.')}</p><p><code>{help.key}</code> · {t('Default')}: {help.defaultKnown ? String(help.default) : t('Unknown')}</p><p>{t('Version applicability')}: {t(help.versionApplicability || 'unresolved')}</p></Dialog>}</div>;
}
