import { describe, it, expect } from 'vitest';
import { validateRecommendBody } from './guard';

const base = {
  input: {
    locations: [] as { name: string }[],
    purpose: { first: '술', second: '카페' },
  },
  midpoint: { lat: 37.5563, lng: 126.9236 },
  congestionData: [{ areaName: '홍대 관광특구', level: '보통' }],
};

describe('validateRecommendBody', () => {
  it('지역 직접 선택 플로우 — 출발지 빈 배열도 통과', () => {
    expect(validateRecommendBody(base)).toBeNull();
  });

  it('출발지 이름이 빈 문자열이어도 통과 (미완성 입력 행)', () => {
    const body = { ...base, input: { ...base.input, locations: [{ name: '' }, { name: '강남역' }] } };
    expect(validateRecommendBody(body)).toBeNull();
  });

  it('출발지 13개 초과는 거부', () => {
    const body = { ...base, input: { ...base.input, locations: Array(13).fill({ name: '역' }) } };
    expect(validateRecommendBody(body)).not.toBeNull();
  });

  it('midpoint 없는 요청은 거부', () => {
    expect(validateRecommendBody({ input: base.input, congestionData: [] })).not.toBeNull();
  });

  it('한반도 밖 좌표는 거부', () => {
    const body = { ...base, midpoint: { lat: 35.6762, lng: 139.6503 } };
    expect(validateRecommendBody(body)).not.toBeNull();
  });

  it('purpose.first 없는 요청은 거부', () => {
    const body = { ...base, input: { ...base.input, purpose: { first: '', second: null } } };
    expect(validateRecommendBody(body)).not.toBeNull();
  });
});
