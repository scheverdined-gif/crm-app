import {readFileSync} from 'node:fs';
export const PROJECT_URL='https://huywyjtskwlddjztpsyl.supabase.co';
export function publicSettings(root){
 const value=JSON.parse(readFileSync(new URL('supabase.public.json',root),'utf8'));
 const keys=['VITE_CRM_STORAGE','VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY'];
 if(Object.keys(value).length!==3 || keys.some(k=>typeof value[k]!=='string'))throw new Error('Проверьте supabase.public.json: нужны только три публичные настройки.');
 if(value.VITE_CRM_STORAGE!=='supabase'||value.VITE_SUPABASE_URL.replace(/\/$/,'')!==PROJECT_URL||!/^sb_publishable_[A-Za-z0-9_-]+$/.test(value.VITE_SUPABASE_PUBLISHABLE_KEY))throw new Error('Комплект должен подключаться к существующему Supabase Extreme Kids. Локальная пустая база запрещена.');
 return value;
}
