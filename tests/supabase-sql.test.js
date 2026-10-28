import {test,before,after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {database,reset,asUser,uid,actors,staff,student,session,snapshot,expected,mutate} from './helpers/database.js';
import {fromSnapshot} from '../src/storage/model.js';
import {sessionEarning,calcCoachSalary,promoStats,uniqueBranchChildren,directionAttendanceStats} from '../src/crmLogic.js';
let db;
before(async()=>{db=await database();});after(async()=>{await db.close();});beforeEach(()=>reset(db));
const read=()=>snapshot(db,actors.owner);
const command=async(name,payload,user=actors.owner,versions)=>mutate(db,user,name,payload,versions || expected(await snapshot(db,user)));
const close=async(id,marks,results={},note='TEST training comment')=>command('session_close',{id,note,attendance:marks,promo_results:results});
const row=async(id)=>(await read()).students.find(s=>s.id===id);

test('Student creation retains CRM 2.2.3 active/promo defaults, independently of SQL table regular default',async()=>{
  const sid=await student(db);const r=await row(sid);
  assert.equal(r.origin,'promo');assert.equal(r.status,'active');assert.equal(r.promo_conversion_session_id,null);
  assert.equal(r.left_date,null);assert.deepEqual(r.status_history,[]);
});
test('Student form fields and phone round-trip; omitted phone preserves old contact and explicit empty clears it',async()=>{
  const payload={id:uid(201),child_id:uid(501),name:'TEST Form',age:12,discipline:'rollers',coach_id:staff.coach,branch_id:'roza',
    level:'Средний',phone:'TEST CONTACT A',join_date:'2026-09-10',comments:[{id:uid(801),date:'2026-10-17',text:'TEST first'}]};
  await command('student_create',payload);
  let raw=await read(),r=raw.students[0];
  for(const key of ['id','child_id','name','age','discipline','coach_id','branch_id','level','phone','join_date'])assert.equal(r[key],payload[key],key);
  assert.equal(raw.comments[0].text,'TEST first');
  const edit={...payload,name:'TEST Edited',age:13,level:'Продвинутый',phone:'TEST CONTACT B',comments:[{id:uid(802),date:'2026-10-16',text:'TEST edited'}]};
  await command('student_update',edit);r=await row(payload.id);
  for(const key of ['name','age','level','phone'])assert.equal(r[key],edit[key],key);
  assert.equal((await read()).comments[0].text,'TEST edited');
  const {phone,...withoutPhone}=edit;
  await command('student_update',withoutPhone);assert.equal((await row(payload.id)).phone,'TEST CONTACT B');
  await assert.rejects(command('student_update',{...edit,phone:'TEST ROLLBACK',comments:[{text:' '}]}),/Пустой комментарий/);
  assert.equal((await row(payload.id)).phone,'TEST CONTACT B');
  await command('student_update',{...edit,phone:''});assert.equal((await row(payload.id)).phone,'');
  await command('student_update',{...edit,phone:null});assert.equal((await row(payload.id)).phone,null);
  assert.equal((await row(payload.id)).join_date,'2026-09-10');
});
test('Coach cannot modify an unassigned legacy student through NULL permission comparison',async()=>{
  const sid=await student(db);await db.query('update public.students set coach_id=null where id=$1',[sid]);
  const versions=expected(await read());
  assert.deepEqual((await snapshot(db,actors.coach)).students,[]);
  await assert.rejects(mutate(db,actors.coach,'student_patch',{id:sid,status:'left'},versions),/Нет прав/);
  await assert.rejects(mutate(db,actors.coach,'student_archive',{id:sid},versions),/Нет прав/);
  assert.equal((await row(sid)).status,'active');assert.equal((await row(sid)).archived_at,null);
  await command('student_patch',{id:sid,status:'vacation'});assert.equal((await row(sid)).status,'vacation');
});
test('Absent promo matrix preserves unknown decisions and explicit outcomes, with zero regular/PRO payroll',async()=>{
  for(const grade of ['regular','pro'])for(const result of [null,'bought','not_bought']){
    await reset(db);await db.query('update public.coaches set grade=$1 where id=$2',[grade,staff.coach]);
    const sid=await student(db);await command('student_patch',{id:sid,status:'vacation'});
    const xid=await session(db,[sid]);await close(xid,{[sid]:'absent'},result?{[sid]:result}:{});
    const raw=await read(),r=raw.students[0],state=fromSnapshot(raw,actors.owner),x=state.school.sessions[0];
    assert.equal(raw.participants[0].present,false);assert.equal(raw.participants[0].promo_result,result);
    assert.equal(r.status,result==='bought'?'active':result==='not_bought'?'left':'vacation');
    assert.equal(r.origin,result==='bought'?'regular':'promo');
    assert.equal(r.left_date,result==='not_bought'?'2026-10-17':null);
    assert.equal(r.promo_conversion_session_id,result?xid:null);
    assert.equal(sessionEarning(state.coaches.find(c=>c.id===staff.coach),x),0);
    assert.equal(promoStats([x]).conversion,result==='bought'?100:result==='not_bought'?0:null);
    assert.equal(x.status,'missed');
  }
});

test('Migration preserves the original seven public tables, both branches and external unique indexes',async()=>{
  const tables=(await db.query("select tablename from pg_tables where schemaname='public'")).rows.map(r=>r.tablename).sort();
  assert.deepEqual(tables,['branches','coaches','managers','session_students','sessions','student_comments','students']);
  assert.equal((await db.query('select count(*)::int n from public.branches')).rows[0].n,2);
  const indexes=(await db.query("select indexname from pg_indexes where indexname in ('students_external_uidx','sessions_external_uidx')")).rows;
  assert.equal(indexes.length,2);
  assert.equal((await db.query("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity")).rows[0].n,7);
});
test('Two directions share child_id, keep independent mentors, and count once per branch',async()=>{
  await student(db);await student(db,{id:uid(202),child:uid(501),direction:'rollers'});
  const state=fromSnapshot(await read(),actors.owner);
  assert.equal(state.school.students.length,2);assert.equal(uniqueBranchChildren(state.school.students,'roza'),1);
  assert.equal(state.school.students[0].childId,state.school.students[1].childId);
  await assert.rejects(student(db,{id:uid(203)}),/crm_one_direction/);
});
test('Distinct children with equal names are never automatically merged',async()=>{
  await student(db);await student(db,{id:uid(202),child:uid(502)});
  await db.query('update public.students set name=$1',['TEST Same Name']);
  assert.equal(uniqueBranchChildren(fromSnapshot(await read(),actors.owner).school.students,'roza'),2);
});
test('Coach assignment accepts configured multiple directions and rejects unsupported branches/directions',async()=>{
  await student(db,{direction:'rollers'});
  await assert.rejects(student(db,{id:uid(202),child:uid(502),direction:'skate'}),/не назначен/);
  await assert.rejects(student(db,{id:uid(202),child:uid(502),branch:'irkutsk'}),/не назначен/);
});
test('A present promo requires purchase outcome and every closure requires comment, atomically',async()=>{
  const sid=await student(db),xid=await session(db,[sid]);
  await assert.rejects(close(xid,{[sid]:'present'}),/Купил/);
  await assert.rejects(close(xid,{[sid]:'present'},{[sid]:'bought'},'  '),/Заметка обязательна/);
  const raw=await read();assert.equal(raw.sessions[0].status,'upcoming');assert.equal(raw.participants[0].present,null);assert.equal(raw.students[0].status,'active');
});
test('Bought promo changes only its directional enrollment, records provenance/history, and earns 500',async()=>{
  const sid=await student(db);await student(db,{id:uid(202),child:uid(501),direction:'rollers'});
  const xid=await session(db,[sid]);await close(xid,{[sid]:'present'},{[sid]:'bought'});
  const raw=await read(),s=raw.students.find(s=>s.id===sid),other=raw.students.find(s=>s.id!==sid);
  assert.equal(s.status,'active');assert.equal(s.origin,'regular');assert.equal(s.promo_conversion_session_id,xid);assert.equal(s.status_history[0].action,'promo_result');
  assert.equal(other.origin,'promo');assert.equal(other.promo_conversion_session_id,null);
  const state=fromSnapshot(raw,actors.owner);assert.equal(sessionEarning(state.coaches.find(c=>c.id===staff.coach),state.school.sessions[0]),500);
});
test('Absent undecided promo preserves vacation, records unknown, pays zero, and is excluded from conversion',async()=>{
  const sid=await student(db);await command('student_patch',{id:sid,status:'vacation'});
  const xid=await session(db,[sid]);await close(xid,{[sid]:'absent'});
  const raw=await read();assert.equal(raw.students[0].status,'vacation');assert.equal(raw.students[0].promo_conversion_session_id,null);assert.equal(raw.participants[0].promo_result,null);
  const state=fromSnapshot(raw,actors.owner),x=state.school.sessions[0];assert.equal(x.status,'missed');assert.deepEqual(x.promoResults,{});
  assert.equal(promoStats([x]).conversion,null);assert.equal(sessionEarning(state.coaches[0],x),0);
  await assert.rejects(session(db,[sid],{id:uid(302)}),/Повторное промо/);
});
test('Mixed promo uses each present participant outcome and never pays an absent purchase',async()=>{
  const a=await student(db),b=await student(db,{id:uid(202),child:uid(502)}),c=await student(db,{id:uid(203),child:uid(503)});
  const xid=await session(db,[a,b,c]);await close(xid,{[a]:'present',[b]:'present',[c]:'absent'},{[a]:'bought',[b]:'not_bought',[c]:'bought'});
  const state=fromSnapshot(await read(),actors.owner);assert.equal(sessionEarning(state.coaches.find(c=>c.id===staff.coach),state.school.sessions[0]),800);
  await db.query("update public.coaches set grade='pro' where id=$1",[staff.coach]);
  const pro=fromSnapshot(await read(),actors.owner);assert.equal(sessionEarning(pro.coaches.find(c=>c.id===staff.coach),pro.school.sessions[0]),900);
});
test('Promo date correction moves automatic inactive date and retains manual status',async()=>{
  const sid=await student(db),xid=await session(db,[sid]);await close(xid,{[sid]:'present'},{[sid]:'not_bought'});
  let raw=await read();let x=raw.sessions[0];
  await command('session_update',{...x,id:xid,date:'2026-09-15',student_ids:[sid]});
  assert.equal((await row(sid)).left_date,'2026-09-15');
  await command('student_patch',{id:sid,status:'left',left_date:'2026-09-15'});
  raw=await read();x=raw.sessions[0];await command('session_update',{...x,id:xid,date:'2026-08-15',student_ids:[sid]});
  assert.equal((await row(sid)).left_date,'2026-09-15');
  assert.ok((await row(sid)).status_history.some(e=>e.action==='promo_reschedule'));
});
test('Deleting an upcoming promo frees the one-trial limit without rewriting the student state',async()=>{
  const sid=await student(db);await command('student_patch',{id:sid,status:'vacation'});
  const xid=await session(db,[sid]);
  await command('session_delete',{id:xid});const r=await row(sid);
  assert.equal(r.status,'vacation');assert.equal(r.promo_conversion_session_id,null);assert.equal(r.promo_prior_state,null);
  await session(db,[sid],{id:uid(302)});
});
test('New history protection rejects deleting a completed promo atomically and preserves manual status',async()=>{
  const sid=await student(db),xid=await session(db,[sid]);await close(xid,{[sid]:'present'},{[sid]:'not_bought'});
  await command('student_patch',{id:sid,status:'vacation'});
  await assert.rejects(command('session_delete',{id:xid}),/историю/);
  assert.equal((await row(sid)).status,'vacation');assert.equal((await row(sid)).promo_conversion_session_id,xid);
  assert.equal((await read()).sessions.length,1);assert.equal((await read()).participants[0].promo_result,'not_bought');
});
test('Archiving preserves attendance/payroll/history, excludes unique counters, and can be restored',async()=>{
  const sid=await student(db),xid=await session(db,[sid]);await close(xid,{[sid]:'present'},{[sid]:'bought'});
  await command('student_archive',{id:sid,archived_at:'2026-10-17'});
  let state=fromSnapshot(await read(),actors.owner);assert.equal(uniqueBranchChildren(state.school.students,'roza'),0);assert.equal(state.school.sessions[0].studentIds.length,1);
  assert.equal(sessionEarning(state.coaches.find(c=>c.id===staff.coach),state.school.sessions[0]),500);
  await command('student_patch',{id:sid,archived_at:null});assert.equal((await row(sid)).archived_at,null);
});
test('Quick student comments persist through server storage and do not fake promo decisions',async()=>{
  const sid=await student(db);
  await command('student_patch',{id:sid,comments:[{id:uid(801),date:'2026-10-17',text:'TEST private comment'}]});
  assert.equal((await read()).comments[0].text,'TEST private comment');assert.equal((await row(sid)).origin,'promo');
  await command('student_patch',{id:sid,comments:[]});assert.equal((await read()).comments.length,0);
});
test('A stale revision cannot overwrite a newer edit or purchase result',async()=>{
  const sid=await student(db);const versions=expected(await read());
  await command('student_patch',{id:sid,status:'vacation'});
  await assert.rejects(command('student_patch',{id:sid,status:'left'},actors.owner,versions),/другим сотрудником/);
  assert.equal((await row(sid)).status,'vacation');
});
test('A changed participant rejects a stale promo close without partial roster/status changes',async()=>{
  const sid=await student(db),xid=await session(db,[sid]);const versions=expected(await read());
  await command('student_patch',{id:sid,status:'vacation'});
  await assert.rejects(command('session_close',{id:xid,note:'TEST comment',attendance:{[sid]:'present'},promo_results:{[sid]:'bought'}},actors.owner,versions),/другим сотрудником/);
  const raw=await read();assert.equal(raw.sessions[0].status,'upcoming');assert.equal(raw.participants[0].present,null);assert.equal(raw.students[0].status,'vacation');
});
test('Failed batch/comment writes roll back the entire transaction',async()=>{
  const sid=await student(db);await command('student_patch',{id:sid,origin:'regular'});
  const x={id:uid(301),type:'group',discipline:'bmx',coach_id:staff.coach,branch_id:'roza',date:'2026-10-17',time:'16:00',duration:60,group_name:'TEST batch',student_ids:[sid]};
  await assert.rejects(command('sessions_create',{sessions:[x,{...x,id:uid(302),branch_id:'missing'}]}));assert.equal((await read()).sessions.length,0);
  await assert.rejects(command('student_create',{id:uid(202),child_id:uid(502),name:'TEST rollback',age:10,discipline:'bmx',coach_id:staff.coach,branch_id:'roza',comments:[{text:' '}]}));
  assert.equal((await read()).students.length,1);
});
test('Invalid or duplicate roster, wrong coach, and first non-promo session are rejected server-side',async()=>{
  const sid=await student(db);
  await assert.rejects(session(db,[sid,sid]),/дважды/);await assert.rejects(session(db,[sid],{coach:staff.other,branch:'irkutsk'}),/Состав/);
  await assert.rejects(session(db,[sid],{type:'group'}),/должно быть промо/);
  await assert.rejects(command('session_create',{id:uid(301),coach_id:staff.coach,branch_id:'roza',discipline:'bmx'}),/Выберите учеников/);
});
test('Closed session roster, coach, branch and direction cannot be rewritten',async()=>{
  const sid=await student(db),xid=await session(db,[sid]);await close(xid,{[sid]:'present'},{[sid]:'bought'});
  const x=(await read()).sessions[0];await assert.rejects(command('session_update',{...x,student_ids:[sid],coach_id:staff.other}),/зафиксированы/);
});
test('RLS isolates coach data; same-branch foreign students cannot be read or changed',async()=>{
  const own=await student(db);const other=await student(db,{id:uid(202),child:uid(502),coach:staff.other,branch:'irkutsk',direction:'rollers'});
  // Add a colleague in the SAME branch to test the original overly broad policy regression.
  await db.query("update public.coaches set branches='{roza,irkutsk}' where id=$1",[staff.other]);
  await student(db,{id:uid(203),child:uid(503),coach:staff.other,branch:'roza',direction:'rollers'});
  const raw=await snapshot(db,actors.coach);assert.deepEqual(raw.students.map(s=>s.id),[own]);assert.equal(raw.coaches.length,1);
  await assert.rejects(command('student_patch',{id:other,status:'left'},actors.coach,expected(await read())),/Нет прав/);
  await assert.rejects(mutate(db,actors.coach,'coach_create',{}),/владельцу/);
});
test('Admin only sees permitted schedule/attendance projection, never purchases, contacts, comments or salary grade',async()=>{
  const own=await student(db);await command('student_patch',{id:own,comments:[{id:uid(801),date:'2026-10-17',text:'TEST PRIVATE'}]});
  const foreign=await student(db,{id:uid(202),child:uid(502),coach:staff.other,branch:'irkutsk',direction:'rollers'});
  const xid=await session(db,[own]);await session(db,[foreign],{id:uid(302),coach:staff.other,branch:'irkutsk',direction:'rollers'});
  await close(xid,{[own]:'present'},{[own]:'bought'});
  const raw=await snapshot(db,actors.admin);assert.equal(raw.sessions.length,1);assert.equal(raw.students.length,1);assert.equal(raw.participants[0].present,true);
  assert.deepEqual(Object.keys(raw.students[0]).sort(),['branch_id','discipline','id','name']);
  assert.equal(raw.sessions[0].note,undefined);assert.equal(raw.participants[0].promo_result,undefined);assert.equal(raw.coaches[0].grade,undefined);assert.deepEqual(raw.comments,[]);
  await asUser(db,actors.admin,async tx=>{assert.equal((await tx.query('select id from public.students')).rows.length,0);assert.equal((await tx.query('select id from public.sessions')).rows.length,0);});
  await assert.rejects(mutate(db,actors.admin,'student_archive',{id:own}),/только просмотр/);
});
test('Direct writes and private mutators are forbidden even for owner JWT; anon and unassigned accounts fail closed',async()=>{
  const sid=await student(db);
  for(const user of [actors.owner,actors.coach,actors.admin]){
    await assert.rejects(asUser(db,user,tx=>tx.query("update public.students set status='left' where id=$1",[sid])),/permission denied/);
    await assert.rejects(asUser(db,user,tx=>tx.query('delete from public.students where id=$1',[sid])),/permission denied/);
    await assert.rejects(asUser(db,user,tx=>tx.query("select crm_private.checked_row('students',$1,'{}')",[sid])),/permission denied/);
  }
  await assert.rejects(snapshot(db,actors.unassigned),/однозначная роль/);
  await assert.rejects(asUser(db,null,tx=>tx.query('select public.crm_snapshot()'),'anon'),/permission denied/);
});
test('A future Auth signup with a matching email does not acquire an unlinked staff role',async()=>{
  await command('coach_create',{id:uid(105),name:'TEST Unlinked',email:'unlinked@example.invalid',discipline:'bmx',disciplines:['bmx'],grade:'regular',branches:['roza'],exp:''});
  await db.query("insert into auth.users(id,email) values($1,'unlinked@example.invalid')",[uid(9)]);
  assert.equal((await db.query('select user_id from public.coaches where id=$1',[uid(105)])).rows[0].user_id,null);
  await assert.rejects(snapshot(db,uid(9)),/однозначная роль/);
});
test('Unknown old marks map to unknown; legacy whole-map absence preserves the existing payroll fallback',async()=>{
  const sid=await student(db),xid=await session(db,[sid]);
  await db.query("update public.sessions set status='done',attendance_recorded=false where id=$1",[xid]);
  let state=fromSnapshot(await read(),actors.owner);assert.equal(state.school.sessions[0].attendance,undefined);assert.equal(sessionEarning(state.coaches.find(c=>c.id===staff.coach),state.school.sessions[0]),300);
  await db.query('update public.sessions set attendance_recorded=true where id=$1',[xid]);
  state=fromSnapshot(await read(),actors.owner);assert.equal(state.school.sessions[0].attendance[sid],null);assert.equal(sessionEarning(state.coaches.find(c=>c.id===staff.coach),state.school.sessions[0]),0);
});
test('Stored 16/23 attendance still classifies strictly below 70 after SQL round trip',async()=>{
  const sid=await student(db);await command('student_patch',{id:sid,origin:'regular'});
  for(let i=0;i<23;i++){
    const xid=await session(db,[sid],{id:uid(310+i),type:'group'});await close(xid,{[sid]:i<16?'present':'absent'});
  }
  const state=fromSnapshot(await read(),actors.owner);const stats=directionAttendanceStats(state.school.students,state.school.sessions,'roza','bmx');
  assert.ok(stats.percent<70);assert.equal(stats.requiresAttention,true);
});
test('Historical roster stays available after transfer without access to the current private card/comments',async()=>{
  const sid=await student(db),xid=await session(db,[sid]);await close(xid,{[sid]:'present'},{[sid]:'bought'});
  const original=await row(sid);
  await command('student_update',{id:sid,child_id:original.child_id,name:original.name,age:original.age,
    discipline:'bmx',coach_id:staff.other,branch_id:'irkutsk',level:'Начальный',comments:[{id:uid(801),date:'2026-10-17',text:'TEST new mentor private'}]});
  await db.query("update public.students set phone='TEST PRIVATE CONTACT' where id=$1",[sid]);
  await asUser(db,actors.coach,async tx=>{assert.equal((await tx.query('select id from public.students')).rows.length,0);assert.equal((await tx.query('select id from public.student_comments')).rows.length,0);});
  const history=await snapshot(db,actors.coach);assert.equal(history.students.length,1);assert.equal(history.students[0].phone,undefined);assert.deepEqual(history.comments,[]);
  const state=fromSnapshot(history,actors.coach);assert.equal(state.school.sessions[0].studentIds[0],sid);assert.equal(sessionEarning(state.coaches[0],state.school.sessions[0]),500);
});
test('Group/sport, individual, PRO and monthly reports retain existing rates after database round trip',async()=>{
  const a=await student(db),b=await student(db,{id:uid(202),child:uid(502)});
  for(const id of [a,b])await command('student_patch',{id,origin:'regular'});
  const g=await session(db,[a,b],{type:'group'});await close(g,{[a]:'present',[b]:'absent'});
  const sport=await session(db,[a,b],{type:'sport_group',id:uid(302)});await close(sport,{[a]:'present',[b]:'present'});
  const ind=await session(db,[a],{type:'individual',id:uid(303)});await close(ind,{[a]:'present'});
  const missed=await session(db,[a],{type:'individual',id:uid(304)});await close(missed,{[a]:'absent'});
  let state=fromSnapshot(await read(),actors.owner),coach=state.coaches.find(c=>c.id===staff.coach);
  assert.equal(calcCoachSalary(coach,state.school.sessions.filter(s=>s.date.startsWith('2026-10'))).total,750);
  assert.equal(calcCoachSalary(coach,state.school.sessions.filter(s=>s.date.startsWith('2026-09'))).total,0);
  await db.query("update public.coaches set grade='pro' where id=$1",[staff.coach]);state=fromSnapshot(await read(),actors.owner);coach=state.coaches.find(c=>c.id===staff.coach);
  assert.equal(calcCoachSalary(coach,state.school.sessions).total,850);
});
test('A legacy present promo with no result earns the base rate; clarification replaces it with 500 without inventing a refusal',async()=>{
  const sid=await student(db),xid=await session(db,[sid]);
  await db.query("update public.sessions set status='done',attendance_recorded=true,note='TEST legacy' where id=$1",[xid]);
  await db.query('update public.session_students set present=true where session_id=$1',[xid]);
  let state=fromSnapshot(await read(),actors.owner);assert.equal(sessionEarning(state.coaches.find(c=>c.id===staff.coach),state.school.sessions[0]),300);assert.deepEqual(state.school.sessions[0].promoResults,{});
  await db.query("update public.coaches set grade='pro' where id=$1",[staff.coach]);state=fromSnapshot(await read(),actors.owner);assert.equal(sessionEarning(state.coaches.find(c=>c.id===staff.coach),state.school.sessions[0]),400);
  await close(xid,{[sid]:'present'},{[sid]:'bought'});state=fromSnapshot(await read(),actors.owner);assert.equal(sessionEarning(state.coaches.find(c=>c.id===staff.coach),state.school.sessions[0]),500);
});
test('Unknown legacy manual marker retains the original rescheduling rules',async()=>{
  const sid=await student(db),xid=await session(db,[sid]);await close(xid,{[sid]:'present'},{[sid]:'not_bought'});
  await db.query('update public.students set promo_status_manual=null,promo_prior_state=null where id=$1',[sid]);
  let x=(await read()).sessions[0];await command('session_update',{...x,student_ids:[sid],date:'2026-09-01'});assert.equal((await row(sid)).left_date,'2026-09-01');
  await db.query("update public.students set promo_status_manual=null,promo_prior_state=$2 where id=$1",[sid,JSON.stringify({origin:'promo',status:'left',leftDate:'2026-09-01'})]);
  x=(await read()).sessions[0];await command('session_update',{...x,student_ids:[sid],date:'2026-08-01'});assert.equal((await row(sid)).left_date,'2026-09-01');
});
