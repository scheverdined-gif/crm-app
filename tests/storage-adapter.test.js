import {test} from 'node:test';
import assert from 'node:assert/strict';
import {storageConfig,createSupabaseStorage} from '../src/storage/supabase.js';
import {fromSnapshot,toPayload,expectedVersions,coachDirections} from '../src/storage/model.js';
const raw=()=>({students:[],sessions:[],participants:[],comments:[],coaches:[],managers:[{id:'m',user_id:'u',name:'TEST Owner',role:'owner',branches:['roza'],revision:1}]});
test('Server mode fails closed without env; rejects secret/legacy keys and typo modes',()=>{
  assert.deepEqual(storageConfig({}),{mode:'local'});
  for(const env of [{VITE_CRM_STORAGE:'supabase'},{VITE_CRM_STORAGE:'supabase',VITE_SUPABASE_URL:'https://test.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_secret_NOT_REAL'},
    {VITE_CRM_STORAGE:'supabse'},{VITE_SUPABASE_URL:'https://test.supabase.co'}])assert.throws(()=>storageConfig(env));
  assert.equal(storageConfig({VITE_CRM_STORAGE:'supabase',VITE_SUPABASE_URL:'http://127.0.0.1:54321',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_TEST_ONLY'}).mode,'supabase');
});
test('Empty server snapshot remains empty and cannot produce demo users or children',()=>{
  const state=fromSnapshot(raw(),'u');assert.deepEqual(state.school.students,[]);assert.deepEqual(state.school.sessions,[]);assert.equal(state.user.record.password,undefined);
  assert.throws(()=>fromSnapshot({...raw(),students:undefined},'u'),/Неполный/);
  assert.throws(()=>fromSnapshot(raw(),'unknown'),/однозначная роль/);
});
test('NULL manual marker stays missing, while explicit false remains false',()=>{
  const data=raw();data.students=[{id:'s',child_id:'child',promo_status_manual:null},{id:'s2',promo_status_manual:false}];
  const [a,b]=fromSnapshot(data,'u').school.students;
  assert.equal(Object.hasOwn(a,'promoStatusManual'),false);assert.equal(b.promoStatusManual,false);assert.equal(a.joinDate,null);
});
test('Mapping unknown purchase/attendance never invents absence or refusal, and preserves explicit whole-map flag',()=>{
  const data=raw();data.sessions=[{id:'x',attendance_recorded:true},{id:'legacy',attendance_recorded:false}];
  data.participants=[{session_id:'x',student_id:'s',present:null,promo_result:null},{session_id:'x',student_id:'s2',present:false,promo_result:'not_bought'},
    {session_id:'legacy',student_id:'s',present:null,promo_result:null}];
  const [x,legacy]=fromSnapshot(data,'u').school.sessions;
  assert.deepEqual(x.attendance,{s:null,s2:'absent'});assert.deepEqual(x.promoResults,{s2:'not_bought'});assert.equal(Object.hasOwn(legacy,'attendance'),false);
});
test('Outbound adapter strips secrets, derived totals, source history, role spoof fields and revision metadata',()=>{
  const payload=toPayload({id:'s',childId:'c',password:'NO',user_id:'malicious',promoStatusManual:false,statusHistory:[{}],salary:500,__expected:{},
    comments:[{id:'cm',date:'2026-10-17',text:'TEST',password:'NO'}],sessions:[{coachId:'c',promoResults:{s:'bought'},password:'NO'}]});
  assert.deepEqual(payload,{id:'s',child_id:'c',comments:[{id:'cm',date:'2026-10-17',text:'TEST'}],sessions:[{coach_id:'c',promo_results:{s:'bought'}}]});
});
test('Versions include all affected tables; coach directions retain a primary and multiple choices',()=>{
  assert.deepEqual(expectedVersions({school:{students:[{id:'s',revision:3}],sessions:[]},coaches:[{id:'c',revision:2}],managers:[]}),{students:{s:3},sessions:{},coaches:{c:2},managers:{}});
  assert.deepEqual(coachDirections({discipline:'bmx'}),['bmx']);assert.deepEqual(coachDirections({discipline:'bmx',disciplines:['bmx','rollers','bmx']}),['bmx','rollers']);
});
test('Adapter uses Supabase Auth, user verification, atomic RPC and frozen editor revisions',async()=>{
  const calls=[];
  const fake={auth:{getSession:async()=>({data:{session:{}}}),getUser:async()=>({data:{user:{id:'u'}}}),
    signInWithPassword:async p=>{calls.push(p);return {};},signOut:async()=>({})},rpc:async(name,p)=>{calls.push({name,p});return {data:name==='crm_snapshot'?raw():{ok:true}};}};
  const storage=createSupabaseStorage({url:'http://127.0.0.1:1',key:'sb_publishable_TEST_ONLY'},()=>fake);
  await storage.login(' OWNER@EXAMPLE.INVALID ','  actual-password  ');assert.deepEqual(calls[0],{email:'owner@example.invalid',password:'  actual-password  '});
  assert.equal((await storage.load()).user.record.id,'m');
  await storage.mutate('student_patch',{id:'s',status:'vacation',password:'NO',__expected:{students:{s:1}}},{school:{students:[{id:'s',revision:2}]}});
  assert.equal(calls.at(-1).p.p_expected.students.s,1);assert.equal(calls.at(-1).p.p_payload.password,undefined);
});
test('Anonymous load does not call CRM API and failed writes never claim success',async()=>{
  let called=false;const fake={auth:{getSession:async()=>({data:{session:null}})},rpc:async()=>{called=true;return {error:{code:'40001',message:'conflict'}};}};
  const storage=createSupabaseStorage({},()=>fake);assert.equal(await storage.load(),null);assert.equal(called,false);
  await assert.rejects(storage.mutate('student_patch',{},{}),/другим сотрудником/);
});
test('Every student form field, including a retained phone, crosses the storage adapter',()=>{
  const form={id:'s',name:'TEST Child',age:10,discipline:'bmx',coachId:'c',branchId:'roza',level:'Средний',
    childId:'child',phone:'TEST CONTACT',comments:[{id:'cm',date:'2026-10-17',text:'TEST note'}]};
  assert.deepEqual(toPayload(form),{id:'s',name:'TEST Child',age:10,discipline:'bmx',coach_id:'c',branch_id:'roza',level:'Средний',
    child_id:'child',phone:'TEST CONTACT',comments:form.comments});
  assert.equal(toPayload({...form,phone:''}).phone,'');
  assert.equal(Object.hasOwn(toPayload({...form,phone:undefined}),'phone'),false);
});
test('session_close reaches the existing atomic RPC with attendance, explicit purchase outcomes and frozen revisions',async()=>{
  let sent;
  const fake={rpc:async(name,p)=>{sent={name,...p};return {data:{ok:true}};}};
  const storage=createSupabaseStorage({url:'http://127.0.0.1:1',key:'sb_publishable_TEST_ONLY'},()=>fake);
  const versions={sessions:{session:3},students:{present:4,absent:5}};
  await storage.mutate('session_close',{id:'session',note:'TEST closure',attendance:{present:'present',absent:'absent'},
    promoResults:{present:'bought'},__expected:versions},{school:{students:[],sessions:[]}});
  assert.deepEqual(sent,{name:'crm_mutate',p_command:'session_close',p_payload:{id:'session',note:'TEST closure',
    attendance:{present:'present',absent:'absent'},promo_results:{present:'bought'}},p_expected:versions});
  assert.equal(Object.hasOwn(sent.p_payload.promo_results,'absent'),false);
});
test('Series deletion uses one atomic RPC with the exact confirmation list and frozen versions',async()=>{
  const calls=[];const fake={rpc:async(name,args)=>{calls.push({name,args});return {data:{ok:true}};}};
  const storage=createSupabaseStorage({url:'http://127.0.0.1:1',key:'sb_publishable_TEST_ONLY'},()=>fake);
  await storage.mutate('sessions_delete',{id:'anchor',scope:'following',sessionIds:['a','b'],__expected:{sessions:{a:1,b:2,anchor:3}}},{});
  assert.deepEqual(calls,[{name:'crm_delete_session_scope',args:{p_payload:{id:'anchor',scope:'following',session_ids:['a','b']},p_expected:{sessions:{a:1,b:2,anchor:3}}}}]);
});
test('Missing migration fails closed and never falls back to partial individual deletes',async()=>{
  let count=0;const fake={rpc:async()=>{count++;return {error:{code:'PGRST202',message:'missing function'}};}};
  const storage=createSupabaseStorage({url:'http://127.0.0.1:1',key:'sb_publishable_TEST_ONLY'},()=>fake);
  await assert.rejects(storage.mutate('sessions_delete',{id:'a',scope:'series',sessionIds:['a']},{}),/миграция 2026102801/);
  assert.equal(count,1);
});
