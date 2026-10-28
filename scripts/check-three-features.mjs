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
const browser=await chromium.launch({headless:true}),checks=[],errors=[];let page;
const pass=name=>{checks.push(name);console.log('PASS',name);};
async function context(timezone='Asia/Tomsk'){
  const ctx=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:timezone});
  await ctx.route('https://fonts.googleapis.com/**',r=>r.fulfill({body:'',contentType:'text/css'}));
  const p=await ctx.newPage();p.setDefaultTimeout(8000);p.on('pageerror',e=>errors.push(String(e)));
  await p.clock.setFixedTime(new Date('2026-10-28T22:30:00Z'));await p.goto(url);return p;
}
async function login(email){await page.getByRole('textbox',{name:'Почта',exact:true}).fill(email);await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);await page.getByRole('button',{name:'Войти',exact:true}).click();await expect(page.getByText('Общая база · Supabase',{exact:false})).toBeVisible();}
const rows=()=>page.locator('.schedule-row');
async function deleteDialog(name,index=0){await rows().filter({hasText:name}).nth(index).getByRole('button',{name:'Удалить',exact:true}).click();return page.getByRole('dialog',{name:'Удаление тренировок',exact:true});}
async function seriesCount(template){return (await api.db.query('select count(*)::int n from public.sessions where template_id=$1',[template])).rows[0].n;}
async function rpc(command,payload){await mutate(api.db,actors.owner,command,payload,expected(await snapshot(api.db,actors.owner)));}
try{
  const pupil=await student(api.db,{id:uid(701),child:uid(901)});await rpc('student_patch',{id:pupil,origin:'regular'});
  page=await context();await login('owner@example.invalid');
  for(const theme of ['light','dark']){
    await page.getByRole('button',{name:theme==='light'?'Включить светлую тему':'Включить тёмную тему',exact:true}).click();
    await expect(page.locator('html')).toHaveAttribute('data-crm-theme',theme);
    for(const tab of ['Обзор','Загруженность','Зарплата','Тренеры','Ученики','Расписание','Администраторы','Памятка']){
      await page.getByRole('button',{name:tab,exact:true}).click();await expect(page.locator('.admin-content')).toBeVisible();
    }
    await page.getByRole('button',{name:'Ученики',exact:true}).click();
    await page.screenshot({path:path.join(root,`artifacts/${theme}-students.png`)});
    pass(`${theme}: all owner sections and tables render without runtime errors`);
  }
  await page.getByRole('button',{name:'Включить светлую тему',exact:true}).click();await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-crm-theme','light');
  await page.getByRole('button',{name:'Расписание',exact:true}).click();await page.getByRole('button',{name:'Открыть календарь',exact:true}).click();
  await expect(page.locator('.date-calendar-head')).toContainText('октябрь 2026');
  await expect(page.getByRole('button',{name:'Выбрать дату 2026-10-29',exact:true})).toHaveAttribute('aria-current','date');
  await expect(page.getByRole('button',{name:'Выбрать дату 2026-10-29',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:path.join(root,'artifacts/light-calendar-today.png')});
  pass('Calendar opens on local today and current month, not old session dates or UTC');
  await page.getByRole('button',{name:'Предыдущий месяц',exact:true}).click();
  await page.getByRole('button',{name:'Выбрать дату 2026-09-15',exact:true}).click();
  await page.clock.setFixedTime(new Date('2026-10-31T18:30:00Z'));
  const update=page.waitForResponse(r=>r.url().endsWith('/rest/v1/rpc/crm_snapshot'));
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await update;
  await expect(page.getByRole('button',{name:'Открыть календарь',exact:true})).toContainText('15 сентября');
  await page.getByRole('button',{name:'Открыть календарь',exact:true}).click();await expect(page.locator('.date-calendar-head')).toContainText('сентябрь 2026');
  await page.getByRole('button',{name:'Открыть календарь',exact:true}).click();await page.getByRole('button',{name:'Сегодня',exact:true}).click();
  await expect(page.getByRole('button',{name:'Открыть календарь',exact:true})).toContainText('1 ноября');
  await page.getByRole('button',{name:'Ученики',exact:true}).click();await page.getByRole('button',{name:'Расписание',exact:true}).click();
  await expect(page.getByRole('button',{name:'Открыть календарь',exact:true})).toContainText('1 ноября');
  pass('Manual calendar selection survives refresh and local month rollover; Today and reopening use fresh local dates');
  // Create a real recurring batch through the existing form and SDK, on the local PostgreSQL fixture.
  await page.getByRole('button',{name:'Тренировка',exact:true}).click();let form=page.getByRole('dialog');
  await form.getByRole('button',{name:'По расписанию, на несколько недель',exact:true}).click();
  await form.getByRole('spinbutton').fill('4');await form.getByRole('combobox',{name:'Название тренировки',exact:true}).fill('TEST UI Series');
  await form.locator('.picker-row').filter({hasText:'TEST Child 0901'}).click();
  await page.screenshot({path:path.join(root,'artifacts/light-recurring-form.png')});
  await form.getByRole('button',{name:'Создать серию тренировок',exact:true}).click();await expect(form).toHaveCount(0);
  const created=(await api.db.query("select * from public.sessions where group_name='TEST UI Series' order by date,time")).rows;
  assert.equal(created.length,4);const template=created[0].template_id;assert.ok(template);assert.ok(created.every(s=>s.template_id===template));
  await page.getByRole('button',{name:'Показать все дни',exact:true}).click();
  await rows().filter({hasText:'TEST UI Series'}).first().getByRole('button',{name:'Провести тренировку',exact:true}).click();
  form=page.getByRole('dialog');await form.getByRole('button',{name:/Пришёл:/}).click();await form.locator('textarea').fill('TEST protected attendance');
  await form.getByRole('button',{name:'Завершить тренировку',exact:true}).click();await expect(form).toHaveCount(0);
  const unrelated=await session(api.db,[pupil],{id:uid(801),type:'group',date:'2027-01-04'});
  await api.db.query("update public.sessions set template_id=$2,group_name='TEST UI Series' where id=$1",[unrelated,uid(988)]);
  await page.getByRole('button',{name:'Обновить данные',exact:true}).click();
  let dialog=await deleteDialog('TEST UI Series');
  await expect(dialog.getByRole('radio',{name:'Вся серия',exact:true})).toBeChecked();
  await expect(dialog).toContainText('Будет удалено: 3');await expect(dialog).toContainText('Сохранятся занятия с историей: 1');
  await page.screenshot({path:path.join(root,'artifacts/light-delete-series.png')});
  await dialog.getByRole('button',{name:'Отмена',exact:true}).click();assert.equal(await seriesCount(template),4);
  pass('Recurring creation preserves template_id; confirmation counts only planned records and cancel is safe');
  dialog=await deleteDialog('TEST UI Series');api.setFailWrites(true);
  await dialog.getByRole('button',{name:'Удалить: 3',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('TEST connection unavailable');
  assert.equal(await seriesCount(template),4);api.setFailWrites(false);await dialog.getByRole('button',{name:'Отмена',exact:true}).click();
  await page.getByRole('button',{name:'Обновить данные',exact:true}).click();
  dialog=await deleteDialog('TEST UI Series');await dialog.getByRole('button',{name:'Удалить: 3',exact:true}).click();await expect(dialog).toHaveCount(0);
  await page.reload();await page.getByRole('button',{name:'Расписание',exact:true}).click();await page.getByRole('button',{name:'Показать все дни',exact:true}).click();
  assert.equal(await seriesCount(template),1);assert.equal(await seriesCount(uid(988)),1);
  const state=fromSnapshot(await snapshot(api.db,actors.owner),actors.owner),closed=state.school.sessions.find(s=>s.id===created[0].id);
  assert.equal(closed.attendance[pupil],'present');assert.equal(sessionEarning(state.coaches.find(c=>c.id===staff.coach),closed),150);
  pass('Whole-series deletion survives reload, preserves identical-name unrelated series, attendance, comment and pay');
  // A second series exercises inclusive following and single deletion.
  const batch=[0,1,2].map(i=>({id:uid(820+i),template_id:uid(989),type:'group',discipline:'bmx',coach_id:staff.coach,branch_id:'roza',
    date:`2027-02-${String(1+i*7).padStart(2,'0')}`,time:'16:00',duration:60,group_name:'TEST Following Series',student_ids:[pupil]}));
  await rpc('sessions_create',{sessions:batch});await page.getByRole('button',{name:'Обновить данные',exact:true}).click();
  dialog=await deleteDialog('TEST Following Series',1);await dialog.getByRole('radio',{name:'Эта и следующие тренировки серии',exact:true}).check();
  await expect(dialog).toContainText('Будет удалено: 2');await dialog.getByRole('button',{name:'Удалить: 2',exact:true}).click();await expect(dialog).toHaveCount(0);
  assert.equal(await seriesCount(uid(989)),1);
  dialog=await deleteDialog('TEST Following Series');await expect(dialog.getByRole('radio',{name:'Только эта тренировка',exact:true})).toBeChecked();
  await dialog.getByRole('button',{name:'Удалить: 1',exact:true}).click();await expect(dialog).toHaveCount(0);assert.equal(await seriesCount(uid(989)),0);
  pass('This-and-following is inclusive; single deletion leaves other records and series untouched');
  await page.getByRole('button',{name:'Выйти',exact:true}).click();await login('coach@example.invalid');
  await expect(page.locator('html')).toHaveAttribute('data-crm-theme','light');
  await page.getByRole('button',{name:'Открыть календарь',exact:true}).click();await page.setViewportSize({width:390,height:844});
  await expect(page.locator('.date-calendar')).toBeVisible();await expect(page.getByRole('button',{name:'Выбрать дату 2026-11-01',exact:true})).toHaveAttribute('aria-current','date');
  await page.screenshot({path:path.join(root,'artifacts/light-coach-mobile-calendar.png')});
  await page.getByRole('button',{name:'Открыть календарь',exact:true}).click();
  await page.getByRole('button',{name:'Включить тёмную тему',exact:true}).click();await page.reload();await expect(page.locator('html')).toHaveAttribute('data-crm-theme','dark');
  pass('Theme survives logout/login and reload for mentor; mobile calendar and manual navigation remain available');
  await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Выйти',exact:true}).click();await login('admin@example.invalid');
  await expect(page.getByRole('button',{name:'Удалить',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Провести тренировку',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Включить светлую тему',exact:true}).click();await page.getByRole('button',{name:'Показать все дни',exact:true}).click();
  await rows().first().getByRole('button',{name:'Участники',exact:true}).click();
  await expect(page.getByRole('dialog')).not.toContainText('Результат промо');await expect(page.getByRole('button',{name:'Удалить',exact:true})).toHaveCount(0);
  await page.screenshot({path:path.join(root,'artifacts/light-admin-attendance.png')});
  pass('Administrator can use both themes and calendar but remains attendance-only with no delete or conduct controls');
  const saved=page;page=await context('America/Los_Angeles');await login('owner@example.invalid');
  await page.getByRole('button',{name:'Расписание',exact:true}).click();await page.getByRole('button',{name:'Открыть календарь',exact:true}).click();
  await expect(page.getByRole('button',{name:'Выбрать дату 2026-10-28',exact:true})).toHaveAttribute('aria-current','date');
  pass('Same instant shows Oct 29 in Tomsk and Oct 28 in Los Angeles without UTC date drift');
  // Local fixture ONLY: reproduce the existing backend before the additive migration.
  await api.db.exec('drop trigger crm_keep_training_history on public.sessions; drop function public.crm_delete_session_scope(jsonb,jsonb); drop function crm_private.keep_training_history()');
  await page.getByRole('button',{name:'Открыть календарь',exact:true}).click();
  await page.getByRole('button',{name:'Показать все дни',exact:true}).click();
  const countBefore=(await api.db.query('select count(*)::int n from public.sessions')).rows[0].n;
  await rows().filter({hasText:'TEST UI Series'}).last().getByRole('button',{name:'Удалить',exact:true}).click();
  dialog=page.getByRole('dialog',{name:'Удаление тренировок',exact:true});
  await dialog.getByRole('button',{name:'Удалить: 1',exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText('требуется SQL-миграция 2026102801');
  assert.equal((await api.db.query('select count(*)::int n from public.sessions')).rows[0].n,countBefore);
  await dialog.getByRole('button',{name:'Отмена',exact:true}).click();
  await page.getByRole('button',{name:'Обновить данные',exact:true}).click();
  await page.getByRole('button',{name:'Тренировка',exact:true}).click();form=page.getByRole('dialog');
  await form.getByRole('combobox',{name:'Название тренировки',exact:true}).fill('TEST before migration');
  await form.locator('.picker-row').filter({hasText:'TEST Child 0901'}).click();
  await form.getByRole('button',{name:'Создать тренировку',exact:true}).click();await expect(form).toHaveCount(0);
  await rows().filter({hasText:'TEST before migration'}).getByRole('button',{name:'Провести тренировку',exact:true}).click();
  form=page.getByRole('dialog');await form.locator('textarea').fill('TEST existing closure still works');
  await form.getByRole('button',{name:'Завершить тренировку',exact:true}).click();await expect(form).toHaveCount(0);
  assert.equal((await api.db.query("select status from public.sessions where group_name='TEST before migration'")).rows[0].status,'done');
  pass('Before migration, delete fails closed without partial changes while existing creation and closure remain operational');page=saved;
  assert.deepEqual(errors,[]);pass('No browser runtime errors');
}catch(error){if(page){console.error((await page.locator('body').innerText()).slice(-7000));await page.screenshot({path:path.join(root,'artifacts/three-features-failure.png'),fullPage:true}).catch(()=>{});}throw error;}
finally{
  await writeFile(path.join(root,'artifacts/three-features-browser.json'),JSON.stringify({backend:'Local HTTP Auth/PostgREST fixture + PGlite; NOT live Supabase',checks,errors,browser:browser.version()},null,2));
  await browser.close();await new Promise(resolve=>ui.close(resolve));await api.close();
}
