// 목적(밥/술/카페) 대비 업종 게이트 — 순수 함수 모듈(외부 I/O 없음).
//
// 배경: 공공데이터 상가정보는 indsLclsCd='I2'(음식 대분류)로 통째로 긁어온다. I2에는
// 제과점·비알코올음료점(빵집/카페)은 물론 '기관 구내식당'까지 들어 있다. L0 발굴 후보를
// 업종 검사 없이 후보 풀에 주입하면 "노포" 조건에 오래 버틴 빵집이 최상위로 올라온다.
// 이 모듈은 그 주입 직전에 목적 대비 업종을 걸러 준다.
//
// ⚠️ 아래 어휘 사전은 실제 API 응답으로 실측 검증한 값이 아니다.
// (로컬에 PUBLIC_DATA_SERVICE_KEY가 없어 indsSclsNm/indsMclsNm의 실제 표기를 확인할 수 없었음)
// 한국 표준산업분류 / 소상공인 상권정보 소분류명 관례에 근거한 가설값이며, 표기 흔들림
// (예: '한식 일반 음식점업' vs '백반/한정식')을 부분일치로 흡수하도록 넉넉하게 작성했다.
// 배포 후 recommend.ts의 `[recommend] L0 ... gateUnknown=` 로그에 찍히는 실제 업종명을 보고
// 이 사전을 교정할 것.

export type StoreGroup = '밥' | '술' | '카페';

/** publicData.PublicStore의 부분집합 — 이 모듈이 실제로 보는 필드만. */
export interface GateStore {
  name: string;
  category: string;   // 상권업종 소분류명 (indsSclsNm)
  mclsName?: string;  // 상권업종 중분류명 (indsMclsNm)
}

// 목적과 무관하게 무조건 제외 — 일반 이용자가 갈 수 없거나(구내식당·급식·출장), 추천 대상이
// 아닌 업태(유흥·단란주점·무도장).
const GLOBAL_EXCLUDE = /구내식당|급식|출장|이동음식|유흥주점|단란주점|무도/;

// 카페 그룹 — 제과점(빵집)은 여기에 둔다. '카페' 목적엔 정당한 후보이고, '밥' 목적엔 탈락해야 한다.
const CAFE_MCLS = /비알코올|음료|커피|카페|제과|제빵|떡(?!볶)/;
// '떡'은 떡집·떡카페를 노린 토큰이지만 '떡볶이'(분식=밥)까지 먹으면 안 되므로 부정 전방탐색.
const CAFE_SCLS = /카페|커피|다방|음료|주스|찻집|전통찻집|제과|제빵|베이커리|빵|도넛|디저트|아이스크림|빙수|생과일|스무디|떡(?!볶)/;

// 술 그룹. 단독 '바'는 '바베큐·바지락·바게트' 오탐이 나므로 구분자로 둘러싸인 경우만 인정한다.
const BAR_MCLS = /주점|술/;
const BAR_SCLS = /주점|호프|맥주|생맥|포차|포장마차|이자카야|칵테일|와인|위스키|사케|막걸리|전통주|바텐|(?:^|[\s/·,&()])바(?:$|[\s/·,&()])/;

// 밥 그룹(식사). 중분류는 상권정보 관례(한식/외국식/중식/일식/서양식/기타 간이/분식)를 폭넓게 수용.
const MEAL_MCLS = /한식|외국식|중식|일식|서양식|양식|간이|분식|음식점|육류|해산물|뷔페/;
const MEAL_SCLS = new RegExp(
  [
    '한식', '백반', '한정식', '국밥', '해장국', '설렁탕', '곰탕', '추어탕', '삼계탕', '보신',
    '칼국수', '국수', '냉면', '만두', '분식', '김밥', '떡볶이', '순대', '족발', '보쌈',
    '곱창', '막창', '갈비', '삼겹살', '구이', '고기', '육류', '전골', '찌개', '전문점',
    '탕', '찜', '볶음', '샤브', '죽', '도시락', '쌈밥', '정식', '식당', '음식점',
    '치킨', '닭', '피자', '햄버거', '버거', '샌드위치', '토스트', '파스타', '스파게티',
    '이탈리', '프렌치', '서양식', '양식', '스테이크', '경양식',
    '중식', '중국', '짜장', '짬뽕', '마라', '양꼬치', '중화',
    '일식', '초밥', '스시', '횟집', '회센터', '물회', '생선', '참치', '라멘', '우동',
    '돈가스', '돈까스', '덮밥', '오뎅', '일본',
    '베트남', '태국', '쌀국수', '아시안', '인도', '커리', '멕시코', '남미',
    '해물', '해산물', '조개', '장어', '오리', '한우', '뷔페', '샐러드',
  ].join('|'),
);

function groupOfText(text: string | undefined, isMcls: boolean): StoreGroup | null {
  const t = (text ?? '').trim();
  if (!t) return null;
  // 카페 신호를 가장 먼저 본다 — 이번 버그(밥 목적에 빵집)가 재발하지 않게, 카페/제과는
  // 다른 신호와 겹치더라도 카페로 확정한다(명시적 거절 우선 원칙).
  if (isMcls ? CAFE_MCLS.test(t) : CAFE_SCLS.test(t)) return '카페';
  if (isMcls ? BAR_MCLS.test(t) : BAR_SCLS.test(t)) return '술';
  if (isMcls ? MEAL_MCLS.test(t) : MEAL_SCLS.test(t)) return '밥';
  return null;
}

/**
 * 가게의 업종 그룹을 판정. 중분류명(mclsName) 우선, 판정 불가면 소분류명(category) 폴백.
 * 어느 쪽으로도 못 정하면 null(= 호출부에서 보수적으로 탈락).
 */
export function classifyStoreGroup(store: GateStore): StoreGroup | null {
  const mcls = groupOfText(store.mclsName, true);
  const scls = groupOfText(store.category, false);
  // 카페 신호는 어느 쪽에서 잡히든 카페로 확정한다(명시적 거절 우선).
  // 실제 업종분류상 제과점업은 '기타 간이 음식점' 중분류 아래에 있어, 중분류만 먼저 보면
  // 빵집이 '밥'으로 오분류된다 — 이번 버그(밥 목적에 빵집)가 바로 그 경로였다.
  if (mcls === '카페' || scls === '카페') return '카페';
  return mcls ?? scls;
}

/** 목적별 허용 그룹. '술'은 안주가 주력인 식당(곱창·구이 등)도 정당한 후보라 밥을 함께 허용. */
const ALLOWED_GROUPS: Record<string, StoreGroup[]> = {
  '밥': ['밥'],
  '술': ['술', '밥'],
  '카페': ['카페'],
};

/** 전역 제외 대상인지 — 관측 로그에서 '분류 불능'과 구분하기 위해 export. */
export function isGloballyExcludedStore(store: GateStore): boolean {
  return GLOBAL_EXCLUDE.test(store.category ?? '')
    || GLOBAL_EXCLUDE.test(store.mclsName ?? '')
    || GLOBAL_EXCLUDE.test(store.name ?? '');
}

/**
 * 이 가게를 1차 목적의 후보로 써도 되는가.
 *
 * 판정 순서(중요): 전역 제외 → (커스텀 메뉴가 있으면 메뉴 토큰 일치) → 명시적 거절 →
 * 명시적 허용 → 분류 불능은 거절.
 * 어휘 사전이 불완전해도 "밥 목적인데 카페/제과 신호"가 잡히면 즉시 탈락하도록,
 * 중분류·소분류 어느 쪽에서든 목적 밖 그룹이 감지되면 거절한다.
 *
 * @param purposeFirst 1차 목적('밥'|'술'|'카페' 프리셋, 그 외(기타·직접입력 메뉴)는 전역 제외만 적용)
 * @param customMenuTokens 사용자가 직접 입력한 메뉴 토큰(있으면 이름/업종명 겹침만으로 판정)
 * @param allowUnclassified 분류 불능(사전에 없는 업종명)을 통과시킬지. 기본 false(보수적 탈락).
 *   호출부가 엄격 모드로 후보를 전부 잃었을 때만 true로 재시도한다 — 사전이 실제 어휘를 못
 *   맞히더라도 L0가 통째로 죽지 않게 하는 안전판. 이때도 '명시적 거절'(제과·카페 등 목적 밖
 *   업종으로 판정된 곳)은 그대로 탈락하므로 빵집이 되살아나지는 않는다.
 */
export function isStoreAllowedForPurpose(
  store: GateStore,
  purposeFirst: string | null | undefined,
  customMenuTokens?: string[],
  allowUnclassified = false,
): boolean {
  if (isGloballyExcludedStore(store)) return false;

  const tokens = (customMenuTokens ?? []).map((t) => t.trim()).filter(Boolean);
  if (tokens.length > 0) {
    const haystack = `${store.name ?? ''} ${store.category ?? ''} ${store.mclsName ?? ''}`;
    return tokens.some((t) => haystack.includes(t));
  }

  const allowed = ALLOWED_GROUPS[(purposeFirst ?? '').trim()];
  if (!allowed) return true; // 프리셋 외 목적: 전역 제외만 적용(과차단 방지)

  const groups = [groupOfText(store.mclsName, true), groupOfText(store.category, false)]
    .filter((g): g is StoreGroup => g !== null);

  // 명시적 거절 우선 — 두 필드 중 하나라도 목적 밖 그룹이면 탈락.
  // (이 판정은 allowUnclassified와 무관하게 항상 적용된다 — 빵집을 막는 건 여기다.)
  if (groups.some((g) => !allowed.includes(g))) return false;
  // 분류 불능 → 기본은 보수적 탈락. L0는 "있으면 넛지, 없으면 조용히 스킵"이 원설계.
  if (groups.length === 0) return allowUnclassified;
  return true;
}
