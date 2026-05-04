import { useState } from 'react';
import type { PresetRegion } from '../services/midpoint';
import { PRESET_REGIONS } from '../services/midpoint';

interface Props {
  onAutoSelect: () => void;
  onRegionSelect: (region: PresetRegion) => void;
  onBack: () => void;
}

// 전국 주요 지역 (검색용)
const SEARCH_REGIONS: PresetRegion[] = [
  // 서울 주요 지역 (PRESET_REGIONS 포함)
  ...PRESET_REGIONS,
  // 서울 추가 구역
  { id: 'seoul-center', label: '서울 중심부', sublabel: '광화문·시청·종로', midpoint: { lat: 37.5665, lng: 126.9780 } },
  { id: 'nowon',        label: '노원/도봉',   sublabel: '노원역·도봉산·창동',   midpoint: { lat: 37.6543, lng: 127.0568 } },
  { id: 'dobong',       label: '도봉/강북',   sublabel: '쌍문역·수유역·미아',   midpoint: { lat: 37.6688, lng: 127.0471 } },
  { id: 'mapo',         label: '마포/공덕',   sublabel: '공덕역·마포역·대흥역', midpoint: { lat: 37.5442, lng: 126.9514 } },
  { id: 'yongsan',      label: '용산',        sublabel: '용산역·이촌·한강진',   midpoint: { lat: 37.5311, lng: 126.9658 } },
  { id: 'gwangjin',     label: '광진/구의',   sublabel: '구의역·자양동·광장동', midpoint: { lat: 37.5450, lng: 127.0850 } },
  { id: 'songpa',       label: '송파/문정',   sublabel: '가락시장·문정역·오금', midpoint: { lat: 37.4760, lng: 127.1218 } },
  { id: 'gangseo',      label: '강서/화곡',   sublabel: '발산역·화곡역·마곡',   midpoint: { lat: 37.5512, lng: 126.8496 } },
  { id: 'yangcheon',    label: '양천/목동',   sublabel: '목동역·신정역·오목교', midpoint: { lat: 37.5170, lng: 126.8680 } },
  { id: 'dongdaemun',   label: '동대문',      sublabel: '동대문역·청량리·답십리', midpoint: { lat: 37.5714, lng: 127.0407 } },
  { id: 'jungnang',     label: '중랑/면목',   sublabel: '면목역·상봉역·중화',   midpoint: { lat: 37.5947, lng: 127.0943 } },
  { id: 'eunpyeong',    label: '은평/불광',   sublabel: '불광역·연신내·구산',   midpoint: { lat: 37.6176, lng: 126.9278 } },
  { id: 'seodaemun',    label: '서대문/연희', sublabel: '서대문역·독립문·연희', midpoint: { lat: 37.5793, lng: 126.9368 } },
  { id: 'seocho',       label: '서초/방배',   sublabel: '방배역·서초역·교대',   midpoint: { lat: 37.4836, lng: 126.9820 } },
  // 경기도
  { id: 'suwon',        label: '수원',        sublabel: '수원역·팔달문·인계동', midpoint: { lat: 37.2636, lng: 127.0286 } },
  { id: 'seongnam',     label: '성남',        sublabel: '모란역·서현역·분당',   midpoint: { lat: 37.4340, lng: 127.1290 } },
  { id: 'bundang',      label: '분당/판교',   sublabel: '판교역·서현역·야탑',   midpoint: { lat: 37.3838, lng: 127.1228 } },
  { id: 'goyang',       label: '고양/일산',   sublabel: '정발산역·일산역·화정', midpoint: { lat: 37.6579, lng: 126.8320 } },
  { id: 'uijeongbu',    label: '의정부',      sublabel: '의정부역·호원동·녹양', midpoint: { lat: 37.7381, lng: 127.0439 } },
  { id: 'bucheon',      label: '부천',        sublabel: '부천역·중동·소사',     midpoint: { lat: 37.5033, lng: 126.7613 } },
  { id: 'anyang',       label: '안양',        sublabel: '안양역·범계역·평촌',   midpoint: { lat: 37.3943, lng: 126.9528 } },
  { id: 'ansan',        label: '안산',        sublabel: '안산역·중앙역·고잔',   midpoint: { lat: 37.3219, lng: 126.8308 } },
  { id: 'hwaseong',     label: '화성/동탄',   sublabel: '동탄역·병점역·향남',   midpoint: { lat: 37.2005, lng: 127.0721 } },
  { id: 'yongin',       label: '용인',        sublabel: '기흥역·죽전역·수지',   midpoint: { lat: 37.2411, lng: 127.1776 } },
  { id: 'gwangmyeong',  label: '광명',        sublabel: '광명역·소하동·철산',   midpoint: { lat: 37.4784, lng: 126.8643 } },
  { id: 'siheung',      label: '시흥',        sublabel: '정왕역·오이도·월곶',   midpoint: { lat: 37.3800, lng: 126.8030 } },
  { id: 'gimpo',        label: '김포',        sublabel: '김포공항·풍무·걸포',   midpoint: { lat: 37.6151, lng: 126.7163 } },
  { id: 'hanam',        label: '하남',        sublabel: '미사역·덕풍·풍산',     midpoint: { lat: 37.5397, lng: 127.2148 } },
  { id: 'namyangju',    label: '남양주',      sublabel: '도농역·별내·퇴계원',   midpoint: { lat: 37.6360, lng: 127.2160 } },
  { id: 'gapyeong',     label: '가평',        sublabel: '가평역·청평·대성리',   midpoint: { lat: 37.8317, lng: 127.5108 } },
  { id: 'yangpyeong',   label: '양평',        sublabel: '양평역·용문·양수',     midpoint: { lat: 37.4916, lng: 127.4876 } },
  { id: 'paju',         label: '파주',        sublabel: '운정역·교하·탄현',     midpoint: { lat: 37.7600, lng: 126.7800 } },
  { id: 'pocheon',      label: '포천',        sublabel: '포천시내·소흘·내촌',   midpoint: { lat: 37.8944, lng: 127.2003 } },
  { id: 'osan',         label: '오산',        sublabel: '오산역·세교·궐동',     midpoint: { lat: 37.1500, lng: 127.0770 } },
  { id: 'pyeongtaek',   label: '평택',        sublabel: '평택역·지제역·송탄',   midpoint: { lat: 37.0174, lng: 127.0733 } },
  { id: 'icheon',       label: '이천',        sublabel: '이천시내·부발·마장',   midpoint: { lat: 37.2720, lng: 127.4350 } },
  { id: 'gwangju-gyeonggi', label: '광주(경기)', sublabel: '경기광주역·곤지암·오포', midpoint: { lat: 37.4296, lng: 127.2550 } },
  // 인천
  { id: 'incheon-center', label: '인천 중심', sublabel: '인천역·동인천·인하대', midpoint: { lat: 37.4738, lng: 126.6216 } },
  { id: 'bupyeong',     label: '부평',        sublabel: '부평역·산곡·작전',     midpoint: { lat: 37.4883, lng: 126.7238 } },
  { id: 'songdo',       label: '송도',        sublabel: '송도역·인천대입구·테크노', midpoint: { lat: 37.3830, lng: 126.6566 } },
  { id: 'seogu-incheon', label: '인천 서구',  sublabel: '검단·원당·마전',       midpoint: { lat: 37.5456, lng: 126.6735 } },
  // 대전/충청
  { id: 'daejeon',      label: '대전',        sublabel: '대전역·둔산·서구',     midpoint: { lat: 36.3504, lng: 127.3845 } },
  { id: 'daejeon-dunsan', label: '대전 둔산', sublabel: '둔산동·탄방·정림',     midpoint: { lat: 36.3510, lng: 127.3730 } },
  { id: 'cheongju',     label: '청주',        sublabel: '청주역·복대·율량',     midpoint: { lat: 36.6424, lng: 127.4890 } },
  { id: 'cheonan',      label: '천안',        sublabel: '천안역·쌍용·불당',     midpoint: { lat: 36.8151, lng: 127.1139 } },
  { id: 'asan',         label: '아산',        sublabel: '아산역·온양온천·배방', midpoint: { lat: 36.7897, lng: 126.9817 } },
  { id: 'sejong',       label: '세종',        sublabel: '세종시·조치원·반곡',   midpoint: { lat: 36.4801, lng: 127.2890 } },
  { id: 'gongju',       label: '공주',        sublabel: '공주시·신관·유구',     midpoint: { lat: 36.4465, lng: 127.1190 } },
  // 부산/경남
  { id: 'busan',        label: '부산',        sublabel: '부산역·서면·해운대',   midpoint: { lat: 35.1796, lng: 129.0756 } },
  { id: 'busan-seomyeon', label: '부산 서면', sublabel: '서면역·부전·전포',     midpoint: { lat: 35.1580, lng: 129.0590 } },
  { id: 'haeundae',     label: '해운대',      sublabel: '해운대역·센텀·마린시티', midpoint: { lat: 35.1631, lng: 129.1636 } },
  { id: 'changwon',     label: '창원',        sublabel: '창원역·마산·진해',     midpoint: { lat: 35.2280, lng: 128.6812 } },
  { id: 'gimhae',       label: '김해',        sublabel: '장유·내외·부원',       midpoint: { lat: 35.2283, lng: 128.8893 } },
  { id: 'ulsan',        label: '울산',        sublabel: '울산역·삼산·남구',     midpoint: { lat: 35.5384, lng: 129.3114 } },
  // 대구/경북
  { id: 'daegu',        label: '대구',        sublabel: '동대구역·반월당·수성', midpoint: { lat: 35.8714, lng: 128.6014 } },
  { id: 'daegu-dongseong', label: '대구 동성로', sublabel: '동성로·반월당·명덕', midpoint: { lat: 35.8700, lng: 128.5950 } },
  { id: 'gumi',         label: '구미',        sublabel: '구미역·원평·공단',     midpoint: { lat: 36.1198, lng: 128.3445 } },
  { id: 'pohang',       label: '포항',        sublabel: '포항역·지곡·남구',     midpoint: { lat: 36.0190, lng: 129.3435 } },
  { id: 'gyeongju',     label: '경주',        sublabel: '경주역·황리단길·보문', midpoint: { lat: 35.8562, lng: 129.2247 } },
  { id: 'andong',       label: '안동',        sublabel: '안동역·구시가지·하회', midpoint: { lat: 36.5684, lng: 128.7294 } },
  // 광주/전라
  { id: 'gwangju',      label: '광주',        sublabel: '광주역·상무·충장로',   midpoint: { lat: 35.1595, lng: 126.8526 } },
  { id: 'gwangju-sangmu', label: '광주 상무', sublabel: '상무역·치평·마륵',     midpoint: { lat: 35.1525, lng: 126.8480 } },
  { id: 'jeonju',       label: '전주',        sublabel: '전주역·한옥마을·금암', midpoint: { lat: 35.8242, lng: 127.1480 } },
  { id: 'mokpo',        label: '목포',        sublabel: '목포역·하당·원도심',   midpoint: { lat: 34.8118, lng: 126.3922 } },
  { id: 'yeosu',        label: '여수',        sublabel: '여수엑스포역·돌산·웅천', midpoint: { lat: 34.7604, lng: 127.6622 } },
  { id: 'suncheon',     label: '순천',        sublabel: '순천역·왕지·행동',     midpoint: { lat: 34.9507, lng: 127.4872 } },
  { id: 'iksan',        label: '익산',        sublabel: '익산역·영등·모현',     midpoint: { lat: 35.9483, lng: 126.9576 } },
  // 강원
  { id: 'chuncheon',    label: '춘천',        sublabel: '춘천역·명동·효자',     midpoint: { lat: 37.8813, lng: 127.7298 } },
  { id: 'wonju',        label: '원주',        sublabel: '원주역·단계·무실',     midpoint: { lat: 37.3422, lng: 127.9202 } },
  { id: 'gangneung',    label: '강릉',        sublabel: '강릉역·교동·포남',     midpoint: { lat: 37.7519, lng: 128.8761 } },
  // 제주
  { id: 'jeju',         label: '제주',        sublabel: '제주시·연동·노형',     midpoint: { lat: 33.4996, lng: 126.5312 } },
  { id: 'seogwipo',     label: '서귀포',      sublabel: '서귀포시·중문·표선',   midpoint: { lat: 33.2541, lng: 126.5600 } },
];

// 중복 제거 (PRESET_REGIONS가 이미 포함되어 있으므로)
const ALL_REGIONS = Array.from(new Map(SEARCH_REGIONS.map((r) => [r.id, r])).values());

export default function RegionSelect({ onAutoSelect, onRegionSelect, onBack }: Props) {
  const [query, setQuery] = useState('');

  const filtered = query.trim().length > 0
    ? ALL_REGIONS.filter(
        (r) =>
          r.label.includes(query.trim()) ||
          r.sublabel.includes(query.trim())
      )
    : PRESET_REGIONS;

  return (
    <div className="min-h-screen bg-[#F5FBF8]">
      <div className="max-w-md mx-auto px-4 pt-8 pb-10">

        <div className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="text-sm text-gray-400 hover:text-gray-600">
            ← 이전
          </button>
          <span className="text-[#3CDBC0] font-black text-lg">MINT</span>
          <div className="w-12" />
        </div>

        <div className="text-center mb-8">
          <h2 className="text-xl font-black text-gray-800">어느 지역에서 만날까요?</h2>
          <p className="text-sm text-gray-400 mt-1">추천 방식을 선택해주세요</p>
        </div>

        {/* 자동 중간지점 */}
        <button
          onClick={onAutoSelect}
          className="w-full text-left bg-white border-2 border-[#3CDBC0] rounded-2xl p-5 shadow-sm hover:bg-[#E8F8F5] transition-all active:scale-[0.98] mb-5"
        >
          <div className="flex items-start gap-4">
            <div className="text-3xl">🧭</div>
            <div>
              <div className="font-black text-gray-800 text-base">자동 중간지점 찾기</div>
              <div className="text-sm text-gray-500 mt-1 leading-relaxed">
                모두의 출발지 기준으로<br />
                최적의 중간 지점을 계산해드려요
              </div>
              <div className="mt-2 inline-block text-xs font-bold text-[#3CDBC0] bg-[#E8F8F5] px-2 py-0.5 rounded-full">
                추천
              </div>
            </div>
          </div>
        </button>

        {/* 지역 검색 + 그리드 */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-black text-gray-700">지역 직접 선택</span>
            <span className="text-xs text-gray-400">대전, 부산, 강남 등 검색</span>
          </div>

          {/* 검색창 */}
          <div className="relative mb-4">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="지역명 검색 (예: 대전, 강남, 부산...)"
              className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-[#3CDBC0] text-sm outline-none transition-all bg-white"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 text-lg"
              >
                ×
              </button>
            )}
          </div>

          {/* 지역 그리드 */}
          {filtered.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-8">
              검색 결과가 없어요
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {filtered.map((region) => (
                <button
                  key={region.id}
                  onClick={() => onRegionSelect(region)}
                  className="bg-white border-2 border-gray-100 rounded-xl p-3 text-left hover:border-[#3CDBC0] hover:bg-[#E8F8F5] transition-all active:scale-[0.97]"
                >
                  <div className="text-sm font-black text-gray-800 truncate">{region.label}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5 truncate">{region.sublabel}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
