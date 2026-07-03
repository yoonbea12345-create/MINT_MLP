import { describe, it, expect } from 'vitest';
import { computeFinalScores, SCORING_CONFIG } from './scoring.js';

const base = { fitScore: 80, bubbleScore: 0, naverRank: null, isPublicGem: false };

describe('computeFinalScores (L3 재정렬)', () => {
  it('빈 배열은 빈 배열', () => {
    expect(computeFinalScores([])).toEqual([]);
  });

  it('신호가 없으면 finalScore = fitScore', () => {
    const [r] = computeFinalScores([{ ...base }]);
    expect(r.finalScore).toBe(80);
  });

  it('bubbleScore는 가중치만큼 감점된다', () => {
    const [r] = computeFinalScores([{ ...base, bubbleScore: 100 }]);
    expect(r.finalScore).toBe(80 - 100 * SCORING_CONFIG.bubblePenaltyWeight);
  });

  it('네이버 상위 노출 + fitScore 하위권이면 괴리 감점', () => {
    // 4개 후보: naverRank 0(상위)이면서 fitScore 최하위인 후보가 감점 대상
    const candidates = [
      { ...base, fitScore: 40, naverRank: 0 },  // 상위 노출인데 적합도 꼴찌 → 감점
      { ...base, fitScore: 90, naverRank: 9 },
      { ...base, fitScore: 85, naverRank: 5 },
      { ...base, fitScore: 80, naverRank: 7 },
    ];
    const scored = computeFinalScores(candidates);
    expect(scored[0].finalScore).toBe(40 - SCORING_CONFIG.discrepancyPenalty);
    expect(scored[1].finalScore).toBe(90); // 정상 후보는 무감점
  });

  it('공공데이터 발굴 후보는 fitScore 중위 이상일 때만 가산점', () => {
    const candidates = [
      { ...base, fitScore: 90, isPublicGem: true },  // 상위권 gem → 보너스
      { ...base, fitScore: 30, isPublicGem: true },  // 하위권 gem → 보너스 없음
      { ...base, fitScore: 60 },
      { ...base, fitScore: 50 },
    ];
    const scored = computeFinalScores(candidates);
    expect(scored[0].finalScore).toBe(90 + SCORING_CONFIG.gemBonus);
    expect(scored[1].finalScore).toBe(30);
  });
});
