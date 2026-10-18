import React,{useState,useMemo,useCallback,useEffect} from 'react';
import {defaults,validatePreferences,migrateAppearance,validateValue,validateSchedule,effectivePreferences} from './model.mjs';
export type Preferences=Record<string,any>;
export type Revision={id:string;at:string;action:string;keys:string[];preferences:Preferences;schedules:any[]};
export type Notice={id:string;at:string;kind:'info'|'success'|'warning'|'error';message:string;dismissed:boolean};
export type SettingsRecord={schemaVersion:1;preferences:Preferences;schedules:any[];revisions:Revision[];notices:Notice[];section:string;snoozeUntil:number};
const KEY='presentation.v1';
function initial():SettingsRecord {
 const empty:SettingsRecord={schemaVersion:1,preferences:{...defaults},schedules:[],revisions:[],notices:[],section:'language',snoozeUntil:0};
 try{const raw=localStorage.getItem(KEY);if(raw){const data=JSON.parse(raw);if(data.schemaVersion!==1||!Array.isArray(data.schedules)||data.schedules.length>200||!Array.isArray(data.revisions)||!Array.isArray(data.notices))throw Error('Invalid local settings');return {...empty,...data,preferences:validatePreferences(data.preferences),schedules:data.schedules.map(validateSchedule),revisions:data.revisions.filter((r:any)=>r&&typeof r.id==='string'&&typeof r.at==='string'&&r.preferences&&Array.isArray(r.schedules)),notices:data.notices.filter((n:any)=>n&&typeof n.id==='string'&&typeof n.message==='string').slice(-500)};}
 const legacy=JSON.parse(localStorage.getItem('appearance')||'null');empty.preferences=migrateAppearance(legacy);
 }catch{empty.notices=[{id:crypto.randomUUID(),at:new Date().toISOString(),kind:'warning',message:'Saved preferences could not be read. Defaults are active; the original record was not overwritten.',dismissed:false}];}
 return empty;
}
export function useSettings(){
 const [record,setRecord]=useState<SettingsRecord>(initial),[storageError,setStorageError]=useState(''),[now,setNow]=useState(()=>new Date());
 useEffect(()=>{const timer=setInterval(()=>setNow(new Date()),15000);return()=>clearInterval(timer)},[]);
 const persist=useCallback((change:(old:SettingsRecord)=>SettingsRecord)=>{setRecord(old=>{const next=change(old);if(next===old)return old;try{localStorage.setItem(KEY,JSON.stringify(next));setStorageError('');}catch{setStorageError('Local storage could not save this change. The live value is temporary; export it before closing.');}return next;});},[]);
 const transact=useCallback((action:string,preferences:Preferences,schedules:any[]=record.schedules)=>{
 const validated=validatePreferences(preferences),validSchedules=schedules.map(validateSchedule);if(validSchedules.length>200)throw Error('At most 200 local schedules are supported');
 persist(old=>{if(JSON.stringify(old.preferences)===JSON.stringify(validated)&&JSON.stringify(old.schedules)===JSON.stringify(validSchedules))return old;const keys=Object.keys(validated).filter(k=>old.preferences[k]!==validated[k]);const baseline=old.revisions.length?old.revisions:[{id:crypto.randomUUID(),at:new Date().toISOString(),action:'Initial preferences',keys:[],preferences:{...old.preferences},schedules:old.schedules}];return {...old,preferences:validated,schedules:validSchedules,revisions:[...baseline,{id:crypto.randomUUID(),at:new Date().toISOString(),action,keys,preferences:{...validated},schedules:validSchedules}]};});
 },[persist,record.schedules]);
 const update=useCallback((key:string,value:any)=>{validateValue(key,value);transact(`Changed ${key}`,{...record.preferences,[key]:value});},[record.preferences,transact]);
 const notify=useCallback((message:string,kind:Notice['kind']='info')=>persist(old=>({...old,notices:[...old.notices,{id:crypto.randomUUID(),at:new Date().toISOString(),kind,message:message.slice(0,1000),dismissed:false}].slice(-500)})),[persist]);
 const effective=useMemo(()=>effectivePreferences(record.preferences,record.schedules,now),[record.preferences,record.schedules,now]);
 return {record,preferences:effective.preferences,activeSchedules:effective.active,storageError,update,transact,notify,persist,reset:(key:string)=>update(key,(defaults as Preferences)[key]),selectSection:(section:string)=>persist(old=>({...old,section})),dismiss:(ids:string[])=>persist(old=>({...old,notices:old.notices.map(n=>ids.includes(n.id)?{...n,dismissed:true}:n)}))};
}
export type SettingsController=ReturnType<typeof useSettings>;
