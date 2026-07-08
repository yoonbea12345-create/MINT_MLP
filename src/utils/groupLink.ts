// 그룹 호스트가 정한 코스·지역·관계를 참여 링크(URL 쿼리)에 실어 게스트에게 전달한다.
// 세션 테이블에 컬럼을 추가하지 않고도 게스트가 "호스트가 고른 코스·지역"을 보고,
// 지역 방식(auto/manual)에 따라 출발지 입력 노출을 결정할 수 있게 하는 경량 통로.

export interface HostContext {
  purposeFirst: string | null;
  firstGenre: string | null;
  purposeSecond: string | null;   // '없음' 또는 null 이면 2차 없음
  secondGenre: string | null;
  relation: string | null;
  occasion: string | null;
  regionType: 'auto' | 'manual';
  regionName: string | null;      // manual일 때 지역명 (예: '성수/건대')
  regionId: string | null;        // manual 프리셋 id (중간지점 계산용)
}

// HostContext → "&c1=밥&..." 형태의 쿼리 문자열(맨 앞 &는 붙이지 않음)
export function encodeHostContext(ctx: HostContext): string {
  const p = new URLSearchParams();
  if (ctx.purposeFirst) p.set('c1', ctx.purposeFirst);
  if (ctx.firstGenre) p.set('g1', ctx.firstGenre);
  if (ctx.purposeSecond && ctx.purposeSecond !== '없음') p.set('c2', ctx.purposeSecond);
  if (ctx.secondGenre && ctx.purposeSecond && ctx.purposeSecond !== '없음') p.set('g2', ctx.secondGenre);
  if (ctx.relation) p.set('rel', ctx.relation);
  if (ctx.occasion) p.set('occ', ctx.occasion);
  p.set('rt', ctx.regionType);
  if (ctx.regionType === 'manual') {
    if (ctx.regionName) p.set('rn', ctx.regionName);
    if (ctx.regionId) p.set('ri', ctx.regionId);
  }
  return p.toString();
}

// URLSearchParams(현재 주소의 쿼리) → HostContext (없으면 null)
export function decodeHostContext(params: URLSearchParams): HostContext | null {
  const c1 = params.get('c1');
  const rt = params.get('rt');
  // 최소한 1차 코스가 있어야 새 플로우로 간주 (구버전 링크는 null 반환)
  if (!c1 && !rt) return null;
  const c2 = params.get('c2');
  return {
    purposeFirst: c1,
    firstGenre: params.get('g1'),
    purposeSecond: c2 ?? '없음',
    secondGenre: params.get('g2'),
    relation: params.get('rel'),
    occasion: params.get('occ'),
    regionType: rt === 'auto' ? 'auto' : 'manual',
    regionName: params.get('rn'),
    regionId: params.get('ri'),
  };
}
