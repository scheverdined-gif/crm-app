-- FINAL REVIEW 17.10.2026. Read-only checks AFTER both migrations, as SQL Editor's trusted role.
-- Run each SELECT separately. No imports, Auth bootstrap, test accounts or mutations here.

-- 1. Compare with the PRE-migration counts. Expected from the user's last check: 2,0,0,0,0,0,0.
select 'branches' as table_name,count(*) as row_count from public.branches
union all select 'coaches',count(*) from public.coaches
union all select 'managers',count(*) from public.managers
union all select 'students',count(*) from public.students
union all select 'sessions',count(*) from public.sessions
union all select 'session_students',count(*) from public.session_students
union all select 'student_comments',count(*) from public.student_comments;
select id,label from public.branches order by id;

-- 2. Seven rows, all RLS=true; only crm_read SELECT policy to authenticated on each.
select c.relname,c.relrowsecurity,p.policyname,p.cmd,p.roles
from pg_class c join pg_namespace n on n.oid=c.relnamespace
left join pg_policies p on p.schemaname=n.nspname and p.tablename=c.relname
where n.nspname='public' and c.relname in ('branches','coaches','managers','students','sessions','session_students','student_comments')
order by c.relname;

-- 3. Present, valid unique external indexes. There must be two rows, no WHERE predicate.
select indexname,indexdef from pg_indexes where schemaname='public'
and indexname in ('students_external_uidx','sessions_external_uidx') order by indexname;

-- 4. Public RPC signatures and EXECUTE: authenticated=true, anon=false.
select p.oid::regprocedure::text as function_signature,p.prosecdef,p.proconfig,
has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('crm_snapshot','crm_mutate','crm_admin_snapshot','crm_historical_students')
order by p.proname;

-- 5. All direct write privileges=false for both client roles (14 rows).
select r.role_name,t.table_name,
has_table_privilege(r.role_name,'public.'||t.table_name,'INSERT') as can_insert,
has_table_privilege(r.role_name,'public.'||t.table_name,'UPDATE') as can_update,
has_table_privilege(r.role_name,'public.'||t.table_name,'DELETE') as can_delete,
has_table_privilege(r.role_name,'public.'||t.table_name,'TRUNCATE') as can_truncate
from (values ('anon'),('authenticated')) r(role_name)
cross join (values ('branches'),('coaches'),('managers'),('students'),('sessions'),('session_students'),('student_comments')) t(table_name)
order by r.role_name,t.table_name;

-- 6. Ordinary client may read permitted phone but never raw import metadata.
select has_column_privilege('authenticated','public.students','phone','SELECT') as phone_select,
has_column_privilege('authenticated','public.students','source_metadata','SELECT') as import_metadata_select;

-- 7. Trusted Auth signup trigger must be the no-op linker (no email role assignment).
select pg_get_functiondef('public.link_auth_user()'::regprocedure);

-- 8. Confirm the reviewed bodies include phone handling and NULL-safe permission check.
select pg_get_functiondef('public.crm_mutate(text,jsonb,jsonb)'::regprocedure);
select pg_get_functiondef('crm_private.can_write_student(jsonb)'::regprocedure);
