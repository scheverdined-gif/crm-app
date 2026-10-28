-- Additive update for the EXISTING CRM 2.2.3 Supabase project. Review before manual application.
-- No imports, table drops, RLS changes, or deletion of rows during migration.
begin;
do $$ begin
  if to_regprocedure('crm_private.checked_row(text,uuid,jsonb)') is null or
    to_regprocedure('public.crm_mutate(text,jsonb,jsonb)') is null then
    raise exception 'Install/review the existing CRM Stage 1 schema before this additive update';
  end if;
end $$;

create or replace function crm_private.keep_training_history() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if old.status<>'upcoming' or old.attendance_recorded or
    exists(select 1 from public.session_students p where p.session_id=old.id and (p.present is not null or p.promo_result is not null)) or
    exists(select 1 from public.students s where s.promo_conversion_session_id=old.id) then
    raise exception using errcode='23514',message='Занятие содержит историю: удаление запрещено. Посещаемость и начисления сохранены';
  end if;
  return old;
end $$;
do $$ begin
  if not exists(select 1 from pg_trigger where tgrelid='public.sessions'::regclass and tgname='crm_keep_training_history') then
    create trigger crm_keep_training_history before delete on public.sessions for each row execute function crm_private.keep_training_history();
  end if;
end $$;

create or replace function public.crm_delete_session_scope(p_payload jsonb,p_expected jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare a jsonb=crm_private.actor(); anchor jsonb; rid uuid; target uuid; mode text;
  candidates uuid[]; requested uuid[];
begin
  if not crm_private.is_owner() and a->>'kind'<>'coach' then
    raise exception using errcode='42501',message='Администратору доступен только просмотр посещаемости';
  end if;
  perform pg_advisory_xact_lock(223001);
  rid=(p_payload->>'id')::uuid;mode=p_payload->>'scope';
  if mode is null or mode not in ('single','series','following') then raise exception 'Некорректная область удаления'; end if;
  if not crm_private.owns_session(rid) then raise exception using errcode='42501',message='Нет прав на тренировку'; end if;
  anchor=crm_private.checked_row('sessions',rid,p_expected);
  if mode<>'single' and anchor->>'template_id' is null then raise exception 'Тренировка не входит в серию'; end if;
  if jsonb_typeof(p_payload->'session_ids') is distinct from 'array' then raise exception 'Нужен подтверждённый список тренировок'; end if;
  select coalesce(array_agg(value::uuid order by value::uuid),'{}'::uuid[]) into requested from jsonb_array_elements_text(p_payload->'session_ids');
  select coalesce(array_agg(s.id order by s.id),'{}'::uuid[]) into candidates from public.sessions s
    where (case when mode='single' then s.id=rid else s.template_id=(anchor->>'template_id')::uuid and
      (mode='series' or (s.date,s.time::time)>=((anchor->>'date')::date,(anchor->>'time')::time)) end)
    and s.status='upcoming' and not s.attendance_recorded
    and not exists(select 1 from public.session_students p where p.session_id=s.id and (p.present is not null or p.promo_result is not null))
    and not exists(select 1 from public.students st where st.promo_conversion_session_id=s.id);
  -- Reject changed membership, new sessions, completed sessions and duplicate client IDs; never silently broaden confirmation.
  if candidates is distinct from requested or cardinality(candidates)=0 then
    raise exception using errcode='40001',message='Состав серии изменился или занятия содержат историю. Обновите данные и подтвердите заново';
  end if;
  foreach target in array candidates loop
    if not crm_private.owns_session(target) then raise exception using errcode='42501',message='Нет прав на все тренировки серии'; end if;
    perform crm_private.checked_row('sessions',target,p_expected);
  end loop;
  delete from public.sessions where id=any(candidates);
  return jsonb_build_object('ok',true,'deleted_ids',to_jsonb(candidates));
end $$;
revoke all on function crm_private.keep_training_history() from public,anon,authenticated;
revoke all on function public.crm_delete_session_scope(jsonb,jsonb) from public,anon;
grant execute on function public.crm_delete_session_scope(jsonb,jsonb) to authenticated;
notify pgrst,'reload schema';
commit;
