import test from 'node:test';
import assert from 'node:assert/strict';
import {migrateSchoolData, childKey, uniqueChildren, validateEnrollment, validateSessionRoster, coachStudents, finalizeSession, promoStats, reconcilePromoStudent, removeSessionFromState, attendancePercent, presentIds, archiveStudent, canSelectStudentForSession} from '../src/crmLogic.js';
const coaches=[{id:'bmx-coach',discipline:'bmx',branches:['roza']},{id:'roller-coach',discipline:'rollers',branches:['roza']},{id:'other-roller',discipline:'rollers',branches:['roza']}];
const ivan={id:'ivan-bmx',childId:'ivan',name:'Иван',age:9,discipline:'bmx',coachId:'bmx-coach',branchId:'roza',status:'active',origin:'promo'};
const roller={...ivan,id:'ivan-rollers',discipline:'rollers',coachId:'roller-coach'};
const trial={id:'p1',studentIds:[ivan.id],type:'promo',discipline:'bmx',coachId:'bmx-coach',branchId:'roza',status:'upcoming',date:'2026-10-09'};
const outcome=(mark,result)=>finalizeSession(trial,{note:'Проверка',attendance:{[ivan.id]:mark},promoResults:{[ivan.id]:result}});
test('One physical child, two working records, two direction counts, one unique child',()=>{
 const records=[ivan,roller]; assert.equal(records.length,2);assert.equal(uniqueChildren(records),1);
 assert.equal(uniqueChildren(records.filter(s=>s.discipline==='bmx')),1);assert.equal(uniqueChildren(records.filter(s=>s.discipline==='rollers')),1);
});
test('Equal names do not join identities in legacy migration',()=>{
 const next=migrateSchoolData([{...ivan,childId:undefined},{...roller,childId:undefined}],[],coaches);
 assert.equal(uniqueChildren(next.students),2);assert.equal(childKey(next.students[0]),ivan.id);
});
test('Explicitly linked new second direction is accepted',()=>assert.doesNotThrow(()=>validateEnrollment([ivan],roller)));
test('Duplicate direction is blocked even with different coach, branch or archived enrollment',()=>{
 assert.throws(()=>validateEnrollment([archiveStudent(ivan,'2026-10-09')],{...ivan,id:'second',coachId:'different',branchId:'other'}),/уже есть/);
 assert.doesNotThrow(()=>validateEnrollment([ivan],ivan,ivan.id));
});
test('Legacy direction splits preserve factual roster, marks, coach and payroll headcount',()=>{
 const old={...ivan,childId:undefined,extraDisciplines:['rollers','bmx','rollers'],extraCoachIds:['roller-coach'],attendance:99};
 const oldSession={...trial,discipline:'rollers',coachId:'roller-coach',status:'done',attendance:{[ivan.id]:'absent'},promoResults:{[ivan.id]:'not_bought'}};
 const input=JSON.stringify({old,oldSession});const next=migrateSchoolData([old],[oldSession],coaches);
 assert.equal(next.students.length,2);assert.equal(uniqueChildren(next.students),1);
 const row=next.students.find(s=>s.discipline==='rollers');assert.equal(row.coachId,'roller-coach');assert.equal(row.attendance,null);
 assert.equal(row.extraCoachIds,undefined);assert.equal(row.extraDisciplines,undefined);assert.deepEqual(row.legacyAssignments.extraCoachIds,['roller-coach']);
 assert.deepEqual(next.sessions[0].studentIds,[row.id]);assert.equal(next.sessions[0].attendance[row.id],'absent');assert.equal(next.sessions[0].promoResults[row.id],'not_bought');
 assert.equal(next.sessions[0].coachId,oldSession.coachId);assert.equal(presentIds(next.sessions[0]).length,presentIds(oldSession).length);assert.equal(JSON.stringify({old,oldSession}),input);
});
test('Ambiguous legacy coach remains unassigned and needs explicit review',()=>{
 const next=migrateSchoolData([{...ivan,extraDisciplines:['rollers'],extraCoachIds:['roller-coach','other-roller']}],[],coaches);
 assert.equal(next.students[1].coachId,null);assert.equal(next.students[1].legacyReview,true);assert.equal(next.migrationIssues.length,2);
});
test('Missing secondary coach never inherits a coach from an unrelated direction',()=>{
 const next=migrateSchoolData([{...ivan,extraDisciplines:['rollers']}],[],coaches);
 assert.equal(next.students[1].coachId,null);assert.equal(canSelectStudentForSession(next.students[1],{coachId:'bmx-coach',discipline:'rollers',branchId:'roza'}),false);
});
test('Legacy historical direction not in extras is retained as a working record',()=>{
 const next=migrateSchoolData([ivan],[{...trial,discipline:'rollers',coachId:'roller-coach'}],coaches);
 assert.equal(next.students.length,2);assert.ok(next.students.some(s=>s.id===next.sessions[0].studentIds[0] && s.discipline==='rollers'));
});
test('Migration is idempotent and does not duplicate records or marks',()=>{
 const once=migrateSchoolData([{...ivan,extraDisciplines:['rollers'],extraCoachIds:['roller-coach']}],[trial],coaches);
 const twice=migrateSchoolData(once.students,once.sessions,coaches);
 assert.deepEqual(twice.students,once.students);assert.deepEqual(twice.sessions,once.sessions);
});
test('Derived legacy enrollment IDs cannot collide with an existing record ID',()=>{
 const colliding={...roller,id:ivan.id+'::rollers',childId:'different'};
 const next=migrateSchoolData([{...ivan,extraDisciplines:['rollers']},colliding],[],coaches);
 assert.equal(new Set(next.students.map(s=>s.id)).size,3);
});
test('Trial can be scheduled once in each different direction',()=>{
 assert.doesNotThrow(()=>validateSessionRoster(trial,[ivan,roller],[]));
 assert.doesNotThrow(()=>validateSessionRoster({...trial,id:'p2',discipline:'rollers',coachId:'roller-coach',studentIds:[roller.id]},[ivan,roller],[trial]));
});
test('Second trial is blocked while first is planned, finished or missed',()=>{
 for(const status of ['upcoming','done','missed']) assert.throws(()=>validateSessionRoster({...trial,id:'p2'},[ivan],[{...trial,status}]),/Повторное/);
});
test('Trial restriction survives coach transfer and alternate enrollment ID of same child',()=>{
 const transferred={...ivan,id:'transferred',coachId:'new-coach'};
 assert.throws(()=>validateSessionRoster({...trial,id:'p2',coachId:'new-coach',studentIds:['transferred']},[ivan,transferred],[trial]),/Повторное/);
});
test('Editing the same planned trial is allowed',()=>assert.doesNotThrow(()=>validateSessionRoster({...trial,time:'18:00'},[ivan],[trial])));
test('Deleted trial releases the direction restriction per confirmed rule',()=>{
 const next=removeSessionFromState({students:[ivan],sessions:[trial]},trial.id);
 assert.doesNotThrow(()=>validateSessionRoster({...trial,id:'p2'},next.students,next.sessions));
});
test('First training of a pending promo enrollment must be labeled promo',()=>assert.throws(()=>validateSessionRoster({...trial,type:'group'},[ivan],[]),/должно быть промо/));
test('A regular record can attend ordinary sessions without invented promo history',()=>assert.doesNotThrow(()=>validateSessionRoster({...trial,type:'group'},[{...ivan,origin:'regular'}],[])));
test('A different child with identical name can have their own trial',()=>assert.doesNotThrow(()=>validateSessionRoster({...trial,id:'p2',studentIds:['other']},[ivan,{...ivan,id:'other',childId:'other'}],[trial])));
test('Foreign direction, mentor, branch and duplicate child roster are rejected',()=>{
 for(const patch of [{discipline:'rollers'},{coachId:'roller-coach'},{branchId:'other'}]) assert.throws(()=>validateSessionRoster({...trial,...patch},[ivan],[]),/Состав/);
 assert.throws(()=>validateSessionRoster({...trial,studentIds:[ivan.id,'copy']},[ivan,{...ivan,id:'copy'}],[]),/дважды/);
});
test('Bought activates vacation or inactive enrollment; not bought makes it inactive',()=>{
 for(const status of ['vacation','left','active']) {
 assert.equal(reconcilePromoStudent({...ivan,status},outcome('present','bought'),[]).status,'active');
 assert.equal(reconcilePromoStudent({...ivan,status},outcome('present','not_bought'),[]).status,'left');
 }
});
test('Explicit purchase decision for an absent participant still contributes to conversion',()=>{
 assert.deepEqual(outcome('absent',undefined).promoResults,{});
 const s=outcome('absent','bought');assert.equal(s.status,'missed');assert.equal(promoStats([s]).conversion,100);
 assert.equal(promoStats([s]).attended,0);assert.equal(promoStats([s]).absent,1);assert.equal(presentIds(s).length,0);
 assert.equal(reconcilePromoStudent(ivan,s,[]).status,'active');
});
test('Deleting automatic promo restores pre-promo status and origin',()=>{
 const initial={...ivan,status:'vacation'}; const s=outcome('present','not_bought');
 const row=reconcilePromoStudent(initial,s,[]);assert.equal(row.status,'left');
 const next=removeSessionFromState({students:[row],sessions:[s]},s.id);assert.equal(next.students[0].status,'vacation');assert.equal(next.students[0].origin,'promo');
});
test('Changing purchase result updates status once without losing original rollback state',()=>{
 const bought=outcome('present','bought');const row=reconcilePromoStudent({...ivan,status:'vacation'},bought,[]);
 const notBought=outcome('present','not_bought');const corrected=reconcilePromoStudent(row,notBought,[bought]);
 assert.equal(corrected.status,'left');assert.equal(corrected.promoPriorState.status,'vacation');
 assert.equal(removeSessionFromState({students:[corrected],sessions:[notBought]},trial.id).students[0].status,'vacation');
});
test('Each coach has their own roster, attendance and promo metrics',()=>{
 const own=outcome('present','bought');const other={...own,id:'other',coachId:'roller-coach',discipline:'rollers',studentIds:[roller.id],attendance:{[roller.id]:'absent'},promoResults:{[roller.id]:'not_bought'}};
 const sessions=[own,other]; const a=coachStudents([ivan,roller],sessions,'bmx-coach'),b=coachStudents([ivan,roller],sessions,'roller-coach');
 assert.equal(a.length,1);assert.equal(b.length,1);assert.equal(a[0].attendance,100);assert.equal(b[0].attendance,0);
 assert.equal(promoStats(sessions.filter(s=>s.coachId==='bmx-coach')).bought,1);assert.equal(promoStats(sessions.filter(s=>s.coachId==='roller-coach')).bought,0);
});
test('Transfer does not assign another coach historical attendance to the new coach',()=>{
 const old=outcome('present','bought');const moved={...ivan,coachId:'new-coach',attendance:null};
 assert.equal(coachStudents([moved],[old],'new-coach')[0].attendance,null);assert.equal(attendancePercent(ivan.id,[old]),100);
});
test('Archiving a direction keeps both history and the child link',()=>{
 const s=outcome('present','bought');const archived=archiveStudent(ivan,'2026-10-09');
 assert.equal(childKey(archived),childKey(roller));assert.equal(uniqueChildren([archived,roller]),1);assert.equal(promoStats([s]).bought,1);
});

test('Explicit owner linkage of pre-existing different-direction records preserves history IDs',async()=>{
 const {updateEnrollment}=await import('../src/crmLogic.js');
 const separate={...roller,childId:'different-child'};
 const rows=updateEnrollment([ivan,separate],separate.id,{...separate,childId:ivan.childId,name:'Иван',age:9});
 assert.equal(uniqueChildren(rows),1);assert.equal(rows[1].id,separate.id);
 assert.throws(()=>updateEnrollment([ivan,separate],separate.id,{...separate,childId:ivan.childId,discipline:'bmx'}),/другого направления/);
});
test('Shared identity correction updates linked names/age but preserves mentor-specific skill and status',async()=>{
 const {updateEnrollment}=await import('../src/crmLogic.js');
 const rows=updateEnrollment([ivan,{...roller,status:'left',level:'Средний'}],ivan.id,{...ivan,name:'Иван Иванов',age:10});
 assert.equal(rows[1].name,'Иван Иванов');assert.equal(rows[1].age,10);assert.equal(rows[1].status,'left');assert.equal(rows[1].level,'Средний');
});
test('A legacy aggregate attendance value is not inherited by a new coach',()=>{
 const [row]=migrateSchoolData([{...ivan,attendance:90}],[],coaches).students;
 assert.equal(coachStudents([{...row,coachId:'new-coach'}],[],'new-coach')[0].attendance,null);
 assert.equal(coachStudents([row],[],'bmx-coach')[0].attendance,90);
});

test('Deleting old promo preserves a later manual vacation status',async()=>{
 const {patchEnrollment}=await import('../src/crmLogic.js');
 const session=outcome('present','bought');
 const bought=reconcilePromoStudent(ivan,session,[]);
 const manual=patchEnrollment(bought,{status:'vacation'});
 const next=removeSessionFromState({students:[manual],sessions:[session]},session.id).students[0];
 assert.equal(next.status,'vacation');assert.equal(next.origin,'promo');
});

test('Legacy automatic conversion provenance follows the actual secondary-direction trial',()=>{
 const old={...ivan,extraDisciplines:['rollers'],extraCoachIds:['roller-coach'],origin:'regular',promoConversionSessionId:'secondary-trial'};
 const session={...outcome('present','bought'),id:'secondary-trial',discipline:'rollers',coachId:'roller-coach'};
 const migrated=migrateSchoolData([old],[session],coaches);
 const primary=migrated.students.find(s=>s.discipline==='bmx'),secondary=migrated.students.find(s=>s.discipline==='rollers');
 assert.equal(primary.promoConversionSessionId,null);assert.equal(secondary.promoConversionSessionId,session.id);
 const removed=removeSessionFromState(migrated,session.id);
 assert.equal(removed.students.find(s=>s.id===secondary.id).origin,'promo');
 assert.equal(removed.students.find(s=>s.id===primary.id).origin,'regular');
});
