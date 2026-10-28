import http from 'node:http';
import path from 'node:path';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {build} from 'vite';
import assert from 'node:assert/strict';
import {fixtureServer,TEST_PASSWORD} from '../tests/helpers/fixture-server.js';
import {actors,staff,uid,student,session,snapshot,mutate,expected} from '../tests/helpers/database.js';
import {fromSnapshot} from '../src/storage/model.js';
import {sessionEarning,promoStats} from '../src/crmLogic.js';

const root=process.cwd(),out=path.join(root,'artifacts/browser-dist');await mkdir(path.join(root,'artifacts'),{recursive:true});
process.env.PLAYWRIGHT_BROWSERS_PATH ||= path.join(root,'.playwright-browsers');
const {chromium}=await import('playwright');const {expect}=await import('playwright/test');
const api=await fixtureServer();
// Real production React + SDK build; backend is an explicitly labelled local HTTP fixture.
await build({root,configFile:false,build:{outDir:out,emptyOutDir:true},define:{
  'import.meta.env.VITE_CRM_STORAGE':JSON.stringify('supabase'),
  'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(api.url),
  'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify('sb_publishable_LOCAL_FIXTURE_ONLY'),
}});
const ui=http.createServer(async(req,res)=>{
  try {const pathname=new URL(req.url,'http://local').pathname;
    const file=path.resolve(out,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(out+path.sep)){res.writeHead(403);res.end();return;}
    res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.html')?'text/html; charset=utf-8':'text/plain');res.end(await readFile(file));
  } catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>ui.listen(0,'127.0.0.1',resolve));const url='http://127.0.0.1:'+ui.address().port;
const browser=await chromium.launch({headless:true});const errors=[],checks=[],closeRequests=[];let page;
const pass=label=>{checks.push(label);console.log('PASS',label);};
async function newPage(){const ctx=await browser.newContext({viewport:{width:1440,height:1000}});await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));page=await ctx.newPage();page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(String(e)));
  page.on('request',r=>{if(r.url().endsWith('/rest/v1/rpc/crm_mutate')){const payload=r.postDataJSON();if(payload.p_command==='session_close')closeRequests.push(payload);}});
  await page.goto(url);return ctx;}
async function login(email){await page.getByRole('textbox',{name:'Почта',exact:true}).fill(email);await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);await page.getByRole('button',{name:'Войти',exact:true}).click();await expect(page.getByText('Общая база · Supabase',{exact:false})).toBeVisible();}
async function owner(){await newPage();await login('owner@example.invalid');}
const record=async name=>(await api.db.query('select * from public.students where name=$1 order by discipline',[name])).rows;
async function newStudent(name,direction='bmx',existing=false){
  await page.getByRole('button',{name:'Ученик',exact:true}).click();const modal=page.getByRole('dialog');
  if(existing){const rows=await record(name);await modal.getByRole('combobox',{name:'Ребёнок',exact:true}).selectOption(rows[0].child_id);}
  else{await modal.getByPlaceholder('Имя Фамилия').fill(name);}
  // Owner's default is the first coach; choose the configured multi-direction coach explicitly.
  const coachSelect=modal.locator('select').filter({has:page.locator('option[value="'+staff.coach+'"]')});
  if(await coachSelect.count())await coachSelect.selectOption(staff.coach);
  await modal.getByRole('combobox',{name:'Направление ученика',exact:true}).selectOption(direction);
  await modal.getByRole('button',{name:'Добавить ученика',exact:true}).click();await expect(modal).toHaveCount(0);
}
try{
  await owner();await page.getByRole('button',{name:'Ученики',exact:true}).click();
  await expect(page.getByText('Детей: 0 · записей по направлениям: 0',{exact:true})).toBeVisible();
  assert.equal(await page.evaluate(()=>Object.keys(localStorage).some(k=>k.startsWith('extreme-kids-v2.1:'))),false);
  pass('Empty server starts without demo children or local school data');
  await newStudent('TEST Browser Child');await newStudent('TEST Browser Child','rollers',true);
  const rows=await record('TEST Browser Child');assert.equal(rows.length,2);assert.equal(rows[0].child_id,rows[1].child_id);
  await expect(page.getByText('Детей: 1 · записей по направлениям: 2',{exact:true})).toBeVisible();
  await page.getByRole('combobox',{name:'Наставник',exact:true}).selectOption(staff.coach);
  await page.getByRole('combobox',{name:'Направление',exact:true}).selectOption('rollers');
  await expect(page.getByText('Детей: 1 · записей по направлениям: 1',{exact:true})).toBeVisible();
  await page.reload();await expect(page.getByRole('button',{name:'Ученики',exact:true})).toBeVisible();await page.getByRole('button',{name:'Ученики',exact:true}).click();
  await expect(page.getByText('Детей: 1 · записей по направлениям: 2',{exact:true})).toBeVisible();
  pass('Create and link two directional enrollments; mentor filters and Auth session survive reload');
  await api.db.query("update public.students set phone='TEST RETAINED CONTACT' where child_id=$1",[rows[0].child_id]);
  await page.getByRole('button',{name:'Обновить данные',exact:true}).click();
  await page.locator('tbody tr').filter({hasText:'TEST Browser Child'}).first().getByRole('button',{name:'Редактировать',exact:true}).click();
  const contactEditor=page.getByRole('dialog');await contactEditor.getByRole('spinbutton').fill('11');
  await contactEditor.getByRole('button',{name:'Сохранить изменения',exact:true}).click();await expect(contactEditor).toHaveCount(0);
  const retained=await record('TEST Browser Child');assert.ok(retained.every(r=>r.phone==='TEST RETAINED CONTACT' && r.age===11));
  pass('Student form retains old phone through SDK/RPC while shared child age updates atomically');
  await page.screenshot({path:path.join(root,'artifacts/server-students.png')});
  // Exercise optimistic locking on an actual open editor, including a background refresh.
  await page.locator('tbody tr').filter({hasText:'TEST Browser Child'}).first().getByRole('button',{name:'Редактировать',exact:true}).click();
  const modal=page.getByRole('dialog');await modal.getByPlaceholder('Имя Фамилия').fill('TEST Stale Draft');
  const current=await snapshot(api.db,actors.owner);const target=current.students[0];
  await mutate(api.db,actors.owner,'student_patch',{id:target.id,status:'vacation'},expected(current));
  // Also change the editor's other row to ensure its frozen participant list is stale.
  for(const r of current.students.filter(s=>s.id!==target.id))await mutate(api.db,actors.owner,'student_patch',{id:r.id,status:'vacation'},expected(await snapshot(api.db,actors.owner)));
  const refreshed=page.waitForResponse(r=>r.url().endsWith('/rest/v1/rpc/crm_snapshot'));
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await refreshed;
  await modal.getByRole('button',{name:'Сохранить изменения',exact:true}).click();
  await expect(modal).toBeVisible();await expect(modal.getByPlaceholder('Имя Фамилия')).toHaveValue('TEST Stale Draft');
  await expect(modal.locator('.form-error')).toContainText('другим сотрудником');assert.equal((await record('TEST Browser Child')).length,2);
  pass('Open stale draft is preserved and cannot overwrite refreshed server revisions');
  await modal.getByRole('button',{name:'Отмена',exact:true}).click();await page.getByRole('button',{name:'Обновить данные',exact:true}).click();
  // Save error must not close a new form or create a partial row.
  await page.getByRole('button',{name:'Ученик',exact:true}).click();const failed=page.getByRole('dialog');await failed.getByPlaceholder('Имя Фамилия').fill('TEST Unsaved');
  api.setFailWrites(true);await failed.getByRole('button',{name:'Добавить ученика',exact:true}).click();await expect(failed.locator('.form-error')).toContainText('TEST connection unavailable');
  await expect(failed.getByPlaceholder('Имя Фамилия')).toHaveValue('TEST Unsaved');assert.equal((await record('TEST Unsaved')).length,0);
  api.setFailWrites(false);await failed.getByRole('button',{name:'Отмена',exact:true}).click();await page.getByRole('button',{name:'Обновить данные',exact:true}).click();
  pass('Failed server write retains input and never creates a partial pupil');
  // Owner: actual create -> read-only participants -> conduct -> existing RPC -> reload.
  await page.getByRole('button',{name:'Тренировка',exact:true}).click();let ownerForm=page.getByRole('dialog');
  await ownerForm.getByRole('button',{name:'Промо',exact:true}).click();
  await expect(ownerForm.getByRole('textbox',{name:'Название тренировки',exact:true})).toHaveValue('Промо · BMX');
  await ownerForm.getByRole('combobox',{name:'Направление тренировки',exact:true}).selectOption('rollers');
  await expect(ownerForm.getByRole('textbox',{name:'Название тренировки',exact:true})).toHaveValue('Промо · Ролики');
  await ownerForm.locator('.picker-row').filter({hasText:'TEST Browser Child'}).click();
  await ownerForm.getByRole('button',{name:'Создать тренировку',exact:true}).click();await expect(ownerForm).toHaveCount(0);
  await page.getByRole('button',{name:'Расписание',exact:true}).click();
  let ownerRow=page.locator('.schedule-row').filter({hasText:'Промо · Ролики'});
  await ownerRow.getByRole('button',{name:'Участники',exact:true}).click();let ownerDetail=page.getByRole('dialog');
  await expect(ownerDetail.getByText('Не отмечено',{exact:true})).toBeVisible();
  await expect(ownerDetail.getByText('Не указан',{exact:true})).toBeVisible();
  await expect(ownerDetail.getByRole('button',{name:'Купил',exact:true})).toHaveCount(0);
  await ownerDetail.getByRole('button',{name:'Провести тренировку',exact:true}).click();
  await ownerDetail.getByRole('button',{name:/Пришёл:/}).click();
  await ownerDetail.getByRole('button',{name:'Завершить тренировку',exact:true}).click();
  await expect(ownerDetail.getByText('Заметка обязательна — опишите, как прошла тренировка',{exact:true})).toBeVisible();
  await ownerDetail.getByPlaceholder('Что отработали, чей прогресс, на что обратить внимание в следующий раз...').fill('TEST Owner Present');
  await ownerDetail.getByRole('button',{name:'Завершить тренировку',exact:true}).click();
  await expect(ownerDetail.getByRole('alert')).toContainText('для каждого присутствовавшего');
  await ownerDetail.getByRole('button',{name:'Купил',exact:true}).click();
  await page.screenshot({path:path.join(root,'artifacts/owner-conduct-promo.png')});
  await page.setViewportSize({width:390,height:844});
  await expect(ownerDetail.getByRole('button',{name:/Пришёл:/})).toBeVisible();
  await ownerDetail.getByRole('button',{name:'Завершить тренировку',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(root,'artifacts/owner-conduct-promo-mobile.png')});
  await page.setViewportSize({width:1440,height:1000});
  await ownerDetail.getByRole('button',{name:'Завершить тренировку',exact:true}).click();await expect(ownerDetail).toHaveCount(0);
  await expect(ownerRow).toContainText('Проведена');
  assert.equal(closeRequests.at(-1).p_command,'session_close');assert.ok(Object.keys(closeRequests.at(-1).p_expected.sessions).length);
  await page.reload();await page.getByRole('button',{name:'Расписание',exact:true}).click();
  ownerRow=page.locator('.schedule-row').filter({hasText:'Промо · Ролики'});await expect(ownerRow).toContainText('Проведена');
  await ownerRow.getByRole('button',{name:'Участники',exact:true}).click();ownerDetail=page.getByRole('dialog');
  await expect(ownerDetail.getByText('✓ Был',{exact:true})).toBeVisible();await expect(ownerDetail.getByText('Купил',{exact:true})).toBeVisible();
  await expect(ownerDetail.locator('textarea')).toHaveValue('TEST Owner Present');
  await ownerDetail.getByRole('button',{name:'Изменить отметки',exact:true}).click();
  await ownerDetail.locator('textarea').fill('TEST Owner Present Updated');
  await ownerDetail.getByRole('button',{name:'Сохранить запись',exact:true}).click();await expect(ownerDetail).toHaveCount(0);
  let ownerState=fromSnapshot(await snapshot(api.db,actors.owner),actors.owner);
  let ownerPromo=ownerState.school.sessions.find(s=>s.groupName==='Промо · Ролики');
  assert.equal(sessionEarning(ownerState.coaches.find(c=>c.id===staff.coach),ownerPromo),500);
  await page.getByRole('button',{name:'Зарплата',exact:true}).click();await expect(page.locator('.admin-content')).toContainText(/500\s*₽/);
  pass('Owner creates auto-named promo, enters conduct from Participants, validates comment/outcome, and retains attendance and 500 pay after reload');
  // Unknown absence; both an HTTP failure and a stale participant must preserve the open draft.
  await page.getByRole('button',{name:'Тренировка',exact:true}).click();ownerForm=page.getByRole('dialog');
  await ownerForm.locator('.picker-row').filter({hasText:'TEST Browser Child'}).click();
  await expect(ownerForm.getByRole('textbox',{name:'Название тренировки',exact:true})).toHaveValue('Промо · BMX');
  await ownerForm.getByRole('button',{name:'Создать тренировку',exact:true}).click();await expect(ownerForm).toHaveCount(0);
  await page.getByRole('button',{name:'Расписание',exact:true}).click();
  ownerRow=page.locator('.schedule-row').filter({hasText:'Промо · BMX'});
  await ownerRow.getByRole('button',{name:'Провести тренировку',exact:true}).click();ownerDetail=page.getByRole('dialog');
  await ownerDetail.getByRole('button',{name:/Не был:/}).click();
  await ownerDetail.getByPlaceholder('Что отработали, чей прогресс, на что обратить внимание в следующий раз...').fill('TEST Owner Absent');
  api.setFailWrites(true);await ownerDetail.getByRole('button',{name:'Завершить тренировку',exact:true}).click();
  await expect(ownerDetail.getByRole('alert')).toContainText('TEST connection unavailable');
  await expect(ownerDetail.locator('textarea')).toHaveValue('TEST Owner Absent');
  assert.equal((await api.db.query("select status from public.sessions where group_name='Промо · BMX'")).rows[0].status,'upcoming');
  api.setFailWrites(false);await ownerDetail.getByRole('button',{name:'Назад',exact:true}).click();await page.getByRole('button',{name:'Обновить данные',exact:true}).click();
  pass('Owner closure failure keeps comment and marks, displays the RPC error, and never completes the session');
  await ownerRow.getByRole('button',{name:'Провести тренировку',exact:true}).click();ownerDetail=page.getByRole('dialog');
  await ownerDetail.getByRole('button',{name:/Не был:/}).click();await ownerDetail.locator('textarea').fill('TEST Owner Absent');
  const beforeConflict=await snapshot(api.db,actors.owner),bmxChild=beforeConflict.students.find(s=>s.discipline==='bmx');
  await mutate(api.db,actors.owner,'student_patch',{id:bmxChild.id,status:'vacation'},expected(beforeConflict));
  const closureRefresh=page.waitForResponse(r=>r.url().endsWith('/rest/v1/rpc/crm_snapshot'));
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await closureRefresh;
  await ownerDetail.getByRole('button',{name:'Завершить тренировку',exact:true}).click();
  await expect(ownerDetail.getByRole('alert')).toContainText('другим сотрудником');
  await expect(ownerDetail.locator('textarea')).toHaveValue('TEST Owner Absent');
  assert.equal((await api.db.query("select status from public.sessions where group_name='Промо · BMX'")).rows[0].status,'upcoming');
  await ownerDetail.getByRole('button',{name:'Назад',exact:true}).click();await page.getByRole('button',{name:'Обновить данные',exact:true}).click();
  pass('Owner attendance editor freezes participant/session revisions and rejects a stale close atomically');
  await ownerRow.getByRole('button',{name:'Провести тренировку',exact:true}).click();ownerDetail=page.getByRole('dialog');
  await ownerDetail.getByRole('button',{name:/Не был:/}).click();await ownerDetail.locator('textarea').fill('TEST Owner Absent');
  await ownerDetail.getByRole('button',{name:'Завершить тренировку',exact:true}).click();await expect(ownerDetail).toHaveCount(0);
  assert.deepEqual(closeRequests.at(-1).p_payload.promo_results,{});
  await page.reload();await page.getByRole('button',{name:'Расписание',exact:true}).click();
  ownerRow=page.locator('.schedule-row').filter({hasText:'Промо · BMX'});await expect(ownerRow).toContainText('Пропущена');
  await ownerRow.getByRole('button',{name:'Участники',exact:true}).click();ownerDetail=page.getByRole('dialog');
  await expect(ownerDetail.getByText('Б Не был',{exact:true})).toBeVisible();await expect(ownerDetail.getByText('Не указан',{exact:true})).toBeVisible();
  await ownerDetail.getByRole('button',{name:'Назад',exact:true}).click();
  ownerState=fromSnapshot(await snapshot(api.db,actors.owner),actors.owner);ownerPromo=ownerState.school.sessions.find(s=>s.groupName==='Промо · BMX');
  assert.equal(sessionEarning(ownerState.coaches.find(c=>c.id===staff.coach),ownerPromo),0);assert.equal(ownerState.school.students.find(s=>s.id===bmxChild.id).status,'vacation');
  assert.equal(promoStats(ownerState.school.sessions).conversion,100);
  pass('Owner absent promo persists B and unknown purchase after reload, preserves vacation, excludes refusal and pays zero');
  // Suggest prior group names in the same branch/direction; retain custom and existing names.
  const rollersChild=ownerState.school.students.find(s=>s.discipline==='rollers');
  const groupId=await session(api.db,[rollersChild.id],{id:uid(320),type:'group',direction:'rollers',date:new Date().toLocaleDateString('sv-SE')});
  await api.db.query("update public.sessions set group_name='TEST Existing Rollers Group' where id=$1",[groupId]);
  await page.getByRole('button',{name:'Обновить данные',exact:true}).click();
  await page.getByRole('button',{name:'Тренировка',exact:true}).click();ownerForm=page.getByRole('dialog');
  await ownerForm.getByRole('button',{name:'Инд.',exact:true}).click();await expect(ownerForm.getByRole('textbox',{name:'Название тренировки',exact:true})).toHaveValue('Индивидуальная · BMX');
  await ownerForm.getByRole('combobox',{name:'Направление тренировки',exact:true}).selectOption('rollers');
  await expect(ownerForm.getByRole('textbox',{name:'Название тренировки',exact:true})).toHaveValue('Индивидуальная · Ролики');
  await ownerForm.getByRole('button',{name:'Группа',exact:true}).click();
  assert.deepEqual(await ownerForm.locator('datalist option').evaluateAll(o=>o.map(x=>x.value)),['TEST Existing Rollers Group']);
  await ownerForm.getByRole('combobox',{name:'Направление тренировки',exact:true}).selectOption('bmx');
  assert.deepEqual(await ownerForm.locator('datalist option').evaluateAll(o=>o.map(x=>x.value)),[]);
  await ownerForm.getByRole('combobox',{name:'Направление тренировки',exact:true}).selectOption('rollers');
  await ownerForm.getByRole('combobox',{name:'Название тренировки',exact:true}).fill('TEST Custom Group');
  await ownerForm.getByRole('button',{name:'Инд.',exact:true}).click();await expect(ownerForm.getByRole('textbox',{name:'Название тренировки',exact:true})).toHaveValue('TEST Custom Group');
  await ownerForm.getByRole('button',{name:'Группа',exact:true}).click();await ownerForm.locator('.picker-row').filter({hasText:'TEST Browser Child'}).click();
  await ownerForm.getByRole('button',{name:'Создать тренировку',exact:true}).click();await expect(ownerForm).toHaveCount(0);
  await page.locator('.schedule-row').filter({hasText:'TEST Custom Group'}).getByRole('button',{name:'Редактировать',exact:true}).click();ownerForm=page.getByRole('dialog');
  await expect(ownerForm.getByRole('combobox',{name:'Название тренировки',exact:true})).toHaveValue('TEST Custom Group');
  await ownerForm.getByRole('button',{name:'Отмена',exact:true}).click();
  pass('Individual names follow direction, group suggestions are scoped, custom names survive type changes and existing names survive editing');
  // Coach closes two synthetic promo sessions through the real interface.
  const a=await student(api.db,{id:uid(211),child:uid(511)}),b=await student(api.db,{id:uid(212),child:uid(512)});
  await student(api.db,{id:uid(213),child:uid(513)});
  const today=new Date().toLocaleDateString('sv-SE');const xa=await session(api.db,[a],{id:uid(311),date:today}),xb=await session(api.db,[b],{id:uid(312),date:today});
  await api.db.query("update public.sessions set group_name=case when id=$1 then 'TEST Present Promo' else 'TEST Absent Promo' end where id=any($2::uuid[])",[xa,[xa,xb]]);
  await page.getByRole('button',{name:'Выйти',exact:true}).click();await login('coach@example.invalid');
  await page.getByRole('button',{name:'Новая тренировка',exact:true}).click();
  let training=page.getByRole('dialog');await training.getByPlaceholder('БМХ Начинающие, Группа А...').fill('TEST UI Created Promo');
  await training.locator('.picker-row').filter({hasText:'TEST Child 0513'}).click();
  await training.getByRole('button',{name:'Создать тренировку',exact:true}).click();await expect(training).toHaveCount(0);
  assert.equal((await api.db.query("select status from public.sessions where group_name='TEST UI Created Promo'")).rows[0].status,'upcoming');
  pass('New training is created through the interface and persisted as promo immediately');
  await page.getByRole('button',{name:'Новая тренировка',exact:true}).click();training=page.getByRole('dialog');
  await training.getByPlaceholder('БМХ Начинающие, Группа А...').fill('TEST UI Repeated Promo');
  await training.locator('.picker-row').filter({hasText:'TEST Child 0511'}).click();
  await training.getByRole('button',{name:'Создать тренировку',exact:true}).click();
  // Existing promo participants cannot be used for a second trial; server and UI keep the form open.
  await expect(training.locator('.form-error')).toContainText('Повторное промо');
  await training.getByRole('button',{name:'Отмена',exact:true}).click();
  pass('Training form preserves the one-promo-per-direction rule against existing server history');
  await page.getByRole('button',{name:/TEST Present Promo/}).click();
  const note=page.getByPlaceholder('Что отработали, чей прогресс, на что обратить внимание в следующий раз...');await note.fill('TEST browser training comment');
  await page.getByRole('button',{name:'Завершить тренировку',exact:true}).click();await expect(page.getByRole('alert')).toContainText('для каждого присутствовавшего');
  await page.getByRole('button',{name:'Купил',exact:true}).click();await page.getByRole('button',{name:'Завершить тренировку',exact:true}).click();
  await expect(page.getByRole('button',{name:/TEST Present Promo/})).toBeVisible();assert.equal((await api.db.query('select origin from public.students where id=$1',[a])).rows[0].origin,'regular');
  pass('Present promo requires outcome, then atomically saves purchase and active status');
  await page.getByRole('button',{name:/TEST Absent Promo/}).click();await page.getByRole('button',{name:/Не был:/}).click();
  await page.getByRole('button',{name:'Завершить тренировку',exact:true}).click();await expect(page.getByText('Заметка обязательна — опишите, как прошла тренировка',{exact:true})).toBeVisible();
  await page.getByPlaceholder('Что отработали, чей прогресс, на что обратить внимание в следующий раз...').fill('TEST absent comment');
  await page.getByRole('button',{name:'Завершить тренировку',exact:true}).click();await expect(page.getByRole('button',{name:/TEST Absent Promo/})).toBeVisible();
  const absent=(await api.db.query('select present,promo_result from public.session_students where session_id=$1',[xb])).rows[0];assert.equal(absent.present,false);assert.equal(absent.promo_result,null);
  pass('Absent promo requires comment, accepts no result, and retains unknown purchase');
  await page.getByRole('button',{name:'Статистика',exact:true}).click();await expect(page.locator('.salary-panel-toggle')).toContainText(/1\s*000\s*₽/);
  pass('Coach month salary reflects server purchase and zero absent pay');
  await page.getByRole('button',{name:'Ученики',exact:true}).click();const opts=await page.getByRole('combobox',{name:'Наставник',exact:true}).locator('option').evaluateAll(o=>o.map(x=>x.value));assert.deepEqual(opts,['all',staff.coach]);
  await page.setViewportSize({width:390,height:844});await expect(page.getByRole('combobox',{name:'Наставник',exact:true})).toBeVisible();await page.screenshot({path:path.join(root,'artifacts/server-coach-mobile.png')});
  await page.setViewportSize({width:1440,height:1000});pass('Coach mentor filter is scoped to self and works at mobile width');
  await page.getByRole('button',{name:'Выйти',exact:true}).click();await login('admin@example.invalid');
  await expect(page.getByRole('button',{name:'Ученики',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'Зарплата',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Провести тренировку',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Показать все дни',exact:true}).click();await page.getByRole('button',{name:'Участники',exact:true}).first().click();await expect(page.getByRole('dialog')).not.toContainText('Результат промо');await expect(page.getByRole('button',{name:'Завершить тренировку',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Провести тренировку',exact:true})).toHaveCount(0);
  await page.screenshot({path:path.join(root,'artifacts/server-admin-attendance.png')});pass('Administrator receives attendance-only interface and restricted server projection');
  await page.getByRole('dialog').getByRole('button',{name:'Назад',exact:true}).click();
  await page.getByRole('button',{name:'Выйти',exact:true}).click();await login('owner@example.invalid');
  await page.getByRole('button',{name:'Тренеры',exact:true}).click();await page.getByRole('button',{name:'Тренер',exact:true}).click();
  const mentor=page.getByRole('dialog');await mentor.getByPlaceholder('Имя Фамилия').fill('TEST Added Mentor');
  await mentor.getByPlaceholder('coach@extremekids.ru').fill('added@example.invalid');
  await mentor.locator('.picker-row').filter({hasText:'BMX'}).click();
  await mentor.getByRole('button',{name:/Обычный · инд/}).click();
  await mentor.getByRole('button',{name:'Добавить тренера',exact:true}).click();await expect(mentor).toHaveCount(0);
  const added=(await api.db.query("select disciplines,user_id from public.coaches where email='added@example.invalid'")).rows[0];
  assert.deepEqual(new Set(added.disciplines),new Set(['rollers','bmx']));assert.equal(added.user_id,null);
  pass('Mentor editor saves multiple directions without a local password or automatic Auth assignment');
  assert.deepEqual(errors,[]);pass('No browser runtime exceptions');
}catch(error){if(page){console.error((await page.locator('body').innerText()).slice(-9000));await page.screenshot({path:path.join(root,'artifacts/browser-failure.png'),fullPage:true}).catch(()=>{});}throw error;}
finally{
  await writeFile(path.join(root,'artifacts/browser-results.json'),JSON.stringify({backend:'Local HTTP fixture + PGlite; NOT live Supabase Auth/PostgREST',browser:browser.version(),checks,errors,sessionCloseRequests:closeRequests},null,2));
  await browser.close();await new Promise(resolve=>ui.close(resolve));await api.close();
}
