-- READ ONLY. Run before and after the additive migration in the EXISTING project.
-- Do not send credentials or personal pupil rows. No imports and no mutations here.
select 'branches' as table_name,count(*) from public.branches
union all select 'students',count(*) from public.students
union all select 'sessions',count(*) from public.sessions
union all select 'session_students',count(*) from public.session_students;
select count(distinct template_id) as linked_series,
  count(*) filter(where template_id is null) as sessions_without_series,
  count(*) filter(where status='upcoming') as planned,
  count(*) filter(where status<>'upcoming') as historical
from public.sessions;
-- After migration: one enabled trigger, three public function entries (anon=false).
select tgname,tgenabled,pg_get_triggerdef(oid) from pg_trigger
where tgrelid='public.sessions'::regclass and tgname='crm_keep_training_history';
select p.oid::regprocedure::text as signature,p.prosecdef,p.proconfig,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in ('crm_snapshot','crm_mutate','crm_delete_session_scope')
order by p.proname;
select tablename,policyname,cmd,roles from pg_policies
where schemaname='public' and tablename in ('branches','coaches','managers','students','sessions','session_students','student_comments')
order by tablename,policyname;
