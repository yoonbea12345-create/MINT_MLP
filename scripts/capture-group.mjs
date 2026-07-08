import { chromium } from 'playwright';
import sharp from 'sharp';
import fs from 'fs';

const BASE = 'http://127.0.0.1:4173';
const OUT = 'public/image/landing';
const W = 360, H = 800, DPR = 2;

const MEMBERS = [
  { member_name: '민준', location_name: '강남역', location_lat: 37.4979, location_lng: 127.0276, vibe_atmosphere: 'atm_cozy', vibe_budget: '2~4만원', vibe_keywords: [] },
  { member_name: '서연', location_name: '홍대입구', location_lat: 37.5572, location_lng: 126.9245, vibe_atmosphere: 'atm_mood', vibe_budget: '2~4만원', vibe_keywords: [] },
];

async function mock(ctx) {
  // Playwright는 나중에 등록한 route가 우선 → 포괄 catch-all을 먼저 등록하고 구체 route를 뒤에 등록
  await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await ctx.route('**/api/count**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1284 }) }));
  await ctx.route('**/api/session-create', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'demo1234' }) }));
  await ctx.route('**/api/session-join', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }));
  await ctx.route('**/api/session-get**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ expected_count: 4, has_second: true, members: MEMBERS }) }));
}

async function save(page, name) {
  const png = await page.screenshot();
  await sharp(png).webp({ quality: 84 }).toFile(`${OUT}/${name}.webp`);
  const m = await sharp(png).metadata();
  console.log(`  ✓ ${name}.webp  ${m.width}x${m.height}`);
}

const wait = (p, ms = 500) => p.waitForTimeout(ms);

async function run() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
  await mock(ctx);
  const page = await ctx.newPage();

  // ─── HOST ───────────────────────────────────────────────
  console.log('HOST');
  await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
  await wait(page, 800);
  // 그룹 선택
  await page.getByText('다같이 정할게요').click();
  await wait(page);
  // 인원 4
  await page.getByRole('button', { name: '4', exact: true }).click().catch(() => {});
  // 1차 밥, 2차 술
  await page.locator('button', { hasText: '밥' }).first().click();
  await wait(page, 300);
  await page.locator('button', { hasText: '술' }).nth(1).click().catch(() => {}); // 2차 술
  await wait(page, 400);
  await save(page, 'host-course');

  // step1 지역
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await wait(page, 600);
  await page.getByText('자동 중간지점 찾기').click().catch(() => {});
  await wait(page, 400);
  await save(page, 'host-region');

  // step2 공유
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await wait(page, 500);
  await page.getByRole('button', { name: /링크 생성하기/ }).click();
  await page.getByText('공유 링크').waitFor({ timeout: 6000 }); // 세션 생성 후 공유 UI 대기
  await page.getByText('민준').waitFor({ timeout: 6000 }).catch(() => {}); // 첫 폴링으로 멤버 표시
  // 표시용 링크를 로컬(127.0.0.1) 대신 실제 배포 도메인으로 치환 — 마케팅 목업 품질
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('p')).find((p) => p.textContent?.includes('/join?id='));
    if (el) el.textContent = 'https://mint-mlp-4vm9.vercel.app/join?id=demo1234';
  });
  await wait(page, 400);
  await save(page, 'host-share');

  // host-vibe: 호스트도 '나도 참여'로 분위기 입력 (게스트 카드와 시각 구분 위해 다른 분위기 선택)
  const hvLink = `${BASE}/join?id=demo1234&c1=%EB%B0%A5&c2=%EC%88%A0&rt=manual&rn=${encodeURIComponent('성수/건대')}`;
  await page.goto(hvLink, { waitUntil: 'networkidle' });
  await wait(page, 700);
  await page.getByPlaceholder('이름을 입력해주세요').fill('호스트');
  await wait(page, 300);
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await wait(page, 600);
  await page.locator('button', { hasText: '시끌벅적' }).first().click().catch(() => {});
  await page.locator('button', { hasText: '힙한' }).first().click().catch(() => {});
  await page.locator('button', { hasText: '새로운 곳' }).first().click().catch(() => {});
  await wait(page, 400);
  await save(page, 'host-vibe');

  // ─── GUEST (임의 지역 링크: 출발지 생략) ──────────────────
  console.log('GUEST');
  const jlink = `${BASE}/join?id=demo1234&c1=%EB%B0%A5&c2=%EC%88%A0&rt=manual&rn=${encodeURIComponent('성수/건대')}`;
  await page.goto(jlink, { waitUntil: 'networkidle' });
  await wait(page, 700);
  // step0 이름
  await page.getByPlaceholder('이름을 입력해주세요').fill('지훈');
  await wait(page, 300);
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await wait(page, 600);
  // step1 분위기 — 몇 개 선택
  await page.locator('button', { hasText: '아늑한' }).first().click().catch(() => {});
  await page.locator('button', { hasText: '검증된 곳' }).first().click().catch(() => {});
  await wait(page, 400);
  await save(page, 'guest-vibe');

  // step2 취향
  await page.getByRole('button', { name: '다음', exact: true }).click();
  await wait(page, 600);
  await page.locator('button', { hasText: '2~4만원' }).first().click().catch(() => {});
  await page.locator('button', { hasText: '주차가능' }).first().click().catch(() => {});
  await wait(page, 400);
  await save(page, 'guest-extra');

  // done
  await page.getByRole('button', { name: /제출하기/ }).click();
  await page.getByText('제출 완료!').waitFor({ timeout: 6000 });
  await page.getByText('민준').waitFor({ timeout: 6000 }).catch(() => {}); // 폴링으로 현황 표시
  await wait(page, 600);
  await save(page, 'guest-done');

  await browser.close();
  console.log('DONE');
}

run().catch((e) => { console.error(e); process.exit(1); });
