import { describe, it, expect } from 'vitest';
import { computeLocalGem } from './publicData.js';

describe('computeLocalGem (공공데이터 발굴 점수)', () => {
  it('연차 정보 없으면 0', () => {
    expect(computeLocalGem(undefined, 0)).toBe(0);
  });

  it('5년이면 만점(1.0) — 노포 편중 방지 cap', () => {
    // 호출부(recommend.ts L0)는 buzzCount=0으로 부르므로 버즈항=1.0
    expect(computeLocalGem(5, 0)).toBe(1);
  });

  it('2.5년이면 0.5 (선형)', () => {
    expect(computeLocalGem(2.5, 0)).toBe(0.5);
  });

  it('5년 초과 업력은 추가 가산 없음 — 40년도 5년과 동률', () => {
    expect(computeLocalGem(40, 0)).toBe(computeLocalGem(5, 0));
  });

  it('버즈 많으면(시끄러움) 감점 — "조용함" 신호 유지', () => {
    // 5년 + 버즈 100/200 정규화 → 1.0 × (1 - 0.5) = 0.5
    expect(computeLocalGem(5, 100)).toBe(0.5);
  });
});
