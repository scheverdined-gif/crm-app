-- Apply after 2026101701_model_access.sql. No real-data import.
begin;
create function crm_private.check_session_fields(x jsonb) returns void language plpgsql set search_path='' as $$
begin
  if coalesce(x->>'type','') not in ('group','individual','sport_group','promo') or
    coalesce(x->>'date','') !~ '^\d{4}-\d{2}-\d{2}$' or
    coalesce(x->>'time','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' or
    nullif(btrim(x->>'group_name'),'') is null then raise exception 'Проверьте тип, дату, время и название тренировки'; end if;
  if (x->>'duration')::int is distinct from (case x->>'type' when 'promo' then 45 when 'sport_group' then 120 else 60 end) then
    raise exception 'Длительность должна соответствовать типу тренировки';
  end if;
end $$;
create function crm_private.checked_row(tbl text, rid uuid, expected jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r jsonb; v bigint;
begin
  if tbl not in ('students','sessions','coaches','managers') then raise exception 'Invalid revision table'; end if;
  execute format('select to_jsonb(t) from public.%I t where id=$1 for update',tbl) into r using rid;
  if r is null then raise exception using errcode='40001',message='Запись удалена или недоступна. Обновите данные'; end if;
  v=(expected->tbl->>rid::text)::bigint;
  if v is null or v<>(r->>'revision')::bigint then
    raise exception using errcode='40001',message='Данные изменены другим сотрудником. Обновите данные и повторите сохранение';
  end if;
  return r;
end $$;

create function crm_private.can_write_student(r jsonb) returns boolean language sql stable security definer set search_path='' as $$
  -- A legacy unassigned coach_id must deny access, not produce NULL in IF NOT permission.
  select coalesce(crm_private.is_owner() or (crm_private.actor()->>'kind'='coach' and
    r->>'coach_id'=crm_private.actor()->>'id' and (crm_private.actor()->'branches') ? (r->>'branch_id')),false)
$$;
create function crm_private.check_assignment(cid uuid,bid text,dir text) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.coaches c where c.id=cid and bid=any(c.branches) and dir=any(c.disciplines)) then
    raise exception using errcode='23514',message='Наставник не назначен на этот филиал и направление';
  end if;
  if not crm_private.is_owner() and (crm_private.actor()->>'kind'<>'coach' or cid::text<>crm_private.actor()->>'id'
    or not (crm_private.actor()->'branches') ? bid) then
    raise exception using errcode='42501',message='Недостаточно прав для выбранного наставника/филиала';
  end if;
end $$;

create function crm_private.status_event(sid uuid, action text, before_state jsonb, session_id uuid default null) returns void
language plpgsql security definer set search_path='' as $$
begin
  update public.students s set status_history=s.status_history || jsonb_build_array(jsonb_build_object(
    'at',clock_timestamp(),'actorId',auth.uid(),'action',action,'sessionId',session_id,'before',before_state,
    'after',jsonb_build_object('origin',s.origin,'status',s.status,'leftDate',s.left_date))) where s.id=sid;
end $$;

create function crm_private.promo_apply(sid uuid, xid uuid, result text, expected jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare s jsonb; d date; previous jsonb;
begin
  s=crm_private.checked_row('students',sid,expected);
  previous=jsonb_build_object('origin',s->'origin','status',s->'status','leftDate',s->'left_date');
  select date into d from public.sessions where id=xid;
  if result in ('bought','not_bought') then
    update public.students set origin=case when result='bought' then 'regular' else 'promo' end,
      status=case when result='bought' then 'active' else 'left' end,
      left_date=case when result='not_bought' then d else null end,
      promo_prior_state=coalesce(promo_prior_state,previous),promo_status_manual=false,promo_conversion_session_id=xid
      where id=sid;
    perform crm_private.status_event(sid,'promo_result',previous,xid);
  elsif s->>'promo_conversion_session_id'=xid::text then
    -- Stage 1 enforces a single trial. Existing ambiguous repeat histories must be reviewed, not guessed.
    if exists(select 1 from public.session_students p join public.sessions x on x.id=p.session_id
      where p.student_id=sid and x.type='promo' and x.status<>'upcoming' and x.id<>xid and p.promo_result is not null) then
      raise exception 'Legacy multiple promo sources need review';
    end if;
    update public.students set origin=coalesce(promo_prior_state->>'origin','promo'),
      status=coalesce(promo_prior_state->>'status',status),
      left_date=case when promo_prior_state ? 'leftDate' then (promo_prior_state->>'leftDate')::date else left_date end,
      promo_prior_state=null,promo_conversion_session_id=null where id=sid;
    perform crm_private.status_event(sid,'promo_undo',previous,xid);
  end if;
end $$;

create function crm_private.validate_roster(x jsonb, old_ids uuid[] default '{}') returns void
language plpgsql security definer set search_path='' as $$
declare sid uuid; s public.students; count_rows int; count_children int; trial_exists boolean;
begin
  perform crm_private.check_assignment((x->>'coach_id')::uuid,x->>'branch_id',x->>'discipline');
  if jsonb_typeof(x->'student_ids') is distinct from 'array' or jsonb_array_length(x->'student_ids')=0 then raise exception 'Выберите учеников'; end if;
  select count(*),count(distinct st.child_id) into count_rows,count_children
    from jsonb_array_elements_text(x->'student_ids') j join public.students st on st.id=j.value::uuid;
  if count_rows<>jsonb_array_length(x->'student_ids') or count_children<>count_rows then
    raise exception 'Один ребёнок не может быть дважды в составе';
  end if;
  if x->>'type'='individual' and count_rows<>1 then raise exception 'В индивидуальной тренировке только один ученик'; end if;
  for sid in select value::uuid from jsonb_array_elements_text(x->'student_ids') loop
    select * into s from public.students where id=sid;
    if s.coach_id<>(x->>'coach_id')::uuid or s.coach_id is null or s.branch_id<>x->>'branch_id' or s.discipline<>x->>'discipline' then
      raise exception 'Состав должен соответствовать наставнику, направлению и филиалу';
    end if;
    if (s.archived_at is not null or s.status='left') and not sid=any(old_ids) then raise exception 'Ученик недоступен для новой тренировки'; end if;
    select exists(select 1 from public.sessions p join public.session_students r on r.session_id=p.id
      join public.students q on q.id=r.student_id where p.type='promo' and p.discipline=s.discipline and q.child_id=s.child_id
        and p.id is distinct from (x->>'id')::uuid) into trial_exists;
    if x->>'type'='promo' and trial_exists then raise exception 'Повторное промо запрещено: одно пробное на ребёнка/направление'; end if;
    if s.origin='promo' and not trial_exists and x->>'type'<>'promo' then raise exception 'Первое занятие промо-ученика должно быть промо'; end if;
  end loop;
end $$;

create function public.crm_mutate(p_command text, p_payload jsonb, p_expected jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  actor jsonb=crm_private.actor(); r jsonb; x jsonb; s jsonb; prior jsonb; item jsonb; c jsonb;
  rid uuid; sid uuid; cid uuid; xid uuid; child uuid; ids uuid[]; old_ids uuid[]; result text; old_result text;
  mark text; revision_id uuid; any_present boolean=false; snapshot_before jsonb; dirs text[]; bs text[];
begin
  if not crm_private.is_owner() and actor->>'kind'<>'coach' then
    raise exception using errcode='42501',message='Администратору доступен только просмотр посещаемости';
  end if;
  -- Small-school MVP: serialize short commits; optimistic versions still reject stale screens.
  -- All client writes use this entry point; direct table writes are revoked.
  perform pg_advisory_xact_lock(223001);
  rid=(p_payload->>'id')::uuid;

  if p_command in ('student_create','student_update','student_patch','student_archive') then
    if p_command='student_create' then
      rid=coalesce(rid,gen_random_uuid()); child=coalesce((p_payload->>'child_id')::uuid,gen_random_uuid());
      perform crm_private.check_assignment((p_payload->>'coach_id')::uuid,p_payload->>'branch_id',p_payload->>'discipline');
      if exists(select 1 from public.students where child_id=child) and not crm_private.is_owner() and
        not exists(select 1 from public.students q where q.child_id=child and crm_private.can_write_student(to_jsonb(q))) then
        raise exception using errcode='42501',message='Связать ребёнка другого наставника может владелец после проверки личности';
      end if;
      if exists(select 1 from public.students where child_id=child and (name is distinct from btrim(p_payload->>'name') or age is distinct from (p_payload->>'age')::int)) then
        raise exception 'Имя и возраст должны соответствовать выбранному ребёнку';
      end if;
      if nullif(btrim(p_payload->>'name'),'') is null or (p_payload->>'age')::int not between 4 and 25 or p_payload->>'age' is null then
        raise exception 'Укажите имя и возраст от 4 до 25 лет';
      end if;
      -- Normal student form in CRM 2.2.3 creates an active promo enrollment (not a legacy importer).
      insert into public.students(id,child_id,name,age,discipline,coach_id,branch_id,level,phone,join_date,origin,status)
        values(rid,child,btrim(p_payload->>'name'),(p_payload->>'age')::int,p_payload->>'discipline',(p_payload->>'coach_id')::uuid,
          p_payload->>'branch_id',coalesce(p_payload->>'level','Начальный'),case when p_payload ? 'phone' then p_payload->>'phone' else '' end,
          coalesce((p_payload->>'join_date')::date,current_date),'promo','active');
    else
      r=crm_private.checked_row('students',rid,p_expected);
      if not crm_private.can_write_student(r) then raise exception using errcode='42501',message='Нет прав на ученика'; end if;
      if p_command='student_archive' then
        update public.students set archived_at=coalesce((p_payload->>'archived_at')::date,current_date) where id=rid;
      elsif p_command='student_patch' then
        -- Only existing quick controls; never accept client-written automatic provenance/history.
        if p_payload ? 'status' and p_payload->>'status' not in ('active','vacation','left') then raise exception 'Некорректный статус'; end if;
        if p_payload ? 'origin' and p_payload->>'origin' not in ('regular','promo') then raise exception 'Некорректное происхождение'; end if;
        prior=jsonb_build_object('origin',r->'origin','status',r->'status','leftDate',r->'left_date');
        update public.students set status=coalesce(p_payload->>'status',status),origin=coalesce(p_payload->>'origin',origin),
          archived_at=case when p_payload ? 'archived_at' then (p_payload->>'archived_at')::date else archived_at end,
          left_date=case when p_payload ? 'left_date' then (p_payload->>'left_date')::date else left_date end,
          flag=case when p_payload ? 'flag' then p_payload->>'flag' else flag end,
          promo_status_manual=case when p_payload ? 'status' and promo_conversion_session_id is not null then true else promo_status_manual end,
          promo_prior_state=case when p_payload->>'origin'='regular' then null
            when p_payload ? 'status' and promo_prior_state is not null then promo_prior_state || jsonb_build_object('status',p_payload->>'status','leftDate',p_payload->>'left_date') else promo_prior_state end,
          promo_conversion_session_id=case when p_payload->>'origin'='regular' then null else promo_conversion_session_id end
          where id=rid;
        if p_payload ? 'status' or p_payload ? 'origin' or p_payload ? 'left_date' then
          perform crm_private.status_event(rid,'manual_status',prior,null);
        end if;
      else
        if p_payload->>'discipline' is distinct from r->>'discipline' then raise exception 'Для другого направления создайте отдельную запись ребёнка'; end if;
        child=(p_payload->>'child_id')::uuid;
        if child is null then raise exception 'Не выбран ребёнок'; end if;
        if child::text<>r->>'child_id' and not crm_private.is_owner() then raise exception using errcode='42501',message='Связь личности меняет владелец'; end if;
        perform crm_private.check_assignment((p_payload->>'coach_id')::uuid,p_payload->>'branch_id',p_payload->>'discipline');
        if nullif(btrim(p_payload->>'name'),'') is null or (p_payload->>'age')::int not between 4 and 25 or p_payload->>'age' is null then raise exception 'Укажите имя и возраст от 4 до 25 лет'; end if;
        -- Protect all shared name/age edits from stale updates; otherwise an update would overwrite another coach.
        for s in select to_jsonb(q) from public.students q where child_id=child and id<>rid loop
          if (s->>'name' is distinct from btrim(p_payload->>'name') or s->>'age' is distinct from p_payload->>'age') then
            if not (p_expected->'students') ? (s->>'id') then raise exception 'Общие данные ребёнка меняет владелец с полной карточкой'; end if;
            perform crm_private.checked_row('students',(s->>'id')::uuid,p_expected);
          end if;
        end loop;
        update public.students set child_id=child,name=btrim(p_payload->>'name'),age=(p_payload->>'age')::int,
          coach_id=(p_payload->>'coach_id')::uuid,branch_id=p_payload->>'branch_id',level=p_payload->>'level',
          phone=case when p_payload ? 'phone' then p_payload->>'phone' else phone end,legacy_review=false where id=rid;
        update public.students set name=btrim(p_payload->>'name'),age=(p_payload->>'age')::int where child_id=child and id<>rid
          and (name is distinct from btrim(p_payload->>'name') or age is distinct from (p_payload->>'age')::int);
      end if;
    end if;
    if p_command in ('student_create','student_update','student_patch') and p_payload ? 'comments' then
      if jsonb_typeof(p_payload->'comments')<>'array' then raise exception 'Некорректные комментарии'; end if;
      delete from public.student_comments where student_id=rid;
      for c in select value from jsonb_array_elements(p_payload->'comments') loop
        if nullif(btrim(c->>'text'),'') is null then raise exception 'Пустой комментарий'; end if;
        insert into public.student_comments(id,student_id,date,text) values(coalesce((c->>'id')::uuid,gen_random_uuid()),rid,(c->>'date')::date,btrim(c->>'text'));
      end loop;
    end if;

  elsif p_command in ('session_create','sessions_create','session_update','session_close','session_delete') then
    if p_command in ('session_create','sessions_create') then
      for x in select value from jsonb_array_elements(case when p_command='sessions_create' then p_payload->'sessions' else jsonb_build_array(p_payload) end) loop
        if p_command='sessions_create' and x->>'type'='promo' then raise exception 'Промо создаётся только разово'; end if;
        perform crm_private.validate_roster(x);
        perform crm_private.check_session_fields(x);
        xid=coalesce((x->>'id')::uuid,gen_random_uuid());
        insert into public.sessions(id,type,discipline,coach_id,branch_id,date,time,duration,group_name,note,status,template_id)
          values(xid,x->>'type',x->>'discipline',(x->>'coach_id')::uuid,x->>'branch_id',(x->>'date')::date,x->>'time',
            (x->>'duration')::int,x->>'group_name',coalesce(x->>'note',''),'upcoming',(x->>'template_id')::uuid);
        insert into public.session_students(session_id,student_id) select xid,value::uuid from jsonb_array_elements_text(x->'student_ids');
      end loop;
    else
      if not crm_private.owns_session(rid) then raise exception using errcode='42501',message='Нет прав на тренировку'; end if;
      r=crm_private.checked_row('sessions',rid,p_expected);
      select array_agg(student_id order by student_id) into old_ids from public.session_students where session_id=rid;
      if p_command='session_delete' then
        if r->>'type'='promo' then
          for sid in select student_id from public.session_students where session_id=rid loop
            perform crm_private.promo_apply(sid,rid,null,p_expected);
          end loop;
        end if;
        delete from public.sessions where id=rid;
      elsif p_command='session_close' then
        if nullif(btrim(p_payload->>'note'),'') is null then raise exception 'Заметка обязательна — опишите, как прошла тренировка'; end if;
        for sid in select student_id from public.session_students where session_id=rid loop
          mark=p_payload->'attendance'->>sid::text;
          if mark is null or mark not in ('present','absent') then raise exception 'Отметьте посещение каждого ученика'; end if;
          result=p_payload->'promo_results'->>sid::text;
          if result is not null and result not in ('bought','not_bought') then result=null; end if;
          if r->>'type'='promo' and mark='present' and result is null then raise exception 'Выберите «Купил» или «Не купил» для каждого присутствовавшего участника промо'; end if;
          if mark='present' then any_present=true; end if;
        end loop;
        update public.sessions set note=btrim(p_payload->>'note'),attendance_recorded=true,
          status=case when any_present then 'done' else 'missed' end where id=rid;
        for sid in select student_id from public.session_students where session_id=rid loop
          result=case when r->>'type'='promo' then p_payload->'promo_results'->>sid::text else null end;
          if result is not null and result not in ('bought','not_bought') then result=null; end if;
          select promo_result into old_result from public.session_students where session_id=rid and student_id=sid;
          update public.session_students set present=(p_payload->'attendance'->>sid::text='present'),promo_result=result where session_id=rid and student_id=sid;
          if r->>'type'='promo' and (r->>'status'='upcoming' or old_result is distinct from result) then
            perform crm_private.promo_apply(sid,rid,result,p_expected);
          end if;
        end loop;
      else
        perform crm_private.check_session_fields(p_payload);
        if r->>'status'<>'upcoming' then
          select array_agg(value::uuid order by value::uuid) into ids from jsonb_array_elements_text(p_payload->'student_ids');
          if ids is distinct from old_ids or exists(select 1 from unnest(array['coach_id','branch_id','discipline','type']) k where r->>k is distinct from p_payload->>k) then
            raise exception 'У закрытой тренировки тип, наставник, направление, филиал и состав зафиксированы';
          end if;
          if nullif(btrim(p_payload->>'note'),'') is null then raise exception 'Заметка обязательна'; end if;
        else
          perform crm_private.validate_roster(p_payload,coalesce(old_ids,'{}'));
          delete from public.session_students where session_id=rid;
          insert into public.session_students(session_id,student_id) select rid,value::uuid from jsonb_array_elements_text(p_payload->'student_ids');
        end if;
        update public.sessions set type=p_payload->>'type',discipline=p_payload->>'discipline',coach_id=(p_payload->>'coach_id')::uuid,
          branch_id=p_payload->>'branch_id',date=(p_payload->>'date')::date,time=p_payload->>'time',duration=(p_payload->>'duration')::int,
          group_name=p_payload->>'group_name',note=p_payload->>'note' where id=rid;
        if r->>'type'='promo' and r->>'status'<>'upcoming' and r->>'date' is distinct from p_payload->>'date' then
          for s in select to_jsonb(q) from public.students q join public.session_students p on p.student_id=q.id where p.session_id=rid and p.promo_result='not_bought'
            and q.promo_conversion_session_id=rid and q.promo_status_manual is not true and q.origin='promo' and q.status='left' loop
            if not coalesce((s->'promo_status_manual'='null'::jsonb and s->'promo_prior_state'->>'status'='left' and
              s->'promo_prior_state'->>'leftDate'=s->>'left_date'),false) and
              (s->>'left_date'=r->>'date' or s->>'promo_status_manual'='false' or s->'promo_prior_state'->>'status'<>'left') then
              perform crm_private.checked_row('students',(s->>'id')::uuid,p_expected);
              prior=jsonb_build_object('origin',s->'origin','status',s->'status','leftDate',s->'left_date');
              update public.students set left_date=(p_payload->>'date')::date where id=(s->>'id')::uuid;
              perform crm_private.status_event((s->>'id')::uuid,'promo_reschedule',prior,rid);
            end if;
          end loop;
        end if;
      end if;
    end if;

  elsif p_command in ('coach_create','coach_update','coach_delete','manager_create','manager_update','manager_delete') then
    if not crm_private.is_owner() then raise exception using errcode='42501',message='Управление сотрудниками доступно владельцу'; end if;
    if p_command like '%_delete' then
      r=crm_private.checked_row(case when p_command='coach_delete' then 'coaches' else 'managers' end,rid,p_expected);
      if p_command='coach_delete' then delete from public.coaches where id=rid;
      else
        if r->>'role'='owner' or r->>'user_id'=auth.uid()::text then raise exception 'Нельзя удалить владельца или текущий аккаунт'; end if;
        delete from public.managers where id=rid;
      end if;
    else
      if p_command like '%_update' then
        r=crm_private.checked_row(case when p_command='coach_update' then 'coaches' else 'managers' end,rid,p_expected);
        if r->>'user_id' is not null and lower(r->>'email')<>lower(btrim(p_payload->>'email')) then
          raise exception 'Почта связанного аккаунта меняется через Supabase Auth и отдельную сверку';
        end if;
      end if;
      if exists(select 1 from public.coaches where lower(email)=lower(btrim(p_payload->>'email')) and id is distinct from rid) or
        exists(select 1 from public.managers where lower(email)=lower(btrim(p_payload->>'email')) and id is distinct from rid) then raise exception 'Почта уже занята'; end if;
      if nullif(btrim(p_payload->>'name'),'') is null or p_payload->>'email' not like '%@%' then raise exception 'Укажите имя и почту'; end if;
      select array_agg(distinct value) into bs from jsonb_array_elements_text(p_payload->'branches');
      if coalesce(cardinality(bs),0)=0 or exists(select 1 from unnest(bs) b where not exists(select 1 from public.branches where id=b)) then raise exception 'Выберите существующий филиал'; end if;
      rid=coalesce(rid,gen_random_uuid());
      if p_command like 'coach_%' then
        select array_agg(distinct value) into dirs from jsonb_array_elements_text(p_payload->'disciplines');
        if p_command='coach_create' then
          insert into public.coaches(id,name,email,discipline,disciplines,exp,grade,branches)
            values(rid,btrim(p_payload->>'name'),lower(btrim(p_payload->>'email')),p_payload->>'discipline',dirs,p_payload->>'exp',p_payload->>'grade',bs);
        else
          if exists(select 1 from public.students where coach_id=rid and archived_at is null and (not discipline=any(dirs) or not branch_id=any(bs))) then
            raise exception 'Сначала переназначьте действующие записи удаляемого направления/филиала';
          end if;
          update public.coaches set name=btrim(p_payload->>'name'),discipline=p_payload->>'discipline',disciplines=dirs,exp=p_payload->>'exp',
            grade=p_payload->>'grade',branches=bs,email=lower(btrim(p_payload->>'email')) where id=rid;
        end if;
      else
        if r->>'role'='owner' and p_payload->>'role'<>'owner' and (r->>'user_id'=auth.uid()::text or (select count(*) from public.managers where role='owner')<2) then
          raise exception 'Нельзя понизить текущего или последнего владельца';
        end if;
        if p_command='manager_create' then
          insert into public.managers(id,name,email,role,branches) values(rid,btrim(p_payload->>'name'),lower(btrim(p_payload->>'email')),p_payload->>'role',bs);
        else update public.managers set name=btrim(p_payload->>'name'),email=lower(btrim(p_payload->>'email')),role=p_payload->>'role',branches=bs where id=rid;
        end if;
      end if;
    end if;
  else raise exception 'Неизвестная операция CRM';
  end if;
  return jsonb_build_object('id',rid,'ok',true);
end $$;

revoke all on all functions in schema crm_private from public,anon,authenticated;
grant execute on function crm_private.actor(),crm_private.is_owner(),crm_private.owns_session(uuid),crm_private.sees_student(uuid) to authenticated;
revoke all on function public.crm_mutate(text,jsonb,jsonb) from public,anon;
grant execute on function public.crm_mutate(text,jsonb,jsonb) to authenticated;
notify pgrst, 'reload schema';
commit;
