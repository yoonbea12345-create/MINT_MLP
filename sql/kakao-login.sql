-- MINT 카카오 기본 로그인
-- 기존 MINT Supabase SQL Editor에서 실행하세요.
--
-- 사업자 미등록 상태라 이메일·전화번호는 다루지 않습니다.
-- 닉네임·프로필이미지·카카오 회원번호(auth.users.id로 식별)·device_id만 씁니다.
-- 서버에는 가벼운 메타데이터만 — 추천 스냅샷·좌표·이미지 URL은 저장하지 않습니다.

-- ── 1. 로그인 사용자 프로필 (auth.users와 1:1, 조회 편의용 캐시) ──
create table if not exists public.mint_profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  kakao_id      text,                 -- 카카오 회원번호(참고용)
  nickname      text,
  avatar_url    text,
  device_id     text,                 -- 로그인 전 익명 활동과 느슨하게 잇기 위한 기기 ID
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);
create index if not exists idx_mint_profiles_device_id on public.mint_profiles(device_id);

-- ── 2. 가벼운 활동 로그 — "몇 번째 모임을 만들었나" 측정용 ──
-- 무거운 필드(좌표·이미지·스냅샷)를 여기에 추가하지 마세요. 그 순간 서버 비용이 새기 시작합니다.
create table if not exists public.mint_activity_log (
  id                 bigserial primary key,
  user_id            uuid not null references auth.users(id) on delete cascade,
  device_id          text,
  place_name         text,
  second_place_name  text,
  area_name          text,
  purpose_first      text,
  group_size         text,
  created_at         timestamptz not null default now()
);
create index if not exists idx_mint_activity_log_user_id on public.mint_activity_log(user_id, created_at desc);

-- ── 3. RLS — 로그인 사용자는 자기 행만. 서버(service role)는 RLS를 우회합니다. ──
alter table public.mint_profiles enable row level security;

drop policy if exists mint_profiles_own_select on public.mint_profiles;
create policy mint_profiles_own_select on public.mint_profiles
  for select to authenticated using (auth.uid() = id);

drop policy if exists mint_profiles_own_insert on public.mint_profiles;
create policy mint_profiles_own_insert on public.mint_profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists mint_profiles_own_update on public.mint_profiles;
create policy mint_profiles_own_update on public.mint_profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

alter table public.mint_activity_log enable row level security;

drop policy if exists mint_activity_log_own_select on public.mint_activity_log;
create policy mint_activity_log_own_select on public.mint_activity_log
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists mint_activity_log_own_insert on public.mint_activity_log;
create policy mint_activity_log_own_insert on public.mint_activity_log
  for insert to authenticated with check (auth.uid() = user_id);
-- update/delete 정책 없음 — 활동 로그는 추가만. 정정·삭제는 서비스롤로만.

-- ── 4. 검증 ──
select tablename, rowsecurity from pg_tables
where schemaname = 'public' and tablename in ('mint_profiles', 'mint_activity_log');

select tablename, policyname, cmd, roles from pg_policies
where schemaname = 'public' and tablename in ('mint_profiles', 'mint_activity_log')
order by tablename, policyname;
