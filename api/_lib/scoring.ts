// L3: 네이버 노출순위-적합도 괴리 보정. 계수는 상수로 분리해 조정 가능하게 유지.
export const SCORING_CONFIG = {
  bubblePenaltyWeight: 0.15, // bubbleScore * 0.15, 최대 15점 감점
  discrepancyPenalty: 8, // naverRank 상위 30% && fitScore 하위 50%
  gemBonus: 5, // 공공데이터 발굴 후보(localGem 상위로 이미 선별됨) && fitScore 중위 이상
  discrepancyNaverRankTopPct: 0.3,
  discrepancyFitScoreBottomPct: 0.5,
  gemFitScoreMinPct: 0.5,
  // 사용자가 명시한 키워드(#루프탑 등)가 실제 매칭되면 순위 가산 — Claude 자가채점의
  // 주관성을 보완하는 객관 신호. 화면 표시 fitScore는 그대로 두고 순위에만 반영.
  keywordHitBonus: 3, // 매칭 키워드 1개당
  keywordHitBonusMax: 9,
};

export interface ScorableCandidate {
  fitScore: number;
  bubbleScore: number;
  naverRank: number | null; // null = 공공데이터 발굴 후보(네이버 노출 없음)
  isPublicGem: boolean;
  keywordHits?: number; // 사용자 지정 키워드와 매칭된 개수(vibeTags/description 기준)
}

// finalScore = fitScore - bubblePenalty - discrepancyPenalty + gemBonus
export function computeFinalScores<T extends ScorableCandidate>(candidates: T[]): (T & { finalScore: number })[] {
  const n = candidates.length;
  if (n === 0) return [];

  // fitScore 오름차순 순위(0=최하위)로 백분위 계산 — "하위 50%"/"중위 이상" 판정용
  const fitRankOf = new Map<T, number>();
  [...candidates]
    .sort((a, b) => a.fitScore - b.fitScore)
    .forEach((c, i) => fitRankOf.set(c, i));

  const naverRanks = candidates
    .map((c) => c.naverRank)
    .filter((r): r is number => r !== null);
  const maxNaverRank = naverRanks.length ? Math.max(...naverRanks) : 0;

  return candidates.map((c) => {
    const bubblePenalty = c.bubbleScore * SCORING_CONFIG.bubblePenaltyWeight;

    const fitPercentile = n > 1 ? fitRankOf.get(c)! / (n - 1) : 1;
    const isFitBottomHalf = fitPercentile < SCORING_CONFIG.discrepancyFitScoreBottomPct;
    const isNaverTop30 =
      c.naverRank !== null && maxNaverRank > 0 && c.naverRank / maxNaverRank <= SCORING_CONFIG.discrepancyNaverRankTopPct;
    const discrepancyPenalty = isNaverTop30 && isFitBottomHalf ? SCORING_CONFIG.discrepancyPenalty : 0;

    const isFitMidUp = fitPercentile >= SCORING_CONFIG.gemFitScoreMinPct;
    const gemBonus = c.isPublicGem && isFitMidUp ? SCORING_CONFIG.gemBonus : 0;

    const keywordBonus = Math.min(
      (c.keywordHits ?? 0) * SCORING_CONFIG.keywordHitBonus,
      SCORING_CONFIG.keywordHitBonusMax,
    );

    const finalScore = c.fitScore - bubblePenalty - discrepancyPenalty + gemBonus + keywordBonus;
    return { ...c, finalScore };
  });
}
