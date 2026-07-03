-- ═══════════════════════════════════════════════════════════════
-- MINT 보안 강화 SQL v2 — Supabase 대시보드 > SQL Editor에서 실행
--
-- v1 문제: 기존 허용 정책의 "이름"을 추측해서 삭제했는데 실제 이름이 달라
--          예약자 명단이 여전히 anon 키로 열람 가능했음 (실측 확인).
-- v2 해결: 대상 테이블의 모든 정책을 이름과 무관하게 동적으로 전부 삭제한 뒤
--          필요한 최소 정책(이벤트/에러로그 insert)만 재생성.
--
-- 실행 후: 서버리스 API(service role)는 RLS를 우회하므로 기능 그대로 동작.
--          브라우저(anon 키)는 events/client_errors insert만 가능, 나머지 전부 차단.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. 신규 테이블 (없으면 생성) ───────────────────────────────

create table if not exists api_hits (
  id bigint generated always as identity primary key,
  ip text not null,
  endpoint text not null,
  ts timestamptz not null default now()
);
create index if not exists api_hits_endpoint_ip_ts on api_hits (endpoint, ip, ts desc);
create index if not exists api_hits_endpoint_ts on api_hits (endpoint, ts desc);

create table if not exists client_errors (
  id bigint generated always as identity primary key,
  message text,
  stack text,
  url text,
  ua text,
  created_at timestamptz not null default now()
);

-- ── 2. 대상 테이블의 기존 정책 전부 삭제 + RLS 활성화 ─────────
-- (정책 이름이 무엇이든 전부 제거 — 이름 추측 없이 동적 처리)

do $$
declare
  t text;
  pol record;
  targets text[] := array[
    'reservations', 'events', 'mint_sessions', 'mint_session_members',
    'recommendation_log', 'place_buzz_cache', 'license_cache',
    'api_hits', 'client_errors'
  ];
begin
  foreach t in array targets loop
    -- 테이블이 존재할 때만 처리
    if exists (select 1 from pg_tables where schemaname = 'public' and tablename = t) then
      -- 이 테이블의 모든 정책 삭제
      for pol in
        select policyname from pg_policies
        where schemaname = 'public' and tablename = t
      loop
        execute format('drop policy %I on public.%I', pol.policyname, t);
      end loop;
      -- RLS 켜기 (+ 강제)
      execute format('alter table public.%I enable row level security', t);
    end if;
  end loop;
end $$;

-- ── 3. anon에게 허용할 최소 권한만 재생성 ──────────────────────

-- 이벤트 트래킹: 브라우저에서 insert만 (조회·수정·삭제 불가)
create policy events_anon_insert on public.events
  for insert to anon with check (true);

-- 클라이언트 에러 로그: insert만
create policy client_errors_anon_insert on public.client_errors
  for insert to anon with check (true);

-- ── 4. 검증 쿼리 (실행 후 결과 확인용) ────────────────────────
-- 아래 select 결과에서 대상 테이블들의 rowsecurity가 모두 true여야 하고,
-- 정책은 events/client_errors의 insert 2개만 보여야 정상.

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('reservations','events','mint_sessions','mint_session_members',
                    'recommendation_log','place_buzz_cache','license_cache',
                    'api_hits','client_errors')
order by tablename;

select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
