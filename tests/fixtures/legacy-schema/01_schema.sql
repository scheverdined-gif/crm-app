-- ============================================================
-- Extreme School CRM — схема Supabase
-- Запуск: Supabase Dashboard → SQL Editor → вставить → Run
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Справочники ----------
create table if not exists branches (
  id    text primary key,          -- 'roza' | 'irkutsk'
  label text not null
);
insert into branches (id, label) values ('roza','Роза'), ('irkutsk','Иркутский')
on conflict (id) do nothing;

-- ---------- Сотрудники ----------
-- Тренер: запись в coaches, привязана к аккаунту Supabase Auth через user_id
create table if not exists coaches (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references auth.users(id) on delete set null,
  name        text not null,
  email       text not null unique,
  discipline  text not null check (discipline in ('rollers','skate','bike','bmx','scooter','balance')),
  exp         text default '',
  grade       text not null default 'regular' check (grade in ('regular','pro')),
  branches    text[] not null default '{}',
  external_id text,                -- id в «Мой класс» (для повторного импорта)
  created_at  timestamptz default now()
);

create table if not exists managers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid unique references auth.users(id) on delete set null,
  name       text not null,
  email      text not null unique,
  role       text not null default 'branch_manager' check (role in ('owner','branch_manager')),
  branches   text[] not null default '{}',
  created_at timestamptz default now()
);

-- ---------- Ученики ----------
create table if not exists students (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  age               int,
  discipline        text not null check (discipline in ('rollers','skate','bike','bmx','scooter','balance')),
  coach_id          uuid references coaches(id) on delete restrict,
  branch_id         text not null references branches(id),
  level             text not null default 'Начальный',
  phone             text default '',
  join_date         date not null default current_date,
  left_date         date,
  origin            text not null default 'regular' check (origin in ('regular','promo')),
  status            text not null default 'active' check (status in ('active','vacation','left')),
  flag              text check (flag in ('injury')),   -- отметка «травма» (показывается в интерфейсе)
  extra_coach_ids   uuid[] not null default '{}',
  extra_disciplines text[] not null default '{}',
  external_id       text,
  created_at        timestamptz default now()
);
create index if not exists students_branch_idx on students(branch_id);
create index if not exists students_coach_idx  on students(coach_id);

create table if not exists student_comments (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  date       date not null default current_date,
  text       text not null,
  created_at timestamptz default now()
);

-- ---------- Тренировки ----------
create table if not exists sessions (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('group','individual','sport_group','promo')),
  discipline  text not null check (discipline in ('rollers','skate','bike','bmx','scooter','balance')),
  coach_id    uuid not null references coaches(id) on delete restrict,
  branch_id   text not null references branches(id),
  date        date not null,
  time        text not null,                       -- 'HH:MM'
  duration    int  not null default 60,
  group_name  text default '',
  note        text default '',
  status      text not null default 'upcoming' check (status in ('upcoming','done','missed')),
  template_id uuid,
  external_id text,
  created_at  timestamptz default now()
);
create index if not exists sessions_date_idx  on sessions(date);
create index if not exists sessions_coach_idx on sessions(coach_id);

-- Состав тренировки + отметка присутствия (present = null, пока не отмечено)
create table if not exists session_students (
  session_id uuid not null references sessions(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  present    boolean,
  primary key (session_id, student_id)
);
create index if not exists ss_student_idx on session_students(student_id);

-- ============================================================
-- Функции доступа (security definer — чтобы RLS не зацикливался)
-- ============================================================
create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from managers where user_id = auth.uid() and role = 'owner');
$$;

create or replace function my_manager_branches() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce((select branches from managers where user_id = auth.uid()), '{}');
$$;

create or replace function is_manager() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from managers where user_id = auth.uid());
$$;

create or replace function my_coach_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from coaches where user_id = auth.uid();
$$;

create or replace function my_coach_branches() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce((select branches from coaches where user_id = auth.uid()), '{}');
$$;

-- Доступ к филиалу: владелец — всё; управляющий и тренер — свои филиалы
create or replace function can_see_branch(b text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_owner() or b = any(my_manager_branches()) or b = any(my_coach_branches());
$$;

create or replace function can_manage_branch(b text) returns boolean
language sql stable security definer set search_path = public as $$
  select is_owner() or b = any(my_manager_branches());
$$;

-- ============================================================
-- RLS
-- ============================================================
alter table branches          enable row level security;
alter table coaches           enable row level security;
alter table managers          enable row level security;
alter table students          enable row level security;
alter table student_comments  enable row level security;
alter table sessions          enable row level security;
alter table session_students  enable row level security;

-- справочник филиалов — читают все авторизованные
create policy branches_read on branches for select to authenticated using (true);

-- тренеры: видят коллег по своим филиалам; управляют — владелец/управляющий
create policy coaches_read on coaches for select to authenticated
  using (is_owner() or user_id = auth.uid() or branches && my_manager_branches() or branches && my_coach_branches());
create policy coaches_write on coaches for all to authenticated
  using (is_owner() or branches && my_manager_branches())
  with check (is_owner() or branches && my_manager_branches());

-- управляющие: читает сам себя и владелец; пишет только владелец
create policy managers_read on managers for select to authenticated
  using (is_owner() or user_id = auth.uid());
create policy managers_write on managers for all to authenticated
  using (is_owner()) with check (is_owner());

-- ученики: читают свой филиал; тренер пишет учеников своего филиала; управляющий — своего
create policy students_read on students for select to authenticated
  using (can_see_branch(branch_id));
create policy students_write on students for all to authenticated
  using (can_manage_branch(branch_id) or (branch_id = any(my_coach_branches())))
  with check (can_manage_branch(branch_id) or (branch_id = any(my_coach_branches())));

create policy comments_all on student_comments for all to authenticated
  using (exists (select 1 from students s where s.id = student_id and can_see_branch(s.branch_id)))
  with check (exists (select 1 from students s where s.id = student_id and can_see_branch(s.branch_id)));

-- тренировки: тренер — свои; управляющий/владелец — по филиалам
create policy sessions_read on sessions for select to authenticated
  using (can_see_branch(branch_id));
create policy sessions_write on sessions for all to authenticated
  using (can_manage_branch(branch_id) or coach_id = my_coach_id())
  with check (can_manage_branch(branch_id) or coach_id = my_coach_id());

create policy ss_all on session_students for all to authenticated
  using (exists (select 1 from sessions x where x.id = session_id
                 and (can_manage_branch(x.branch_id) or x.coach_id = my_coach_id())))
  with check (exists (select 1 from sessions x where x.id = session_id
                 and (can_manage_branch(x.branch_id) or x.coach_id = my_coach_id())));
create policy ss_read on session_students for select to authenticated
  using (exists (select 1 from sessions x where x.id = session_id and can_see_branch(x.branch_id)));

-- ============================================================
-- Привязка аккаунта Auth к записи тренера/управляющего по e-mail
-- (срабатывает при создании пользователя в Authentication)
-- ============================================================
create or replace function link_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update coaches   set user_id = new.id where lower(email) = lower(new.email) and user_id is null;
  update managers  set user_id = new.id where lower(email) = lower(new.email) and user_id is null;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function link_auth_user();
