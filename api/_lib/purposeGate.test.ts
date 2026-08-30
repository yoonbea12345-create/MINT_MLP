import { describe, it, expect } from 'vitest';
import { isStoreAllowedForPurpose, classifyStoreGroup } from './purposeGate.js';

// ⚠️ 아래 픽스처의 업종명(category/mclsName)은 실제 공공데이터 API 응답으로 실측 검증한 값이
// 아니다. 한국 표준산업분류 / 소상공인 상권정보 소분류·중분류명 관례에 근거한 가설값이며,
// 실제 표기가 다를 수 있다(그래서 purposeGate는 부분일치로 흔들림을 흡수한다).
// 배포 후 `[recommend] L0 ... gateUnknown=` 로그의 실제 값으로 사전과 픽스처를 교정할 것.
const store = (category: string, opts: { name?: string; mclsName?: string } = {}) => ({
  name: opts.name ?? '테스트가게',
  category,
  mclsName: opts.mclsName,
});

describe('isStoreAllowedForPurpose (목적 대비 업종 게이트)', () => {
  it('회귀: 밥 목적에 제과점(빵집)은 불허 — "노포 골랐는데 빵집이 나온" 버그', () => {
    expect(isStoreAllowedForPurpose(store('제과점'), '밥')).toBe(false);
    expect(isStoreAllowedForPurpose(store('제과점업', { name: '○○베이커리' }), '밥')).toBe(false);
    expect(isStoreAllowedForPurpose(store('기타 간이 음식점업', { mclsName: '제과제빵' }), '밥')).toBe(false);
  });

  it('밥 목적: 백반/한정식·곱창 구이는 허용', () => {
    expect(isStoreAllowedForPurpose(store('백반/한정식'), '밥')).toBe(true);
    expect(isStoreAllowedForPurpose(store('곱창 전골/구이'), '밥')).toBe(true);
    expect(isStoreAllowedForPurpose(store('한식 일반 음식점업', { mclsName: '한식' }), '밥')).toBe(true);
  });

  it('밥 목적: 떡볶이(분식)는 "떡" 때문에 카페로 오분류되지 않는다', () => {
    expect(classifyStoreGroup(store('떡볶이 전문점'))).toBe('밥');
    expect(isStoreAllowedForPurpose(store('떡볶이 전문점'), '밥')).toBe(true);
  });

  it('카페 목적: 제과점·커피전문점 허용 / 곱창 구이 불허', () => {
    expect(isStoreAllowedForPurpose(store('제과점'), '카페')).toBe(true);
    expect(isStoreAllowedForPurpose(store('커피전문점/카페'), '카페')).toBe(true);
    expect(isStoreAllowedForPurpose(store('곱창 전골/구이'), '카페')).toBe(false);
  });

  it('술 목적: 호프/맥주·곱창 구이(안주 식당) 허용 / 커피전문점 불허', () => {
    expect(isStoreAllowedForPurpose(store('호프/맥주'), '술')).toBe(true);
    expect(isStoreAllowedForPurpose(store('곱창 전골/구이'), '술')).toBe(true);
    expect(isStoreAllowedForPurpose(store('커피전문점/카페'), '술')).toBe(false);
  });

  it('전역 제외: 기관 구내식당은 어떤 목적에서도 불허', () => {
    for (const purpose of ['밥', '술', '카페', '기타', '보쌈']) {
      expect(isStoreAllowedForPurpose(store('기관 구내식당'), purpose)).toBe(false);
    }
    expect(isStoreAllowedForPurpose(store('일반유흥주점'), '술')).toBe(false);
  });

  it('분류 불능(빈 문자열/미지 어휘)은 보수적으로 불허', () => {
    expect(classifyStoreGroup(store(''))).toBe(null);
    expect(isStoreAllowedForPurpose(store(''), '밥')).toBe(false);
    expect(isStoreAllowedForPurpose(store('알수없는업태'), '밥')).toBe(false);
    expect(isStoreAllowedForPurpose(store('알수없는업태'), '카페')).toBe(false);
  });

  it('커스텀 메뉴("보쌈"): 족발/보쌈은 허용, 제과점은 불허', () => {
    expect(isStoreAllowedForPurpose(store('족발/보쌈'), '보쌈', ['보쌈'])).toBe(true);
    expect(isStoreAllowedForPurpose(store('제과점', { name: '행복제과' }), '보쌈', ['보쌈'])).toBe(false);
    // 가게명으로만 겹쳐도 허용
    expect(isStoreAllowedForPurpose(store('한식 일반 음식점업', { name: '원조보쌈집' }), '보쌈', ['보쌈'])).toBe(true);
  });

  it('프리셋 밖 목적(기타)은 전역 제외만 적용 — 과차단 방지', () => {
    expect(isStoreAllowedForPurpose(store('알수없는업태'), '기타')).toBe(true);
    expect(isStoreAllowedForPurpose(store('기관 구내식당'), '기타')).toBe(false);
  });

  // 사전이 실제 어휘를 못 맞혀 후보가 0이 되면 호출부가 allowUnclassified=true로 재시도한다.
  // 이 완화 모드에서도 빵집은 반드시 막혀야 한다 — 안 그러면 이번 버그가 그대로 되살아난다.
  describe('완화 모드(allowUnclassified=true)', () => {
    it('모르는 업종은 통과시킨다 — L0가 통째로 죽지 않게', () => {
      expect(isStoreAllowedForPurpose(store('알수없는업태'), '밥', [], true)).toBe(true);
      expect(isStoreAllowedForPurpose(store(''), '밥', [], true)).toBe(true);
    });

    it('완화 모드여도 제과점은 밥 목적에서 여전히 막힌다 (빵집 재발 방지)', () => {
      expect(isStoreAllowedForPurpose(store('제과점'), '밥', [], true)).toBe(false);
      expect(isStoreAllowedForPurpose(store('제과점', { mclsName: '기타 간이 음식점' }), '밥', [], true)).toBe(false);
      expect(isStoreAllowedForPurpose(store('커피전문점/카페'), '밥', [], true)).toBe(false);
    });

    it('완화 모드여도 전역 제외는 그대로 막힌다', () => {
      expect(isStoreAllowedForPurpose(store('기관 구내식당'), '밥', [], true)).toBe(false);
      expect(isStoreAllowedForPurpose(store('일반유흥주점'), '술', [], true)).toBe(false);
    });
  });

  it('중분류명이 소분류명보다 우선한다', () => {
    expect(classifyStoreGroup(store('', { mclsName: '비알코올 음료점업' }))).toBe('카페');
    expect(classifyStoreGroup(store('', { mclsName: '주점업' }))).toBe('술');
    expect(classifyStoreGroup(store('', { mclsName: '외국식 음식점업' }))).toBe('밥');
  });

  // 실제 업종분류상 제과점업은 '기타 간이 음식점' 중분류 아래에 있다. 중분류를 무조건 먼저
  // 보면 빵집이 '밥'으로 오분류되고, 이 헬퍼를 쓰는 코드가 생기는 순간 버그가 재발한다.
  it('중분류가 밥으로 읽혀도 소분류가 제과점이면 카페로 확정한다 (빵집 오분류 방지)', () => {
    expect(classifyStoreGroup(store('제과점', { mclsName: '기타 간이 음식점' }))).toBe('카페');
    expect(classifyStoreGroup(store('제과점업', { mclsName: '기타 간이 음식점업' }))).toBe('카페');
    // 같은 중분류라도 제과 신호가 없으면 밥 그대로.
    expect(classifyStoreGroup(store('김밥/기타 간이 음식점', { mclsName: '기타 간이 음식점' }))).toBe('밥');
  });
});
