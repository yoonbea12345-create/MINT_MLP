import { describe, it, expect } from 'vitest';
import { computeBubbleScore } from './blogBuzz.js';

function post(title: string, description: string, postdate: string) {
  return { title, description, postdate };
}

const NORMAL = '맛있어요 또 가고 싶은 집';

describe('computeBubbleScore (블로그 버즈 거품 분석)', () => {
  it('후기 3건 미만이면 판단 보류(0점) + buzzCount 유지', () => {
    const r = computeBubbleScore([post('a', 'b', '20260101')], 57);
    expect(r.bubbleScore).toBe(0);
    expect(r.buzzCount).toBe(57);
  });

  it('협찬 마커가 많을수록 sponsoredRatio와 bubbleScore가 오른다', () => {
    const items = [
      post('협찬 받았어요', '체험단 후기', '20240101'),
      post('원고료를 지원받아 작성', '', '20240201'),
      post(NORMAL, '', '20240301'),
      post(NORMAL, '', '20240401'),
    ];
    const r = computeBubbleScore(items, items.length);
    expect(r.sponsoredRatio).toBe(0.5);
    expect(r.bubbleScore).toBeGreaterThan(0);
  });

  it('재방문 마커는 거품 점수를 낮춘다', () => {
    const sponsored = [
      post('협찬 후기', '', '20240101'),
      post('협찬 후기2', '', '20240201'),
      post(NORMAL, '', '20240301'),
      post(NORMAL, '', '20240401'),
    ];
    const withRevisit = [
      post('협찬 후기', '', '20240101'),
      post('협찬 후기2', '', '20240201'),
      post('재방문했어요 단골 됐어요', '', '20240301'),
      post('벌써 세 번째 방문', '자주 가는 집', '20240401'),
    ];
    const a = computeBubbleScore(sponsored, 4);
    const b = computeBubbleScore(withRevisit, 4);
    expect(b.bubbleScore).toBeLessThan(a.bubbleScore);
  });

  it('점수는 0~100으로 클램프된다', () => {
    const allSponsored = Array.from({ length: 10 }, (_, i) =>
      post('협찬 체험단 원고료', '제공받아 작성', `2026060${i % 9 + 1}`));
    const r = computeBubbleScore(allSponsored, 10);
    expect(r.bubbleScore).toBeLessThanOrEqual(100);
    expect(r.bubbleScore).toBeGreaterThanOrEqual(0);
  });
});
