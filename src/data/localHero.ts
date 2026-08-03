// 현지인 리워드 배지 — 아직 만들지 않은 기능의 시각적 프로토타입(사진 찍으려고 잠깐 켜 둔 것).
// 서버는 현지인 데이터를 주지 않는다. 장소명·주소를 시드로 성씨·방문횟수·활동기간을 결정적으로
// 파생해, 같은 장소를 다시 열어도 같은 사람이 나오게 한다(사진마다 사람이 바뀌면 그게 더 티가 난다).
// 실존 인물로 오인되지 않게 성씨 + 마스킹(○○)만 쓴다 — 풀네임은 절대 만들지 않는다.
//
// ⚠️ MOCK — 실데이터가 아니다. 사진 다 찍었으면 아래 플래그만 false로 되돌리면 배지가 전부 사라진다.
export const LOCAL_HERO_MOCK_ENABLED = true;

const LOCAL_SURNAMES = [
  '김', '이', '박', '최', '정', '강', '조', '윤', '장', '임',
  '한', '오', '서', '신', '권', '황', '안', '송', '전', '홍',
];

// djb2 변형 — 같은 입력이면 항상 같은 값. 파생의 결정성은 전부 여기에 기댄다.
function hashSeed(input: string): number {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

export interface LocalHeroProfile {
  surname: string;     // 성씨 — 노출은 언제나 '김○○' 형태다
  visitCount: number;  // 6~47회
  activeYears: number; // 1~6년
}

export function deriveLocalHero(place: { placeName?: string; address?: string }): LocalHeroProfile {
  const seed = hashSeed(`${place.placeName ?? ''}|${place.address ?? ''}`);
  return {
    surname: LOCAL_SURNAMES[seed % LOCAL_SURNAMES.length],
    visitCount: 6 + (Math.floor(seed / LOCAL_SURNAMES.length) % 42),
    activeYears: 1 + (Math.floor(seed / 97) % 6),
  };
}

// "서울 성동구 성수동2가 ..." → "성수동". 토큰 전체가 '~동' 또는 '~동+숫자+가'여야 매치되므로
// '성동구'처럼 우연히 '동'을 품은 토큰은 걸리지 않는다. 도로명 주소면 area로, 그것도 없으면 '동네'.
export function deriveNeighborhoodLabel(place: { address?: string; area?: string }): string {
  const tokens = (place.address ?? '').trim().split(/\s+/);
  const dong = tokens.find((t) => /^[가-힣]{2,6}동(\d+가)?$/.test(t));
  if (dong) return dong.replace(/\d+가$/, '');
  return (place.area ?? '').trim() || '동네';
}

// 예: "성수동 현지인 김○○님이 추천하는 이자카야"
export function localHeroLabel(place: {
  placeName?: string;
  address?: string;
  area?: string;
  category?: string;
}): string {
  const { surname } = deriveLocalHero(place);
  return `${deriveNeighborhoodLabel(place)} 현지인 ${surname}○○님이 추천하는 ${place.category?.trim() || '이곳'}`;
}
