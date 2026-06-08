-- =============================================
-- MINT 어드민 Supabase 초기 설정
-- Supabase 대시보드 > SQL Editor 에서 전체 실행
-- =============================================

-- 1. reservations 테이블
CREATE TABLE IF NOT EXISTS reservations (
  id          TEXT PRIMARY KEY,
  place_name  TEXT NOT NULL,
  address     TEXT,
  guest_name  TEXT,
  people      TEXT,
  arrival_time TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 2. events 테이블 (analytics)
CREATE TABLE IF NOT EXISTS events (
  id               BIGSERIAL PRIMARY KEY,
  type             TEXT NOT NULL,
  duration_seconds INTEGER,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 3. duration_seconds 컬럼 추가 (이미 테이블이 있는 경우)
ALTER TABLE events ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- =============================================
-- RLS 정책 — anon 키로 읽기/쓰기 허용
-- =============================================

-- reservations
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon read reservations" ON reservations;
CREATE POLICY "anon read reservations"
  ON reservations FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "anon insert reservations" ON reservations;
CREATE POLICY "anon insert reservations"
  ON reservations FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon delete reservations" ON reservations;
CREATE POLICY "anon delete reservations"
  ON reservations FOR DELETE
  TO anon
  USING (true);

-- events
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon read events" ON events;
CREATE POLICY "anon read events"
  ON events FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "anon insert events" ON events;
CREATE POLICY "anon insert events"
  ON events FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon delete events" ON events;
CREATE POLICY "anon delete events"
  ON events FOR DELETE
  TO anon
  USING (true);
