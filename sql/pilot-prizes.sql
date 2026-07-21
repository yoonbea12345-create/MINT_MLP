-- MINT 파일럿 v2 — 꽝 없는 즉시 지급 뽑기
-- 기존 MINT Supabase SQL Editor에서 실행하세요. (코드는 미실행 시에도 폴백으로 안전 동작)

-- ── 1. pilot_feedback 확장 (하위호환: 전부 add if not exists / 제약 완화) ──
alter table pilot_feedback add column if not exists session_key text;
alter table pilot_feedback add column if not exists selections jsonb;
alter table pilot_feedback add column if not exists place_name text;
alter table pilot_feedback add column if not exists claim_code text;

-- 신규 제출은 피드백을 텍스트 1칸(fit_text)으로 통합 → extra_text 필수 완화
alter table pilot_feedback alter column extra_text drop not null;

-- 당첨코드로 재수령 조회 (nullable unique)
create unique index if not exists pilot_feedback_claim_code_key
  on pilot_feedback (claim_code) where claim_code is not null;

-- ── 2. 기프티콘 재고 풀 ──
create table if not exists pilot_prizes (
  id text primary key,
  title text not null,                       -- 상품명(예: 스타벅스 아메리카노)
  tier text not null default 'basic',        -- 룰렛 칸 매핑/희소도(basic·rare·epic 등)
  image_path text not null,                  -- private 버킷 경로
  status text not null default 'available'
    check (status in ('available','assigned','redeemed','void')),
  assigned_feedback_id text unique,          -- ★ 이중 배정 물리 차단 (unique)
  assigned_at timestamptz,
  claim_code text,                           -- 배정 시 발급되는 당첨코드
  memo text,
  created_at timestamptz not null default now()
);
create index if not exists pilot_prizes_status_idx on pilot_prizes (status, created_at);
create unique index if not exists pilot_prizes_claim_code_key
  on pilot_prizes (claim_code) where claim_code is not null;

alter table pilot_prizes enable row level security;
-- 브라우저 직접 접근 금지 — 서버리스 API(service role)만 사용
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'pilot_prizes'
  loop execute format('drop policy %I on public.pilot_prizes', pol.policyname); end loop;
end $$;

-- ── 3. 기프티콘 전용 PRIVATE 버킷 (바코드 노출 방지 · 서명 URL로만 조회) ──
insert into storage.buckets (id, name, public)
values ('pilot-prizes', 'pilot-prizes', false)
on conflict (id) do update set public = false;

-- anon 정책 전부 제거 — 업로드/조회 모두 서버가 발급한 서명 URL로만
do $$
declare pol record;
begin
  for pol in select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'pilot_prizes_%'
  loop execute format('drop policy %I on storage.objects', pol.policyname); end loop;
end $$;

-- ── 4. 원자적 배정 RPC (동시 제출 경합 안전 + 제출ID 멱등) ──
-- 이미 이 제출에 배정된 상품이 있으면 그걸 반환(멱등), 없으면 available 1건을
-- 잠금+건너뛰기(FOR UPDATE SKIP LOCKED)로 낚아채 배정. 재고 0이면 빈 결과.
create or replace function claim_pilot_prize(p_feedback_id text, p_claim_code text)
returns setof pilot_prizes
language plpgsql
as $$
declare v_row pilot_prizes;
begin
  select * into v_row from pilot_prizes
    where assigned_feedback_id = p_feedback_id limit 1;
  if found then
    return next v_row; return;
  end if;

  select * into v_row from pilot_prizes
    where status = 'available'
    order by created_at asc
    for update skip locked
    limit 1;
  if not found then return; end if;

  update pilot_prizes
    set status = 'assigned',
        assigned_feedback_id = p_feedback_id,
        assigned_at = now(),
        claim_code = p_claim_code
    where id = v_row.id
    returning * into v_row;
  return next v_row;
end;
$$;
