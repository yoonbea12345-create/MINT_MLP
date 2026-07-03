import { describe, it, expect } from 'vitest';
import { findBalancedAreas, findNearestAreas, calcMidpoint } from './midpoint';

const GANGNAM = { lat: 37.4979, lng: 127.0276 };
const HONGDAE = { lat: 37.5573, lng: 126.9243 };
const SEONGSU = { lat: 37.5447, lng: 127.0557 };

describe('findBalancedAreas (중간지점 계산)', () => {
  it('출발지 0곳이면 서울 중심부 폴백', () => {
    const r = findBalancedAreas([]);
    expect(r.areaName).toBe('서울 중심부');
    expect(r.midpoint.lat).toBeCloseTo(37.5665, 3);
  });

  it('2명이면 선분의 정확한 중점', () => {
    const r = findBalancedAreas([GANGNAM, HONGDAE]);
    expect(r.midpoint.lat).toBeCloseTo((GANGNAM.lat + HONGDAE.lat) / 2, 6);
    expect(r.midpoint.lng).toBeCloseTo((GANGNAM.lng + HONGDAE.lng) / 2, 6);
  });

  it('3명이면 삼각형 무게중심(산술평균과 일치)', () => {
    const pts = [GANGNAM, HONGDAE, SEONGSU];
    const r = findBalancedAreas(pts);
    expect(r.midpoint.lat).toBeCloseTo(pts.reduce((s, p) => s + p.lat, 0) / 3, 5);
    expect(r.midpoint.lng).toBeCloseTo(pts.reduce((s, p) => s + p.lng, 0) / 3, 5);
  });

  it('일직선 좌표(면적 0)여도 NaN 없이 평균으로 폴백', () => {
    const collinear = [
      { lat: 37.5, lng: 127.0 },
      { lat: 37.6, lng: 127.0 },
      { lat: 37.7, lng: 127.0 },
    ];
    const r = findBalancedAreas(collinear);
    expect(Number.isFinite(r.midpoint.lat)).toBe(true);
    expect(r.midpoint.lng).toBeCloseTo(127.0, 6);
  });

  it('출발지가 150km 이상 떨어지면 보완 메시지 제공', () => {
    const seoul = { lat: 37.5665, lng: 126.978 };
    const busan = { lat: 35.1631, lng: 129.1635 };
    const r = findBalancedAreas([seoul, busan]);
    expect(r.compromiseMessage).toBeTruthy();
  });
});

describe('findNearestAreas', () => {
  it('요청한 개수만큼 가까운 지역명을 반환', () => {
    const areas = findNearestAreas(GANGNAM, 3);
    expect(areas).toHaveLength(3);
    expect(areas[0]).toBe('강남역');
  });
});

describe('calcMidpoint (하위 호환)', () => {
  it('좌표 평균을 반환', () => {
    const r = calcMidpoint([GANGNAM, HONGDAE]);
    expect(r.lat).toBeCloseTo((GANGNAM.lat + HONGDAE.lat) / 2, 6);
  });
});
