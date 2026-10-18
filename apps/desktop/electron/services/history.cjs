'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const {withNativeLock}=require('./credential-store.cjs');
const scrypt=promisify(crypto.scrypt);
const run=promisify(execFile);
const KEYS=new Set('language funnyEnglish funnyCantonese dialogEmoji narration narratorLanguage voiceEnglish voiceCantonese speechRate speechPitch screenReaderMode theme density accent fontFamily fontScale fontWeight motion logoPreset accessibilityVisible textScale highContrast strongFocus largeTargets focus lowStimulation timeAwareness oneThing nextAction momentum idleMinutes snoozeMinutes toastSeconds quietEnabled quietStart quietEnd paletteSize'.split(' '));
const ACTIONS=new Set(['created','updated','deleted','reset','restored','imported','settings-changed','labelled','retention-changed']);
const OMITTED=['Personal wording and file metadata','Credentials and vault data','Device paths','User-entered text, schedule labels and voice identifiers'];
const stable=value=>JSON.stringify(value);
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const validId=value=>typeof value==='string'&&/^[a-f0-9-]{36}$/.test(value);
function createHistoryService(options) {
  const {appDataRoot,historyRoot,gitExecutable,gitSha256,credentialStore,validatePreferences,validateSchedule,onTransition=async()=>{}}=options || {};
  if(!path.isAbsolute(appDataRoot||'')||historyRoot!==path.join(appDataRoot,'settings-history')||!path.isAbsolute(gitExecutable||'')||!/^[a-f0-9]{64}$/.test(gitSha256||'')||typeof credentialStore?.withKey!=='function'||typeof validatePreferences!=='function'||typeof validateSchedule!=='function')throw new Error('INVALID_HISTORY_OPTIONS');
  const repo=path.join(historyRoot,'repository'), events=path.join(repo,'events'), authFile=path.join(historyRoot,'auth.json'), journal=path.join(historyRoot,'pending.json');
  let unlockedUntil=0, ready=false, queue=Promise.resolve(),lease;
  const lockIdentity=async()=>{await verifyManagedPaths();await directory(appDataRoot);const resolved=await fs.realpath(appDataRoot);return digest('history:'+path.join(resolved,'settings-history').toLowerCase());};
  const assertHeld=()=>{if(!lease)throw new Error('HISTORY_LOCK_REQUIRED');lease.assertHeld();};
  const active=()=>{if(Date.now()>=unlockedUntil)throw new Error('HISTORY_LOCKED');};
  const serial=fn=>{const result=queue.then(fn);queue=result.catch(()=>{});return result;};
  async function noLinks(target){let current=path.resolve(target);while(true){try{const stat=await fs.lstat(current);if(stat.isSymbolicLink())throw new Error('UNSAFE_HISTORY_PATH');}catch(error){if(error.code!=='ENOENT')throw error;}const parent=path.dirname(current);if(parent===current)break;current=parent;}}
  async function checkedPath(target,type,{missing=true,maxBytes=Infinity}={}){
    await noLinks(target);
    try{const stat=await fs.lstat(target);if((type==='directory'&&!stat.isDirectory())||(type==='file'&&(!stat.isFile()||stat.nlink!==1||stat.size>maxBytes)))throw new Error('UNSAFE_HISTORY_PATH');return stat;}
    catch(error){if(missing&&error.code==='ENOENT')return null;throw error;}
  }
  async function directory(target){await checkedPath(target,'directory');await fs.mkdir(target,{recursive:true,mode:0o700});await checkedPath(target,'directory',{missing:false});}
  async function boundedRead(target,maxBytes){await checkedPath(target,'file',{missing:false,maxBytes});return fs.readFile(target);}
  async function verifyGitConfiguration(){
    const admin=path.join(repo,'.git');
    if(!await checkedPath(admin,'directory'))return;
    const config=await boundedRead(path.join(admin,'config'),8192);
    let section='',seen=new Set();
    const allowed={repositoryformatversion:'0',filemode:['true','false'],bare:'false',logallrefupdates:'true',symlinks:'false',ignorecase:'true'};
    for(const line of config.toString('utf8').split(/\r?\n/)){
      const text=line.trim();if(!text||text.startsWith('#')||text.startsWith(';'))continue;
      if(text==='[core]'){if(section)throw new Error('UNSAFE_HISTORY_GIT_CONFIG');section='core';continue;}
      const match=/^([a-z]+)\s*=\s*([a-z0-9]+)$/.exec(text);
      if(section!=='core'||!match||!Object.hasOwn(allowed,match[1])||seen.has(match[1])||!(Array.isArray(allowed[match[1]])?allowed[match[1]].includes(match[2]):allowed[match[1]]===match[2]))throw new Error('UNSAFE_HISTORY_GIT_CONFIG');seen.add(match[1]);
    }
    for(const required of ['repositoryformatversion','bare'])if(!seen.has(required))throw new Error('UNSAFE_HISTORY_GIT_CONFIG');
    const forbidden=['config.worktree','commondir','gitdir','info/attributes','info/grafts','objects/info/alternates','objects/info/http-alternates','refs/replace','shallow'];
    for(const relative of forbidden){const target=path.join(admin,relative);await noLinks(target);try{await fs.lstat(target);throw new Error('UNSAFE_HISTORY_GIT_STATE');}catch(error){if(error.code!=='ENOENT')throw error;}}
    const legacyHooks=path.join(admin,'hooks');if(await checkedPath(legacyHooks,'directory'))for(const name of await fs.readdir(legacyHooks))if(!name.endsWith('.sample'))throw new Error('UNSAFE_HISTORY_HOOKS');
    const pending=[admin];let entries=0;
    while(pending.length){const dir=pending.pop();await checkedPath(dir,'directory',{missing:false});for(const entry of await fs.readdir(dir,{withFileTypes:true})){if(++entries>30000)throw new Error('HISTORY_CAPACITY_REACHED');const target=path.join(dir,entry.name);await noLinks(target);if(entry.isDirectory())pending.push(target);else await checkedPath(target,'file',{missing:false,maxBytes:16*1024*1024});}}
  }
  async function verifyManagedPaths(){
    for(const target of [appDataRoot,historyRoot,repo,events,path.join(historyRoot,'no-hooks')])await checkedPath(target,'directory');
    for(const target of [authFile,journal])await checkedPath(target,'file',{maxBytes:400000});
    const config=path.join(historyRoot,'empty-config');if(await checkedPath(config,'file',{maxBytes:0})){if((await boundedRead(config,0)).length)throw new Error('UNSAFE_HISTORY_GIT_CONFIG');}
    const hooks=path.join(historyRoot,'no-hooks');if(await checkedPath(hooks,'directory'))if((await fs.readdir(hooks)).length)throw new Error('UNSAFE_HISTORY_HOOKS');
    let abandonedTempCount=0,abandonedBytes=0;
    if(await checkedPath(historyRoot,'directory'))for(const name of await fs.readdir(historyRoot)){
      const target=path.join(historyRoot,name);
      if(/^(auth|pending)\.json\.[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.tmp$/.test(name)){
        const stat=await checkedPath(target,'file',{missing:false,maxBytes:400000});abandonedTempCount++;abandonedBytes+=stat.size;
        if(abandonedTempCount>128||abandonedBytes>8*1024*1024)throw new Error('HISTORY_ABANDONED_TEMP_LIMIT');
        continue;
      }
      if(!['repository','no-hooks','empty-config','auth.json','pending.json'].includes(name))throw new Error('UNSAFE_HISTORY_MANAGED_STATE');await noLinks(target);
    }
    if(await checkedPath(repo,'directory'))for(const name of await fs.readdir(repo)){if(!['.git','events'].includes(name))throw new Error('UNSAFE_HISTORY_ATTRIBUTES');await noLinks(path.join(repo,name));}
    if(await checkedPath(events,'directory'))for(const name of await fs.readdir(events)){if(!/^[a-f0-9-]{36}\.json$/.test(name))throw new Error('UNSAFE_HISTORY_ATTRIBUTES');await checkedPath(path.join(events,name),'file',{missing:false,maxBytes:400000});}
    await verifyGitConfiguration();return {abandonedTempCount};
  }
  async function atomic(file,value){
    assertHeld();await verifyManagedPaths();await checkedPath(path.dirname(file),'directory',{missing:false});await checkedPath(file,'file',{maxBytes:400000});
    const temp=file+'.'+crypto.randomUUID()+'.tmp';await noLinks(temp);const handle=await fs.open(temp,'wx',0o600);
    try{await handle.writeFile(stable(value));await handle.sync();}finally{await handle.close();}
    await onTransition('temp-synced',{target:path.basename(file)});
    assertHeld();await checkedPath(path.dirname(file),'directory',{missing:false});await checkedPath(file,'file',{maxBytes:400000});await checkedPath(temp,'file',{missing:false,maxBytes:400000});await fs.rename(temp,file);assertHeld();
  }
  async function git(args){ assertHeld(); await verifyManagedPaths();
    if(digest(await fs.readFile(gitExecutable))!==gitSha256)throw new Error('HISTORY_GIT_MISMATCH');
    const env={...process.env};for(const key of Object.keys(env))if(key.startsWith('GIT_'))delete env[key];
    Object.assign(env,{GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:path.join(historyRoot,'empty-config'),GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0'});
    try{return (await run(gitExecutable,['-c','core.hooksPath='+path.join(historyRoot,'no-hooks'),'-c','core.fsmonitor=false','-c','protocol.allow=never','-c','commit.gpgSign=false','-c','user.name=Material Browser','-c','user.email=local@invalid','-C',repo,...args],{env,windowsHide:true,shell:false,timeout:10000,maxBuffer:2*1024*1024,encoding:'utf8'})).stdout.trim();}catch{throw new Error('HISTORY_GIT_FAILED');}
  }
  async function init(){await verifyManagedPaths();if(ready)return;await directory(historyRoot);await directory(repo);await directory(events);await directory(path.join(historyRoot,'no-hooks'));const config=path.join(historyRoot,'empty-config');if(!await checkedPath(config,'file',{maxBytes:0}))await fs.writeFile(config,'',{flag:'wx',mode:0o600});if(!await checkedPath(path.join(repo,'.git'),'directory'))await git(['init','--initial-branch=main','--template='+path.join(historyRoot,'no-hooks')]);await verifyManagedPaths();ready=true;}
  function project(input){
    if(input?.kind==='display-name'){
      if(input.schemaVersion!==1||input.recordId!=='application-display-name-v1'||Object.keys(input).some(k=>!['schemaVersion','kind','recordId','displayName'].includes(k))||(input.displayName!==null&&(typeof input.displayName!=='string'||!input.displayName.trim()||input.displayName.length>120||/[\x00-\x1f\x7f]/.test(input.displayName))))throw new Error('INVALID_DISPLAY_NAME_RECORD');
      return {schemaVersion:1,kind:'display-name',recordId:'application-display-name-v1',displayName:input.displayName};
    }
    if(!input||input.schemaVersion!==1||Object.keys(input).some(k=>!['schemaVersion','preferences','schedules'].includes(k))||!input.preferences||typeof input.preferences!=='object'||Array.isArray(input.preferences)||Object.keys(input.preferences).some(k=>!KEYS.has(k))||!Array.isArray(input.schedules)||input.schedules.length>200)throw new Error('INVALID_HISTORY_SNAPSHOT');
    // Both validators are trusted imports of the shared settings model, never renderer callbacks.
    const preferences=validatePreferences(input.preferences), schedules=input.schedules.map(validateSchedule);
    if(Object.keys(preferences).some(k=>!KEYS.has(k))||new Set(schedules.map(s=>s.id)).size!==schedules.length)throw new Error('INVALID_HISTORY_SNAPSHOT');
    const snapshot={schemaVersion:1,preferences,schedules};if(Buffer.byteLength(stable(snapshot))>262144)throw new Error('HISTORY_SNAPSHOT_TOO_LARGE');return snapshot;
  }
  async function seal(value,id){return credentialStore.withKey(key=>{const recordId=value.snapshot?.recordId||value.recordId||'presentation-settings-v1';const nonce=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,nonce);cipher.setAAD(Buffer.from('material-browser:settings-history:v1:'+recordId+':'+id));const plaintext=Buffer.from(stable(value));try{const data=Buffer.concat([cipher.update(plaintext),cipher.final()]);return {version:2,id,recordId,nonce:nonce.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:data.toString('base64')};}finally{plaintext.fill(0);}});}
  async function read(id){if(!validId(id)&&id!=='pending')throw new Error('INVALID_REVISION');const file=id==='pending'?journal:path.join(events,id+'.json');const raw=await boundedRead(file,400000);if(raw.length>400000)throw new Error('INVALID_REVISION');const envelope=JSON.parse(raw);if(envelope.id!==id||![1,2].includes(envelope.version)||(envelope.version===2&&!['presentation-settings-v1','application-display-name-v1'].includes(envelope.recordId)))throw new Error('INVALID_REVISION');return credentialStore.withKey(key=>{const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(envelope.nonce,'base64'));decipher.setAAD(Buffer.from('material-browser:settings-history:v1:'+(envelope.version===2?envelope.recordId+':':'')+id));decipher.setAuthTag(Buffer.from(envelope.tag,'base64'));const plaintext=Buffer.concat([decipher.update(Buffer.from(envelope.data,'base64')),decipher.final()]);try{return JSON.parse(plaintext.toString('utf8'));}finally{plaintext.fill(0);}});}
  async function append(payload){await init();const files=await fs.readdir(events);if(files.length>=2000)throw new Error('HISTORY_CAPACITY_REACHED');const id=crypto.randomUUID(),file=path.join(events,id+'.json');await checkedPath(events,'directory',{missing:false});await noLinks(file);assertHeld();await fs.writeFile(file,stable(await seal({...payload,date:new Date().toISOString()},id)),{flag:'wx',mode:0o600});await git(['add','--','events/'+id+'.json']);await git(['commit','--no-verify','-m','Record local settings history']);const commit=await git(['rev-parse','HEAD']);return {revision:id,commit};}
  async function configured(){await checkedPath(authFile,'file',{maxBytes:8192});try{await fs.access(authFile);return true;}catch(error){if(error.code==='ENOENT')return false;throw error;}}
  async function requireAuth(){await init();if(!await configured())throw new Error('HISTORY_NOT_CONFIGURED');}
  async function rows(){await requireAuth();active();const diskFiles=await fs.readdir(events);if(diskFiles.length>2000)throw new Error('HISTORY_CAPACITY_REACHED');if(!diskFiles.length)return [];const files=(await git(['ls-tree','--name-only','HEAD:events'])).split(/\r?\n/).filter(Boolean);const all=[];for(const file of files){if(!/^[a-f0-9-]{36}\.json$/.test(file))throw new Error('INVALID_HISTORY_FILE');const id=file.slice(0,-5);all.push({revision:id,...await read(id)});}return all.sort((a,b)=>b.date.localeCompare(a.date)||b.revision.localeCompare(a.revision));}
  const methods={
    async status(){await init();const {abandonedTempCount}=await verifyManagedPaths();let recoveryPending=false;try{await fs.access(journal);recoveryPending=true;}catch{}return {configured:await configured(),unlocked:Date.now()<unlockedUntil,recoveryPending,abandonedTempCount,physicalPruneAvailable:false};},
    async setup(secret){return serial(async()=>{await init();if(await configured())throw new Error('HISTORY_ALREADY_CONFIGURED');if(typeof secret!=='string'||secret.length<6||secret.length>256)throw new Error('INVALID_HISTORY_PASSWORD');const salt=crypto.randomBytes(16),derived=await scrypt(secret,salt,32);try{await credentialStore.withKey(()=>{},{create:true});await atomic(authFile,{version:1,salt:salt.toString('base64'),verifier:derived.toString('base64')});unlockedUntil=Date.now()+10*60*1000;return {configured:true,unlocked:true};}finally{derived.fill(0);}});},
    async verify(secret){await requireAuth();if(typeof secret!=='string'||secret.length>256)throw new Error('INVALID_HISTORY_PASSWORD');const auth=JSON.parse((await boundedRead(authFile,8192)).toString('utf8'));if(auth.version!==1||Buffer.from(auth.salt,'base64').length!==16||Buffer.from(auth.verifier,'base64').length!==32)throw new Error('INVALID_HISTORY_AUTH');const derived=await scrypt(secret,Buffer.from(auth.salt,'base64'),32);try{if(!crypto.timingSafeEqual(derived,Buffer.from(auth.verifier,'base64')))throw new Error('HISTORY_AUTH_FAILED');await credentialStore.withKey(()=>{});return {verified:true};}finally{derived.fill(0);}},
    async unlock(secret){await methods.verify(secret);unlockedUntil=Date.now()+10*60*1000;return {unlocked:true};},
    async lock(){unlockedUntil=0;return {unlocked:false};},
    async recordSettings({before,after,action='settings-changed',protectedMutation=false}){return serial(async()=>{try{await requireAuth();if(protectedMutation)throw new Error('PROTECTED_TRANSACTION_REQUIRED');if(!ACTIONS.has(action))throw new Error('INVALID_HISTORY_ACTION');const snapshot=project(after);if(snapshot.kind==='display-name')throw new Error('PROTECTED_TRANSACTION_REQUIRED');if(before&&stable(project(before))===stable(snapshot))return {recorded:false,unchanged:true};return {recorded:true,...await append({action,recordId:'presentation-settings-v1',snapshot})};}catch(error){return {recorded:false,warning:/^[A-Z_]+$/.test(error.message)?error.message:'HISTORY_WRITE_FAILED'};}});},
    async transactDisplayName({before,after,action='updated'},apply){return serial(async()=>{
      await requireAuth();active();if(typeof apply!=='function')throw new Error('TRUSTED_APPLY_REQUIRED');if(!['created','updated','deleted','reset'].includes(action))throw new Error('INVALID_HISTORY_ACTION');
      const snapshot=project({schemaVersion:1,kind:'display-name',recordId:'application-display-name-v1',displayName:after});const previous=project({...snapshot,displayName:before});if(stable(snapshot)===stable(previous))return {recorded:false,unchanged:true};
      const latest=(await rows()).find(row=>row.snapshot?.kind==='display-name'&&!row.prepared&&row.action!=='restore-prepared');if(latest&&latest.snapshot.displayName!==before)throw new Error('HISTORY_STATE_CONFLICT');
      try{await fs.access(journal);throw new Error('HISTORY_RECOVERY_REQUIRED');}catch(error){if(error.code!=='ENOENT')throw error;}
      const transaction={operation:'display-name',transactionId:crypto.randomUUID(),phase:'prepared',action,snapshot,previous};await atomic(journal,await seal(transaction,'pending'));await onTransition('journal-prepared');
      await append({action:'transaction-prepared',prepared:true,recordId:snapshot.recordId,snapshot});await onTransition('prepared-committed');transaction.phase='apply-started';await atomic(journal,await seal(transaction,'pending'));
      try{assertHeld();await apply(snapshot,{expected:previous});await onTransition('applied');}catch{throw new Error('HISTORY_RECOVERY_REQUIRED');}
      transaction.phase='applied';await atomic(journal,await seal(transaction,'pending'));const receipt=await append({action,recordId:snapshot.recordId,snapshot});await fs.unlink(journal);return {applied:true,recorded:true,...receipt};
    });},
    async list({actions=[],from='',to='',limit=100}={}){if(!Array.isArray(actions)||actions.some(a=>!ACTIONS.has(a))||!Number.isInteger(limit)||limit<1||limit>500||[from,to].some(x=>x!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(x)))throw new Error('INVALID_HISTORY_FILTER');const all=await rows(),labels=new Map();for(const row of [...all].reverse())if(row.action==='labelled')labels.set(row.target,row.label);const policy=all.find(row=>row.action==='retention-changed'),cutoff=policy?Date.now()-policy.visibleDays*86400000:0;const revisions=all.filter(row=>row.snapshot&&!row.prepared&&row.action!=='restore-prepared'&&Date.parse(row.date)>=cutoff&&(!actions.length||actions.includes(row.action))&&(!from||row.date.slice(0,10)>=from)&&(!to||row.date.slice(0,10)<=to)).slice(0,limit).map(row=>({revision:row.revision,date:row.date,action:row.action,label:labels.get(row.revision)||'',recordId:row.recordId}));return {revisions,omitted:OMITTED,logicalRetentionDays:policy?.visibleDays||null,physicalPruneAvailable:false};},
    async diff(revision){await requireAuth();active();const row=await read(revision);if(!row.snapshot)throw new Error('INVALID_REVISION');if(row.snapshot.kind==='display-name')return {recordKind:'display-name',changed:true,omitted:OMITTED};const all=(await rows()).filter(r=>r.snapshot&&!r.prepared&&r.action!=='restore-prepared'&&!r.snapshot.kind);const index=all.findIndex(r=>r.revision===revision),previous=all[index+1]?.snapshot;return {changedKeys:[...KEYS].filter(key=>stable(previous?.preferences[key])!==stable(row.snapshot.preferences[key])),scheduleCount:row.snapshot.schedules.length,previousScheduleCount:previous?.schedules.length||0,omitted:OMITTED};},
    async label(revision,label){return serial(async()=>{await requireAuth();active();await read(revision);if(typeof label!=='string'||label.length>120||/[\x00-\x1f]/.test(label))throw new Error('INVALID_HISTORY_LABEL');return append({action:'labelled',target:revision,label});});},
    async restore(revision,apply){return serial(async()=>{await requireAuth();active();if(typeof apply!=='function')throw new Error('TRUSTED_APPLY_REQUIRED');try{await fs.access(journal);throw new Error('HISTORY_RECOVERY_REQUIRED');}catch(error){if(error.code!=='ENOENT')throw error;}const row=await read(revision);if(!row.snapshot)throw new Error('INVALID_REVISION');const snapshot=project(row.snapshot);const transaction={operation:'restore',transactionId:crypto.randomUUID(),phase:'prepared',source:revision,snapshot};await atomic(journal,await seal(transaction,'pending'));await onTransition('journal-prepared');await append({action:'restore-prepared',recordId:snapshot.recordId||'presentation-settings-v1',snapshot});await onTransition('prepared-committed');transaction.phase='apply-started';await atomic(journal,await seal(transaction,'pending'));try{assertHeld();await apply(snapshot);await onTransition('applied');}catch{throw new Error('HISTORY_RECOVERY_REQUIRED');}transaction.phase='applied';await atomic(journal,await seal(transaction,'pending'));const receipt=await append({action:'restored',recordId:snapshot.recordId||'presentation-settings-v1',snapshot});await fs.unlink(journal);return {restored:true,recorded:true,...receipt};});},
    async recover(decision,apply){return serial(async()=>{await requireAuth();active();if(!['retry','discard'].includes(decision))throw new Error('INVALID_RECOVERY_DECISION');const pending=await read('pending');if(!['restore','display-name'].includes(pending.operation))throw new Error('INVALID_RECOVERY_RECORD');if(decision==='retry'){if(typeof apply!=='function')throw new Error('TRUSTED_APPLY_REQUIRED');const snapshot=project(pending.snapshot);await append({action:'transaction-prepared',prepared:true,recordId:snapshot.recordId||'presentation-settings-v1',snapshot});try{assertHeld();await apply(snapshot,{expected:pending.previous,recovery:true});}catch{throw new Error('HISTORY_RECOVERY_REQUIRED');}const receipt=await append({action:pending.operation==='display-name'?pending.action:'restored',recordId:snapshot.recordId||'presentation-settings-v1',snapshot});await fs.unlink(journal);return {recovered:true,recorded:true,...receipt};}const receipt=await append({action:'transaction-discarded',source:pending.source||null});await fs.unlink(journal);return {recovered:true,discarded:true,...receipt};});},
    async setRetention({visibleDays}){return serial(async()=>{await requireAuth();active();if(!Number.isInteger(visibleDays)||visibleDays<1||visibleDays>36500)throw new Error('INVALID_RETENTION');return {...await append({action:'retention-changed',visibleDays}),logicalOnly:true,physicalPruneAvailable:false};});},
    async exportRedacted(){const {revisions}=await methods.list({limit:500});return {schemaVersion:1,revisions:revisions.map(({label,...row})=>row),omitted:OMITTED};}
  };
  const api={};for(const [name,method]of Object.entries(methods))api[name]=async(...args)=>{try{return await withNativeLock(await lockIdentity(),async held=>{lease=held;try{return {ok:true,...await method(...args)};}finally{lease=undefined;}});}catch(error){return {ok:false,error:{code:/^[A-Z_]+$/.test(error.message)?error.message:'HISTORY_UNAVAILABLE',message:'Local history is unavailable or the request is invalid.'}};}};
  return Object.freeze(api);
}
module.exports={createHistoryService};
