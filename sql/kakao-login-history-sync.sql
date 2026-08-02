-- MINT 카카오 로그인 — 계정 기록 동기화(백필 + 조회) 지원
-- sql/kakao-login.sql 이후 실행. 기존 테이블 드롭·데이터 삭제 없음(전부 additive).
-- Supabase SQL Editor에서 실행하세요.
--
-- 배경: 로그인 카드가 "다음에도 이어져요"라고 약속하는데 실제로는 쓰기만 하고 아무도 읽지 않았습니다.
-- 이 마이그레이션은 (1) 최초 로그인 시 로컬 기록을 계정으로 한 번만 올리고,
-- (2) 그 이후 계정 기록을 읽어 보여주기 위한 최소 컬럼만 추가합니다.

-- 백필을 이미 했는지 판정하는 유일한 신뢰 원천. null이면 아직 백필 안 함.
-- (클라이언트의 localStorage 힌트 플래그는 속도 최적화일 뿐 신뢰 원천이 아닙니다.)
alter table public.mint_profiles add column if not exists backfilled_at timestamptz;

-- 'live'  = 추천 완료 시점에 실시간으로 쌓인 기록
-- 'backfill' = 최초 로그인 시 그 기기의 로컬 기록을 한 번 올린 것
-- 기존 행은 default 'live'로 채워지므로 과거 데이터 해석이 바뀌지 않습니다.
alter table public.mint_activity_log add column if not exists source text not null default 'live';

-- 두 기기에서 동시에 첫 로그인하면 backfilled_at 검사를 둘 다 통과해 같은 기록이 두 번 올라갈 수 있습니다.
-- 그 경쟁상태의 2차 방어선 — 백필 행에 한해 (사용자, 장소, 2차장소, 원래시각) 조합을 유일하게 강제합니다.
-- live 행은 대상이 아니므로(부분 인덱스) 같은 곳을 여러 번 가는 정상 사용은 전혀 막지 않습니다.
create unique index if not exists idx_mint_activity_log_backfill_dedupe
  on public.mint_activity_log (user_id, place_name, coalesce(second_place_name, ''), created_at)
  where source = 'backfill';

-- RLS 정책은 행 단위(auth.uid() = user_id)라 새로 추가한 컬럼에도 그대로 적용됩니다. 정책 변경 불필요.

-- ── 회원 탈퇴 ──
-- 원래는 서버리스 함수(api/account-delete.ts)에서 service role로 처리했는데,
-- Vercel Hobby 플랜의 서버리스 함수 한도(12개)를 넘겨 배포가 막혔다. 그래서 DB 함수로 옮긴다.
-- security definer라 함수 소유자 권한으로 auth.users를 지우지만, 지우는 대상을 auth.uid()로
-- 못박아 두어 자기 계정 외에는 건드릴 수 없다. mint_profiles·mint_activity_log는 FK의
-- on delete cascade로 함께 사라진다.
-- search_path를 비워 두는 건 security definer 함수의 기본 방어 — 모든 참조를 스키마까지 적는다.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

-- 비로그인(anon)은 호출할 수 없게 막는다. auth.uid()가 null이라 어차피 아무것도 못 지우지만,
-- 실행 권한 자체를 주지 않는 편이 명확하다.
revoke all on function public.delete_own_account() from public;
revoke all on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;

-- ── 검증 ──
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'mint_profiles' and column_name = 'backfilled_at';

select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'mint_activity_log' and column_name = 'source';

select indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename = 'mint_activity_log' and indexname = 'idx_mint_activity_log_backfill_dedupe';

select routine_name, security_type from information_schema.routines
where routine_schema = 'public' and routine_name = 'delete_own_account';
