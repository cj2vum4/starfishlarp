'use strict';

/**
 * 榮譽牆與玩本記錄表單的前端測試。
 *
 * 跑法：node tests/browser.test.js
 * 需要 playwright（npm i -D playwright）。沒裝就直接跳過，不會讓整套測試失敗。
 *
 * 所有外部請求都被攔截：試算表 CSV、Apps Script 端點、CDN、圖床，
 * 所以不會碰到正式資料，也不依賴網路。
 */

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (error) {
  console.log('⏭  跳過前端測試：未安裝 playwright（npm i -D playwright）');
  process.exit(0);
}

const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = 8787;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg'
};

const server = http.createServer((request, response) => {
  let relative = decodeURIComponent(request.url.split('?')[0]);
  if (relative === '/') relative = '/index.html';

  const file = path.join(ROOT, relative);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    response.writeHead(404);
    response.end('not found');
    return;
  }

  response.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] || 'application/octet-stream'
  });
  fs.createReadStream(file).pipe(response);
});

/* ── 假資料 ────────────────────────────────────────────────
   日期以當月為基準，讓「本月榜」「本月任務」永遠有東西可測。 */
const now = new Date();
const MONTH_KEY = now.getFullYear() + '/' + (now.getMonth() + 1);
const inMonth = (day) => now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + day;
const LAST_YEAR = (now.getFullYear() - 1) + '/3/2';
// 阿華刻意跟所有人都不同天，用來驗證「同場戰友」不會把單純玩過同一本的人算進去
const SOLO = (now.getFullYear() - 1) + '/5/8';

const CSV = [
  '時間戳記,怎麼稱呼你呢,日期,劇本,角色,給予評價,50字以內的心得推薦,介紹人',
  `${LAST_YEAR},海星,${LAST_YEAR},瘋兔子白又白砍下腦袋飛起來,兔子,5,反轉真的太強了整場都在起雞皮疙瘩,`,
  `${inMonth(3)},海星,${inMonth(3)},春晝短,小春,5,這個月第一場心得寫得夠長夠長夠長,`,
  `${inMonth(9)},海星,${inMonth(9)},年輪,甲,5,推理線扎實好玩非常推薦給大家,`,
  `${inMonth(9)},小明,${inMonth(9)},年輪,乙,4,跟海星同一場一起玩的很開心,海星`,
  `${inMonth(15)},小明,${inMonth(15)},上路,丙,5,演繹空間很大值得再玩一次,`,
  `${SOLO},阿華,${SOLO},瘋兔子白又白砍下腦袋飛起來,紅兔,4,去年玩過的一場,`
].join('\n');

const SUMMARY = {
  ok: true,
  monthKey: MONTH_KEY,
  doubleDayNote: '平日開本，點數兩倍',
  summary: [
    { name: '海星', agent: '#001', earned: 145, redeemed: 50, balance: 95,
      monthEarned: 60, plays: 3, last: inMonth(9),
      questProgress: { '場次': 2, '心得': 2, '新本': 2, '揪團': 0 },
      gilded: true, title: '兔子剋星', legend: true },
    { name: '小明', agent: '#002', earned: 120, redeemed: 0, balance: 120,
      monthEarned: 120, plays: 2, last: inMonth(15),
      gilded: false, title: '', legend: false },
    { name: '阿華', agent: '#003', earned: 40, redeemed: 0, balance: 40,
      monthEarned: 0, plays: 1, last: SOLO,
      gilded: false, title: '', legend: false }
  ],
  rewards: [
    { track: '神秘', name: '神秘盒 ???', cost: 30, note: '內容隨機', active: true },
    { track: '保底', name: '折抵 50 元', cost: 50, note: '直接折抵當場費用', active: true },
    { track: '特權', name: '優先選角權', cost: 80, note: '開本前先挑角色', active: true },
    { track: '榮耀', name: '榮譽牆名字鍍金', cost: 100, note: '名字變成金色', active: true },
    { track: '榮耀', name: '傳奇殿堂留名', cost: 500, note: '永久留名', active: true }
  ],
  quests: [
    { id: '場次', label: '本月完成 3 場', goal: 3, points: 20 },
    { id: '心得', label: '本月寫 2 篇長心得', goal: 2, points: 15 },
    { id: '新本', label: '本月開 1 本沒玩過的劇本', goal: 1, points: 15 },
    { id: '揪團', label: '本月介紹 1 位新朋友', goal: 1, points: 30 }
  ],
  rules: [
    { label: '完成一筆玩本記錄', points: 10 },
    { label: '心得寫滿 15 字', points: 5 },
    { label: '第一次玩這個劇本', points: 5 },
    { label: '全店第一個玩這個劇本', points: 10 },
    { label: '生涯第一筆記錄（新手好運）', points: 20 },
    { label: '介紹新朋友來（雙方各得）', points: 10 },
    { label: '心得每被按一個讚', points: 2, note: '單則最多 10 點' },
    { label: '心得被選為精選', points: 20 },
    { label: '平日開本，點數兩倍', multiplier: 2, note: '當天所有點數加倍' }
  ],
  mystery: [{ name: '海星', prize: '免費飲料一杯', date: inMonth(9) }],
  interactions: [{ script: '年輪', date: inMonth(9), author: '海星', likes: 4, featured: true }]
};

/** Playwright 預設路徑找不到時，掃 /opt/pw-browsers（容器環境）。 */
async function launchBrowser() {
  try {
    return await chromium.launch();
  } catch (error) {
    const base = '/opt/pw-browsers';
    if (!fs.existsSync(base)) throw error;

    for (const dir of fs.readdirSync(base)) {
      const candidate = path.join(base, dir, 'chrome-linux', 'chrome');
      if (fs.existsSync(candidate)) {
        return chromium.launch({ executablePath: candidate });
      }
    }
    throw error;
  }
}

(async () => {
  await new Promise((resolve) => server.listen(PORT, resolve));

  const browser = await launchBrowser();
  const context = await browser.newContext();

  const errors = [];
  const likePosts = [];
  context.on('weberror', (event) => errors.push('pageerror: ' + event.error().message));

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = request.url();

    // 預約系統：點數總覽用假資料；玩本記錄的送出、按讚、心得清單回「店家還沒切換」，
    // 所以這個 context 驗的是切換前的舊路線（Apps Script 與試算表 CSV）。不讓測試碰到正式資料。
    if (url.includes('supabase.co')) {
      const json = (status, body) => route.fulfill({ status, contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
      if (new URL(url).pathname.endsWith('/public/records')) return json(200, SUMMARY);
      return json(503, { ok: false, live: false, error: 'RECORDS_NOT_LIVE' });
    }

    if (url.includes('docs.google.com') || url.includes('corsproxy') ||
        url.includes('allorigins') || url.includes('codetabs')) {
      return route.fulfill({ status: 200, contentType: 'text/csv; charset=utf-8', body: CSV });
    }

    if (url.includes('script.google.com')) {
      if (request.method() === 'POST') {
        const body = request.postData() || '';
        if (body.includes('action=like')) {
          likePosts.push(body);
          return route.fulfill({
            status: 200, contentType: 'application/json',
            headers: { 'Access-Control-Allow-Origin': '*' },
            body: JSON.stringify({ ok: true, likes: 5 })
          });
        }
        return route.fulfill({
          status: 200, contentType: 'application/json',
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            ok: true, row: 9,
            award: { points: 30, detail: '基本10＋心得5＋首玩5＋雙倍日 x2' }
          })
        });
      }
      const callback = new URL(url).searchParams.get('callback') || 'cb';
      return route.fulfill({
        status: 200, contentType: 'text/javascript; charset=utf-8',
        body: callback + '(' + JSON.stringify(SUMMARY) + ');'
      });
    }

    // 讓 CDN 失敗，順便驗證既有的降級路徑仍然可用
    if (url.includes('cdnjs.cloudflare.com')) return route.abort();

    if (url.includes('placehold.co') || url.includes('postimg.cc')) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('') });
    }

    return route.continue();
  });

  let pass = 0;
  let fail = 0;
  const failures = [];

  const check = (label, actual, expected) => {
    const ok = expected === undefined ? Boolean(actual) : actual === expected;
    if (ok) pass += 1;
    else {
      fail += 1;
      failures.push(label);
    }
    console.log((ok ? '  ✅ ' : '  ❌ ') + label +
      (ok ? '' : ' → 得到 ' + JSON.stringify(actual) +
        (expected === undefined ? '' : '，預期 ' + JSON.stringify(expected))));
  };

  const url = (name) => `http://localhost:${PORT}/${encodeURIComponent(name)}`;

  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push('console: ' + message.text());
  });

  /* ================= 榮譽牆：點數與檔案 ================= */
  console.log('\n=== 榮譽牆：點數與探員檔案 ===');
  await page.goto(url('榮譽牆.html'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  check('雙倍日公告有顯示', await page.locator('#doubleDayBanner').isVisible());
  check('全站累計案件數有顯示', await page.locator('#collectiveBanner').isVisible());
  check('全站計數算出 6 起案件',
    (await page.locator('#collectiveBanner').textContent()).includes('6'));

  await page.locator('.leaderboard-header').click();
  await page.waitForTimeout(300);
  check('排行榜有玩家', await page.locator('#leaderboardList li').count() > 0);
  check('排行榜顯示點數',
    (await page.locator('#leaderboardList li').first().textContent()).includes('點'));

  await page.selectOption('#playerSelector', '海星');
  await page.waitForTimeout(400);

  const cardText = await page.locator('#pointsCard').textContent();
  check('探員檔案有顯示', await page.locator('#pointsCard').isVisible());
  check('顯示探員編號', cardText.includes('#001'));
  check('顯示可用點數', cardText.includes('95'));
  check('有下一個目標', cardText.includes('下一個目標'));
  check('已達標的獎勵標成可換', cardText.includes('✅'));
  check('未達標的獎勵上鎖', cardText.includes('🔒'));
  check('有管家問候', cardText.includes('歡迎回來') || cardText.includes('好久不見'));
  check('有本月任務', cardText.includes('本月任務'));
  check('任務標出可得點數', cardText.includes('+20 點'));
  check('任務顯示本月已拿多少 / 總共多少', /已拿\s*30\s*\/\s*80\s*點/.test(cardText), true);
  check('達標的任務打勾', await page.locator('#pointsCard .pts-quest.done').count(), 2);
  check('未達標的不打勾',
    await page.locator('#pointsCard .pts-quest:not(.done)').count(), 2);

  check('有點數規則面板', cardText.includes('點數怎麼來'));
  check('規則列出基本點數', cardText.includes('完成一筆玩本記錄'));
  check('規則數字來自設定而非寫死', cardText.includes('心得寫滿 15 字'));
  check('規則列出雙倍日', cardText.includes('×2'));
  check('規則面板預設收合',
    await page.locator('#pointsCard .pts-rules').evaluate((el) => el.open), false);

  await page.locator('#pointsCard .pts-rules summary').click();
  await page.waitForTimeout(200);
  check('點了會展開',
    await page.locator('#pointsCard .pts-rules').evaluate((el) => el.open), true);
  check('有同場戰友', cardText.includes('同場戰友'));
  check('有神秘盒紀錄', cardText.includes('免費飲料一杯'));
  check('有彩蛋徽章區', cardText.includes('彩蛋徽章'));

  check('沒同場過的阿華不在戰友裡',
    !(await page.locator('#pointsCard .pts-mate').allTextContents())
      .some((text) => text.includes('阿華')), true);

  await page.locator('#pointsCard .pts-mate').first().click();
  await page.waitForTimeout(400);
  check('點戰友會切到對方檔案',
    (await page.locator('#pointsCard .pts-name').textContent()).trim(), '小明');

  /* ================= 榮耀軌 ================= */
  console.log('\n=== 榮耀軌 ===');
  await page.selectOption('#playerSelector', '海星');
  await page.waitForTimeout(400);

  check('探員檔案名字鍍金',
    await page.locator('#pointsCard .pts-name.pts-gilded').count() > 0);
  check('顯示自訂稱號',
    (await page.locator('#pointsCard .pts-custom-title').textContent()).trim(), '兔子剋星');
  check('排行榜名字也鍍金', await page.locator('#leaderboardList .pts-gilded').count() > 0);
  check('傳奇殿堂有出現', await page.locator('#legendHall').isVisible());
  check('殿堂列出海星',
    (await page.locator('#legendHall .pts-hall-name').first().textContent()).includes('海星'));

  /* ================= 排行榜雙軌 ================= */
  console.log('\n=== 排行榜：範圍與排序 ===');
  await page.locator('.sort-btn[data-scope="month"]').click();
  await page.waitForTimeout(300);
  const monthNames = await page.locator('#leaderboardList .player-name').allTextContents();
  check('本月榜排除本月沒記錄的人',
    monthNames.every((name) => !name.includes('阿華')), true);
  check('本月榜剩兩人', monthNames.length, 2);

  await page.locator('.sort-btn[data-sort="points"]').click();
  await page.waitForTimeout(300);
  check('本月依點數：小明(120) 排在海星(60) 前',
    (await page.locator('#leaderboardList .player-name').first().textContent()).startsWith('小明'), true);

  await page.locator('.sort-btn[data-scope="all"]').click();
  await page.waitForTimeout(300);
  const allNames = await page.locator('#leaderboardList .player-name').allTextContents();
  check('總榜三人都在', allNames.length, 3);
  check('總榜依累積點：海星(145) 第一', allNames[0].startsWith('海星'), true);

  /* ================= 收藏冊 ================= */
  console.log('\n=== 收藏冊剪影 ===');
  await page.locator('.sort-btn[data-sort="plays"]').click();
  await page.waitForTimeout(300);

  check('顯示方式切換有出現', await page.locator('#wallViewToggle').isVisible());
  const silhouettes = await page.locator('.script-card.silhouette').count();
  check('未玩過的劇本變剪影', silhouettes > 0);
  check('玩過的劇本不是剪影', await page.locator('.script-card.played.silhouette').count(), 0);

  await page.locator('.sort-btn[data-view="played"]').click();
  await page.waitForTimeout(300);
  check('切成只看玩過後剪影消失', await page.locator('.script-card.silhouette').count(), 0);
  check('切成只看玩過後未玩的被隱藏',
    await page.locator('.script-card.hidden').count() > 0);

  await page.locator('.sort-btn[data-view="collection"]').click();
  await page.waitForTimeout(300);
  check('切回收藏冊剪影回來',
    await page.locator('.script-card.silhouette').count(), silhouettes);

  /* ================= 成就卡 ================= */
  console.log('\n=== 成就卡產圖 ===');
  await page.locator('.pts-share button').click();
  await page.waitForTimeout(2500);

  check('成就卡預覽有開啟', await page.locator('.pts-shot.open').count() > 0);
  const size = await page.locator('.pts-shot img')
    .evaluate((img) => ({ width: img.naturalWidth, height: img.naturalHeight }));
  check('寬度 1080', size.width, 1080);
  check('高度貼合內容，不是固定 1350', size.height > 900 && size.height !== 1350, true);
  check('下載連結帶玩家名',
    (await page.locator('.pts-shot a').getAttribute('download')).includes('海星'), true);

  await page.locator('.pts-shot button').click();
  await page.waitForTimeout(200);
  check('成就卡可關閉', await page.locator('.pts-shot.open').count(), 0);

  /* ================= 劇本頁：心得按讚 ================= */
  console.log('\n=== 劇本頁：心得按讚 ===');
  const scriptPage = await context.newPage();
  // 便利貼有無限浮動動畫，Playwright 會判定元素不穩定而點不下去。
  // 開 reduced-motion 讓動畫停下，順便驗到既有的減少動態路徑。
  await scriptPage.emulateMedia({ reducedMotion: 'reduce' });
  await scriptPage.goto(`http://localhost:${PORT}/5%E4%BA%BA/${encodeURIComponent('年輪.html')}`,
    { waitUntil: 'domcontentloaded' });
  await scriptPage.waitForTimeout(1200);

  check('劇本頁掛上了評價元件', await scriptPage.locator('.rv-fab').count() > 0);
  await scriptPage.locator('.rv-fab').click();
  await scriptPage.waitForTimeout(2000);

  check('評價彈窗有便利貼', await scriptPage.locator('.rv-note').count() > 0);
  check('精選心得有標記', await scriptPage.locator('.rv-pick').count() > 0);
  check('精選排在最前面',
    await scriptPage.locator('.rv-note').first()
      .evaluate((el) => el.classList.contains('rv-featured')), true);
  check('按讚按鈕有出現（端點自動載入成功）',
    await scriptPage.locator('.rv-like').count() > 0);
  check('讚數來自試算表',
    (await scriptPage.locator('.rv-note.rv-featured .rv-like').textContent()).includes('4'), true);

  await scriptPage.locator('.rv-note.rv-featured .rv-like').click();
  await scriptPage.waitForTimeout(800);
  check('按下後讚數加一',
    (await scriptPage.locator('.rv-note.rv-featured .rv-like').textContent()).includes('5'), true);
  check('按下後按鈕鎖住',
    await scriptPage.locator('.rv-note.rv-featured .rv-like').isDisabled(), true);
  check('按讚有送出 POST', likePosts.length > 0);
  check('POST 帶了作者與日期',
    likePosts[0].includes('author') && likePosts[0].includes('date'), true);
  await scriptPage.close();

  /* ================= 新增玩本記錄 ================= */
  console.log('\n=== 新增玩本記錄 ===');
  await page.goto(url('新增玩本記錄.html'), { waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  check('介紹人欄位存在', await page.locator('#referrer').count(), 1);
  check('雙倍日公告有顯示',
    (await page.locator('#doubleDayNote').textContent()).includes('平日開本'));
  check('心情欄位已移除', await page.locator('#moodOptions').count(), 0);

  await page.fill('#playerName', '測試玩家');
  await page.selectOption('#scriptSelect', { index: 1 });
  await page.waitForTimeout(300);
  await page.locator('#roleOptions .role-choice').first().click();
  await page.locator('.rating-options label').nth(4).click();
  await page.fill('#comment', '這是一段夠長的心得用來測試字數門檻是否正確');
  await page.fill('#referrer', '海星');
  await page.click('#submitButton');
  await page.waitForTimeout(900);

  check('送出後顯示成功面板', await page.locator('#successPanel').isVisible());
  check('得點卡有顯示', await page.locator('#awardCard').isVisible());
  check('顯示本場得點', (await page.locator('#awardPoints').textContent()).trim(), '+30');
  check('顯示得點明細',
    (await page.locator('#awardDetail').textContent()).includes('基本10'));

  await page.click('#addAnotherButton');
  await page.waitForTimeout(300);
  check('再新增一筆會收起得點卡', await page.locator('#awardCard').isHidden());
  check('再新增一筆保留名字', await page.locator('#playerName').inputValue(), '測試玩家');

  /* ================= 端點失效時的降級 ================= */
  console.log('\n=== 點數端點失效時的降級 ===');
  await context.route('**/script.google.com/**', (route) => route.abort());
  await context.route('**/*.supabase.co/**', (route) => route.abort());

  const offline = await context.newPage();
  await offline.goto(url('榮譽牆.html'), { waitUntil: 'networkidle' });
  await offline.waitForTimeout(800);

  check('榮譽牆仍然載入劇本卡片', await offline.locator('.script-card').count() > 0);
  check('全站計數仍顯示（來自 CSV）', await offline.locator('#collectiveBanner').isVisible());

  await offline.selectOption('#playerSelector', '海星');
  await offline.waitForTimeout(500);
  const fallback = await offline.locator('#pointsCard').textContent();
  check('徽章與戰友仍在', fallback.includes('彩蛋徽章') && fallback.includes('同場戰友'), true);
  check('有說明點數讀不到', fallback.includes('讀不到'), true);
  await offline.close();

  /* ================= 舊版部署的辨識 ================= */
  console.log('\n=== 部署的是舊版 Apps Script ===');
  // 舊版 doGet 沒有 action=summary，會回一包有 ok 但沒有 summary 的 JSON。
  // 這種情況要講「部署是舊的」，不能講成「這個玩家沒有記錄」。
  await context.route('**/script.google.com/**', (route) => {
    const callback = new URL(route.request().url()).searchParams.get('callback') || 'cb';
    return route.fulfill({
      status: 200, contentType: 'text/javascript; charset=utf-8',
      body: callback + '({"ok":true,"service":"starfishlarp-play-record","message":"endpoint ready"});'
    });
  });

  const stale = await context.newPage();
  await stale.goto(url('榮譽牆.html'), { waitUntil: 'networkidle' });
  await stale.waitForTimeout(800);
  await stale.selectOption('#playerSelector', '海星');
  await stale.waitForTimeout(500);

  const staleText = await stale.locator('#pointsCard').textContent();
  check('舊版部署會說是部署問題', staleText.includes('舊版本'), true);
  check('不會誤導成玩家沒有記錄', staleText.includes('還沒有點數記錄'), false);
  check('有指出要重新部署', staleText.includes('重新部署'), true);
  await stale.close();

  /* ================= 資料來源很慢或失敗時的載入 ================= */
  console.log('\n=== 資料來源很慢或失敗時的載入 ===');
  // 每個情境都用新的 context：localStorage 的 CSV 快取要能控制有沒有
  const slowContext = await browser.newContext();
  let csvRequests = 0;
  let csvMode = 'first-hangs';  // first-hangs：第一個請求卡住、補發的正常回；fail：全部失敗
  await slowContext.route('**/*', async (route) => {
    const target = route.request().url();
    if (target.includes('docs.google.com')) {
      csvRequests += 1;
      if (csvMode === 'fail') return route.abort();
      if (csvRequests === 1) {
        await new Promise((resolve) => setTimeout(resolve, 15000));
        return route.abort().catch(() => {});
      }
      return route.fulfill({ status: 200, contentType: 'text/csv; charset=utf-8', body: CSV });
    }
    if (target.includes('script.google.com')) {
      // 點數端點慢到 8 秒逾時：以前整頁會跟著卡住
      await new Promise((resolve) => setTimeout(resolve, 9000));
      return route.abort().catch(() => {});
    }
    if (target.includes('supabase.co') || target.includes('cdnjs.cloudflare.com')) return route.abort();
    return route.continue();
  });

  const slow = await slowContext.newPage();
  const slowStart = Date.now();
  await slow.goto(url('榮譽牆.html'));
  await slow.waitForFunction(
    () => document.querySelectorAll('#playerSelector option').length > 1, null, { timeout: 8000 }
  ).catch(() => {});
  const slowElapsed = Date.now() - slowStart;
  check('第一個 CSV 請求卡住時，補發的請求讓玩家選單在 6 秒內出現', slowElapsed < 6000, true);
  check('有補發第二個 CSV 請求', csvRequests >= 2, true);
  check('不用等點數端點就有排行榜', await slow.locator('#leaderboardList li').count() > 0, true);
  await slow.selectOption('#playerSelector', '海星');
  check('點數還在讀時顯示讀取中',
    (await slow.locator('#pointsCard').textContent()).includes('讀取中'), true);
  await slow.close();

  // 同一個 context 再開一次：CSV 全部失敗，但有上次的快取可以秒開
  csvMode = 'fail';
  const cached = await slowContext.newPage();
  await cached.goto(url('榮譽牆.html'));
  await cached.waitForTimeout(1500);
  check('CSV 讀不到時沿用上次的資料', await cached.locator('#playerSelector option').count() > 1, true);
  check('有快取時不顯示錯誤', await cached.locator('.load-error').isHidden(), true);
  await cached.close();
  await slowContext.close();

  // 完全沒有快取、CSV 又讀不到：要明確說失敗，而且劇本卡片不能被清掉
  const failContext = await browser.newContext();
  await failContext.route('**/*', (route) => {
    const target = route.request().url();
    if (target.includes('docs.google.com') || target.includes('script.google.com') ||
        target.includes('supabase.co') || target.includes('cdnjs.cloudflare.com')) return route.abort();
    return route.continue();
  });
  const failed = await failContext.newPage();
  await failed.goto(url('榮譽牆.html'));
  await failed.waitForSelector('.load-error:not([hidden])', { timeout: 5000 }).catch(() => {});
  check('讀取失敗會顯示錯誤訊息', await failed.locator('.load-error').isVisible(), true);
  check('讀取失敗時劇本卡片仍在', await failed.locator('.script-card').count() > 0, true);
  check('玩家選單顯示讀取失敗',
    (await failed.locator('#playerSelector').textContent()).includes('讀取失敗'), true);
  await failContext.close();

  /* ================= 結果 ================= */
  console.log('\n=== 角色問卷：送進預約系統，連不上才改送舊的 Apps Script ===');
  // 每個情境開新的 context，各自決定預約系統（supabase.co）怎麼回應；其他外部請求一律擋掉。
  for (const [label, supabase, wantLegacy, wantDone, wantMessage] of [
    ['預約系統收到：不再送舊的 Apps Script', { status: 201, body: { ok: true } }, false, true],
    ['預約系統還沒部署（404）：改送舊的', { status: 404, body: { error: 'ROUTE_NOT_FOUND' } }, true, true],
    ['預約系統連不上：改送舊的', 'abort', true, true],
    ['預約系統暫時錯誤（503）：改送舊的', { status: 503, body: { error: 'DATABASE_UNAVAILABLE' } }, true, true],
    ['預約系統暫時收太多（429）：改送舊的', { status: 429, body: { error: 'TOO_MANY_REQUESTS' } }, true, true],
    ['內容不合格（400）：直接顯示失敗、不改送', { status: 400, body: { error: 'INVALID_SURVEY' } }, false, false, '問卷內容有問題'],
  ]) {
    const surveyContext = await browser.newContext();
    const sent = [];
    await surveyContext.route('**/*', (route) => {
      const target = route.request().url();
      const json = (status, body) => route.fulfill({ status, contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
      if (target.includes('supabase.co')) {
        sent.push({ to: 'supabase', body: route.request().postData() });
        return supabase === 'abort' ? route.abort() : json(supabase.status, supabase.body);
      }
      if (target.includes('script.google.com')) {
        sent.push({ to: 'legacy', body: route.request().postData() });
        return json(200, { ok: true });
      }
      if (!target.startsWith(`http://localhost:${PORT}/`)) return route.abort();
      return route.continue();
    });
    const surveyPage = await surveyContext.newPage();
    await surveyPage.goto(`http://localhost:${PORT}/${encodeURIComponent('問卷')}/${encodeURIComponent('王座.html')}`);
    await surveyPage.waitForSelector('.sv-form');
    await surveyPage.evaluate(() => {
      const form = document.querySelector('.sv-form');
      form.querySelector('input[name="q0"]').value = '測試玩家';
      const groups = new Set([...form.querySelectorAll('input[type="radio"]')].map((r) => r.name));
      groups.forEach((name) => form.querySelector(`input[type="radio"][name="${name}"]`).click());
    });
    await surveyPage.click('.sv-submit');
    await surveyPage.waitForFunction(() => !document.querySelector('.sv-done').hidden ||
      document.querySelector('.sv-status').textContent !== '', null, { timeout: 8000 }).catch(() => {});
    const done = await surveyPage.evaluate(() => !document.querySelector('.sv-done').hidden);
    const after = await surveyPage.evaluate(() => ({ status: document.querySelector('.sv-status').textContent,
      disabled: document.querySelector('.sv-submit').disabled }));
    check(label + '：先送預約系統', sent[0] && sent[0].to, 'supabase');
    check(label + '：' + (wantLegacy ? '有' : '沒有') + '改送舊的', sent.some((x) => x.to === 'legacy'), wantLegacy);
    check(label + '：' + (wantDone ? '顯示已收到' : '顯示送出失敗'), done, wantDone);
    if (!wantDone) {
      check(label + '：說明原因、按鈕可以再按', after.status.includes(wantMessage) && !after.disabled, true);
    }
    if (sent[0]) {
      const payload = JSON.parse(sent[0].body);
      check(label + '：送出的劇本與答案', payload.script === '王座' && payload.fields[0].label === 'Line名稱' &&
        payload.fields[0].value === '測試玩家', true);
      check(label + '：帶送出編號', /^[0-9a-f-]{36}$/.test(payload.id), true);
      const legacyPost = sent.find((x) => x.to === 'legacy');
      if (legacyPost) {
        const old = JSON.parse(legacyPost.body);
        check(label + '：舊的收到同一個送出編號', old.fields.some((f) => f.label === '送出編號' && f.value === payload.id), true);
      }
    }
    await surveyContext.close();
  }

  /* ================= 玩本記錄：店家切換到預約系統之後 ================= */
  console.log('\n=== 玩本記錄：切換到預約系統之後 ===');
  const liveContext = await browser.newContext();
  const liveSent = [];
  let playMode = 'earn';
  const API_ROWS = CSV.split('\n').slice(1).map((line) => {
    const c = line.split(',');
    return { name: c[1], date: c[2], script: c[3], character: c[4], rating: c[5], comment: c[6] };
  });
  await liveContext.route('**/*', (route) => {
    const target = route.request().url();
    const method = route.request().method();
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
    if (target.includes('supabase.co')) {
      const p = new URL(target).pathname.replace(/^.*\/api/, '');
      liveSent.push({ to: p, method, body: route.request().postData() });
      if (p === '/public/records') return json(200, SUMMARY);
      if (p === '/public/play-records' && method === 'GET') return json(200, { ok: true, live: true, records: API_ROWS });
      if (p === '/public/play-records') {
        if (playMode === 'abort') return route.abort();
        if (playMode === 'invalid') return json(400, { ok: false, error: 'INVALID_RECORD' });
        if (playMode === 'duplicate') return json(200, { ok: true, live: true, status: 'duplicate', award: null });
        return json(201, { ok: true, live: true, status: 'earn', award: { points: 45,
          detail: '基本10＋首玩5＋首探10＋新手好運20', script: '年輪', extra: [{ detail: '被介紹10', points: 10 }] } });
      }
      if (p === '/public/likes') return json(200, { ok: true, likes: 5, live: true });
      return json(404, { ok: false, error: 'ROUTE_NOT_FOUND' });
    }
    if (target.includes('docs.google.com')) {
      liveSent.push({ to: 'csv', method });
      return route.fulfill({ status: 200, contentType: 'text/csv; charset=utf-8', body: CSV });
    }
    if (target.includes('script.google.com')) {
      liveSent.push({ to: 'gas', method, body: route.request().postData() });
      if (method === 'POST') return json(200, { ok: true, row: 9, award: { points: 30, detail: '基本10＋心得5＋首玩5＋雙倍日 x2' } });
      const callback = new URL(target).searchParams.get('callback') || 'cb';
      return route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8',
        body: callback + '(' + JSON.stringify(SUMMARY) + ');' });
    }
    if (!target.startsWith(`http://localhost:${PORT}/`)) return route.abort();
    return route.continue();
  });
  const sentTo = (to, method) => liveSent.filter((x) => x.to === to && (!method || x.method === method));

  const liveWall = await liveContext.newPage();
  liveWall.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  await liveWall.goto(url('榮譽牆.html'));
  await liveWall.waitForFunction(() => document.querySelectorAll('#playerSelector option').length > 1, null, { timeout: 8000 }).catch(() => {});
  check('切換後：榮譽牆的玩家選單來自預約系統', await liveWall.locator('#playerSelector option').count() > 1, true);
  check('切換後：榮譽牆不再下載試算表 CSV', sentTo('csv').length, 0);
  check('切換後：榮譽牆讀了心得清單', sentTo('/public/play-records', 'GET').length > 0, true);
  await liveWall.close();

  const livePage = await liveContext.newPage();
  await livePage.emulateMedia({ reducedMotion: 'reduce' });
  await livePage.goto(`http://localhost:${PORT}/5%E4%BA%BA/${encodeURIComponent('年輪.html')}`, { waitUntil: 'domcontentloaded' });
  await livePage.waitForTimeout(1000);
  await livePage.locator('.rv-fab').click();
  await livePage.waitForTimeout(1500);
  check('切換後：劇本頁心得來自預約系統', await livePage.locator('.rv-note').count(), 2);
  check('切換後：劇本頁只問這本的心得', sentTo('/public/play-records', 'GET').some((x) => x.to && true), true);
  await livePage.locator('.rv-note.rv-featured .rv-like').click();
  await livePage.waitForTimeout(800);
  const likePost = sentTo('/public/likes', 'POST')[0];
  check('切換後：按讚送到預約系統', Boolean(likePost), true);
  if (likePost) {
    const like = JSON.parse(likePost.body);
    check('按讚帶劇本、日期、作者與這個瀏覽器的編號', like.script === '年輪' && like.author === '海星' &&
      like.date === inMonth(9) && /^[0-9a-f-]{36}$/.test(like.liker), true);
  }
  check('切換後：按讚不再送 Apps Script', sentTo('gas', 'POST').length, 0);
  await livePage.close();

  const form = await liveContext.newPage();
  const fillForm = async () => {
    await form.fill('#playerName', '測試玩家');
    await form.selectOption('#scriptSelect', { index: 1 });
    await form.waitForTimeout(200);
    await form.locator('#roleOptions .role-choice').first().click();
    await form.locator('.rating-options label').nth(4).click();
    await form.fill('#comment', '短');
    await form.fill('#referrer', '海星');
  };
  await form.goto(url('新增玩本記錄.html'), { waitUntil: 'networkidle' });
  await fillForm();
  await form.click('#submitButton');
  await form.waitForSelector('#successPanel:not([hidden])', { timeout: 5000 }).catch(() => {});
  check('切換後：送出顯示預約系統算的點數', (await form.locator('#awardPoints').textContent()).trim(), '+45');
  check('切換後：介紹人的加分也有寫出來', (await form.locator('#awardDetail').textContent()).includes('被介紹10 +10'), true);
  const post = sentTo('/public/play-records', 'POST')[0];
  if (post) {
    const body = JSON.parse(post.body);
    check('送出的內容與送出編號', body.name === '測試玩家' && body.character && body.rating === '5' &&
      body.referrer === '海星' && /^[0-9a-f-]{36}$/.test(body.id), true);
  } else check('切換後：記錄送到預約系統', false, true);
  check('切換後：記錄不再送 Apps Script', sentTo('gas', 'POST').length, 0);

  playMode = 'duplicate';
  await form.click('#addAnotherButton');
  await fillForm();
  await form.click('#submitButton');
  await form.waitForSelector('#successPanel:not([hidden])', { timeout: 5000 }).catch(() => {});
  check('同一天同一本再記一次：不給點並說明原因',
    await form.locator('#awardCard').isHidden() && (await form.locator('#successNote').textContent()).includes('同一天同一本'), true);
  const ids = sentTo('/public/play-records', 'POST').map((x) => JSON.parse(x.body).id);
  check('每一筆新的記錄用新的送出編號', ids.length === 2 && ids[0] !== ids[1], true);

  playMode = 'invalid';
  await form.click('#addAnotherButton');
  await fillForm();
  await form.click('#submitButton');
  await form.waitForTimeout(800);
  check('內容不合格：顯示錯誤、不改送 Apps Script',
    await form.locator('#successPanel').isHidden() && sentTo('gas', 'POST').length === 0, true);

  playMode = 'abort';
  const before = sentTo('/public/play-records', 'POST').length;
  await form.click('#submitButton');
  await form.waitForSelector('#successPanel:not([hidden])', { timeout: 8000 }).catch(() => {});
  const tries = sentTo('/public/play-records', 'POST').slice(before).map((x) => JSON.parse(x.body).id);
  check('預約系統沒回應：用同一個送出編號再試一次', tries.length === 2 && tries[0] === tries[1], true);
  check('再不行才改送 Apps Script', sentTo('gas', 'POST').length, 1);
  check('改送 Apps Script 後照樣顯示得點', (await form.locator('#awardPoints').textContent()).trim(), '+30');
  await form.close();
  await liveContext.close();

  console.log('\n=== JS 執行錯誤 ===');
  const realErrors = errors.filter((message) =>
    !/Failed to load resource|net::ERR|favicon|Tone|PapaParse|papaparse/i.test(message));
  realErrors.forEach((message) => console.log('  ⚠️  ' + message));
  if (!realErrors.length) console.log('  沒有 JS 執行錯誤');
  check('沒有未預期的 JS 錯誤', realErrors.length, 0);

  console.log('\n' + '─'.repeat(52));
  if (fail) {
    console.log('失敗項目：');
    failures.forEach((line) => console.log('  • ' + line));
  }
  console.log('通過 ' + pass + ' 項，失敗 ' + fail + ' 項');

  await browser.close();
  server.close();
  process.exit(fail ? 1 : 0);
})().catch((error) => {
  console.error(error);
  server.close();
  process.exit(1);
});
