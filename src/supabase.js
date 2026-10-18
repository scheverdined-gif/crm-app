import { createClient } from '@supabase/supabase-js';
import { fromSnapshot, toPayload, expectedVersions } from './model.js';

export function storageConfig(env) {
  if (env.VITE_CRM_STORAGE && !['local','supabase'].includes(env.VITE_CRM_STORAGE)) throw new Error('Неизвестный режим хранения CRM');
  if (env.VITE_CRM_STORAGE !== 'supabase') {
    if(env.VITE_SUPABASE_URL || env.VITE_SUPABASE_PUBLISHABLE_KEY) throw new Error('Для подключения базы задайте VITE_CRM_STORAGE=supabase');
    return {mode:'local'};
  }
  const url=env.VITE_SUPABASE_URL, key=env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Для серверного режима задайте адрес Supabase и публичный ключ');
  if (!/^https:\/\//.test(url) && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url)) throw new Error('Нужен HTTPS-адрес Supabase или локальный тестовый адрес');
  // Legacy JWT keys intentionally unsupported: accept only the unprivileged publishable key.
  if (!key.startsWith('sb_publishable_')) throw new Error('Клиенту нужен публичный ключ sb_publishable_…; секретные ключи запрещены');
  return {mode:'supabase',url,key};
}
export function createSupabaseStorage(config, clientFactory=createClient) {
  const projectUrl = new URL(config.url || 'http://127.0.0.1');
  const storageKey='extreme-kids-supabase-auth:'+projectUrl.host;
  const client=clientFactory(config.url,config.key,{auth:{persistSession:true,storageKey,autoRefreshToken:true,detectSessionInUrl:true}});
  return {
    client,
    async load() {
      const {data:session,error:sessionError}=await client.auth.getSession();
      if(sessionError)throw sessionError;
      if(!session.session)return null;
      const {data:auth,error:authError}=await client.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) return null;
      const {data,error}=await client.rpc('crm_snapshot');
      if (error) throw error;
      return fromSnapshot(data,auth.user.id);
    },
    async login(email,password) {
      const {error}=await client.auth.signInWithPassword({email:email.trim().toLowerCase(),password});
      if (error) throw new Error('Не удалось войти. Проверьте почту, пароль и доступ к Supabase');
    },
    async logout() {
      const {error}=await client.auth.signOut({scope:'local'});
      if(error){globalThis.localStorage?.removeItem(storageKey);client.auth.stopAutoRefresh();throw new Error('Вы вышли на этом устройстве. Supabase недоступен для подтверждения выхода');}
    },
    async mutate(command,payload,state) {
      const {data,error}=await client.rpc('crm_mutate',{p_command:command,p_payload:toPayload(payload),p_expected:payload.__expected || expectedVersions(state)});
      if (error) {
        const e=new Error(error.code==='40001' ? 'Данные изменены другим сотрудником. Проверьте изменения и откройте форму заново' : error.message || 'Сохранение не подтверждено. Обновите данные перед повтором');
        e.code=error.code; throw e;
      }
      if (!data?.ok) throw new Error('Сервер не подтвердил сохранение');
      return data;
    },
  };
}
