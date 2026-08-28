-- MINT 상시 유저 피드백 (좌하단 FAB → 피드백 시트 제출)
-- 기존 MINT Supabase SQL Editor에서 실행하세요.
--
-- pilot_feedback을 재사용하지 않는 이유: 그쪽은 이미지 경로 NOT NULL·별점 필수·상품 배정(claim_code)까지
-- 얽힌 선발대 캠페인 전용 스키마다. 상시 피드백을 끼워 넣으면 레거시 NOT NULL을 더미 값으로 때워야 하고
-- 어드민 집계도 오염된다. 관심사가 다르면 테이블도 다르다.

create table if not exists user_feedback (
  id          text primary key,   -- 클라이언트 발급('fb'+14자) — 아웃박스 재전송의 멱등성 키
  text        text not null check (char_length(text) between 2 and 500),
  category    text check (category in ('bug','pain','idea','praise')),  -- 미선택(null) 허용
  contact     text,               -- 답변 받고 싶은 사람만 남긴다(선택)
  route       text,
  tab         text,
  session_key text,               -- events 테이블과 조인해 "무엇을 하다 남긴 말인지" 추적
  device_id   text,
  user_agent  text,               -- 클라가 보내지 않고 서버가 요청 헤더에서 직접 기록
  viewport    text,
  created_at  timestamptz not null default now()
);

-- 어드민은 항상 최신순 200건만 읽는다
create index if not exists user_feedback_created_at_idx on user_feedback (created_at desc);

alter table user_feedback enable row level security;

-- 브라우저는 테이블에 직접 접근하지 않고 서버리스 API(service role)만 사용합니다.
do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'user_feedback'
  loop
    execute format('drop policy %I on public.user_feedback', pol.policyname);
  end loop;
end $$;
