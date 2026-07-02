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

-- 그룹 세션 테이블
CREATE TABLE IF NOT EXISTS mint_sessions (
  id TEXT PRIMARY KEY,
  expected_count INTEGER NOT NULL DEFAULT 2,
  has_second BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mint_session_members (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES mint_sessions(id) ON DELETE CASCADE,
  member_name TEXT NOT NULL,
  location_name TEXT NOT NULL,
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  purpose_first TEXT,
  purpose_second TEXT,
  vibe_atmosphere TEXT,
  vibe_budget TEXT,
  vibe_keywords TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

-- 기존 테이블 마이그레이션 (이미 테이블이 있는 경우)
ALTER TABLE mint_sessions ADD COLUMN IF NOT EXISTS has_second BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE mint_session_members ADD COLUMN IF NOT EXISTS purpose_first TEXT;
ALTER TABLE mint_session_members ADD COLUMN IF NOT EXISTS purpose_second TEXT;
ALTER TABLE mint_session_members ADD COLUMN IF NOT EXISTS vibe_keywords TEXT;

-- RLS
ALTER TABLE mint_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon read mint_sessions" ON mint_sessions;
CREATE POLICY "anon read mint_sessions" ON mint_sessions FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon insert mint_sessions" ON mint_sessions;
CREATE POLICY "anon insert mint_sessions" ON mint_sessions FOR INSERT TO anon WITH CHECK (true);

ALTER TABLE mint_session_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon read mint_session_members" ON mint_session_members;
CREATE POLICY "anon read mint_session_members" ON mint_session_members FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon insert mint_session_members" ON mint_session_members;
CREATE POLICY "anon insert mint_session_members" ON mint_session_members FOR INSERT TO anon WITH CHECK (true);

-- =============================================
-- L1: 블로그 버즈 분석 캐시 (추천 재설계 Phase 1)
-- 서버(service role)만 접근 — anon 정책 없음
-- =============================================
CREATE TABLE IF NOT EXISTS place_buzz_cache (
  place_key       TEXT PRIMARY KEY,
  bubble_score    DOUBLE PRECISION NOT NULL,
  sponsored_ratio DOUBLE PRECISION,
  burstiness      DOUBLE PRECISION,
  recent_spike    DOUBLE PRECISION,
  revisit_ratio   DOUBLE PRECISION,
  buzz_count      INTEGER,
  analyzed_at     TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE place_buzz_cache ENABLE ROW LEVEL SECURITY;

-- =============================================
-- L0: 인허가 배치 캐시 (추천 재설계 Phase 2)
-- api/admin-refresh-license-cache.ts로 월 1회 수동 적재. 서버 전용 — anon 정책 없음.
-- =============================================
CREATE TABLE IF NOT EXISTS license_cache (
  id            BIGSERIAL PRIMARY KEY,
  region_code   TEXT NOT NULL,        -- 개방자치단체코드 (LOCALDATA 체계, 예: 3220000=강남구)
  biz_name      TEXT NOT NULL,
  address       TEXT,
  lat           DOUBLE PRECISION,     -- WGS84 변환 완료된 값만 저장
  lng           DOUBLE PRECISION,
  license_date  DATE,                 -- LCPMT_YMD
  status_code   TEXT,                 -- SALS_STTS_CD
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_license_cache_region ON license_cache(region_code);
CREATE INDEX IF NOT EXISTS idx_license_cache_latlng ON license_cache(lat, lng);

ALTER TABLE license_cache ENABLE ROW LEVEL SECURITY;
