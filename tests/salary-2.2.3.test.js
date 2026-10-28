import test from 'node:test';
import assert from 'node:assert/strict';
import {sessionEarning,calcCoachSalary,promoStats,finalizeSession} from '../src/crmLogic.js';
const regular={id:'coach',grade:'regular'},pro={...regular,grade:'pro'};
const base={id:'s',coachId:'coach',branchId:'roza',date:'2026-10-16',type:'promo',status:'done',studentIds:['a'],attendance:{a:'present'},promoResults:{a:'bought'}};
test('Individual pay remains 300 regular / 400 PRO; Б earns nothing',()=>{
 for(const [coach,expected] of [[regular,300],[pro,400]]) {
  assert.equal(sessionEarning(coach,{...base,type:'individual'}),expected);
  assert.equal(sessionEarning(coach,{...base,type:'individual',attendance:{a:'absent'}}),0);
 }
});
test('Each bought promo attendee earns 500 regardless of coach grade',()=>{
 assert.equal(sessionEarning(regular,base),500);assert.equal(sessionEarning(pro,base),500);
});
test('Each declined promo attendee earns 300 regular / 400 PRO',()=>{
 const declined={...base,promoResults:{a:'not_bought'}};
 assert.equal(sessionEarning(regular,declined),300);assert.equal(sessionEarning(pro,declined),400);
});
test('Mixed promo roster pays per present pupil/outcome and never pays absent purchases',()=>{
 const mixed={...base,studentIds:['a','b','c','d'],attendance:{a:'present',b:'present',c:'absent',d:'present'},promoResults:{a:'bought',b:'not_bought',c:'bought'}};
 assert.equal(sessionEarning(regular,mixed),1100);assert.equal(sessionEarning(pro,mixed),1300);
});
test('Absent promo pays zero for bought, declined and unknown outcomes',()=>{
 for(const status of ['done','missed']) for(const result of ['bought','not_bought',undefined]) for(const coach of [regular,pro])
  assert.equal(sessionEarning(coach,{...base,status,attendance:{a:'absent'},promoResults:{a:result}}),0);
});
test('Old present promo without purchase outcome pays base individual rate without altering data or conversion',()=>{
 const legacy={...base,promoResults:undefined},before=JSON.stringify(legacy),stats=promoStats([legacy]);
 assert.equal(sessionEarning(regular,legacy),300);assert.equal(sessionEarning(pro,legacy),400);
 assert.equal(JSON.stringify(legacy),before);assert.deepEqual(promoStats([legacy]),stats);
 assert.equal(legacy.promoResults,undefined);assert.equal(stats.notBought,0);
});
test('Clarifying old promo as bought replaces base pay with 500, without additive double payment',()=>{
 const old={...base,promoResults:{}};
 const updated=finalizeSession(old,{note:'Купил после уточнения',attendance:old.attendance,promoResults:{a:'bought'}});
 for(const coach of [regular,pro]) {
  assert.equal(calcCoachSalary(coach,[old]).total,coach.grade==='pro'?400:300);
  assert.equal(calcCoachSalary(coach,[updated]).total,500);
 }
});
test('Group, sports group and other non-individual/non-promo types retain 150 per present pupil',()=>{
 for(const type of ['group','sport_group','legacy_other']) for(const coach of [regular,pro]) {
  const group={...base,type,studentIds:['a','b','c'],attendance:{a:'present',b:'absent',c:'present'}};
  assert.equal(sessionEarning(coach,group),300);
 }
});
test('Legacy attendance fallback is preserved; unknown entries in an explicit attendance map are unpaid',()=>{
 assert.equal(sessionEarning(regular,{...base,type:'group',studentIds:['a','b'],attendance:undefined}),300);
 assert.equal(sessionEarning(pro,{...base,attendance:undefined,promoResults:undefined}),400);
 assert.equal(sessionEarning(regular,{...base,studentIds:['a','b'],attendance:{a:'present'}}),500);
});
test('Salary excludes upcoming/missed trainings and other coaches even when attendance marks exist',()=>{
 for(const patch of [{status:'upcoming'},{status:'missed'},{coachId:'other'}]) assert.equal(sessionEarning(regular,{...base,...patch}),0);
 assert.equal(calcCoachSalary(regular,[base,{...base,coachId:'other'},{...base,status:'upcoming'}]).total,500);
});
test('Monthly salary sums groups, individual and mixed promo without mixing coaches/months/branches',()=>{
 const list=[base,{...base,id:'declined',promoResults:{a:'not_bought'}},{...base,id:'individual',type:'individual'},{...base,id:'group',type:'group',studentIds:['a','b'],attendance:{a:'present',b:'present'}},{...base,id:'prior',date:'2026-09-30'},{...base,id:'foreign',coachId:'other'},{...base,id:'other-branch',branchId:'irkutsk'}];
 const scoped=list.filter(s=>s.date.startsWith('2026-10') && s.branchId==='roza');
 assert.deepEqual(calcCoachSalary(regular,scoped),{groupSessions:3,groupEarned:1100,indSessions:1,indEarned:300,total:1400,totalSessions:4});
 assert.equal(calcCoachSalary(pro,scoped).total,1600);
 assert.equal(calcCoachSalary(regular,list.filter(s=>s.date.startsWith('2026-09'))).total,500);
});
test('Missing grade preserves the regular rate and an empty month earns zero',()=>{
 assert.equal(sessionEarning({id:'coach'},{...base,promoResults:{}}),300);
 assert.equal(calcCoachSalary(regular,[]).total,0);
});
