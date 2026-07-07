import { describe, it, expect } from 'vitest';
import { splitMemberKeywords, EXCLUDE_FOOD_PREFIX } from './groupAggregate';
import type { GroupMember } from './groupAggregate';

function member(keywords: string[]): GroupMember {
  return {
    member_name: 'x', location_name: 'y', location_lat: 37.5, location_lng: 127,
    vibe_atmosphere: null, vibe_budget: null, vibe_keywords: keywords,
  };
}

describe('splitMemberKeywords', () => {
  it('편식 접두사 항목을 일반 키워드와 분리한다', () => {
    const { keywords, excludeFoods } = splitMemberKeywords([
      member(['단체룸', `${EXCLUDE_FOOD_PREFIX}회`]),
      member([`${EXCLUDE_FOOD_PREFIX}오이`, '주차가능']),
    ]);
    expect(keywords).toEqual(['단체룸', '주차가능']);
    expect(excludeFoods).toEqual(['회', '오이']);
  });

  it('전원 합집합 — 중복 편식은 하나로 합친다', () => {
    const { excludeFoods } = splitMemberKeywords([
      member([`${EXCLUDE_FOOD_PREFIX}곱창`]),
      member([`${EXCLUDE_FOOD_PREFIX}곱창`, `${EXCLUDE_FOOD_PREFIX}매운 음식`]),
    ]);
    expect(excludeFoods).toEqual(['곱창', '매운 음식']);
  });

  it('키워드가 없는 멤버·빈 접두사 항목은 무시한다', () => {
    const noKw = member([]);
    delete (noKw as Partial<GroupMember>).vibe_keywords;
    const { keywords, excludeFoods } = splitMemberKeywords([noKw, member([EXCLUDE_FOOD_PREFIX])]);
    expect(keywords).toEqual([]);
    expect(excludeFoods).toEqual([]);
  });
});
