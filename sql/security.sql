-- ═══════════════════════════════════════════════════════════════
-- MINT 보안 강화 SQL — Supabase 대시보드 > SQL Editor에서 실행
-- (2026-07 MVP 보안 점검: anon 키로 개인정보 열람 가능하던 문제 차단)
--
-- 실행 후 동작 방식:
--  · 서버리스 API(service role)는 RLS를 우회하므로 기존 기능 그대로 동작
--  · 브라우저(anon 키)는 events/client_errors "insert만" 가능, 조회는 전부 차단
-- ═══════════════════════════════════════════════════════════════

-- ── 1. 신규 테이블 ─────────────────────────────────────────────

-- 레이트리밋 기록 (api/_lib/guard.ts)
create table if not exists api_hits (
  id bigint generated always as identity primary key,
  ip text not null,
  endpoint text not null,
  ts timestamptz not null default now()
);
create index if not exists api_hits_endpoint_ip_ts on api_hits (endpoint, ip, ts desc);
create index if not exists api_hits_endpoint_ts on api_hits (endpoint, ts desc);

-- 클라이언트 에러 로그 (src/utils/errorLog.ts)
create table if not exists client_errors (
  id bigint generated always as identity primary key,
  message text,
  stack text,
  url text,
  ua text,
  created_at timestamptz not null default now()
);

-- ── 2. RLS 활성화 ──────────────────────────────────────────────
-- RLS가 켜지고 anon용 정책이 없으면 anon 접근은 전부 차단된다.
-- service role(서버리스 API)은 RLS를 우회한다.

alter table if exists reservations         enable row level security;
alter table if exists events               enable row level security;
alter table if exists mint_sessions        enable row level security;
alter table if exists mint_session_members enable row level security;
alter table if exists recommendation_log   enable row level security;
alter table if exists place_buzz_cache     enable row level security;
alter table if exists license_cache        enable row level security;
alter table if exists api_hits             enable row level security;
alter table if exists client_errors        enable row level security;

-- ── 3. 기존의 느슨한 정책 제거 ─────────────────────────────────
-- (프로젝트 초기에 만들었을 수 있는 허용 정책들 — 이름이 다르면
--  대시보드 > Authentication > Policies에서 anon 대상 정책을 전부 삭제)
drop policy if exists "Enable read access for all users"   on reservations;
drop policy if exists "Enable insert for all users"        on reservations;
drop policy if exists "Enable delete for all users"        on reservations;
drop policy if exists "Enable read access for all users"   on events;
drop policy if exists "Enable insert for all users"        on events;
drop policy if exists "Enable delete for all users"        on events;

-- ── 4. anon에게 허용할 최소 권한 ───────────────────────────────
-- 이벤트 트래킹: 브라우저에서 insert만 (조회·삭제 불가)
drop policy if exists events_anon_insert on events;
create policy events_anon_insert on events
  for insert to anon with check (true);

-- 클라이언트 에러 로그: insert만
drop policy if exists client_errors_anon_insert on client_errors;
create policy client_errors_anon_insert on client_errors
  for insert to anon with check (true);

-- ── 5. 오래된 api_hits 자동 정리(선택) ────────────────────────
-- pg_cron 확장이 활성화된 경우에만 동작. 없으면 이 블록은 건너뛰어도 됨.
-- select cron.schedule('purge-api-hits', '0 4 * * *',
--   $$delete from api_hits where ts < now() - interval '2 days'$$);
