import test from 'node:test';
import assert from 'node:assert/strict';
import {directionsOf, presentIds, attendancePercent, finalizeSession, promoStats, matchesStudent, weekStats, canAccessSession, canEditSession, needsAttention, reconcilePromoStudent, formatAttendance, archiveStudent, isArchived, attendanceSelection, removeSessionFromState, repairMissingPromoSources, canSelectStudentForSession, averageSessionAttendance} from '../src/crmLogic.js';
const group = {id:'g',studentIds:['a','b','c'],type:'group',status:'upcoming',date:'2026-10-08',branchId:'roza',coachId:'c1'};
const promo = {...group,type:'promo'};
const payload = {note:'Провели занятие',attendance:{a:'present',b:'present',c:'absent'},promoResults:{a:'bought',b:'not_bought',c:'bought'}};
test('Working record exposes exactly one direction', () => assert.deepEqual(directionsOf({discipline:'bmx',extraDisciplines:['skate','bmx','skate']}),['bmx']));
test('Removed secondary direction cannot leak into current filters', () => assert.equal(matchesStudent({name:'Анна',age:8,level:'Начальный',status:'active',discipline:'rollers',extraDisciplines:['balance']},{direction:'balance',age:'8',level:'Начальный',status:'active',query:' анна '}),false));
test('Status and skill filters do not admit mismatches', () => assert.equal(matchesStudent({name:'Анна',age:8,level:'Средний',status:'vacation',discipline:'rollers'},{level:'Начальный',status:'active'}),false));
test('Promo origin does not depend on active status', () => assert.ok(matchesStudent({name:'Анна',origin:'promo',status:'left',discipline:'bmx'},{status:'promo'})));
test('Closing promo rejects missing purchase results', () => assert.throws(() => finalizeSession(promo,{...payload,promoResults:{a:'bought'}}), /Купил/));
test('Closing promo requires attendance for every student', () => assert.throws(() => finalizeSession(promo,{...payload,attendance:{a:'present'}}), /посещение/));
test('Explicit result is preserved for an absent participant', () => {const s=finalizeSession(promo,payload);assert.deepEqual(s.promoResults,{a:'bought',b:'not_bought',c:'bought'});assert.deepEqual(presentIds(s),['a','b']);});
test('An entirely absent promo closes without invented purchase outcomes', () => {const s=finalizeSession(promo,{note:'Никто не пришёл',attendance:{a:'absent',b:'absent',c:'absent'}});assert.equal(s.status,'missed');assert.deepEqual(s.promoResults,{});});
test('Regular group does not require promo results', () => assert.equal(finalizeSession(group,{...payload,promoResults:undefined}).status,'done'));
test('Trainer note remains required', () => assert.throws(()=>finalizeSession(group,{...payload,note:'  '}),/Заметка/));
test('Monthly promo totals count outcomes, absent and unknown separately', () => {const s=finalizeSession(promo,payload);assert.deepEqual(promoStats([s,{...promo,id:'legacy',studentIds:['x'],status:'done'}]),{sessions:2,attended:2,bought:2,notBought:1,unknown:1,absent:1,conversion:50});});
test('Replacing result does not double count conversion', () => {const s=finalizeSession(promo,{...payload,promoResults:{a:'not_bought',b:'not_bought',c:'not_bought'}});assert.equal(promoStats([s]).bought,0);assert.equal(promoStats([s]).notBought,3);});
test('Student attendance excludes upcoming and legacy unknown records', () => {const sessions=[finalizeSession(group,payload),{...finalizeSession(group,payload),id:'two',attendance:{a:'absent'}},group,{...group,id:'legacy',status:'done'}];assert.equal(attendancePercent('a',sessions),50);assert.equal(attendancePercent('missing',sessions),null);});
test('Legacy payroll keeps old behavior but missed sessions pay zero', () => {assert.deepEqual(presentIds({...group,status:'done'}),['a','b','c']);assert.deepEqual(presentIds({...group,status:'missed'}),[]);});
test('Attendance 69 requires attention; exactly 70 does not', () => {assert.equal(needsAttention({attendance:69,status:'active'}),true);assert.equal(needsAttention({attendance:70,status:'active'}),false);assert.equal(needsAttention({attendance:69,status:'left'}),false);assert.equal(needsAttention({attendance:90,flag:'injury'}),true);});
test('Administrator can read own branch, never write sessions', () => {const user={kind:'manager',record:{role:'branch_manager',branches:['roza']}};assert.ok(canAccessSession(user,group));assert.equal(canEditSession(user,group),false);assert.equal(canAccessSession(user,{...group,branchId:'irkutsk'}),false);});
test('Coach cannot write another coach or inaccessible branch', () => {const user={kind:'coach',record:{id:'c1',branches:['roza']}};assert.ok(canEditSession(user,group));assert.equal(canEditSession(user,{...group,coachId:'c2'}),false);assert.equal(canEditSession(user,{...group,branchId:'irkutsk'}),false);assert.equal(canEditSession(user,undefined),false);});
test('Owner keeps full access in authorized branches', () => assert.ok(canEditSession({kind:'manager',record:{role:'owner',branches:['roza','irkutsk']}},{...group,branchId:'irkutsk'})));
test('Weekly counts include only dates in the selected calendar week', () => {const rows=weekStats([group,{...group,date:'2026-10-04'},{...group,date:'2026-10-12'},{...group,date:'2026-10-05'}],'2026-10-08');assert.equal(rows.reduce((a,r)=>a+r.count,0),2);assert.equal(rows[0].count,1);assert.equal(rows[3].count,1);});
test('Purchase correction restores pending promo without losing past outcomes', () => {
  const bought=finalizeSession(promo,payload);
  const student=reconcilePromoStudent({id:'a',origin:'promo'},bought,[]);
  assert.equal(student.origin,'regular');
  const corrected=finalizeSession(promo,{...payload,promoResults:{a:'not_bought',b:'not_bought',c:'not_bought'}});
  assert.equal(reconcilePromoStudent(student,corrected,[bought]).status,'left');
  assert.equal(reconcilePromoStudent(student,corrected,[{...bought,id:'other'}]).origin,'promo');
});
test('Confirmed promo purchase activates a regular student as well', () => {
  const student={id:'a',origin:'regular'};
  assert.equal(reconcilePromoStudent(student,finalizeSession(promo,payload),[]).status,'active');
});

test('16 of 23 visits stays below 70 before display rounding; 7 of 10 is exactly 70', () => {
  const sessions=Array.from({length:23},(_,i)=>({...group,id:String(i),status:'done',attendance:{a:i<16?'present':'absent'}}));
  const value=attendancePercent('a',sessions);
  assert.ok(value<70);
  assert.equal(formatAttendance(value),'69,6%');
  assert.equal(needsAttention({status:'active',attendance:value}),true);
  const exact=Array.from({length:10},(_,i)=>({...group,id:String(i),status:'done',attendance:{a:i<7?'present':'absent'}}));
  assert.equal(attendancePercent('a',exact),70);
  assert.equal(needsAttention({status:'active',attendance:attendancePercent('a',exact)}),false);
});

test('A value just below the threshold never displays a misleading 70 percent', () => {
  assert.equal(formatAttendance(69.99),'<70%');
  assert.equal(needsAttention({attendance:69.99,status:'active'}),true);
  assert.equal(formatAttendance(70),'70%');
});

test('Unknown old marks stay unknown both for coach and administrator', () => {
  for (const status of ['done','missed']) for (const readOnly of [true,false]) {
    assert.equal(attendanceSelection({...group,status},'a',readOnly),null);
  }
  assert.equal(attendanceSelection({...group,status:'done',attendance:{a:'absent'}},'a',true),false);
  assert.equal(attendanceSelection({...group,status:'done',attendance:{a:'present'}},'a',true),true);
  assert.equal(attendanceSelection(group,'a',true),null);
  assert.equal(attendanceSelection(group,'a',false),true);
});

test('Saving a note on an old unknown session cannot silently invent absence', () => {
  assert.throws(()=>finalizeSession({...group,status:'done'},{note:'Комментарий',attendance:{a:null,b:'present',c:'absent'}}),/посещение/);
});

test('Deleting the only purchased promo restores only its automatic conversion', () => {
  const bought=finalizeSession(promo,payload);
  const automatic=reconcilePromoStudent({id:'a',origin:'promo'},bought,[]);
  const manual={id:'b',origin:'regular'};
  const next=removeSessionFromState({students:[automatic,manual],sessions:[bought]},bought.id);
  assert.equal(next.sessions.length,0);
  assert.equal(next.students[0].origin,'promo');
  assert.equal(next.students[0].promoConversionSessionId,null);
  assert.deepEqual(next.students[1],manual);
  assert.equal(promoStats(next.sessions).bought,0);
});

test('Deleting one purchase preserves another confirmed purchase without changing visit counting', () => {
  const bought=finalizeSession(promo,payload);
  const other={...bought,id:'other'};
  const student=reconcilePromoStudent({id:'a',origin:'promo'},bought,[]);
  const next=removeSessionFromState({students:[student],sessions:[bought,other]},bought.id);
  assert.equal(next.students[0].origin,'regular');
  assert.equal(next.students[0].promoConversionSessionId,'other');
  assert.equal(promoStats(next.sessions).bought,2);
});

test('An upcoming or foreign-roster result cannot sustain an automatic conversion', () => {
  const bought=finalizeSession(promo,payload);
  const student=reconcilePromoStudent({id:'a',origin:'promo'},bought,[]);
  const invalid=[{...bought,id:'future',status:'upcoming'},{...bought,id:'foreign',studentIds:['b']}];
  const next=removeSessionFromState({students:[student],sessions:[bought,...invalid]},bought.id);
  assert.equal(next.students[0].origin,'promo');
});

test('Deleting ordinary or missing sessions does not change student origin', () => {
  const students=[{id:'a',origin:'regular',promoConversionSessionId:'other'}];
  assert.equal(removeSessionFromState({students,sessions:[group]},'g').students,students);
  assert.equal(removeSessionFromState({students,sessions:[group]},'missing').students,students);
});

test('Existing orphan automatic sources repair without rewriting manual conversions', () => {
  const students=[{id:'a',origin:'regular',promoConversionSessionId:'deleted'},{id:'b',origin:'regular'}];
  const repaired=repairMissingPromoSources(students,[]);
  assert.equal(repaired[0].origin,'promo');
  assert.equal(repaired[0].promoConversionSessionId,null);
  assert.equal(repaired[1],students[1]);
  assert.equal(repairMissingPromoSources(repaired,[]),repaired);
  const bought=finalizeSession(promo,payload);
  assert.equal(repairMissingPromoSources(students,[bought])[0].promoConversionSessionId,'g');
});

test('Archiving preserves student dates, status, assignments, attendance and promo history', () => {
  const student={id:'a',name:'Архивный ученик',discipline:'bmx',extraDisciplines:['rollers'],coachId:'c1',extraCoachIds:['c3'],status:'active',origin:'regular',joinDate:'2025-01-01'};
  const sessions=[finalizeSession(promo,payload),{...group,id:'legacy',status:'done'}];
  const before=JSON.stringify(sessions);
  const metrics={promo:promoStats(sessions),payroll:presentIds(sessions[0]),attendance:attendancePercent('a',sessions)};
  const archived=archiveStudent(student,'2026-10-08');
  assert.equal(isArchived(archived),true);
  assert.deepEqual({...archived,archivedAt:undefined},{...student,archivedAt:undefined});
  assert.equal(matchesStudent(archived),false);
  assert.equal(matchesStudent(archived,{status:'archived'}),true);
  assert.equal(needsAttention({...archived,attendance:10}),false);
  assert.equal(JSON.stringify(sessions),before);
  assert.deepEqual({promo:promoStats(sessions),payroll:presentIds(sessions[0]),attendance:attendancePercent('a',sessions)},metrics);
  assert.equal(matchesStudent({...archived,archivedAt:null}),true);
});

test('Archived students cannot enter new training pools but stay in existing rosters', () => {
  const student=archiveStudent({id:'a',coachId:'c1',branchId:'roza',discipline:'bmx',status:'active'},'2026-10-08');
  const target={coachId:'c1',branchId:'roza',discipline:'bmx'};
  assert.equal(canSelectStudentForSession(student,target),false);
  assert.equal(canSelectStudentForSession(student,{...target,studentIds:['a']}),true);
  assert.equal(canSelectStudentForSession({...student,archivedAt:null},target),true);
});

test('Secondary coaches cannot share a working record', () => {
  const student={id:'a',coachId:'c1',extraCoachIds:['c3'],discipline:'bmx',extraDisciplines:['rollers'],branchId:'roza',status:'active'};
  assert.equal(canSelectStudentForSession(student,{coachId:'c3',discipline:'rollers',branchId:'roza'}),false);
  assert.equal(canSelectStudentForSession(student,{coachId:'c3',discipline:'rollers',branchId:'irkutsk'}),false);
  assert.equal(canSelectStudentForSession({...student,extraCoachIds:[]},{coachId:'c3',discipline:'rollers',branchId:'roza'}),false);
});

test('Historical monthly average uses recorded participants, including archived or departed people', () => {
  const sessions=[{...group,status:'done',attendance:{a:'present',b:'absent'}},{...group,id:'second',status:'done',attendance:{a:'absent',b:'absent'}},{...group,id:'future',attendance:{c:'present'}}];
  assert.equal(averageSessionAttendance(sessions),25);
  assert.equal(averageSessionAttendance([{...group,status:'done'}]),null);
  assert.equal(averageSessionAttendance([]),null);
});
