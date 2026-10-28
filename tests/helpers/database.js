import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
export const uid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export const actors={owner:uid(1),coach:uid(2),other:uid(3),admin:uid(4),unassigned:uid(5)};
export const staff={owner:uid(101),coach:uid(102),other:uid(103),admin:uid(104)};
const sql = path => readFile(new URL('../../'+path,import.meta.url),'utf8');
export async function baseDatabase() {
  const db=new PGlite();
  // PostgreSQL engine only. auth.uid() is a test stub, not Supabase JWT verification.
  await db.exec(`create role anon; create role authenticated;
    create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as
      $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  // gen_random_uuid is built into PostgreSQL. PGlite doesn't ship the optional pgcrypto extension.
  await db.exec((await sql('tests/fixtures/legacy-schema/01_schema.sql')).replace('create extension if not exists pgcrypto;',''));
  await db.exec(await sql('tests/fixtures/legacy-schema/02_import_helpers.sql'));
  return db;
}
export async function applyMigrations(db) {
  await db.exec(await sql('tests/fixtures/legacy-schema/2026101701_model_access.sql'));
  await db.exec(await sql('tests/fixtures/legacy-schema/2026101702_atomic_commands.sql'));
  await db.exec(await sql('supabase/migrations/2026102801_safe_series_delete.sql'));
}
export async function database() {
  const db=await baseDatabase();
  await applyMigrations(db);
  await db.query(`insert into auth.users(id,email,email_confirmed_at) select x, 'test-'||x||'@example.invalid',now() from unnest($1::uuid[]) x`,[Object.values(actors)]);
  await reset(db);
  return db;
}
export async function reset(db) {
  await db.exec('truncate public.students,public.sessions,public.session_students,public.student_comments,public.coaches,public.managers cascade');
  await db.query(`insert into public.managers(id,user_id,name,email,role,branches) values
    ($1,$2,'TEST Owner','owner@example.invalid','owner','{roza,irkutsk}'),
    ($3,$4,'TEST Administrator','admin@example.invalid','branch_manager','{roza}')`,[staff.owner,actors.owner,staff.admin,actors.admin]);
  await db.query(`insert into public.coaches(id,user_id,name,email,discipline,disciplines,grade,branches) values
    ($1,$2,'TEST Coach','coach@example.invalid','bmx','{bmx,rollers}','regular','{roza}'),
    ($3,$4,'TEST Other Coach','other@example.invalid','rollers','{rollers,bmx}','pro','{irkutsk}')`,[staff.coach,actors.coach,staff.other,actors.other]);
}
export async function asUser(db,user,fn,role='authenticated') {
  return db.transaction(async tx=>{
    await tx.exec('set local role '+role);
    await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user || '']);
    return fn(tx);
  });
}
export const snapshot=(db,user)=>asUser(db,user,async tx=>(await tx.query('select public.crm_snapshot() as data')).rows[0].data);
export const expected = raw => Object.fromEntries(['students','sessions','coaches','managers'].map(k=>[k,Object.fromEntries(raw[k].map(r=>[r.id,r.revision]))]));
export async function mutate(db,user,command,payload,versions) {
  return asUser(db,user,async tx=>(await tx.query('select public.crm_mutate($1,$2::jsonb,$3::jsonb) as data',[command,JSON.stringify(payload),JSON.stringify(versions || {})])).rows[0].data);
}
export async function student(db,{id=uid(201),child=uid(501),coach=staff.coach,branch='roza',direction='bmx'}={}) {
  await mutate(db,actors.owner,'student_create',{id,child_id:child,name:'TEST Child '+child.slice(-4),age:10,coach_id:coach,branch_id:branch,discipline:direction,level:'Начальный',join_date:'2026-10-17'});
  return id;
}
export async function session(db,ids,{id=uid(301),coach=staff.coach,branch='roza',direction='bmx',type='promo',date='2026-10-17'}={}) {
  await mutate(db,actors.owner,'session_create',{id,type,coach_id:coach,branch_id:branch,discipline:direction,date,time:'16:00',duration:type==='promo'?45:type==='sport_group'?120:60,group_name:'TEST Session',student_ids:ids,note:''});
  return id;
}
