-- MINT 상시 유저 피드백 (좌하단 FAB → 피드백 시트 제출)
-- 기존 MINT Supabase SQL Editor에서 실행하세요.
--
-- pilot_feedback을 재사용하지 않는 이유: 그쪽은 이미지 경로 NOT NULL·별점 필수·상품 배정(claim_code)까지
-- 얽힌 선발대 캠페인 전용 스키마다. 상시 피드백을 끼워 넣으면 레거시 NOT NULL을 더미 값으로 때워야 하고
-- 어드민 집계도 오염된다. 관심사가 다르면 테이블도 다르다.

create table if not exists user_feedback (
  id          text primary key,   -- 클라이언트 발급('fb'+14자) — 아웃박스 재전송의 멱등성 키
  -- ⚠️ char_length는 "문자(코드포인트)"를 센다. JS의 text.length는 UTF-16 코드유닛이라
  -- '👍'가 JS에선 2, 여기선 1이다. 하한을 2로 두면 이모지 하나만 남긴 피드백이 클라·서버를
  -- 통과하고 DB에서만 23514로 터진다 — 그리고 서버가 500을 주니 아웃박스가 영원히 재시도한다.
  -- 하한은 1이 맞다. 👍 한 글자도 충분히 유효한 피드백이다.
  text        text not null check (char_length(text) between 1 and 500),
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

-- ── 이미 이 테이블을 만든 뒤에 이 파일을 다시 실행하는 경우 ──
-- create table if not exists는 기존 테이블의 check 제약을 바꾸지 않는다.
-- 하한 2로 만들어진 제약이 남아 있으면 이모지 1자 피드백이 계속 거절되므로 명시적으로 갈아끼운다.
-- (제약 이름은 컬럼 check의 관례상 user_feedback_text_check지만, 확실하게 이름과 무관히 찾아 지운다.)
do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'public.user_feedback'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%char_length(text)%'
  loop
    execute format('alter table public.user_feedback drop constraint %I', con.conname);
  end loop;
  alter table public.user_feedback
    add constraint user_feedback_text_check check (char_length(text) between 1 and 500);
end $$;
