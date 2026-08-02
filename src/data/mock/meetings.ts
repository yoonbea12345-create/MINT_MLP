// 내 모임 탭 목업 데이터 — 서버 모임 기능은 아직 없다. 화면 수요 검증용.
export interface MockMeeting {
  id: string; title: string; dateLabel: string;
  respondedCount: number; totalCount: number;
  placeName: string | null; areaName: string | null;
  isHost: boolean; status: 'collecting' | 'confirmed' | 'past';
}

export const MOCK_MEETINGS: MockMeeting[] = [
  { id: 'm1', title: '이번주 금요일 저녁 모임', dateLabel: '8/8(금) 19:00', respondedCount: 3, totalCount: 6, placeName: null, areaName: '홍대', isHost: true, status: 'collecting' },
  { id: 'm2', title: '대학 동기 모임', dateLabel: '8/15(금) 18:30', respondedCount: 5, totalCount: 5, placeName: '아키야마 성수본점', areaName: '성수', isHost: false, status: 'confirmed' },
  { id: 'm3', title: '프로젝트 회식', dateLabel: '7/25(금) 19:00', respondedCount: 4, totalCount: 4, placeName: '몽탄', areaName: '용산', isHost: true, status: 'past' },
];
