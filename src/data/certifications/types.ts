// 다중 인증(우슐랭·미쉐린·백년가게·착한가격 …) 공통 타입 정의.
// 새 인증 리스트는 CertSource 하나를 추가하고 index.ts의 CERT_SOURCES에 끼워넣기만 하면 된다.
// 컴포넌트(ResultCard)·매칭 엔진(match.ts)은 손대지 않는다.

// 시·도 게이트 키 — 전국 17개 광역 지자체. 확장 시 값만 추가.
export type Sido =
  | '서울' | '부산' | '대구' | '인천' | '광주' | '대전' | '울산' | '세종'
  | '경기' | '강원' | '충북' | '충남' | '전북' | '전남' | '경북' | '경남' | '제주';

// 시·도 게이트에서 검사할 주소 토큰(약칭·정식 표기 모두 허용).
export const SIDO_TOKENS: Record<Sido, string[]> = {
  서울: ['서울'],
  부산: ['부산'],
  대구: ['대구'],
  인천: ['인천'],
  광주: ['광주'],
  대전: ['대전'],
  울산: ['울산'],
  세종: ['세종'],
  경기: ['경기'],
  강원: ['강원'],
  충북: ['충북', '충청북도'],
  충남: ['충남', '충청남도'],
  전북: ['전북', '전라북도'],
  전남: ['전남', '전라남도'],
  경북: ['경북', '경상북도'],
  경남: ['경남', '경상남도'],
  제주: ['제주'],
};

// 한 인증 리스트의 개별 등재 업소.
export interface CertEntry {
  name: string;      // 공식/보도 표기 상호명 원문
  region: Sido;      // 시·도 게이트 키
  district: string;  // 구·군 — 필수. 3중 게이트의 마지막 자물쇠
  category?: string; // 참고용(매칭에 사용하지 않음)
  year?: string;     // 선정 연도(참고용)
}

// 한 인증 리스트(브랜드) 정의 — 뱃지 외형 + 안내 시트 문구 + 데이터.
export interface CertSource {
  id: string;             // 고유 식별자(상태 키로도 사용)
  label: string;          // 뱃지에 노출될 짧은 이름 (예: 우슐랭)
  emoji: string;          // 뱃지·시트 아이콘
  badgeTextColor: string; // 뱃지 글자/아이콘 색 (배경은 흰색 고정)
  priority: number;       // 낮을수록 먼저 노출(정렬·slice 기준)
  sheetTitle: string;     // 안내 시트 제목
  sheetBody: string;      // 안내 시트 본문
  sourceLine: string;     // 출처 한 줄
  ctaLabel: string;       // 시트 확인 버튼 문구
  disclaimer?: string;    // (선택) 면책 문구 — 미쉐린 등 상표 독립성 고지
  entries: CertEntry[];   // 등재 업소 목록
}

// 매칭 결과 — 어떤 인증의 어떤 엔트리에 걸렸는지.
export interface CertMatch {
  source: CertSource;
  entry: CertEntry;
}
