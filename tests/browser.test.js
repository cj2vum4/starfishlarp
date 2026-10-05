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

  /* ================= 結果 ================= */
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
