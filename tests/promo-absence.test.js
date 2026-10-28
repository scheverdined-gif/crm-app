import test from 'node:test';
import assert from 'node:assert/strict';
import {finalizeSession, promoStats, reconcilePromoStudent, validateSessionRoster, presentIds} from '../src/crmLogic.js';
const student={id:'a',childId:'child-a',name:'Промо',discipline:'bmx',coachId:'c1',branchId:'roza',origin:'promo',status:'vacation'};
const trial={id:'trial',type:'promo',status:'upcoming',date:'2026-10-09',discipline:'bmx',coachId:'c1',branchId:'roza',studentIds:['a']};
const close=(mark,result)=>finalizeSession(trial,{note:'Комментарий',attendance:{a:mark},promoResults:result === undefined ? {} : {a:result}});
test('Absent promo without result closes and stores no invented purchase decision',()=>{
 const s=close('absent');assert.equal(s.status,'missed');assert.deepEqual(s.promoResults,{});
 assert.equal(Object.hasOwn(s.promoResults,'a'),false);assert.deepEqual(JSON.parse(JSON.stringify(s)).promoResults,{});
 assert.deepEqual(presentIds(s),[]);
});
test('Absent promo without result preserves every student status and promo origin',()=>{
 const session=close('absent');
 for(const status of ['active','left','vacation']) for(const origin of ['promo','regular']) {
  const before={...student,status,origin};assert.equal(reconcilePromoStudent(before,session,[]),before);
 }
});
test('All absent promos without decisions have undefined conversion, zero sales and refusals',()=>{
 assert.deepEqual(promoStats([close('absent')]),{sessions:1,attended:0,bought:0,notBought:0,absent:1,unknown:1,conversion:null});
});
test('Absent undecided participants do not dilute a successful sale',()=>{
 const bought=close('present','bought'),absent={...close('absent'),id:'absent'};
 const stats=promoStats([bought,absent]);assert.equal(stats.conversion,100);assert.equal(stats.bought,1);assert.equal(stats.notBought,0);assert.equal(stats.unknown,1);
});
test('Absent undecided participants neither add a sale nor a refusal to mixed outcomes',()=>{
 const stats=promoStats([close('present','bought'),{...close('present','not_bought'),id:'refusal'},{...close('absent'),id:'absent'}]);
 assert.equal(stats.conversion,50);assert.equal(stats.bought,1);assert.equal(stats.notBought,1);assert.equal(stats.absent,1);
});
test('Present promo still requires an explicit valid purchase result',()=>{
 for(const result of [undefined,null,'','unknown']) assert.throws(()=>close('present',result),/присутствовавшего/);
 assert.equal(reconcilePromoStudent(student,close('present','bought'),[]).status,'active');
 assert.equal(reconcilePromoStudent(student,close('present','not_bought'),[]).status,'left');
});
test('Mixed promo requires decisions only from present participants',()=>{
 const mixed={...trial,studentIds:['a','b']};
 const s=finalizeSession(mixed,{note:'Комментарий',attendance:{a:'present',b:'absent'},promoResults:{a:'not_bought'}});
 assert.equal(s.status,'done');assert.deepEqual(s.promoResults,{a:'not_bought'});
 assert.equal(promoStats([s]).conversion,0);
 assert.throws(()=>finalizeSession(mixed,{note:'Комментарий',attendance:{a:'present',b:'absent'},promoResults:{b:'bought'}}),/Купил/);
});
test('Absent result stays optional, while an explicitly entered result retains existing behavior',()=>{
 for(const result of ['bought','not_bought']) {
  const s=close('absent',result),stats=promoStats([s]);assert.equal(s.promoResults.a,result);
  assert.equal(stats.conversion,result==='bought'?100:0);assert.equal(reconcilePromoStudent(student,s,[]).status,result==='bought'?'active':'left');
 }
});
test('Clearing a result on an absent promo restores its pre-conversion state',()=>{
 const bought=close('present','bought'),converted=reconcilePromoStudent(student,bought,[]);
 const absent=close('absent');const restored=reconcilePromoStudent(converted,absent,[bought]);
 assert.equal(restored.status,'vacation');assert.equal(restored.origin,'promo');assert.equal(restored.promoConversionSessionId,null);
});
test('Blank or invalid absent result is normalized to undefined, never not_bought',()=>{
 for(const result of [null,'','unknown']) assert.deepEqual(close('absent',result).promoResults,{});
});
test('Comments remain mandatory for present, absent and ordinary trainings',()=>{
 for(const type of ['promo','group','individual','sport_group']) for(const mark of ['present','absent']) assert.throws(()=>finalizeSession({...trial,type},{note:'  ',attendance:{a:mark},promoResults:{a:'bought'}}),/Заметка/);
});
test('Absent undecided promo still consumes the existing one-trial-per-direction limit',()=>{
 const absent=close('absent');assert.throws(()=>validateSessionRoster({...trial,id:'second'},[student],[absent]),/Повторное/);
 assert.doesNotThrow(()=>validateSessionRoster(absent,[student],[absent]));
});
