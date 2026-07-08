import { chromium } from 'playwright';
import sharp from 'sharp';
const BASE='http://127.0.0.1:4173';
const OUT='public/image/landing';
const wait=(p,ms=400)=>p.waitForTimeout(ms);
async function save(p,name){ const png=await p.screenshot(); await sharp(png).webp({quality:84}).toFile(`${OUT}/${name}.webp`); console.log('  ✓',name); }
const KAKAO=()=>{const OK='OK';window.kakao={maps:{services:{Status:{OK,ZERO_RESULT:'ZERO'},Places:function(){this.keywordSearch=(kw,cb)=>cb([{id:'1',place_name:'x',address_name:'서울 마포구 서교동 1',road_address_name:'',x:'126.92',y:'37.55',category_name:'',phone:'',place_url:''}],OK);},Geocoder:function(){this.addressSearch=(q,cb)=>cb([{x:'126.92',y:'37.55'}],OK);}},load:(cb)=>cb&&cb()}};};
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:360,height:800},deviceScaleFactor:2,isMobile:true,hasTouch:true});
await ctx.route('**/api/**',r=>r.fulfill({status:200,contentType:'application/json',body:'{}'}));
await ctx.addInitScript(KAKAO);
const p=await ctx.newPage();

// ── purpose.webp: step0 (밥 1차 · 술 2차) ──
await p.goto(BASE+'/app',{waitUntil:'networkidle'});await wait(p,700);
await p.getByText('혼자 정할게요').click();await wait(p,300);
await p.locator('button',{hasText:'밥'}).first().click();await wait(p,200);
await p.locator('button',{hasText:'술'}).nth(1).click();await wait(p,300);
await save(p,'purpose');

// ── region.webp: step2 지역 선택 화면 ──
await p.getByRole('button',{name:'다음',exact:true}).click();await wait(p,400); // step1 관계
await p.getByRole('button',{name:'다음',exact:true}).click();await wait(p,500); // step2 지역
await save(p,'region');

// ── vibe.webp: step3 (동네 선택 후) ──
await p.getByPlaceholder(/대흥동/).fill('서교동');await wait(p,600);
await p.getByText(/서울 마포구 서교동/).first().click();await wait(p,700);
await p.getByRole('button',{name:'다음',exact:true}).click();await wait(p,500);
await p.locator('button',{hasText:'아늑한'}).first().click().catch(()=>{});
await p.locator('button',{hasText:'검증된 곳'}).first().click().catch(()=>{});
await wait(p,400);
await save(p,'vibe');

// ── menu-demo.webp: 메뉴 콕 + #보쌈 #피자 (MENU CHOICE 섹션용) ──
// 이전 solo 입력 초안이 localStorage에 남아 복원되면 모드선택이 안 뜨므로 초기화 후 재진입
await p.goto(BASE+'/app',{waitUntil:'networkidle'});
await p.evaluate(()=>localStorage.clear());
await p.goto(BASE+'/app',{waitUntil:'networkidle'});await wait(p,700);
await p.getByText('혼자 정할게요').click();await wait(p,300);
await p.getByText('메뉴 콕!').first().click();await wait(p,300);
for(const m of ['보쌈','피자']){ const mi=p.getByPlaceholder(/보쌈|메뉴 더/); await mi.fill(m); await mi.press('Enter'); await wait(p,250); }
await wait(p,300);
await save(p,'menu-demo');

await b.close();console.log('DONE');
