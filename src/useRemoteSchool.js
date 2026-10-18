import { useState, useEffect, useRef, useCallback } from 'react';
import { expectedVersions } from './model.js';
const empty = () => ({school:{schemaVersion:2,students:[],sessions:[],migrationIssues:[]},coaches:[],managers:[],user:null});

export function useRemoteSchool(storage) {
  const [state,setState]=useState(empty), [loading,setLoading]=useState(!!storage), [busy,setBusy]=useState(false), [error,setError]=useState('');
  const epoch=useRef(0), alive=useRef(true), writeLock=useRef(false), current=useRef(state), needsRefresh=useRef(false), signedOut=useRef(false);
  current.current=state;
  const refresh=useCallback(async () => {
    if (!storage) return;
    if(signedOut.current){setState(empty());setLoading(false);return;}
    const generation=++epoch.current;
    setLoading(true);setError('');
    try {
      const next=await storage.load();
      if(alive.current && generation===epoch.current){setState(next || empty());needsRefresh.current=false;}
    } catch(e) {
      // Never show old permissions/identity after a failed authorization refresh.
      if(alive.current && generation===epoch.current){setState(empty());setError(e.message);needsRefresh.current=true;}
      throw e;
    } finally {if(alive.current && generation===epoch.current)setLoading(false);}
  },[storage]);
  useEffect(() => {
    alive.current=true;
    if(!storage)return;
    // Keep the auth callback synchronous; SDK requests run after the callback returns.
    let timer;
    const {data:{subscription}}=storage.client.auth.onAuthStateChange((event, session) => {
      if (event==='SIGNED_OUT') {signedOut.current=true;epoch.current++;setState(empty());setError('');setLoading(false);}
      else if (['SIGNED_IN','TOKEN_REFRESHED','USER_UPDATED'].includes(event)) {
        if(session?.user?.id !== current.current.authUserId) {epoch.current++;setState(empty());setLoading(true);}
        clearTimeout(timer);timer=setTimeout(() => refresh().catch(()=>{}),0);
      }
    });
    refresh().catch(()=>{});
    // Small installation: refetch on focus, plus periodic permissions/data refresh.
    // Avoid replacing forms during an in-flight write; version checks guard stale forms.
    const poll=() => {if(!writeLock.current)refresh().catch(()=>{});};
    const interval=setInterval(poll,60000);window.addEventListener('focus',poll);
    return () => {alive.current=false;epoch.current++;clearTimeout(timer);clearInterval(interval);window.removeEventListener('focus',poll);subscription.unsubscribe();};
  },[storage,refresh]);
  const login=async(email,password) => {await storage.login(email,password);signedOut.current=false;await refresh();};
  const logout=async() => {signedOut.current=true;epoch.current++;setState(empty());setError('');await storage.logout();};
  const mutate=async(command,payload) => {
    if(writeLock.current)throw new Error('Дождитесь завершения сохранения');
    if(needsRefresh.current)throw new Error('Сначала обновите данные — предыдущее сохранение не подтверждено');
    writeLock.current=true;setBusy(true);
    try {
      const ack=await storage.mutate(command,payload,current.current);
      try {await refresh();} catch {setError('Сохранено на сервере, но список не обновлён. Обновите данные; не создавайте запись повторно');}
      return ack;
    } catch(e) {needsRefresh.current=true;setError(e.message);throw e;}
    finally {writeLock.current=false;setBusy(false);}
  };
  return {...state,versions:expectedVersions(state),loading,busy,error,refresh,login,logout,mutate};
}
