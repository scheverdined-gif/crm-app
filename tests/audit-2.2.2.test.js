import test from 'node:test';
import assert from 'node:assert/strict';
import {uniqueBranchChildren, directionAttendanceStats, updateSessionInState, reconcilePromoStudent, patchEnrollment, promoStats, formatAttendance, removeSessionFromState} from '../src/crmLogic.js';

const pupil={id:'ivan-bmx',childId:'ivan',name:'Иван',discipline:'bmx',coachId:'c1',branchId:'roza',status:'active',origin:'promo',joinDate:'2026-09-01'};
const otherDirection={...pupil,id:'ivan-rollers',discipline:'rollers',coachId:'c3'};
const promo={id:'promo',studentIds:[pupil.id],type:'promo',discipline:'bmx',coachId:'c1',branchId:'roza',date:'2026-09-30',status:'done',note:'Не купил',attendance:{[pupil.id]:'present'},promoResults:{[pupil.id]:'not_bought'}};
const auto=()=>reconcilePromoStudent(pupil,promo,[]);
const state=(student=auto())=>({schemaVersion:2,students:[student,otherDirection],sessions:[promo]});
const move=(s,date='2026-10-01')=>updateSessionInState(s,promo.id,{date});
const outflow=(students,month)=>students.filter(s=>s.status==='left' && s.leftDate?.slice(0,7)===month).length;

test('Branch comparison counts one child across directions, not enrollment rows',()=>{
 assert.equal(uniqueBranchChildren([pupil,otherDirection], 'roza'),1);
});
test('Branch comparison excludes archived-only children and keeps active/archived identities once',()=>{
 const rows=[{...pupil,archivedAt:'2026-10-01'},otherDirection,{...pupil,id:'archived-only',childId:'archived',archivedAt:'2026-10-01'}];
 assert.equal(uniqueBranchChildren(rows,'roza'),1);
 assert.equal(uniqueBranchChildren(rows.slice(0,1),'roza'),0);
});
test('Branch identity is scoped per branch; equal names and inactive records keep their identities',()=>{
 const rows=[pupil,otherDirection,{...pupil,id:'second-child',childId:'different',status:'left'},{...pupil,id:'other-branch',branchId:'irkutsk'},{...pupil,id:'legacy',childId:undefined}];
 assert.equal(uniqueBranchChildren(rows,'roza'),3);assert.equal(uniqueBranchChildren(rows,'irkutsk'),1);assert.equal(uniqueBranchChildren(rows,'missing'),0);
});
test('Rescheduling a declined promo moves the automatic left date and monthly outflow atomically',()=>{
 const before=state(),snapshot=JSON.stringify(before),next=move(before);
 assert.equal(next.sessions[0].date,'2026-10-01');assert.equal(next.students[0].leftDate,'2026-10-01');
 assert.equal(next.students[0].status,'left');assert.equal(next.students[0].promoConversionSessionId,promo.id);
 assert.deepEqual(next.students[0].promoPriorState,before.students[0].promoPriorState);
 assert.equal(outflow(next.students,'2026-09'),0);assert.equal(outflow(next.students,'2026-10'),1);
 assert.equal(promoStats(next.sessions.filter(s=>s.date.startsWith('2026-09'))).notBought,0);
 assert.equal(promoStats(next.sessions.filter(s=>s.date.startsWith('2026-10'))).notBought,1);
 assert.equal(next.students[1],otherDirection);assert.equal(JSON.stringify(before),snapshot);
});
test('Repeated date corrections and note-only edits do not duplicate or reset conversion',()=>{
 const first=move(state()),second=move(first,'2026-11-03');
 assert.equal(second.students[0].leftDate,'2026-11-03');assert.equal(outflow(second.students,'2026-10'),0);
 const note=updateSessionInState(second,promo.id,{note:'Уточнение'});
 assert.equal(note.students,second.students);assert.equal(note.sessions[0].note,'Уточнение');assert.equal(promoStats(note.sessions).notBought,1);
});
test('Date correction preserves manual statuses, including manually confirmed inactive on the original date',()=>{
 for(const patch of [{status:'active'},{status:'vacation'},{status:'left',leftDate:'2026-10-05'},{status:'left',leftDate:promo.date}]) {
  const manual=patchEnrollment(auto(),patch),next=move(state(manual));
  assert.equal(next.students[0],manual);assert.equal(next.sessions[0].date,'2026-10-01');
 }
});
test('Legacy manual inactive date and unrelated source, roster and direction are preserved',()=>{
 for(const patch of [{promoConversionSessionId:'other'},{id:'unrelated'},{origin:'regular'}]) {
  const row={...auto(),...patch};assert.equal(move(state(row)).students[0],row);
 }
 const manual=patchEnrollment(auto(),{status:'left',leftDate:'2026-10-05'});delete manual.promoStatusManual;
 assert.equal(move(state(manual)).students[0],manual);
});
test('Legacy automatic decline without the new manual marker still follows the promo date',()=>{
 const legacy=auto();delete legacy.promoStatusManual;
 assert.equal(move(state(legacy)).students[0].leftDate,'2026-10-01');
});
test('Legacy same-date manual decline is preserved when prior state already records the manual date',()=>{
 const legacy=patchEnrollment(auto(),{status:'left',leftDate:promo.date});delete legacy.promoStatusManual;
 assert.equal(move(state(legacy)).students[0],legacy);
});
test('A legacy stale automatic date left by the 2.2.1 bug repairs on the next reschedule',()=>{
 const legacy=auto();delete legacy.promoStatusManual;
 const before={students:[legacy,otherDirection],sessions:[{...promo,date:'2026-10-01'}]};
 const next=move(before,'2026-11-01');assert.equal(next.students[0].leftDate,'2026-11-01');
 assert.equal(outflow(next.students,'2026-09'),0);assert.equal(outflow(next.students,'2026-11'),1);
});
test('An explicitly automatic decline is rescheduled even if its previous status was already inactive',()=>{
 const inactive={...pupil,status:'left',leftDate:promo.date};
 const converted=reconcilePromoStudent(inactive,promo,[]);
 assert.equal(move(state(converted)).students[0].leftDate,'2026-10-01');
});
test('Bought, undecided absent, upcoming and ordinary trainings cannot create inactive dates',()=>{
 for(const patch of [{promoResults:{[pupil.id]:'bought'}},{promoResults:{},attendance:{[pupil.id]:'absent'},status:'missed'},{status:'upcoming'},{type:'group'}]) {
  const s={...promo,...patch};const row={...auto()};
  assert.equal(move({students:[row],sessions:[s]}).students[0],row);
 }
});
test('Corrected date keeps promo deletion rollback and manual rollback working',()=>{
 const next=move(state());assert.equal(removeSessionFromState(next,promo.id).students[0].status,'active');
 const manual=patchEnrollment(auto(),{status:'vacation'});const adjusted=move(state(manual));
 assert.equal(removeSessionFromState(adjusted,promo.id).students[0].status,'vacation');
});
test('Direction report uses raw 16/23 attendance; 69.56 percent remains below threshold',()=>{
 const sessions=Array.from({length:23},(_,i)=>({...promo,id:String(i),type:'group',attendance:{[pupil.id]:i<16?'present':'absent'}}));
 const stats=directionAttendanceStats([pupil],sessions,'roza','bmx');
 assert.equal(stats.percent,100*16/23);assert.equal(Math.round(stats.percent),70);
 assert.equal(stats.requiresAttention,true);assert.equal(formatAttendance(stats.percent),'69,6%');
});
test('Direction report treats exactly 70 as normal, just below 70 as attention, no records as unknown',()=>{
 for(const [visits,total,attention] of [[7,10,false],[7000,10001,true],[8,10,false]]) {
  const sessions=Array.from({length:total},(_,i)=>({...promo,id:String(i),attendance:{[pupil.id]:i<visits?'present':'absent'}}));
  assert.equal(directionAttendanceStats([pupil],sessions,'roza','bmx').requiresAttention,attention);
 }
 assert.deepEqual(directionAttendanceStats([pupil],[],'roza','bmx'),{percent:null,requiresAttention:false});
});
test('Direction averages preserve per-student weighting, branch/direction scope and unknown legacy marks',()=>{
 const row={...pupil,id:'other'};const sessions=[{...promo,studentIds:[pupil.id,row.id],attendance:{[pupil.id]:'present',[row.id]:'absent'}},{...promo,id:'foreign-branch',branchId:'irkutsk',attendance:{[pupil.id]:'present'}},{...promo,id:'foreign-direction',discipline:'rollers',attendance:{[pupil.id]:'present'}},{...promo,id:'legacy',attendance:undefined},{...promo,id:'planned',status:'upcoming'}];
 assert.deepEqual(directionAttendanceStats([pupil,row,otherDirection],sessions,'roza','bmx'),{percent:50,requiresAttention:true});
});
