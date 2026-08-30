// 공공데이터 상가(상권)정보의 실제 업종 분류명 어휘를 덤프한다.
//
// 왜 필요한가: api/_lib/purposeGate.ts의 업종 사전은 표준산업분류 관례에 근거한 "가설값"이다.
// 실제 indsMclsNm(중분류명)/indsSclsNm(소분류명) 표기를 한 번도 관측하지 못한 채 작성됐다.
// 이 스크립트로 실제 표기를 뽑아 사전을 교정한다.
//
// 사용법 (Node 20+ 의 --env-file 사용, 별도 패키지 불필요):
//   1) 프로젝트 루트에 .env 파일을 만들고 아래 한 줄을 넣는다.
//        PUBLIC_DATA_SERVICE_KEY=여기에_공공데이터포털_일반인증키
//      (키는 data.go.kr → 마이페이지 → 개발계정 에서 언제든 다시 복사할 수 있다.)
//   2) node --env-file=.env scripts/dump-inds-vocab.mjs
//      좌표/반경을 바꾸려면:  node --env-file=.env scripts/dump-inds-vocab.mjs 37.5445 127.0557 1000
//
// 이 스크립트는 인증키를 절대 출력하지 않는다. 출력물은 업종 분류명(공개 정보)뿐이다.

const key = process.env.PUBLIC_DATA_SERVICE_KEY;
if (!key) {
  console.error('PUBLIC_DATA_SERVICE_KEY 가 없다. .env 에 넣고 --env-file=.env 로 실행할 것.');
  process.exit(1);
}

const lat = Number(process.argv[2] ?? 37.5445);   // 기본: 서울 성수동
const lng = Number(process.argv[3] ?? 127.0557);
const radius = Number(process.argv[4] ?? 1000);

// recommend.ts 의 L0 와 동일하게 indsLclsCd=I2(음식 대분류) 전수 조회.
async function fetchPage(pageNo) {
  const url = `https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius`
    + `?serviceKey=${key}&cx=${lng}&cy=${lat}&radius=${radius}`
    + `&type=json&numOfRows=100&pageNo=${pageNo}&indsLclsCd=I2`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.header?.resultCode && data.header.resultCode !== '00') {
    // resultCode 03 = NODATA. 그 외는 키 문제일 가능성이 높다(메시지만 출력, 키는 노출 안 함).
    console.error(`[경고] resultCode=${data.header.resultCode} msg=${data.header.resultMsg ?? ''}`);
  }
  return data.body?.items ?? [];
}

const pages = await Promise.all([fetchPage(1), fetchPage(2), fetchPage(3)]);
const items = pages.flat();

if (items.length === 0) {
  console.error('결과 0건. 좌표/반경을 바꾸거나 인증키 승인 상태를 확인할 것.');
  process.exit(2);
}

// 응답에 중분류 필드가 실제로 존재하는지부터 확인한다 — purposeGate 가 중분류를 우선 신뢰하므로 중요.
const sample = items[0];
const hasMcls = Object.prototype.hasOwnProperty.call(sample, 'indsMclsNm');
console.log(`총 ${items.length}건 수집 (lat=${lat} lng=${lng} r=${radius}m)`);
console.log(`indsMclsNm 필드 존재: ${hasMcls ? 'O' : 'X  ← 없으면 purposeGate 는 소분류 폴백으로만 동작'}`);
console.log(`응답 필드: ${Object.keys(sample).join(', ')}\n`);

const counts = new Map();
for (const it of items) {
  const label = `${it.indsMclsNm ?? '-'}\t${it.indsSclsNm ?? '-'}`;
  counts.set(label, (counts.get(label) ?? 0) + 1);
}

console.log('중분류명\t소분류명\t건수');
console.log('─'.repeat(60));
for (const [label, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`${label}\t${n}`);
}
console.log(`\n고유 조합 ${counts.size}종. 이 표를 api/_lib/purposeGate.ts 의 사전과 대조할 것.`);
