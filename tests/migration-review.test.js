import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {baseDatabase,applyMigrations,uid} from './helpers/database.js';
const migration=n=>readFile(new URL(`./fixtures/legacy-schema/${n}`,import.meta.url),'utf8');
const first=()=>migration('2026101701_model_access.sql');
const second=()=>migration('2026101702_atomic_commands.sql');

test('Both migrations preserve populated Claude tables, contacts, dates, legacy marks and separate same-name identities',async()=>{
  const db=await baseDatabase();try{
    await db.query("insert into public.coaches(id,name,email,discipline,branches) values($1,'TEST Legacy Coach','legacy@example.invalid','bmx','{roza}')",[uid(102)]);
    for(let i=0;i<2;i++)await db.query(`insert into public.students(id,name,age,discipline,coach_id,branch_id,phone,join_date,left_date,origin,status,external_id)
      values($1,'TEST Same Legacy Name',11,$2,$3,'roza',$4,'2025-03-01',$5,$6,$7,$8)`,
      [uid(201+i),i?'rollers':'bmx',uid(102),'TEST CONTACT '+i,i?'2026-08-01':null,i?'promo':'regular',i?'left':'vacation','TEST external '+i]);
    await db.query("insert into public.student_comments(id,student_id,date,text) values($1,$2,'2025-03-02','TEST old note')",[uid(801),uid(201)]);
    for(let i=0;i<2;i++)await db.query(`insert into public.sessions(id,type,discipline,coach_id,branch_id,date,time,status,external_id)
      values($1,'group','bmx',$2,'roza','2025-03-02','16:00','done',$3)`,[uid(301+i),uid(102),'TEST session '+i]);
    await db.query('insert into public.session_students(session_id,student_id,present) values($1,$2,true),($1,$3,null),($4,$2,null)',[uid(301),uid(201),uid(202),uid(302)]);
    const tables=['branches','coaches','managers','students','sessions','session_students','student_comments'];
    const before=Object.fromEntries(await Promise.all(tables.map(async t=>[t,(await db.query('select * from public.'+t+' order by 1')).rows])));
    await db.exec(await readFile(new URL('../tests/fixtures/legacy-schema/PREFLIGHT-READ-ONLY.sql',import.meta.url),'utf8'));
    // Simulate broad original Supabase table grants, rather than relying on bare PostgreSQL defaults.
    await db.exec('grant all on all tables in schema public to anon,authenticated');
    await applyMigrations(db);
    await db.exec(await readFile(new URL('../tests/fixtures/legacy-schema/POSTFLIGHT-READ-ONLY.sql',import.meta.url),'utf8'));
    for(const t of tables){const rows=(await db.query('select * from public.'+t+' order by 1')).rows;
      assert.equal(rows.length,before[t].length,t);
      for(let i=0;i<rows.length;i++)for(const [key,value] of Object.entries(before[t][i]))assert.deepEqual(rows[i][key],value,t+'.'+key);
    }
    const children=(await db.query('select child_id from public.students')).rows;
    assert.equal(new Set(children.map(r=>r.child_id)).size,2);
    assert.deepEqual((await db.query('select attendance_recorded from public.sessions order by id')).rows.map(r=>r.attendance_recorded),[true,false]);
    assert.equal((await db.query("select has_column_privilege('authenticated','public.students','phone','SELECT') ok")).rows[0].ok,true);
    assert.equal((await db.query("select has_column_privilege('authenticated','public.students','source_metadata','SELECT') ok")).rows[0].ok,false);
    for(const role of ['anon','authenticated'])for(const t of tables)for(const action of ['INSERT','UPDATE','DELETE','TRUNCATE'])
      assert.equal((await db.query('select has_table_privilege($1,$2,$3) ok',[role,'public.'+t,action])).rows[0].ok,false,role+t+action);
  }finally{await db.close();}
});
test('Unknown live policies abort migration 1 before any schema/data/access changes',async()=>{
  const db=await baseDatabase();try{
    await db.exec('create policy unexpected_live_policy on public.students for select to authenticated using(true)');
    await assert.rejects(db.exec(await first()),/Unknown policies/);await db.exec('rollback');
    assert.equal((await db.query("select count(*)::int n from information_schema.columns where table_schema='public' and table_name='students' and column_name='child_id'")).rows[0].n,0);
    assert.equal((await db.query("select count(*)::int n from pg_policies where policyname in ('students_write','unexpected_live_policy')")).rows[0].n,2);
    assert.equal((await db.query('select count(*)::int n from public.branches')).rows[0].n,2);
  }finally{await db.close();}
});
test('A failure late in migration 2 rolls back all its functions; committed migration 1 keeps writes closed',async()=>{
  const db=await baseDatabase();try{
    await db.exec(await first());
    const bad=(await second()).replace(/commit;\s*$/,"select * from public.TEST_missing_table;\ncommit;");
    await assert.rejects(db.exec(bad),/does not exist/);await db.exec('rollback');
    assert.equal((await db.query("select to_regprocedure('public.crm_mutate(text,jsonb,jsonb)') fn")).rows[0].fn,null);
    assert.equal((await db.query("select to_regprocedure('crm_private.can_write_student(jsonb)') fn")).rows[0].fn,null);
    assert.notEqual((await db.query("select to_regprocedure('public.crm_snapshot()') fn")).rows[0].fn,null);
    assert.equal((await db.query("select has_table_privilege('authenticated','public.students','UPDATE') ok")).rows[0].ok,false);
    await db.exec(await second());
    assert.notEqual((await db.query("select to_regprocedure('public.crm_mutate(text,jsonb,jsonb)') fn")).rows[0].fn,null);
  }finally{await db.close();}
});
test('Final functions fix search_path and EXECUTE grants; rerunning migration 1 is safely refused',async()=>{
  const db=await baseDatabase();try{
    await applyMigrations(db);
    const functions=(await db.query(`select n.nspname,p.proname,p.oid::regprocedure::text signature,p.proconfig
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='crm_private' or (n.nspname='public' and p.proname like 'crm_%')`)).rows;
    const allowed=new Set(['actor','is_owner','owns_session','sees_student','crm_snapshot','crm_admin_snapshot','crm_historical_students','crm_mutate','crm_delete_session_scope']);
    for(const f of functions){
      assert.ok(f.proconfig?.includes('search_path=""'),f.signature);
      assert.equal((await db.query('select has_function_privilege($1,$2,\'EXECUTE\') ok',['anon',f.signature])).rows[0].ok,false,f.signature);
      assert.equal((await db.query('select has_function_privilege($1,$2,\'EXECUTE\') ok',['authenticated',f.signature])).rows[0].ok,allowed.has(f.proname),f.signature);
    }
    await assert.rejects(db.exec(await first()),/already installed/);await db.exec('rollback');
    assert.equal((await db.query('select count(*)::int n from public.branches')).rows[0].n,2);
    assert.equal((await db.query("select count(*)::int n from pg_policies where policyname='crm_read'")).rows[0].n,7);
  }finally{await db.close();}
});
