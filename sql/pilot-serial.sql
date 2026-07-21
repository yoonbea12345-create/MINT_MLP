-- MINT 파일럿 v3 — 일련번호 기반 무마찰 검증 + Q&A
-- Supabase SQL Editor에서 실행. (미실행 시 코드가 42703 폴백으로 안전 동작 — serial/places_display/qa 없이 저장)

-- ── recommendation_log: 일련번호 + 사람이 읽는 추천장소 스냅샷 ──
alter table recommendation_log add column if not exists serial text;
alter table recommendation_log add column if not exists places_display jsonb;
-- 일련번호로 파일럿↔추천 조인. NULL 허용 unique(값 있는 행만).
create unique index if not exists recommendation_log_serial_key
  on recommendation_log (serial) where serial is not null;

-- ── pilot_feedback: 일련번호 링크 + 진입유형 + 추천스냅샷 + 실제방문 + Q&A ──
alter table pilot_feedback add column if not exists serial text;
alter table pilot_feedback add column if not exists entry_type text;   -- 'auto' | 'manual'
alter table pilot_feedback add column if not exists rec_snapshot jsonb; -- {conditions, coursePicks}
alter table pilot_feedback add column if not exists visited jsonb;      -- [{course, choice, otherName?}]
alter table pilot_feedback add column if not exists qa_answers jsonb;   -- {reason, issues, budget, vibeFit, reuse}
create index if not exists pilot_feedback_serial_idx on pilot_feedback (serial) where serial is not null;
