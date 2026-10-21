import React, { useEffect, useRef, useState } from 'react';
import { request, SuperProfile, SuperRevision } from './api';
import { Button, Modal } from './components';
import { Search } from './Search';
import { SuperProfilesWizard } from './SuperProfilesWizard';
import './SuperProfiles.css';
import { operationFailure } from './operation-errors.mjs';
type Session = {id:string;profileId:string;revisionId:string;distribution:string;mode:string;state:string;message?:string;phase?:string;operationId?:string;events?:{sequence:number;timestampMs:number;phase:string;message:string}[]};
export function SuperProfiles({t}: {t:(s:string)=>string}) {
  const [profiles,setProfiles]=useState<SuperProfile[]>([]), [selected,setSelected]=useState(''), [rows,setRows]=useState<number[]>([]);
  const [revisions,setRevisions]=useState<SuperRevision[]>([]), [sessions,setSessions]=useState<Session[]>([]);
  const [capabilities,setCapabilities]=useState<any>(null), [busy,setBusy]=useState(false), [notice,setNotice]=useState('');
  const [wizard,setWizard]=useState<'new'|'edit'|null>(null), [confirm,setConfirm]=useState<{kind:'launch'|'remove'|'restore'|'save'|'stop'|'discard';revision?:string;session?:Session}|null>(null);
  const [saveCategories,setSaveCategories]=useState<string[]>([]);
  const [preview,setPreview]=useState<{sessionId:string;categories:{id:string;included:boolean}[];excluded:string[];stopped:boolean}|null>(null);
  const [identityConsent,setIdentityConsent]=useState(false);
  const inFlight=useRef(false), selection=useRef('');
  const profile=profiles.find(p=>p.id===selected);
  const activeSession=sessions.some(s=>s.profileId===selected&&!['stopped','saved','discarded'].includes(s.state));
  const refresh=async()=>{
    const [templates,caps,active]=await Promise.all([request('superProfiles.list'),request('superProfiles.capabilities'),request('superProfiles.sessions.status')]);
    setProfiles(templates);setCapabilities(caps);setSessions(Array.isArray(active)?active:active.sessions||[]);
  };
  const run=async(action:()=>Promise<void|string>)=>{
    if(inFlight.current)return;
    inFlight.current=true;setBusy(true);setNotice(t('Working'));
    try{const result=await action();setNotice(t(result||'Completed'));}catch(e){setNotice(t(operationFailure(e)[0]));}finally{setBusy(false);inFlight.current=false;}
  };
  useEffect(()=>{void run(refresh);},[]);
  useEffect(()=>{
    let cancelled=false;let timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{try{const active=await request('superProfiles.sessions.status');if(!cancelled)setSessions(Array.isArray(active)?active:active.sessions||[]);}catch{if(!cancelled)setNotice(t('Session status unavailable. Retry Refresh.'));}finally{if(!cancelled)timer=setTimeout(poll,2500);}};
    timer=setTimeout(poll,2500);return()=>{cancelled=true;clearTimeout(timer);};
  },[]);
  useEffect(()=>{
    selection.current=selected;setRevisions([]);setConfirm(null);setWizard(null);setIdentityConsent(false);
    if(selected)request('superProfiles.revisions.list',{id:selected}).then(value=>{if(selection.current===selected)setRevisions([...value].sort((a:SuperRevision,b:SuperRevision)=>b.createdAt-a.createdAt));}).catch(e=>{if(selection.current===selected)setNotice(t(operationFailure(e)[0]));});
  },[selected,profiles]);
  const ask=(value:NonNullable<typeof confirm>)=>{setIdentityConsent(false);setPreview(null);if(value.kind==='save'){void run(async()=>{const result=await request('superProfiles.sessions.preview',{sessionId:value.session?.id});setPreview(result);setSaveCategories(result.categories.filter((c:{id:string;included:boolean})=>c.included&&['browser','workspace'].includes(c.id)).map((c:{id:string})=>c.id));setConfirm(value);});}else setConfirm(value);};
  const execute=()=>void run(async()=>{
    if(!profile||!confirm)return;
    const id=profile.id,expectedRevisionId=profile.revisionId;let result:any;
    if(confirm.kind==='launch'){
      if(!identityConsent)throw Error('IDENTITY_CONSENT_REQUIRED');
      await request('superProfiles.sessions.launch',{profileId:id,requireStableIdentity:false});
    }else if(confirm.kind==='discard')await request('superProfiles.sessions.discard',{sessionId:confirm.session?.id});
    else if(confirm.kind==='save')result=await request('superProfiles.sessions.save',{sessionId:confirm.session?.id,expectedRevisionId:confirm.session?.revisionId,categories:saveCategories,closeAfterSave:true});
    else if(confirm.kind==='stop')await request('superProfiles.sessions.stop',{sessionId:confirm.session?.id});
    else if(confirm.kind==='restore')await request('superProfiles.revisions.restore',{id,expectedRevisionId,revisionId:confirm.revision});
    else await request('superProfiles.remove',{id,expectedRevisionId});
    setConfirm(null);await refresh();if(result?.saved&&result?.cleanupPending)return 'Data saved. Cleanup is incomplete; retry Discard and close.';
  });
  return <div className="super-workspace">
    <div className="page-heading"><div><h1>{t('Super Profiles')}</h1><p>{t('Reusable environments with explicit save-back revisions.')}</p></div><Button disabled={busy} onClick={()=>setWizard('new')}>{t('Create Super Profile')}</Button></div>
    <p className="super-notice" role="status" aria-live="polite">{notice||t('Select a template to begin')}</p>
    <div className="super-actions"><Button secondary disabled={busy} onClick={()=>void run(refresh)}>{t('Refresh')}</Button></div>
    {wizard ? <SuperProfilesWizard key={wizard==='edit'?selected:'new'} profile={wizard==='edit'?profile:undefined} t={t} busy={busy} onCancel={()=>setWizard(null)} onSave={async draft=>{
      if(inFlight.current)return;
      inFlight.current=true;setBusy(true);
      try{
        const result=await request(wizard==='edit'?'superProfiles.update':'superProfiles.create',{...draft,...(wizard==='edit'&&profile?{id:profile.id,expectedRevisionId:profile.revisionId}:{})});
        await refresh();setSelected(result.id);setWizard(null);setNotice(t('Template saved'));
      }catch(e){setNotice(t(operationFailure(e)[0]));throw e;}finally{inFlight.current=false;setBusy(false);}
    }}/> : <div className="super-columns">
      <section className="surface"><Search label={t('Search')} items={profiles.map(p=>`${p.name} ${p.settings.backend}`)} onResults={setRows} t={t}/>
        {!profiles.length&&<p>{t('No Super Profiles yet')}</p>}
        {rows.map(i=>profiles[i]&&<button className={`profile-row ${selected===profiles[i].id?'selected':''}`} key={profiles[i].id} disabled={busy} onClick={()=>setSelected(profiles[i].id)}><span><strong>{profiles[i].name}</strong><small>{profiles[i].settings.backend} · {t(profiles[i].settings.launchMode||'terminal')}</small></span></button>)}
      </section>
      <section className="surface">{profile ? <>
        <h2>{profile.name}</h2><dl><dt>{t('Environment')}</dt><dd>{profile.settings.backend}</dd><dt>{t('Engine')}</dt><dd>{profile.engine}</dd><dt>{t('Current revision')}</dt><dd>{profile.revisionId}</dd></dl>
        <div className="super-actions">
          <Button disabled={busy||activeSession} onClick={()=>ask({kind:'launch'})}>{t('Launch')}</Button>
          <Button secondary disabled={busy||activeSession} onClick={()=>setWizard('edit')}>{t('Edit template')}</Button>
          <Button secondary disabled={busy} onClick={()=>void run(async()=>{const copy=await request('superProfiles.duplicate',{id:profile.id,name:`${profile.name} (${t('Copy')})`});await refresh();setSelected(copy.id);})}>{t('Duplicate')}</Button>
          <Button secondary disabled={busy||activeSession} onClick={()=>ask({kind:'remove'})}>{t('Delete template')}</Button>
        </div>
        {activeSession&&<p>{t('Stop the active session before editing, deleting or launching this template again.')}</p>}<h3>{t('Sessions')}</h3>
        {sessions.filter(s=>s.profileId===profile.id).length===0&&<p>{t('No sessions reported')}</p>}
        {sessions.filter(s=>s.profileId===profile.id).map(s=><article key={s.id}><h4>{s.distribution||s.id}</h4><p>{t('State')}: {t(s.state)} · {t(s.mode)}</p>{s.phase&&<p>{t('Phase')}: {t(s.phase)}</p>}{s.events?.length ? <details><summary>{t('Session progress')}</summary><ol>{s.events.map(event=><li key={event.sequence}>{new Date(event.timestampMs).toLocaleTimeString()} · {t(event.phase)}</li>)}</ol></details>:null}<div className="super-actions"><Button secondary disabled={busy||!['running','launched','starting','recovery-required','provisioning'].includes(s.state)} onClick={()=>ask({kind:'stop',session:s})}>{t(s.state==='provisioning'?'Cancel provisioning':'Stop')}</Button><Button secondary disabled={busy||!['running','launched','starting','stopped'].includes(s.state)} onClick={()=>ask({kind:'save',session:s})}>{t('Save back and close')}</Button><Button secondary disabled={busy||!['running','launched','starting','stopped','saved','cleanup-required','recovery-required'].includes(s.state)} onClick={()=>ask({kind:'discard',session:s})}>{t('Discard and close')}</Button></div></article>)}
        <h3>{t('Revisions')}</h3>
        {revisions.map(r=><article key={r.id}><p>{r.name} · {new Date(r.createdAt*1000).toLocaleString()} · {r.archiveBytes} {t('bytes')}</p><small>{r.id}</small><div className="super-actions"><Button secondary disabled={busy||activeSession||r.id===profile.revisionId} onClick={()=>ask({kind:'restore',revision:r.id})}>{t('Restore')}</Button></div></article>)}
      </>:<p>{t('Select a template to begin')}</p>}</section>
    </div>}
    <details className="surface"><summary>{t('Host capabilities')}</summary><p>{t('Capability availability is not proof that a session launched successfully.')}</p><dl><dt>WSL 2</dt><dd>{t(capabilities?.wsl2?.available?'Available':'Unavailable')}</dd><dt>Windows Sandbox</dt><dd>{t(capabilities?.windowsSandbox?.available?'Available':'Unavailable')}</dd><dt>{t('Stable identity')}</dt><dd>{t('Unavailable')}</dd></dl><p>{t('WSL graphical modes require WSLg and the selected guest programs. Sandbox must already be enabled.')}</p></details>
    {confirm&&profile&&<Modal title={t({launch:'Launch Super Profile',remove:'Delete template',restore:'Restore revision',save:'Review save-back',stop:'Stop session',discard:'Discard and close'}[confirm.kind])} onClose={()=>{if(!busy)setConfirm(null);}} closeLabel={t('Cancel')} accessibilityLabel={t('Accessibility')} actions={<Button disabled={busy||(confirm.kind==='launch'&&!identityConsent)||(confirm.kind==='save'&&(!preview||preview.sessionId!==confirm.session?.id||saveCategories.length===0))} onClick={execute}>{t({launch:'Launch with standard identity',remove:'Delete template',restore:'Restore',save:'Save back and close',stop:'Stop',discard:'Discard session'}[confirm.kind])}</Button>}>
      <p><strong>{profile.name}</strong></p>
      {confirm.kind==='launch'&&<><p>{t('Standard launch uses the engine’s normal identity. It does not provide identity spoofing, stable cross-device identity or portable browser credentials.')}</p><label><input type="checkbox" checked={identityConsent} onChange={e=>setIdentityConsent(e.target.checked)} disabled={busy}/>{t('Use standard identity for this launch only')}</label><p>{t('Launching executes the template commands. Review the template before continuing.')}</p></>}
      {confirm.kind==='save'&&<><p>{t('The host will gracefully stop this session, save the selected data as a new encrypted revision, and remove the disposable guest. Existing revisions remain available.')}</p><p>{t('Only managed browser data and workspace files are included. The operating system, external folders and machine identity are excluded.')}</p><fieldset disabled={busy}><legend>{t('Save categories')}</legend>{preview?.categories.filter(c=>['browser','workspace'].includes(c.id)).map(c=><label key={c.id}><input type="checkbox" checked={saveCategories.includes(c.id)} onChange={e=>setSaveCategories(previous=>e.target.checked?[...previous,c.id]:previous.filter(id=>id!==c.id))}/>{t(c.id)}</label>)}</fieldset><p>{t('Select at least one category. Unselected categories are excluded from the new revision.')}</p><p>{t('Cancel leaves the session unchanged. Saving may include private files stored inside the environment.')}</p></>}
      {confirm.kind==='discard'&&<p>{t('Discard gracefully stops and removes the disposable guest without saving changes. Existing revisions are preserved. Cleanup failures remain visible and can be retried.')}</p>}
      {confirm.kind==='remove'&&<p>{t('Delete this template and its revision history? This cannot be undone.')}</p>}
      {confirm.kind==='restore'&&<><p>{t('Restore creates a new revision from the selected history entry.')}</p><p>{confirm.revision}</p></>}
      {confirm.kind==='stop'&&<p>{t('Stopping interrupts this owned session. Unsaved application work may be lost. The template is unchanged until you save back.')}</p>}
    </Modal>}
  </div>;
}
