-- Supabase SQL Editor에서 실행하세요.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 30),
  grade smallint check (grade between 1 and 3),
  class_no smallint check (class_no between 1 and 20),
  created_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  subject text not null check (char_length(subject) between 1 and 40),
  description text not null default '',
  due_date date,
  grade smallint check (grade between 1 and 3),
  class_no smallint check (class_no between 1 and 20),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.assignment_checks (
  assignment_id uuid references public.assignments(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  is_done boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (assignment_id, user_id)
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  unique(user_id, subscription)
);

alter table public.profiles enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_checks enable row level security;
alter table public.push_subscriptions enable row level security;

create policy "users read own profile" on public.profiles
for select to authenticated using (auth.uid() = id);
create policy "users insert own profile" on public.profiles
for insert to authenticated with check (auth.uid() = id);
create policy "users update own profile" on public.profiles
for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create policy "signed-in users can read assignments" on public.assignments
for select to authenticated using (true);
create policy "signed-in users can post assignments" on public.assignments
for insert to authenticated with check (auth.uid() = created_by);
create policy "authors can update assignments" on public.assignments
for update to authenticated using (auth.uid() = created_by) with check (auth.uid() = created_by);
create policy "authors can delete assignments" on public.assignments
for delete to authenticated using (auth.uid() = created_by);

create policy "users read own assignment checks" on public.assignment_checks
for select to authenticated using (auth.uid() = user_id);
create policy "users manage own assignment checks" on public.assignment_checks
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "users manage own push subscriptions" on public.push_subscriptions
for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 회원가입 시 auth.users의 metadata를 profiles에 자동 저장합니다.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, grade, class_no)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), '학생'),
    nullif(new.raw_user_meta_data ->> 'grade', '')::smallint,
    nullif(new.raw_user_meta_data ->> 'class_no', '')::smallint
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    grade = excluded.grade,
    class_no = excluded.class_no;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute procedure public.handle_new_user_profile();

-- 보안: service_role 키는 브라우저 코드나 NEXT_PUBLIC_ 환경변수에 절대 넣지 마세요.

-- 상문마스터: 상문고등학교 1학년 1반 전용 접근 제어 + 수행평가 공지
-- 기존 Supabase 프로젝트에서 실행하기 전에 백업하세요.
-- 반 확인은 담당자가 실제로 확인한 계정에만 승인합니다.

alter table public.profiles
  add column if not exists class_verified boolean not null default false;

-- 학생은 자신의 닉네임만 수정할 수 있고, 반/승인 상태는 직접 수정할 수 없습니다.
revoke insert on public.profiles from authenticated;
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

create table if not exists public.class_assignment_notices (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  subject text not null check (char_length(subject) between 1 and 40),
  description text not null default '' check (char_length(description) <= 5000),
  due_date date,
  grade smallint not null check (grade between 1 and 3),
  class_no smallint not null check (class_no between 1 and 20),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists class_assignment_notices_target_due_idx
  on public.class_assignment_notices (grade, class_no, due_date);
create index if not exists class_assignment_notices_created_by_idx
  on public.class_assignment_notices (created_by);

alter table public.class_assignment_notices enable row level security;
revoke all on public.class_assignment_notices from anon, authenticated;
grant select, insert, update, delete on public.class_assignment_notices to authenticated;

-- 기존의 범용 assignments 테이블은 이 전용 사이트에서 사용하지 않으므로 클라이언트 접근을 닫습니다.
-- 기존 정책이 남아 있어도 테이블 권한이 없어 Data API로 접근할 수 없습니다.
revoke all on public.assignments from anon, authenticated;

drop policy if exists "verified students read own class notices" on public.class_assignment_notices;
drop policy if exists "verified 1-1 students read notices" on public.class_assignment_notices;
create policy "verified 1-1 students read notices"
on public.class_assignment_notices for select to authenticated
using (
  grade = 1 and class_no = 1
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.class_verified = true and p.grade = 1 and p.class_no = 1
  )
);

drop policy if exists "verified students post to own class" on public.class_assignment_notices;
drop policy if exists "verified 1-1 students post notices" on public.class_assignment_notices;
create policy "verified 1-1 students post notices"
on public.class_assignment_notices for insert to authenticated
with check (
  grade = 1 and class_no = 1 and created_by = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.class_verified = true and p.grade = 1 and p.class_no = 1
  )
);

drop policy if exists "authors update own class notices" on public.class_assignment_notices;
drop policy if exists "authors update own 1-1 notices" on public.class_assignment_notices;
create policy "authors update own 1-1 notices"
on public.class_assignment_notices for update to authenticated
using (
  grade = 1 and class_no = 1 and created_by = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.class_verified = true and p.grade = 1 and p.class_no = 1
  )
)
with check (
  grade = 1 and class_no = 1 and created_by = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.class_verified = true and p.grade = 1 and p.class_no = 1
  )
);

drop policy if exists "authors delete own class notices" on public.class_assignment_notices;
drop policy if exists "authors delete own 1-1 notices" on public.class_assignment_notices;
create policy "authors delete own 1-1 notices"
on public.class_assignment_notices for delete to authenticated
using (
  grade = 1 and class_no = 1 and created_by = (select auth.uid())
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.class_verified = true and p.grade = 1 and p.class_no = 1
  )
);

-- 가입 시 클라이언트 메타데이터를 신뢰하지 않고 서버에서 1학년 1반으로 고정합니다.
-- class_verified는 항상 false로 시작하므로 담당자 승인 전에는 접근할 수 없습니다.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, grade, class_no, class_verified)
  values (
    new.id,
    coalesce(nullif(left(new.raw_user_meta_data ->> 'display_name', 30), ''), '학생'),
    1, 1, false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.handle_new_user_profile();

-- 승인 전에 등록된 비대상 반의 공지는 학생에게 공개되지 않습니다.
-- 승인 예시 (실제 1학년 1반인지 확인한 UUID 한 명만 사용):
-- update public.profiles set class_verified = true
-- where id = '실제-학생-UUID' and grade = 1 and class_no = 1;
-- service_role 키는 브라우저/ NEXT_PUBLIC_ 환경변수/GitHub에 절대 넣지 마세요.
