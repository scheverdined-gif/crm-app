-- Stage 1, based on the supplied 01_schema.sql / 02_import_helpers.sql.
-- REVIEW FIRST. Never run against the existing remote project without approval.
-- No tables/data are dropped. RLS stays enabled. Run each migration as one transaction.
-- Existing project: Claude 01_schema.sql / 02_import_helpers.sql are already installed; do not rerun them.
begin;
do $$
declare t text;
begin
  if to_regprocedure('crm_private.actor()') is not null then
    raise exception 'CRM migration is already installed; do not rerun. Review the installed version before any repair';
  end if;
  foreach t in array array['branches','coaches','managers','students','sessions','session_students','student_comments'] loop
    if to_regclass('public.'||t) is null then raise exception 'Missing base table: %', t; end if;
  end loop;
  if exists(select 1 from public.students where cardinality(extra_disciplines)>0 or cardinality(extra_coach_ids)>0) then
    raise exception 'Legacy extra assignments need a reviewed mapping before this migration';
  end if;
  if exists(select 1 from public.coaches c join public.managers m on lower(c.email)=lower(m.email) or c.user_id=m.user_id) then
    raise exception 'Ambiguous employee identities need review';
  end if;
  if exists(select 1 from pg_policies where schemaname='public' and tablename in
    ('branches','coaches','managers','students','sessions','session_students','student_comments') and policyname not in
    ('branches_read','coaches_read','coaches_write','managers_read','managers_write','students_read','students_write',
     'comments_all','sessions_read','sessions_write','ss_all','ss_read','crm_read')) then
    raise exception 'Unknown policies: review live schema before replacing access rules';
  end if;
end $$;

create schema if not exists crm_private;
revoke all on schema crm_private from public, anon;
grant usage on schema crm_private to authenticated;

alter table public.coaches add column if not exists disciplines text[];
update public.coaches set disciplines=array[discipline] where disciplines is null;
alter table public.coaches alter column disciplines set not null;
alter table public.coaches add constraint crm_coach_directions check (
  cardinality(disciplines)>0 and discipline=any(disciplines) and
  disciplines <@ array['rollers','skate','bike','bmx','scooter','balance']::text[]);

alter table public.students add column if not exists child_id uuid;
-- Each old row remains an independent child. No matching by name/date/parent.
update public.students set child_id=gen_random_uuid() where child_id is null;
alter table public.students alter column child_id set not null;
alter table public.students add constraint crm_one_direction unique(child_id,discipline);
alter table public.students add column if not exists archived_at date;
alter table public.students add column if not exists birth_date date;
alter table public.students add column if not exists promo_conversion_session_id uuid references public.sessions(id) on delete restrict;
alter table public.students add column if not exists promo_prior_state jsonb;
alter table public.students add column if not exists promo_status_manual boolean;
alter table public.students add column if not exists status_history jsonb not null default '[]';
alter table public.students add column if not exists legacy_attendance numeric;
alter table public.students add column if not exists attendance_coach_id uuid references public.coaches(id) on delete restrict;
alter table public.students add column if not exists last_note text not null default '';
alter table public.students add column if not exists legacy_review boolean not null default false;
alter table public.students add column if not exists legacy_assignments jsonb;
-- Not returned by the ordinary CRM API; reserved for a separately approved import.
alter table public.students add column if not exists source_metadata jsonb;
alter table public.students alter column join_date drop not null;
alter table public.students alter column join_date drop default;
alter table public.sessions add column if not exists attendance_recorded boolean not null default false;
alter table public.session_students add column if not exists promo_result text check(promo_result in ('bought','not_bought'));
update public.sessions x set attendance_recorded=true where exists(
  select 1 from public.session_students p where p.session_id=x.id and p.present is not null);

do $$
declare t text; c record;
begin
  foreach t in array array['students','sessions','coaches','managers'] loop
    execute format('alter table public.%I add column if not exists revision bigint not null default 1',t);
    execute format('alter table public.%I add column if not exists updated_at timestamptz not null default now()',t);
  end loop;
  -- Preserve history even if a privileged maintenance operation tries a hard delete.
  for c in select conname, conrelid::regclass tbl from pg_constraint
    where contype='f' and confrelid='public.students'::regclass
      and conrelid in ('public.session_students'::regclass,'public.student_comments'::regclass) loop
    execute format('alter table %s drop constraint %I',c.tbl,c.conname);
  end loop;
end $$;
alter table public.session_students add constraint crm_roster_student_history foreign key(student_id) references public.students(id) on delete restrict;
alter table public.student_comments add constraint crm_comment_student_history foreign key(student_id) references public.students(id) on delete restrict;
create index if not exists crm_students_child_idx on public.students(child_id);
create index if not exists crm_sessions_scope_idx on public.sessions(coach_id,branch_id,date);
create index if not exists crm_roster_student_idx on public.session_students(student_id,session_id);

create function crm_private.touch_revision() returns trigger language plpgsql set search_path='' as $$
begin new.revision=old.revision+1; new.updated_at=clock_timestamp(); return new; end $$;
do $$ declare t text; begin
  foreach t in array array['students','sessions','coaches','managers'] loop
    execute format('create trigger crm_revision before update on public.%I for each row execute function crm_private.touch_revision()',t);
  end loop;
end $$;

-- Roles are assigned by a trusted explicit Auth UUID, never an email-only signup trigger.
-- Preserve the installed trigger, replacing its unsafe automatic linking behavior.
create or replace function public.link_auth_user() returns trigger language plpgsql security definer set search_path='' as $$
begin return new; end $$;

create function crm_private.actor() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a jsonb; n int;
begin
  if auth.uid() is null then raise exception using errcode='42501',message='Войдите в CRM'; end if;
  select count(*) into n from (
    select id from public.managers where user_id=auth.uid()
    union all select id from public.coaches where user_id=auth.uid()) x;
  if n<>1 then raise exception using errcode='42501',message='Аккаунту не назначена однозначная роль CRM'; end if;
  select jsonb_build_object('kind','manager','id',id,'role',role,'branches',branches) into a
    from public.managers where user_id=auth.uid();
  if a is null then
    select jsonb_build_object('kind','coach','id',id,'branches',branches) into a from public.coaches where user_id=auth.uid();
  end if;
  return a;
end $$;
create function crm_private.is_owner() returns boolean language sql stable security definer set search_path='' as $$
  select coalesce((crm_private.actor()->>'role')='owner',false)
$$;
create function crm_private.owns_session(sid uuid) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.sessions x where x.id=sid and (
    crm_private.is_owner() or (x.coach_id=(crm_private.actor()->>'id')::uuid and
      (crm_private.actor()->'branches') ? x.branch_id and crm_private.actor()->>'kind'='coach')))
$$;
create function crm_private.sees_student(sid uuid) returns boolean language sql stable security definer set search_path='' as $$
  select crm_private.is_owner() or exists(select 1 from public.students s where s.id=sid and
    crm_private.actor()->>'kind'='coach' and
      s.coach_id=(crm_private.actor()->>'id')::uuid and (crm_private.actor()->'branches') ? s.branch_id)
$$;

do $$ declare p record; t text; begin
  for p in select tablename,policyname from pg_policies where schemaname='public' and tablename in
    ('branches','coaches','managers','students','sessions','session_students','student_comments') loop
    execute format('drop policy %I on public.%I',p.policyname,p.tablename);
  end loop;
  foreach t in array array['branches','coaches','managers','students','sessions','session_students','student_comments'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
  end loop;
end $$;
-- Direct writes are deliberately absent. Atomic RPCs below perform scoped writes.
create policy crm_read on public.branches for select to authenticated using(
  crm_private.is_owner() or (crm_private.actor()->'branches') ? id);
create policy crm_read on public.coaches for select to authenticated using(
  crm_private.is_owner() or user_id=auth.uid());
create policy crm_read on public.managers for select to authenticated using(
  crm_private.is_owner() or user_id=auth.uid());
create policy crm_read on public.students for select to authenticated using(crm_private.sees_student(id));
create policy crm_read on public.sessions for select to authenticated using(crm_private.owns_session(id));
create policy crm_read on public.session_students for select to authenticated using(crm_private.owns_session(session_id));
create policy crm_read on public.student_comments for select to authenticated using(crm_private.sees_student(student_id));
-- Remove direct access to import metadata; grants for columns are explicit.
revoke select on public.students from authenticated;
grant select(id,name,age,discipline,coach_id,branch_id,level,phone,join_date,left_date,origin,status,flag,
  extra_coach_ids,extra_disciplines,external_id,created_at,child_id,archived_at,birth_date,
  promo_conversion_session_id,promo_prior_state,promo_status_manual,status_history,legacy_attendance,
  attendance_coach_id,last_note,legacy_review,legacy_assignments,revision,updated_at) on public.students to authenticated;

create function public.crm_historical_students() returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if crm_private.actor()->>'kind'<>'coach' then return '[]'::jsonb; end if;
  -- A past attendee remains readable in that coach's diary, without the current private card/comments.
  return coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'age',s.age,'child_id',s.child_id,
    'discipline',s.discipline,'coach_id',s.coach_id,'branch_id',s.branch_id,'archived_at',s.archived_at,'revision',s.revision))
    from public.students s where not crm_private.sees_student(s.id) and exists(
      select 1 from public.session_students p where p.student_id=s.id and crm_private.owns_session(p.session_id))),'[]');
end $$;

create function public.crm_admin_snapshot() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a jsonb=crm_private.actor(); result jsonb;
begin
  if a->>'role'<>'branch_manager' or a->>'kind'<>'manager' then
    raise exception using errcode='42501',message='Только просмотр расписания администратора';
  end if;
  -- Return only the projection needed by the existing attendance-only interface.
  select jsonb_build_object('students',coalesce((
    select jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'discipline',s.discipline,'branch_id',s.branch_id))
    from public.students s where exists(select 1 from public.session_students p join public.sessions x on x.id=p.session_id
      where p.student_id=s.id and (a->'branches') ? x.branch_id)), '[]'),
    'coaches',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'discipline',c.discipline,'branches',c.branches))
      from public.coaches c where exists(select 1 from public.sessions x where x.coach_id=c.id and (a->'branches') ? x.branch_id)), '[]'),
    'sessions',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'type',x.type,'discipline',x.discipline,'coach_id',x.coach_id,
      'branch_id',x.branch_id,'date',x.date,'time',x.time,'duration',x.duration,'group_name',x.group_name,'status',x.status,
      'attendance_recorded',x.attendance_recorded)) from public.sessions x where (a->'branches') ? x.branch_id),'[]'),
    'participants',coalesce((select jsonb_agg(jsonb_build_object('session_id',p.session_id,'student_id',p.student_id,'present',p.present))
      from public.session_students p join public.sessions x on x.id=p.session_id where (a->'branches') ? x.branch_id),'[]'),
    'managers',jsonb_build_array((select to_jsonb(m) from public.managers m where m.user_id=auth.uid())),
    'comments','[]'::jsonb) into result;
  return result;
end $$;

create function public.crm_snapshot() returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare a jsonb=crm_private.actor(); result jsonb;
begin
  if a->>'role'='branch_manager' then return public.crm_admin_snapshot(); end if;
  -- One response/SQL snapshot avoids partial multi-request state and API row caps.
  select jsonb_build_object(
    'students',coalesce((select jsonb_agg(to_jsonb(s)) from (select id,name,age,discipline,coach_id,branch_id,level,phone,
      join_date,left_date,origin,status,flag,child_id,archived_at,birth_date,promo_conversion_session_id,promo_prior_state,
      promo_status_manual,status_history,legacy_attendance,attendance_coach_id,last_note,legacy_review,legacy_assignments,revision
      from public.students) s),'[]') || public.crm_historical_students(),
    'sessions',coalesce((select jsonb_agg(to_jsonb(x)) from public.sessions x),'[]'),
    'participants',coalesce((select jsonb_agg(to_jsonb(p)) from public.session_students p),'[]'),
    'coaches',coalesce((select jsonb_agg(to_jsonb(c)) from public.coaches c),'[]'),
    'managers',coalesce((select jsonb_agg(to_jsonb(m)) from public.managers m),'[]'),
    'comments',coalesce((select jsonb_agg(to_jsonb(c)) from public.student_comments c),'[]')) into result;
  return result;
end $$;

-- Existing email-link/helper functions are not part of the new public API.
do $$ declare f record; begin
  for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('is_owner','my_manager_branches','is_manager','my_coach_id',
      'my_coach_branches','can_see_branch','can_manage_branch','link_auth_user') loop
    execute format('revoke execute on function %s from public, anon, authenticated',f.signature);
  end loop;
end $$;
revoke all on all functions in schema crm_private from public,anon,authenticated;
grant execute on function crm_private.actor(),crm_private.is_owner(),crm_private.owns_session(uuid),crm_private.sees_student(uuid) to authenticated;
revoke all on function public.crm_snapshot(),public.crm_admin_snapshot(),public.crm_historical_students() from public,anon;
grant execute on function public.crm_snapshot(),public.crm_admin_snapshot(),public.crm_historical_students() to authenticated;
commit;
