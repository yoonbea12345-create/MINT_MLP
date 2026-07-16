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
  session_key      TEXT,   -- 탐색 에피소드 조인 키(recommendation_log.session_key와 매칭)
  payload          JSONB,  -- 이벤트 맥락(place_click: {placeName,address,priceRange,fitScore} / reject: 동일 / location_search_zero: {query})
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 3. 기존 테이블 컬럼 보강 (이미 테이블이 있는 경우) — 모두 additive, 안전.
--    ⚠️ 앱은 이 컬럼이 없어도 {type}만으로 폴백 삽입하므로 실행 전에도 수집은 끊기지 않는다.
ALTER TABLE events ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;
ALTER TABLE events ADD COLUMN IF NOT EXISTS session_key TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS payload JSONB;
CREATE INDEX IF NOT EXISTS idx_events_session_key ON events(session_key);

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
-- 임의 지역 모드 게스트는 출발지를 입력하지 않으므로 좌표를 NULL 허용으로 완화
ALTER TABLE mint_session_members ALTER COLUMN location_name DROP NOT NULL;
ALTER TABLE mint_session_members ALTER COLUMN location_lat DROP NOT NULL;
ALTER TABLE mint_session_members ALTER COLUMN location_lng DROP NOT NULL;

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

-- =============================================
-- L4: 추천 신호 로그 (추천 재설계 Phase 3)
-- 분석은 v2 스코프 — 지금은 기록만. 서버 전용, anon 정책 없음.
-- =============================================
CREATE TABLE IF NOT EXISTS recommendation_log (
  id                  BIGSERIAL PRIMARY KEY,
  session_key         TEXT,
  created_at          TIMESTAMPTZ DEFAULT now(),
  group_size          INTEGER,
  purpose_first       TEXT,
  purpose_second      TEXT,
  budget              TEXT,
  vibe_first          TEXT,
  vibe_second         TEXT,
  midpoint_lat        DOUBLE PRECISION,
  midpoint_lng        DOUBLE PRECISION,
  candidates          JSONB NOT NULL,
  selected_place_key  TEXT,
  retried             BOOLEAN DEFAULT false,
  shared              BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_recommendation_log_created_at ON recommendation_log(created_at);
-- 세션키 조인/업데이트 인덱스 (session_key 컬럼은 위 CREATE TABLE에 이미 포함)
CREATE INDEX IF NOT EXISTS idx_recommendation_log_session_key ON recommendation_log(session_key);

ALTER TABLE recommendation_log ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 공유 결과 페이지 멤버 투표 (share-vote API)
-- 서버(service role)만 접근 — anon 정책 없음.
-- =============================================
CREATE TABLE IF NOT EXISTS mint_share_votes (
  id          BIGSERIAL PRIMARY KEY,
  share_id    TEXT NOT NULL,
  voter_id    TEXT NOT NULL,
  choice      INTEGER NOT NULL,
  place_name  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (share_id, voter_id)
);

CREATE INDEX IF NOT EXISTS idx_share_votes_share ON mint_share_votes(share_id);

ALTER TABLE mint_share_votes ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 공유 결과 스냅샷 (share-vote API가 type=snapshot으로 저장/조회 — /shared?id=)
-- 서버(service role)만 접근. 실행 전에는 앱이 자동으로 레거시 ?data= 링크로 폴백한다.
-- =============================================
CREATE TABLE IF NOT EXISTS mint_share_snapshots (
  share_id   TEXT PRIMARY KEY,
  payload    JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_share_snapshots_created ON mint_share_snapshots(created_at);
ALTER TABLE mint_share_snapshots ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 그룹 세션 결과 전달 (호스트 추천 결과를 게스트 폴링으로 수신)
-- 실행 전에는 게스트가 기존 대기 화면 그대로(기능만 off).
-- =============================================
ALTER TABLE mint_sessions ADD COLUMN IF NOT EXISTS result_json JSONB;
ALTER TABLE mint_sessions ADD COLUMN IF NOT EXISTS result_at TIMESTAMPTZ;
