// 우슐랭(우체국+미슐랭) 시드 데이터 — 부산지방우정청 공식 가이드 245곳 중
// 언론보도·우슐랭 전용 기사에서 "상호명 + 구·군"이 함께 확인된 곳만 수록한다.
// 확장은 이 배열에 엔트리를 추가만 하면 되며, 컴포넌트·매칭 로직은 손대지 않는다.
//
// ⚠️ 금지 조항(신뢰 자산 보호):
//  - 노출을 늘리려고 이름 부분일치(includes)·district 게이트 제거·region 게이트 완화를 하지 말 것.
//  - 우슐랭 스티커의 가치는 "희소성 + 정확성"이며, 오탐 1건이 기능 전체의 신뢰를 부순다.
//  - 상호명은 반드시 출처가 있는 것만. 창작·추정 금지(잘못된 인증 표시는 해당 가게에도 실례).
//
// TODO: 부산지방우정청 공식 245곳 리스트(네이버 블로그 PDF) 확보 시 이 배열을 교체·확장.

export interface UshulangEntry {
  name: string;                          // 공식/보도 표기 상호명 원문
  region: '부산' | '울산' | '경남';       // 시·도 게이트 키 (전국 확장 시 유니온에 값만 추가)
  district: string;                      // 구·군 — 필수. 3중 게이트의 마지막 자물쇠
  category?: string;                     // 참고용(매칭에 사용하지 않음)
}

// 출처: 머니투데이/뉴스1/위키푸디 우슐랭 보도, 우슐랭 가이드 정리글(2025 개정판)
export const USHULANG_LIST: UshulangEntry[] = [
  // ── 부산 ──
  { name: '동래할매파전', region: '부산', district: '동래구', category: '파전' },
  { name: '동래밀면',     region: '부산', district: '동래구', category: '밀면' },
  { name: '오봉한',       region: '부산', district: '중구',   category: '한정식' },
  { name: '다무치아',     region: '부산', district: '중구',   category: '이탈리안' },
  // ── 울산 ──
  { name: '전통한우수구레국밥', region: '울산', district: '울주군', category: '국밥' },
  { name: '옥국밥',             region: '울산', district: '남구',   category: '국밥' },
  // ── 경남 ──
  { name: '하연옥',        region: '경남', district: '진주시', category: '냉면' },
  { name: '천황식당',      region: '경남', district: '진주시', category: '한정식' },
  { name: '마리나 송원횟집', region: '경남', district: '통영시', category: '횟집' },
  { name: '제이라운지',    region: '경남', district: '남해군', category: '카페·양식' },
];

// 시·도 게이트에서 검사할 주소 토큰(약칭·정식 표기 모두 허용)
const REGION_TOKENS: Record<UshulangEntry['region'], string[]> = {
  부산: ['부산'],
  울산: ['울산'],
  경남: ['경남', '경상남도'],
};

// 이름 정규화 — 순서 고정. 공백·특수문자 제거 + '공백으로 분리된' 지점명 토큰만 안전하게 제거.
export function normalizeName(raw: string): string {
  if (!raw) return '';
  const strip = (s: string) =>
    s.toLowerCase().replace(/[^가-힣a-z0-9]/g, ''); // 소문자화 + 한글·영문·숫자만
  const trimmed = raw.trim();
  // 마지막 '공백 토큰'이 지점명일 때만 제거 (붙어있는 ~점은 절대 자르지 않는다)
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const isBranch = last === '본점' || last === '본관' || /^.{1,6}점$/.test(last);
    if (isBranch) {
      const candidate = strip(parts.slice(0, -1).join(''));
      if (candidate.length >= 2) return candidate; // 결과가 2자 미만이면 절삭 취소
    }
  }
  return strip(trimmed);
}

// 정규화 이름 → 엔트리[] 사전(동명 대비 배열). 모듈 로드 시 1회 구축.
const NAME_INDEX: Map<string, UshulangEntry[]> = (() => {
  const m = new Map<string, UshulangEntry[]>();
  for (const e of USHULANG_LIST) {
    const key = normalizeName(e.name);
    const arr = m.get(key);
    if (arr) arr.push(e);
    else m.set(key, [e]);
  }
  return m;
})();

// 매칭 — 이름 완전일치 AND 시·도 토큰 AND 구·군 토큰(3중 게이트 모두 통과해야 인증).
export function findUshulang(place: { placeName?: string; address?: string; area?: string }): UshulangEntry | null {
  const candidates = NAME_INDEX.get(normalizeName(place.placeName || ''));
  if (!candidates) return null;
  const addr = `${place.address || ''} ${place.area || ''}`;
  for (const e of candidates) {
    const regionOk = REGION_TOKENS[e.region].some((t) => addr.includes(t));
    if (regionOk && addr.includes(e.district)) return e;
  }
  return null;
}
