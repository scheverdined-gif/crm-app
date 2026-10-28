-- Extreme Kids: ТОЛЬКО ЧТЕНИЕ. Подготовлено 16.10.2026.
-- Самим Codex к базе НЕ применялось.
-- В SQL Editor выделяйте ОДИН SELECT целиком, включая завершающую ;,
-- и запускайте выделенный запрос. Не запускайте 01_schema.sql повторно.
-- Запросы 1-6 читают системные каталоги; они не зависят от наличия столбцов CRM.
-- Запросы 7-9 запускайте после сверки структуры с оригинальным SQL.

-- 1. Наличие семи таблиц, RLS, число политик на каждую.
select expected.table_name,
       c.oid is not null as table_exists,
       c.relrowsecurity as rls_enabled,
       (select count(*) from pg_policy p where p.polrelid = c.oid) as policy_count
from (values ('branches'), ('coaches'), ('managers'), ('students'),
             ('student_comments'), ('sessions'), ('session_students')) expected(table_name)
left join pg_namespace n on n.nspname = 'public'
left join pg_class c on c.relnamespace = n.oid
                    and c.relname = expected.table_name
                    and c.relkind in ('r','p')
order by expected.table_name;

-- 2. Столбцы и значения по умолчанию. Здесь нет содержимого записей.
select table_name, ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and table_name in ('branches','coaches','managers','students',
                     'student_comments','sessions','session_students')
order by table_name, ordinal_position;

-- 3. Реальные ограничения (PK, FK, CHECK, UNIQUE).
select c.relname as table_name, con.conname, con.contype,
       pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class c on c.oid = con.conrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('branches','coaches','managers','students',
                    'student_comments','sessions','session_students')
order by c.relname, con.conname;

-- 4. Индексы. Проверить не только название: indisunique=true,
-- indisvalid=true, predicate=NULL и действительно external_id.
select t.relname as table_name, i.relname as index_name,
       x.indisunique, x.indisvalid,
       pg_get_expr(x.indpred, x.indrelid) as predicate,
       pg_get_indexdef(x.indexrelid) as definition
from pg_index x
join pg_class t on t.oid = x.indrelid
join pg_class i on i.oid = x.indexrelid
join pg_namespace n on n.oid = t.relnamespace
where n.nspname = 'public' and t.relname in ('students','sessions')
order by t.relname, i.relname;

-- 5. Полный текст RLS. Ожидаемые числа по исходному SQL:
-- branches 1, coaches 2, managers 2, students 2,
-- student_comments 1, sessions 2, session_students 2: всего 12.
select tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('branches','coaches','managers','students',
                    'student_comments','sessions','session_students')
order by tablename, policyname;

-- 6. Создан ли триггер привязки Auth и что он вызывает.
select t.tgname, pg_get_triggerdef(t.oid) as trigger_definition,
       pg_get_functiondef(t.tgfoid) as function_definition
from pg_trigger t
where t.tgrelid = to_regclass('auth.users')
  and t.tgname = 'on_auth_user_created' and not t.tgisinternal;

-- 7. Только количества. По последней сверке пользователя в СУЩЕСТВУЮЩЕМ проекте:
-- branches=2, остальные шесть таблиц=0. Иное значение: СТОП,
-- выяснить происхождение данных; ничего не очищать.
select 'branches' as table_name, count(*) as row_count from public.branches
union all select 'coaches', count(*) from public.coaches
union all select 'managers', count(*) from public.managers
union all select 'students', count(*) from public.students
union all select 'student_comments', count(*) from public.student_comments
union all select 'sessions', count(*) from public.sessions
union all select 'session_students', count(*) from public.session_students;

-- 8. Есть ли конфликтующие external_id перед созданием unique-индексов.
-- Возвращает количество групп повторов, а не персональные данные.
select 'students' as table_name, count(*) as duplicate_external_id_groups
from (select external_id from public.students where external_id is not null
      group by external_id having count(*) > 1) d
union all
select 'sessions', count(*)
from (select external_id from public.sessions where external_id is not null
      group by external_id having count(*) > 1) d;

-- 9. Только агрегаты Auth и привязок: ни паролей, ни e-mail, ни токенов.
-- Даже при пустых таблицах CRM существующие Auth-аккаунты требуют проверки.
select (select count(*) from auth.users) as auth_users,
       (select count(*) from auth.users where email_confirmed_at is null) as unconfirmed_auth_users,
       (select count(*) from public.coaches where user_id is null) as unlinked_coaches,
       (select count(*) from public.managers where user_id is null) as unlinked_managers;

-- 10. Table and column grants (definitions only).
select table_name,grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated','PUBLIC')
order by table_name,grantee,privilege_type;
select table_name,column_name,grantee,privilege_type from information_schema.column_privileges
where table_schema='public' and grantee in ('anon','authenticated','PUBLIC')
order by table_name,column_name,grantee;
-- 11. Existing functions and ACL, not user data.
select p.proname,pg_get_function_identity_arguments(p.oid) args,p.prosecdef,p.proconfig,p.proacl
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','crm_private') and p.proname in
('is_owner','my_manager_branches','is_manager','my_coach_id','my_coach_branches',
'can_see_branch','can_manage_branch','link_auth_user','crm_snapshot','crm_mutate','crm_admin_snapshot','crm_historical_students')
order by n.nspname,p.proname;
-- 12. Views can expose extra data. Review any CRM-related view before deployment.
select c.relname,c.reloptions,c.relacl from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('v','m') order by c.relname;
