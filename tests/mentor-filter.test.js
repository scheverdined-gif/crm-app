import test from 'node:test';
import assert from 'node:assert/strict';
import {matchesStudent, studentFilterCoaches, uniqueChildren} from '../src/crmLogic.js';
const coaches=[{id:'bmx',branches:['roza']},{id:'rollers',branches:['roza']},{id:'other',branches:['irkutsk']},{id:'both',branches:['roza','irkutsk']}];
const owner={kind:'manager',record:{role:'owner',branches:['roza','irkutsk']}};
const students=[
 {id:'ivan-bmx',childId:'ivan',name:'Иван',coachId:'bmx',branchId:'roza',discipline:'bmx',age:10,level:'Начальный',status:'active'},
 {id:'ivan-rollers',childId:'ivan',name:'Иван',coachId:'rollers',branchId:'roza',discipline:'rollers',age:10,level:'Средний',status:'vacation'},
 {id:'other',childId:'different',name:'Иван',coachId:'bmx',branchId:'roza',discipline:'bmx',age:9,level:'Начальный',status:'left'},
 {id:'archived',childId:'archived',name:'Иван',coachId:'bmx',branchId:'roza',discipline:'bmx',age:10,level:'Начальный',status:'active',archivedAt:'2026-10-01'},
];
test('All mentors keeps the prior student scope and unique child/enrollment counts',()=>{
 const rows=students.filter(s=>matchesStudent(s,{coachId:'all'}));
 assert.equal(rows.length,3);assert.equal(uniqueChildren(rows),2);
});
test('Mentor selection matches one primary mentor and combines every existing filter',()=>{
 const filters={coachId:'bmx',query:' иВаН ',direction:'bmx',age:'10',level:'Начальный',status:'active'};
 assert.deepEqual(students.filter(s=>matchesStudent(s,filters)).map(s=>s.id),['ivan-bmx']);
 for(const patch of [{coachId:'rollers'},{direction:'rollers'},{age:'8'},{level:'Продвинутый'},{status:'vacation'},{query:'Другое имя'}])
  assert.equal(students.filter(s=>matchesStudent(s,{...filters,...patch})).length,0);
});
test('Mentor filter retains independent archive/status counts without double-counting children',()=>{
 const scoped=students.filter(s=>matchesStudent(s,{coachId:'bmx',archived:'include'}));
 assert.equal(scoped.filter(s=>matchesStudent(s,{status:'active'})).length,1);
 assert.equal(scoped.filter(s=>matchesStudent(s,{status:'left'})).length,1);
 assert.equal(scoped.filter(s=>matchesStudent(s,{status:'archived'})).length,1);
 assert.equal(uniqueChildren(students.filter(s=>matchesStudent(s,{coachId:'rollers'}))),1);
});
test('Owner mentor options follow the selected branch, including coaches in multiple branches',()=>{
 assert.deepEqual(studentFilterCoaches(coaches,owner).map(c=>c.id),['bmx','rollers','other','both']);
 assert.deepEqual(studentFilterCoaches(coaches,owner,'roza').map(c=>c.id),['bmx','rollers','both']);
 assert.deepEqual(studentFilterCoaches(coaches,owner,'irkutsk').map(c=>c.id),['other','both']);
});
test('Restricted owner mentor options never expose an unauthorized branch',()=>{
 const limited={...owner,record:{...owner.record,branches:['roza']}};
 assert.deepEqual(studentFilterCoaches(coaches,limited).map(c=>c.id),['bmx','rollers','both']);
 assert.deepEqual(studentFilterCoaches(coaches,limited,'irkutsk'),[]);
});
test('Coach can select only self in an authorized branch; administrator gains no student access',()=>{
 const coach={kind:'coach',record:{id:'bmx',branches:['roza']}};
 assert.deepEqual(studentFilterCoaches(coaches,coach,'roza').map(c=>c.id),['bmx']);
 assert.deepEqual(studentFilterCoaches(coaches,coach,'irkutsk'),[]);
 assert.deepEqual(studentFilterCoaches(coaches,{kind:'manager',record:{role:'branch_manager',branches:['roza']}}),[]);
 assert.deepEqual(studentFilterCoaches(coaches,null),[]);
});
