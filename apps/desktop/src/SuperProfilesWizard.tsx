import { LinearProgress } from "./MaterialPrimitives";
import { MaterialInput } from "./MaterialPrimitives";
import React, { useState } from 'react';
import { Button, Field, Select } from './components';
import { requestSuperProfile as request, PasswordManager, SuperProfile, SuperProfileSettings } from './api';
import { readSuperProfileDraft, superProfileResumeMetadata, switchSuperProfileBackend, persistSuperProfileConfiguration } from './SuperProfiles.model.mjs';
import { buildGuestPasswordManager as buildGuest } from './password-manager-model.mjs';
const buildGuestPasswordManager=(form:Parameters<typeof buildGuest>[0])=>buildGuest(form) as PasswordManager|null;
const key = 'super-profile-draft-v1';
type Draft = { name: string; engine: string; settings: SuperProfileSettings; step: number };
const initial = (): Draft => ({name:'',engine:'chromium',settings:{backend:'wsl2',launchMode:'terminal',},step:0});
export function SuperProfilesWizard({profile,t,busy,onSave,onCancel}: {profile?:SuperProfile;t:(s:string)=>string;busy:boolean;onSave:(draft:Omit<Draft,'step'>)=>Promise<void>;onCancel:()=>void}) {
  const [draft,setDraft] = useState<Draft>(() => profile ? {...profile,step:0} : initial());
  const [message,setMessage] = useState('');
  const [checking,setChecking]=useState(false),[check,setCheck]=useState<{backend:string;available:boolean;modes:string[]}|null>(null);
  const update=(value:Partial<Draft>)=>setDraft(d=>({...d,...value}));
  const setting=(value:Partial<SuperProfileSettings>)=>setDraft(d=>({...d,settings:{...d.settings,...value}}));
  const lines=(label:string,field:'setupCommands'|'startupCommands'|'installers')=><label>{t(label)}<textarea value={(draft.settings[field] || []).join('\n')} onChange={e=>setting({[field]:e.target.value.split('\n').filter(line=>line.trim())})}/></label>;
  const titles=['Template','Environment','Startup and files','Review'];
  return <section className="surface super-wizard" aria-label={t('Super Profile wizard')}>
    <h2>{t(profile ? 'Edit template' : 'Create Super Profile')}</h2>
    <p className="eyebrow">{t('Step')} {draft.step+1} / 4: {t(titles[draft.step])}</p>
    <LinearProgress max={4} value={draft.step+1} label={t('Setup progress')}/>
    <div className="super-actions">
      {!profile && <Button secondary disabled={busy} onClick={()=>{try {const saved=readSuperProfileDraft(localStorage.getItem(key));setDraft(saved);setMessage('Draft restored');}catch {setMessage('No valid saved draft');}}}>{t('Resume draft')}</Button>}
      <Button secondary disabled={busy} onClick={()=>{try{localStorage.setItem(key,JSON.stringify(superProfileResumeMetadata(draft)));setMessage('Resume metadata saved');}catch{setMessage('Draft could not be saved');}}}>{t('Save progress')}</Button>
    </div>
    <p>{t('Resume metadata survives restart on this computer. Paths and commands are excluded; enter them again after resuming. Do not use confidential template names.')}</p>
    {message && <p role="status">{t(message)}</p>}
    <fieldset disabled={busy} className="super-fields">
      <legend>{t(titles[draft.step])}</legend>
      {draft.step===0 && <>
        <Field label={t('Name')} value={draft.name} onChange={name=>update({name})} required/>
        <Select label={t('Environment')} value={draft.settings.backend} onChange={backend=>{const settings=switchSuperProfileBackend({...draft.settings,engine:draft.engine},backend);update({settings,engine:settings.engine==='firefox'&&backend==='wsl2'?'firefox':'chromium'});setCheck(null);}} options={[["wsl2","WSL 2"],["windows-sandbox","Windows Sandbox"]]}/>
        <Select label={t('Engine')} value={draft.engine} onChange={engine=>{update({engine});setting({engine});}} options={draft.settings.backend==='wsl2'?[["chromium","Chromium"],["firefox","Firefox"]]:[["chromium","Chromium"]]}/>
      </>}
      {draft.step===1 && <>
        <Select label={t('Launch mode')} value={draft.settings.launchMode} onChange={launchMode=>setting({launchMode:launchMode as SuperProfileSettings['launchMode']})} options={(draft.settings.backend==='windows-sandbox'?['browser']:['terminal','browser','desktop']).map(s=>[s,t(s)] as [string,string])}/>
        {draft.settings.backend==='wsl2'&&<p>{t('Leave both root filesystem fields empty to use the verified managed base. A custom archive requires its SHA-256.')}</p>}
        {draft.settings.backend==='wsl2' && <Field label={t('Root filesystem archive path')} value={draft.settings.rootfsPath||''} onChange={rootfsPath=>setting({rootfsPath})}/>}
        {draft.settings.backend==='wsl2'&&<Field label={t('Root filesystem SHA-256')} value={draft.settings.rootfsSha256||''} onChange={rootfsSha256=>setting({rootfsSha256})}/>}
        <Button secondary disabled={busy||checking} onClick={()=>{setChecking(true);setCheck(null);const backend=draft.settings.backend;void request('superProfiles.capabilities').then(c=>{const result=backend==='wsl2'?c.wsl2:c.windowsSandbox;setCheck({backend,available:result?.available===true,modes:Array.isArray(result?.modes)?result.modes:[]});}).catch(()=>setMessage('Environment check unavailable')).finally(()=>setChecking(false));}}>{t(checking?'Checking environment':'Check environment')}</Button>
        {check&&<p role="status">{check.backend}: {t(check.available?'Available':'Unavailable')} · {t('Supported modes')}: {check.modes.map(t).join(', ')}. {t('Capability availability is not proof that a session launched successfully.')}</p>}
        <p>{t('Each backend keeps its own configuration. Saving selects the backend shown here for the next launch.')}</p>
        <Field label={t('Workspace folder path')} value={draft.settings.workspacePath||''} onChange={workspacePath=>setting({workspacePath})}/>
        <label className="super-check"><MaterialInput type="checkbox" disabled={draft.settings.backend!=='windows-sandbox'} checked={draft.settings.networking!==false} onChange={e=>setting({networking:e.target.checked})}/>{t('Allow network access')}</label>
        <label className="super-check"><MaterialInput type="checkbox" disabled checked={draft.settings.clipboard===true} onChange={e=>setting({clipboard:e.target.checked})}/>{t('Allow clipboard sharing')}</label>
        <p>{t('Clipboard sharing and per-session memory limits are not configurable. WSL networking follows the existing host configuration.')}</p><Field disabled label={t('Memory limit (MB)')} type="number" value={String(draft.settings.memoryMb||4096)} onChange={s=>setting({memoryMb:Number(s)})}/>
      </>}
      {draft.step===2 && <>
        {lines('Installer paths, one per line','installers')}
        <label className="super-check"><MaterialInput type="checkbox" disabled={draft.settings.backend!=='wsl2'} checked={!!draft.settings.passwordManager} onChange={e=>setting({passwordManager:e.target.checked?buildGuestPasswordManager({enabled:true,databasePath:'/home/materialbrowser/.material-browser/workspace/vault.kdbx',databaseMode:'existing',extension:true,passkeys:true}):null})}/>{t('Pair the guest browser with KeePassXC inside the guest')}</label>
        {draft.settings.passwordManager && <>
          <Field label={t('Guest database path (.kdbx)')} value={draft.settings.passwordManager.database.path} onChange={path=>{try{setting({passwordManager:buildGuestPasswordManager({enabled:true,databasePath:path,databaseMode:draft.settings.passwordManager!.database.mode,extension:draft.settings.passwordManager!.extension,passkeys:draft.settings.passwordManager!.passkeys})});setMessage('');}catch{setMessage(t('Guest database path must end with .kdbx'));}}}/>
          <label className="super-check"><MaterialInput type="checkbox" checked={draft.settings.passwordManager.extension} onChange={e=>setting({passwordManager:{...draft.settings.passwordManager!,extension:e.target.checked}})}/>{t('Install the KeePassXC browser extension')}</label>
          <label className="super-check"><MaterialInput type="checkbox" checked={draft.settings.passwordManager.passkeys} onChange={e=>setting({passwordManager:{...draft.settings.passwordManager!,passkeys:e.target.checked}})}/>{t('Enable passkeys')}</label>
          <p>{t('Add a KeePassXC package from the maintained lineage to the installers above; the guest must provide /usr/bin/keepassxc-proxy before launch.')}</p>
        </>}
        {lines('Setup commands, one per line','setupCommands')}
        {lines('Startup commands, one per line','startupCommands')}
        <p>{t('Commands run inside the selected environment. Review every command and use trusted installers.')}</p>
      </>}
      {draft.step===3 && <>
        <dl><dt>{t('Name')}</dt><dd>{draft.name}</dd><dt>{t('Environment')}</dt><dd>{draft.settings.backend}</dd><dt>{t('Launch mode')}</dt><dd>{t(draft.settings.launchMode)}</dd><dt>{t('Engine')}</dt><dd>{draft.engine}</dd></dl>
        <p>{t('Saving a template does not install prerequisites or verify that this environment can launch.')}</p>
        <p>{t('Standard launch uses the engine’s normal identity. It does not provide identity spoofing, stable cross-device identity or portable browser credentials.')}</p>
      </>}
    </fieldset>
    <div className="super-actions wizard-footer">
      <Button secondary disabled={busy} onClick={onCancel}>{t('Cancel')}</Button>
      <Button secondary disabled={busy||draft.step===0} onClick={()=>update({step:draft.step-1})}>{t('Back')}</Button>
      {draft.step<3 ? <Button disabled={busy||!draft.name.trim()} onClick={()=>update({step:draft.step+1})}>{t('Next')}</Button> : <Button disabled={busy||!draft.name.trim()} onClick={()=>void onSave({name:draft.name.trim(),engine:draft.engine,settings:persistSuperProfileConfiguration({...draft.settings,engine:draft.engine})}).then(()=>localStorage.removeItem(key)).catch(()=>{})}>{t('Save template')}</Button>}
    </div>
  </section>;
}
