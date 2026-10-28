import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {database,reset,student,mutate,snapshot,expected,asUser,actors,staff,uid} from './helpers/database.js';
import {fromSnapshot} from '../src/storage/model.js';
import {calcCoachSalary} from '../src/crmLogic.js';
let db;before(async()=>{db=await database();});after(()=>db.close());beforeEach(()=>reset(db));
const read=()=>snapshot(db,actors.owner);
async function setup(){
  const child=await student(db);await mutate(db,actors.owner,'student_patch',{id:child,origin:'regular'},expected(await read()));
  const sessions=[0,1,2,3].map(i=>({id:uid(301+i),template_id:uid(801),type:'group',discipline:'bmx',coach_id:staff.coach,
    branch_id:'roza',date:`2026-10-${20+i}`,time:'16:00',duration:60,group_name:'TEST Series',student_ids:[child]}));
  await mutate(db,actors.owner,'sessions_create',{sessions});
  return {child,ids:sessions.map(s=>s.id)};
}
async function remove(id,ids,scope='series',user=actors.owner,versions){
  const revision=versions || expected(await read());
  return asUser(db,user,async tx=>(await tx.query('select public.crm_delete_session_scope($1,$2) data',
    [JSON.stringify({id,scope,session_ids:ids}),JSON.stringify(revision)])).rows[0].data);
}
test('Whole series is one transaction, preserving closed history/payroll and an identically named unrelated series',async()=>{
  const {child,ids}=await setup();
  await mutate(db,actors.owner,'session_close',{id:ids[0],note:'TEST done',attendance:{[child]:'present'}},expected(await read()));
  await db.query(`insert into public.sessions(id,type,discipline,coach_id,branch_id,date,time,group_name,template_id)
    values($1,'group','bmx',$2,'roza','2026-10-24','16:00','TEST Series',$3)`,[uid(401),staff.coach,uid(802)]);
  await remove(ids[0],ids.slice(1));
  const state=fromSnapshot(await read(),actors.owner);assert.deepEqual(state.school.sessions.map(s=>s.id).sort(),[ids[0],uid(401)].sort());
  assert.equal(calcCoachSalary(state.coaches.find(c=>c.id===staff.coach),state.school.sessions).total,150);
  assert.equal(state.school.sessions.find(s=>s.id===ids[0]).attendance[child],'present');
});
test('Following is inclusive and single deletion leaves other series members unchanged',async()=>{
  const {ids}=await setup();await remove(ids[2],ids.slice(2),'following');
  assert.deepEqual((await read()).sessions.map(s=>s.id).sort(),ids.slice(0,2));
  await remove(ids[0],[ids[0]],'single');assert.deepEqual((await read()).sessions.map(s=>s.id),[ids[1]]);
});
test('Admin, foreign coach and anonymous cannot use deletion RPC; own coach can delete its series',async()=>{
  const {ids}=await setup();for(const user of [actors.admin,actors.other])await assert.rejects(remove(ids[0],ids,'series',user),/просмотр|Нет прав/);
  await assert.rejects(asUser(db,null,tx=>tx.query("select public.crm_delete_session_scope('{}','{}')"),'anon'),/permission denied/);
  await remove(ids[0],ids,'series',actors.coach);assert.equal((await read()).sessions.length,0);
});
test('Changed membership or stale revisions roll back the entire deletion',async()=>{
  const {ids,child}=await setup(),old=expected(await read());await db.query("update public.sessions set note='TEST changed' where id=$1",[ids[2]]);
  await assert.rejects(remove(ids[0],ids,'series',actors.owner,old),/изменены/);assert.equal((await read()).sessions.length,4);
  await assert.rejects(remove(ids[0],ids.slice(1)),/Состав серии/);assert.equal((await read()).sessions.length,4);
  await assert.rejects(remove(ids[0],[...ids,ids[0]]),/Состав серии/);assert.equal((await read()).sessions.length,4);
  await mutate(db,actors.owner,'session_create',{id:uid(450),template_id:uid(801),type:'group',discipline:'bmx',coach_id:staff.coach,
    branch_id:'roza',date:'2026-10-24',time:'16:00',duration:60,group_name:'TEST inserted after confirmation',student_ids:[child]});
  await assert.rejects(remove(ids[0],ids),/Состав серии/);assert.equal((await read()).sessions.length,5);
});
test('Completing a session after confirmation prevents any deletion, and old delete API cannot erase history',async()=>{
  const {child,ids}=await setup(),old=expected(await read());
  await mutate(db,actors.owner,'session_close',{id:ids[2],note:'TEST completed concurrently',attendance:{[child]:'absent'}},expected(await read()));
  await assert.rejects(remove(ids[0],ids,'series',actors.owner,old),/Состав серии/);
  await assert.rejects(mutate(db,actors.owner,'session_delete',{id:ids[2]},expected(await read())),/историю/);
  assert.equal((await read()).sessions.length,4);assert.equal((await read()).sessions.find(s=>s.id===ids[2]).status,'missed');
});
test('Unknown old attendance and explicit promo outcomes are protected even on a malformed upcoming session',async()=>{
  const {ids}=await setup();await db.query('update public.session_students set present=false where session_id=$1',[ids[1]]);
  await db.query('update public.sessions set attendance_recorded=true where id=$1',[ids[2]]);
  await db.query("update public.session_students set promo_result='bought' where session_id=$1",[ids[3]]);
  await remove(ids[0],[ids[0]]);assert.equal((await read()).sessions.length,3);
  for(const id of ids.slice(1))await assert.rejects(db.query('delete from public.sessions where id=$1',[id]),/историю/);
});
