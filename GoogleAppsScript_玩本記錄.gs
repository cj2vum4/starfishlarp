/**
 * 海星劇本殺｜玩本記錄 + 集點系統
 *
 * 目標試算表：
 * https://docs.google.com/spreadsheets/d/1hjdPJQo5Z6nVICZsvljihSXoZAJ32DpiAEQikCaog-8/edit?gid=463584243
 *
 * 使用方式：
 * 1. 將本檔完整貼入 Apps Script 專案的 Code.gs。
 * 2. 儲存後選擇：部署 → 新增部署作業 → 網頁應用程式。
 * 3. 執行身分選「我」，存取權限選「所有人」。
 * 4. 複製以 /exec 結尾的網址，貼到網站的 play-record-config.js。
 * 5. 在編輯器的函式下拉選單選「setupAll」，按「執行」並完成授權。
 *    這一步會建立所有分頁，並把歷史資料的點數全部算好。
 * 6. （選用）再執行一次「installMenu」，之後開試算表就會看到
 *    「🌟 海星集點」選單，日常操作不用回到編輯器。
 *
 * 註：本檔是「獨立腳本」（用 openById 指定試算表，沒有綁在試算表上），
 * 因此 onOpen 這種簡單觸發器不會自動執行，選單必須靠 installMenu 安裝。
 *
 * ── 分頁說明 ────────────────────────────────────────────────
 * 表單回應 1  原始回饋資料。集點的唯一輸入來源，請勿更動表頭。
 * 點數帳本    每一列一筆加減點。來源=表單 的列由系統產生，重算時會整批重建；
 *             來源=手動 的列（兌換、補登、調整）永遠保留，重算不會動到。
 * 玩家        別名歸戶與探員編號。同一人用了多個名字時，把其他名字填進「別名」。
 * 設定        點數規則與活動參數，改完按「重算所有點數」生效。
 * 獎勵        兌換清單，前端榮譽牆直接讀這一頁。
 * 神秘盒      神秘盒的可能內容與權重，只有 GM 看得到，玩家端不會顯示。
 * 點數總覽    系統算出來的結果，給網站讀。請勿手動編輯。
 *
 * ── GM 日常操作 ─────────────────────────────────────────────
 * 作廢一筆點數：在「點數帳本」把該列的「狀態」改成 作廢，再按「重算所有點數」。
 * 兌換扣點：在「點數帳本」新增一列，類型 redeem、點數填負數、來源填 手動。
 * 開神秘盒：選單按「開一個神秘盒」，輸入玩家名稱，程式會抽獎並自動扣點。
 * 合併同一人的多個名字：在「玩家」分頁的「別名」欄填入其他名字（逗號分隔）。
 */

const SPREADSHEET_ID = '1hjdPJQo5Z6nVICZsvljihSXoZAJ32DpiAEQikCaog-8';
const SHEET_GID = 463584243;
const SHEET_NAME = '表單回應 1';

const LEDGER_SHEET = '點數帳本';
const PLAYER_SHEET = '玩家';
const CONFIG_SHEET = '設定';
const REWARD_SHEET = '獎勵';
const SUMMARY_SHEET = '點數總覽';
const MYSTERY_SHEET = '神秘盒';

const REQUIRED_HEADERS = [
  '時間戳記',
  '怎麼稱呼你呢',
  '日期',
  '劇本',
  '角色',
  '給予評價',
  '50字以內的心得推薦',
  '介紹人'
];

const LEDGER_HEADERS = [
  '時間戳記', '玩家名', '歸戶名', '類型', '點數', '明細',
  '劇本', '日期', '來源', '狀態', '備註', '去重鍵'
];

const PLAYER_HEADERS = ['顯示名', '別名', '探員編號', '加入日期', '備註'];
const CONFIG_HEADERS = ['設定項', '值', '說明'];
const REWARD_HEADERS = ['軌道', '品項', '所需點數', '說明', '是否上架'];
const MYSTERY_HEADERS = ['獎品', '權重', '剩餘數量', '是否啟用'];
const SUMMARY_HEADERS = ['歸戶名', '探員編號', '累積點', '已兌換', '餘額', '場次', '最後遊玩日'];

const SOURCE_FORM = '表單';
const SOURCE_MANUAL = '手動';
const STATUS_VOID = '作廢';

const DEFAULT_CONFIG = [
  ['基本點數', 10, '完成一筆回饋的基本點數'],
  ['心得點數', 5, '心得達字數門檻時的加分'],
  ['心得字數門檻', 15, '心得要幾個字才拿得到心得加分'],
  ['首玩點數', 5, '該玩家第一次玩這個劇本'],
  ['首探點數', 10, '全店第一位遊玩這個劇本的人'],
  ['新手好運點數', 20, '玩家生涯第一筆記錄的額外加分'],
  ['介紹人點數', 10, '成功介紹新玩家，介紹人可得'],
  ['被介紹點數', 10, '填寫了介紹人的新玩家可得'],
  ['每日上限筆數', 3, '同一位玩家同一天最多幾筆可以得點，超過的只收記錄不給點'],
  ['雙倍日', '', '填星期（例：二,三）或指定日期（例：2026/08/15），逗號分隔。當天所有點數 x2'],
  ['雙倍日文案', '', '顯示在表單上的活動說明，留空則不顯示']
];

const DEFAULT_REWARDS = [
  ['保底', '折抵 50 元', 50, '直接折抵當場費用', 'TRUE'],
  ['保底', '折抵 120 元', 100, '直接折抵當場費用', 'TRUE'],
  ['特權', '優先選角權', 80, '開本前先挑你想要的角色', 'TRUE'],
  ['特權', '點播權', 150, '指定下個月要開的本', 'TRUE'],
  ['特權', '帶一位朋友免費', 300, '朋友首次來店免費入場', 'TRUE'],
  ['榮耀', '榮譽牆名字鍍金', 100, '你的名字在榮譽牆上變成金色', 'TRUE'],
  ['榮耀', '自訂專屬稱號', 200, '自己取一個稱號，審核後掛在名字旁', 'TRUE'],
  ['榮耀', '傳奇殿堂留名', 500, '永久列入榮譽牆傳奇殿堂', 'TRUE'],
  ['神秘', '神秘盒 ???', 30, '內容隨機，開了才知道', 'TRUE']
];

// 神秘盒的內容。權重越大越容易抽到；剩餘數量填 -1 代表無限。
// 開箱由 GM 從選單觸發，隨機結果由程式決定，避免變成 GM 挑一個給。
const DEFAULT_MYSTERY = [
  ['免費飲料一杯', 30, -1, 'TRUE'],
  ['下次開本折抵 30 元', 25, -1, 'TRUE'],
  ['隨機角色小卡一張', 20, -1, 'TRUE'],
  ['雙倍點數卡（下一場點數 x2）', 15, -1, 'TRUE'],
  ['優先選角權一次', 8, -1, 'TRUE'],
  ['免費入場一次', 2, -1, 'TRUE']
];

/* ============================================================
   選單
   ============================================================ */

/**
 * 本專案是「獨立腳本」（用 openById 指定試算表，沒有綁在試算表上），
 * 而 onOpen 這種簡單觸發器只有在腳本綁定於該文件時才會自動執行。
 * 所以必須先跑一次 installMenu() 建立可安裝的開啟觸發器，選單才會出現。
 *
 * 註：函式名稱結尾不能加底線。結尾底線在 Apps Script 代表私有函式，
 * 無法被選單、觸發器或編輯器的「執行」下拉選單呼叫。
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🌟 海星集點')
    .addItem('重算所有點數', 'menuRebuild')
    .addItem('開一個神秘盒', 'menuOpenMystery')
    .addItem('建立／修復所有分頁', 'menuSetup')
    .addToUi();
}

/**
 * 一次性安裝：替指定試算表建立開啟觸發器，之後每次開啟都會出現選單。
 * 在 Apps Script 編輯器的函式下拉選單選這個，按「執行」即可。
 */
function installMenu() {
  // 先清掉舊的，避免重複安裝跑出多個一樣的選單
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'onOpen') ScriptApp.deleteTrigger(trigger);
  });

  ScriptApp.newTrigger('onOpen')
    .forSpreadsheet(SpreadsheetApp.openById(SPREADSHEET_ID))
    .onOpen()
    .create();

  const message = '選單已安裝。請重新整理試算表，上方就會出現「🌟 海星集點」。';
  console.log(message);
  return message;
}

/**
 * 不想裝選單也可以：在編輯器直接執行這一個函式，
 * 它會建立所有分頁並把歷史資料的點數算好。
 */
function setupAll() {
  setupSheets_();
  const result = rebuildPoints_();
  const message = '分頁已建立，點數已重算。\n' +
    '玩家數：' + result.players + '\n' +
    '得點記錄：' + result.earnRows + ' 筆\n' +
    '已發出總點數：' + result.totalEarned;
  console.log(message);
  return message;
}

/**
 * 神秘盒開箱：GM 在現場按一下，程式抽出獎品並自動扣點。
 * 隨機由程式決定，GM 沒有選擇權——這才是「不確定性」真正的來源。
 */
function menuOpenMystery() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt('開神秘盒', '輸入玩家名稱：', ui.ButtonSet.OK_CANCEL);
  if (response.getSelectedButton() !== ui.Button.OK) return;

  try {
    const result = openMysteryBox_(response.getResponseText());
    ui.alert(
      '🎁 ' + result.player + ' 開出了\n\n' +
      result.prize + '\n\n' +
      '已扣除 ' + result.cost + ' 點，剩餘 ' + result.balance + ' 點。'
    );
  } catch (error) {
    ui.alert('無法開箱：' + (error && error.message ? error.message : error));
  }
}

function openMysteryBox_(rawName) {
  const ss = setupSheets_();
  const aliasMap = readAliasMap_(ss);
  const player = canonicalName_(String(rawName || '').trim(), aliasMap);
  if (!player) throw new Error('請輸入玩家名稱。');

  const reward = readRows_(ss.getSheetByName(REWARD_SHEET)).find(function (row) {
    return String(row['軌道'] || '').trim() === '神秘';
  });
  if (!reward) throw new Error('「獎勵」分頁裡找不到軌道為「神秘」的品項。');

  const cost = Number(reward['所需點數']) || 0;

  const summaryRow = readRows_(ss.getSheetByName(SUMMARY_SHEET)).find(function (row) {
    return String(row['歸戶名'] || '').trim() === player;
  });

  // 名字打錯時要講清楚是找不到人，不然 GM 會看到「只有 0 點」而以為是點數問題。
  if (!summaryRow) {
    throw new Error('找不到玩家「' + player + '」。請確認名字，或先在「玩家」分頁設定別名。');
  }

  const balance = Number(summaryRow['餘額']) || 0;
  if (balance < cost) {
    throw new Error(player + ' 目前只有 ' + balance + ' 點，不足 ' + cost + ' 點。');
  }

  const sheet = ss.getSheetByName(MYSTERY_SHEET);
  const rows = readRows_(sheet);
  const pool = [];
  rows.forEach(function (row, index) {
    if (String(row['是否啟用'] || '').trim().toUpperCase() === 'FALSE') return;
    const remaining = Number(row['剩餘數量']);
    if (!isNaN(remaining) && remaining === 0) return;
    const weight = Number(row['權重']) || 0;
    if (weight <= 0) return;
    pool.push({ name: String(row['獎品'] || '').trim(), weight: weight, rowIndex: index + 2, remaining: remaining });
  });

  if (!pool.length) throw new Error('「神秘盒」分頁裡沒有可抽的獎品。');

  const total = pool.reduce(function (sum, item) { return sum + item.weight; }, 0);
  let roll = Math.random() * total;
  let picked = pool[pool.length - 1];
  for (let i = 0; i < pool.length; i++) {
    roll -= pool[i].weight;
    if (roll <= 0) { picked = pool[i]; break; }
  }

  if (!isNaN(picked.remaining) && picked.remaining > 0) {
    sheet.getRange(picked.rowIndex, 3).setValue(picked.remaining - 1);
  }

  const today = normalizeDate_(new Date());
  ss.getSheetByName(LEDGER_SHEET).appendRow([
    new Date(), player, player, 'redeem', -cost, '神秘盒',
    '', today, SOURCE_MANUAL, '有效', '開出：' + picked.name, ''
  ]);

  rebuildPoints_();

  return { player: player, prize: picked.name, cost: cost, balance: balance - cost };
}

function menuSetup() {
  setupSheets_();
  notify_('分頁已建立／修復完成。接著請按「重算所有點數」。');
}

function menuRebuild() {
  const result = rebuildPoints_();
  notify_(
    '重算完成。\n\n' +
    '玩家數：' + result.players + '\n' +
    '得點記錄：' + result.earnRows + ' 筆\n' +
    '手動記錄：' + result.manualRows + ' 筆（兌換／調整，未更動）\n' +
    '已發出總點數：' + result.totalEarned
  );
}

/** 從編輯器直接執行時沒有 UI，這時改印到執行紀錄，不要讓整個函式失敗。 */
function notify_(message) {
  try {
    SpreadsheetApp.getUi().alert(message);
  } catch (error) {
    console.log(message);
  }
}

/* ============================================================
   Web App 端點
   ============================================================ */

function doGet(e) {
  const params = (e && e.parameter) || {};

  if (params.action === 'summary') {
    return maybeJsonp_(params, buildPublicPayload_());
  }

  return maybeJsonp_(params, {
    ok: true,
    service: 'starfishlarp-play-record',
    spreadsheetId: SPREADSHEET_ID,
    message: 'endpoint ready'
  });
}

function doPost(e) {
  try {
    const data = (e && e.parameter) || {};

    // 蜜罐欄位有值代表疑似機器人；回傳成功但不寫入。
    if (String(data.website || '').trim()) {
      return jsonResponse_({ ok: true });
    }

    const record = {
      '時間戳記': new Date(),
      '怎麼稱呼你呢': clean_(data.name, 30),
      '日期': clean_(data.date, 20),
      // script 使用既有 reviewKey，確保歷史榮譽牆資料仍能對應。
      '劇本': clean_(data.script, 100),
      '角色': clean_(data.character, 100),
      '給予評價': clean_(data.rating, 10),
      '50字以內的心得推薦': clean_(data.comment, 50),
      '介紹人': clean_(data.referrer, 30)
    };

    validate_(record);

    const sheet = getTargetSheet_();
    const headers = ensureHeaders_(sheet);
    let roleWritten = false;
    const row = headers.map(function (header) {
      // 舊 Google 表單可能留下多個「角色...」欄位。
      // 新 HTML 表單只把角色寫進第一個角色欄，避免榮譽牆顯示重複角色。
      if (String(header).indexOf('角色') === 0) {
        if (roleWritten) return '';
        roleWritten = true;
        return record['角色'];
      }

      return Object.prototype.hasOwnProperty.call(record, header)
        ? record[header]
        : '';
    });

    sheet.appendRow(row);

    // 重算是唯一的計分實作，寫入後立刻重跑，
    // 保證即時記點與歷史回填用的是同一套規則、不會有落差。
    let award = null;
    try {
      const rebuilt = rebuildPoints_();
      award = rebuilt.lastAwardByPlayer[canonicalName_(record['怎麼稱呼你呢'], rebuilt.aliasMap)] || null;
    } catch (rebuildError) {
      console.error('記錄已寫入，但重算點數失敗：' + rebuildError);
    }

    return jsonResponse_({
      ok: true,
      row: sheet.getLastRow(),
      sheetName: sheet.getName(),
      award: award
    });
  } catch (error) {
    console.error(error);
    return jsonResponse_({
      ok: false,
      error: String(error && error.message ? error.message : error)
    });
  }
}

/* ============================================================
   分頁建立
   ============================================================ */

function setupSheets_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

  ensureHeaders_(getTargetSheet_());

  ensureSheetWithHeaders_(ss, LEDGER_SHEET, LEDGER_HEADERS);
  ensureSheetWithHeaders_(ss, PLAYER_SHEET, PLAYER_HEADERS);
  ensureSheetWithHeaders_(ss, SUMMARY_SHEET, SUMMARY_HEADERS);

  const configSheet = ensureSheetWithHeaders_(ss, CONFIG_SHEET, CONFIG_HEADERS);
  seedIfEmpty_(configSheet, DEFAULT_CONFIG);

  const rewardSheet = ensureSheetWithHeaders_(ss, REWARD_SHEET, REWARD_HEADERS);
  seedIfEmpty_(rewardSheet, DEFAULT_REWARDS);

  const mysterySheet = ensureSheetWithHeaders_(ss, MYSTERY_SHEET, MYSTERY_HEADERS);
  seedIfEmpty_(mysterySheet, DEFAULT_MYSTERY);

  return ss;
}

function ensureSheetWithHeaders_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  const existing = sheet.getLastColumn()
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0]
    : [];

  const matches = headers.every(function (header, index) {
    return String(existing[index] || '').trim() === header;
  });

  if (!matches) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function seedIfEmpty_(sheet, rows) {
  if (sheet.getLastRow() > 1) return;
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

/* ============================================================
   核心：重算所有點數
   這是唯一的計分實作。即時記點與歷史回填都走這裡。
   ============================================================ */

function rebuildPoints_() {
  const ss = setupSheets_();
  const config = readConfig_(ss);
  const aliasMap = readAliasMap_(ss);

  const responses = readResponses_();
  const ledgerSheet = ss.getSheetByName(LEDGER_SHEET);
  const existingLedger = readRows_(ledgerSheet);

  // 來源=手動 的列（兌換、補登、調整）完全保留；只有系統產生的表單列會重建。
  const manualRows = existingLedger.filter(function (row) {
    return String(row['來源'] || '').trim() !== SOURCE_FORM;
  });

  // GM 先前標成作廢的表單列，重建後要維持作廢。
  const voidedKeys = {};
  existingLedger.forEach(function (row) {
    if (String(row['來源'] || '').trim() === SOURCE_FORM &&
        String(row['狀態'] || '').trim() === STATUS_VOID) {
      voidedKeys[String(row['去重鍵'] || '')] = true;
    }
  });

  // 依實際遊玩順序處理，首玩／首探才判得準。
  const ordered = responses
    .map(function (row, index) {
      return {
        raw: row,
        index: index,
        name: String(row['怎麼稱呼你呢'] || '').trim(),
        script: String(row['劇本'] || '').trim(),
        dateText: normalizeDate_(row['日期']),
        dateValue: parseDate_(row['日期']),
        comment: String(row['50字以內的心得推薦'] || '').trim(),
        referrer: String(row['介紹人'] || '').trim(),
        stamp: parseDate_(row['時間戳記'])
      };
    })
    .filter(function (item) { return item.name && item.script; })
    .sort(function (a, b) {
      const at = a.dateValue ? a.dateValue.getTime() : 0;
      const bt = b.dateValue ? b.dateValue.getTime() : 0;
      if (at !== bt) return at - bt;
      const as = a.stamp ? a.stamp.getTime() : 0;
      const bs = b.stamp ? b.stamp.getTime() : 0;
      if (as !== bs) return as - bs;
      return a.index - b.index;
    });

  const seenKeys = {};          // 去重鍵 → 已計過點
  const playerScripts = {};     // 歸戶名|劇本 → 玩過
  const scriptExplored = {};    // 劇本 → 已有人玩過
  const playerSeen = {};        // 歸戶名 → 已有記錄
  const dailyCount = {};        // 歸戶名|日期 → 當日已計點筆數
  const lastAwardByPlayer = {};

  const generated = [];
  let totalEarned = 0;

  ordered.forEach(function (item) {
    const canon = canonicalName_(item.name, aliasMap);
    const key = canon + '|' + item.script + '|' + item.dateText;
    const dayKey = canon + '|' + item.dateText;

    const push = function (type, points, detail, note) {
      const voided = !!voidedKeys[key];
      generated.push([
        item.stamp || new Date(),
        item.name,
        canon,
        type,
        voided ? 0 : points,
        detail,
        item.script,
        item.dateText,
        SOURCE_FORM,
        voided ? STATUS_VOID : '有效',
        note || '',
        key
      ]);
      if (!voided) totalEarned += points;
      return voided;
    };

    // ── 不給點但仍要留下記錄的情況 ────────────────────────
    if (seenKeys[key]) {
      push('skip', 0, '', '重複記錄：同一位玩家、同一劇本、同一天只計一次');
      return;
    }
    seenKeys[key] = true;

    dailyCount[dayKey] = (dailyCount[dayKey] || 0) + 1;
    if (dailyCount[dayKey] > config['每日上限筆數']) {
      push('skip', 0, '', '超過每日上限 ' + config['每日上限筆數'] + ' 筆，只收記錄不給點');
      return;
    }

    // ── 計分 ──────────────────────────────────────────────
    const parts = [];
    let points = config['基本點數'];
    parts.push('基本' + config['基本點數']);

    if (charLength_(item.comment) >= config['心得字數門檻']) {
      points += config['心得點數'];
      parts.push('心得' + config['心得點數']);
    }

    const scriptKey = canon + '|' + item.script;
    if (!playerScripts[scriptKey]) {
      playerScripts[scriptKey] = true;
      points += config['首玩點數'];
      parts.push('首玩' + config['首玩點數']);
    }

    if (!scriptExplored[item.script]) {
      scriptExplored[item.script] = true;
      points += config['首探點數'];
      parts.push('首探' + config['首探點數']);
    }

    const isFirstEver = !playerSeen[canon];
    if (isFirstEver) {
      playerSeen[canon] = true;
      points += config['新手好運點數'];
      parts.push('新手好運' + config['新手好運點數']);
    }

    let doubled = false;
    if (isDoubleDay_(item.dateValue, item.dateText, config['雙倍日'])) {
      points *= 2;
      doubled = true;
      parts.push('雙倍日 x2');
    }

    const voided = push('earn', points, parts.join('＋'), doubled ? '雙倍點數日' : '');

    if (!voided) {
      lastAwardByPlayer[canon] = { points: points, detail: parts.join('＋'), script: item.script };
    }

    // ── 介紹人：只在被介紹者的第一筆記錄結算一次 ──────────
    if (isFirstEver && item.referrer) {
      const referrerCanon = canonicalName_(item.referrer, aliasMap);
      if (referrerCanon && referrerCanon !== canon) {
        if (!voided) totalEarned += config['被介紹點數'] + config['介紹人點數'];

        generated.push([
          item.stamp || new Date(), item.name, canon, 'earn',
          voided ? 0 : config['被介紹點數'],
          '被介紹' + config['被介紹點數'],
          item.script, item.dateText, SOURCE_FORM,
          voided ? STATUS_VOID : '有效',
          '介紹人：' + item.referrer, key
        ]);

        generated.push([
          item.stamp || new Date(), item.referrer, referrerCanon, 'earn',
          voided ? 0 : config['介紹人點數'],
          '介紹新玩家' + config['介紹人點數'],
          item.script, item.dateText, SOURCE_FORM,
          voided ? STATUS_VOID : '有效',
          '介紹了：' + item.name, key + '|ref'
        ]);
      }
    }
  });

  // ── 寫回帳本：手動列在前，系統列在後 ──────────────────────
  const manualMatrix = manualRows.map(function (row) {
    return LEDGER_HEADERS.map(function (header) { return row[header]; });
  });
  const allRows = manualMatrix.concat(generated);

  if (ledgerSheet.getLastRow() > 1) {
    ledgerSheet.getRange(2, 1, ledgerSheet.getLastRow() - 1, LEDGER_HEADERS.length).clearContent();
  }
  if (allRows.length) {
    ledgerSheet.getRange(2, 1, allRows.length, LEDGER_HEADERS.length).setValues(allRows);
  }

  const summary = writeSummary_(ss, allRows, ordered, aliasMap);

  return {
    players: summary.length,
    earnRows: generated.length,
    manualRows: manualRows.length,
    totalEarned: totalEarned,
    lastAwardByPlayer: lastAwardByPlayer,
    aliasMap: aliasMap
  };
}

/* ============================================================
   點數總覽 + 探員編號
   ============================================================ */

function writeSummary_(ss, ledgerRows, ordered, aliasMap) {
  const idxName = LEDGER_HEADERS.indexOf('歸戶名');
  const idxPoints = LEDGER_HEADERS.indexOf('點數');
  const idxStatus = LEDGER_HEADERS.indexOf('狀態');

  const stats = {};
  const ensure = function (name) {
    if (!stats[name]) {
      stats[name] = { earned: 0, redeemed: 0, plays: 0, last: '', lastValue: 0 };
    }
    return stats[name];
  };

  ledgerRows.forEach(function (row) {
    const name = String(row[idxName] || '').trim();
    if (!name) return;
    if (String(row[idxStatus] || '').trim() === STATUS_VOID) return;

    const points = Number(row[idxPoints]) || 0;
    const bucket = ensure(name);
    if (points >= 0) bucket.earned += points;
    else bucket.redeemed += Math.abs(points);
  });

  // 場次與最後遊玩日以實際回饋記錄為準（去重後）。
  const countedPlays = {};
  ordered.forEach(function (item) {
    const canon = canonicalName_(item.name, aliasMap);
    const key = canon + '|' + item.script + '|' + item.dateText;
    if (countedPlays[key]) return;
    countedPlays[key] = true;

    const bucket = ensure(canon);
    bucket.plays += 1;
    const value = item.dateValue ? item.dateValue.getTime() : 0;
    if (value >= bucket.lastValue) {
      bucket.lastValue = value;
      bucket.last = item.dateText;
    }
  });

  const agentNumbers = assignAgentNumbers_(ss, ordered, aliasMap);

  const names = Object.keys(stats).sort(function (a, b) {
    return (stats[b].earned - stats[b].redeemed) - (stats[a].earned - stats[a].redeemed);
  });

  const rows = names.map(function (name) {
    const s = stats[name];
    return [
      name,
      agentNumbers[name] || '',
      s.earned,
      s.redeemed,
      s.earned - s.redeemed,
      s.plays,
      s.last
    ];
  });

  const sheet = ss.getSheetByName(SUMMARY_SHEET);
  if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, SUMMARY_HEADERS.length).clearContent();
  }
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, SUMMARY_HEADERS.length).setValues(rows);
  }

  return rows;
}

/**
 * 探員編號：依玩家首次出現的順序發號，一旦發出就固定不變。
 */
function assignAgentNumbers_(ss, ordered, aliasMap) {
  const sheet = ss.getSheetByName(PLAYER_SHEET);
  const lastRow = sheet.getLastRow();
  const values = lastRow > 1
    ? sheet.getRange(2, 1, lastRow - 1, PLAYER_HEADERS.length).getValues()
    : [];

  const numbers = {};   // 顯示名 → 已發出的編號
  const rowOf = {};     // 顯示名 → 試算表列號
  let maxNumber = 0;

  values.forEach(function (row, index) {
    const name = String(row[0] || '').trim();
    if (!name) return;

    rowOf[name] = index + 2;

    // 只有真的填了編號才算已發號。GM 為了設定別名而手動新增的列
    // 編號是空的，這種列要補發而不是跳過。
    const code = String(row[2] || '').trim();
    if (!code) return;

    numbers[name] = code;
    const parsed = parseInt(code.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(parsed) && parsed > maxNumber) maxNumber = parsed;
  });

  const appended = [];
  ordered.forEach(function (item) {
    const canon = canonicalName_(item.name, aliasMap);
    if (!canon || numbers[canon]) return;

    maxNumber += 1;
    const code = '#' + String(maxNumber).padStart(3, '0');
    numbers[canon] = code;

    const existingRow = rowOf[canon];
    if (existingRow) {
      sheet.getRange(existingRow, 3).setValue(code);
      if (!String(values[existingRow - 2][3] || '').trim()) {
        sheet.getRange(existingRow, 4).setValue(item.dateText);
      }
    } else {
      appended.push([canon, '', code, item.dateText, '']);
    }
  });

  if (appended.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, appended.length, PLAYER_HEADERS.length)
      .setValues(appended);
  }

  return numbers;
}

/* ============================================================
   對外 JSON（讓網站即時讀，避開 CSV 發布的 5–10 分鐘快取）
   ============================================================ */

function buildPublicPayload_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const config = readConfig_(ss);

  // 本月點數直接從帳本現算，而不是存在總覽裡。
  // 存起來的話，跨月之後要等下一次有人送出記錄才會歸零。
  const now = new Date();
  const monthKey = now.getFullYear() + '/' + (now.getMonth() + 1);
  const monthEarned = {};
  const mystery = [];

  readRows_(ss.getSheetByName(LEDGER_SHEET)).forEach(function (row) {
    if (String(row['狀態'] || '').trim() === STATUS_VOID) return;

    const name = String(row['歸戶名'] || '').trim();
    if (!name) return;

    const note = String(row['備註'] || '').trim();
    if (note.indexOf('開出：') === 0) {
      mystery.push({
        name: name,
        prize: note.slice(3),
        date: normalizeDate_(row['日期'])
      });
    }

    const points = Number(row['點數']) || 0;
    if (points <= 0) return;

    const date = parseDate_(row['日期']);
    if (!date) return;
    if (date.getFullYear() !== now.getFullYear() || date.getMonth() !== now.getMonth()) return;

    monthEarned[name] = (monthEarned[name] || 0) + points;
  });

  const summary = readRows_(ss.getSheetByName(SUMMARY_SHEET)).map(function (row) {
    const name = String(row['歸戶名'] || '').trim();
    return {
      name: name,
      agent: String(row['探員編號'] || '').trim(),
      earned: Number(row['累積點']) || 0,
      redeemed: Number(row['已兌換']) || 0,
      balance: Number(row['餘額']) || 0,
      monthEarned: monthEarned[name] || 0,
      plays: Number(row['場次']) || 0,
      last: String(row['最後遊玩日'] || '').trim()
    };
  }).filter(function (item) { return item.name; });

  const rewards = readRows_(ss.getSheetByName(REWARD_SHEET)).map(function (row) {
    return {
      track: String(row['軌道'] || '').trim(),
      name: String(row['品項'] || '').trim(),
      cost: Number(row['所需點數']) || 0,
      note: String(row['說明'] || '').trim(),
      active: String(row['是否上架'] || '').trim().toUpperCase() !== 'FALSE'
    };
  }).filter(function (item) { return item.name && item.active; });

  return {
    ok: true,
    updatedAt: now.toISOString(),
    monthKey: monthKey,
    doubleDayNote: config['雙倍日文案'] || '',
    summary: summary,
    rewards: rewards,
    mystery: mystery
  };
}

/* ============================================================
   讀取工具
   ============================================================ */

function readResponses_() {
  return readRows_(getTargetSheet_());
}

function readRows_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];

  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
    .map(function (value) { return String(value || '').trim(); });

  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastColumn).getValues();

  return values
    .filter(function (row) {
      return row.some(function (cell) { return String(cell || '').trim(); });
    })
    .map(function (row) {
      const record = {};
      headers.forEach(function (header, index) {
        if (header) record[header] = row[index];
      });
      return record;
    });
}

function readConfig_(ss) {
  const config = {};
  DEFAULT_CONFIG.forEach(function (entry) { config[entry[0]] = entry[1]; });

  readRows_(ss.getSheetByName(CONFIG_SHEET)).forEach(function (row) {
    const key = String(row['設定項'] || '').trim();
    if (!key) return;
    const raw = row['值'];
    config[key] = (typeof raw === 'number') ? raw : String(raw == null ? '' : raw).trim();
  });

  // 數值型設定一律轉成數字，避免試算表存成文字造成字串相加。
  ['基本點數', '心得點數', '心得字數門檻', '首玩點數', '首探點數',
   '新手好運點數', '介紹人點數', '被介紹點數', '每日上限筆數'].forEach(function (key) {
    const value = Number(config[key]);
    config[key] = isNaN(value) ? 0 : value;
  });

  if (!config['每日上限筆數']) config['每日上限筆數'] = 99;

  return config;
}

/**
 * 別名歸戶：把「海星⭐」「Michael」都對回「海星」。
 * 回傳 { 正規化別名 → 顯示名 }
 */
function readAliasMap_(ss) {
  const map = {};

  readRows_(ss.getSheetByName(PLAYER_SHEET)).forEach(function (row) {
    const display = String(row['顯示名'] || '').trim();
    if (!display) return;

    map[normalizeName_(display)] = display;

    String(row['別名'] || '')
      .split(/[,，、;；]/)
      .map(function (alias) { return alias.trim(); })
      .filter(Boolean)
      .forEach(function (alias) {
        map[normalizeName_(alias)] = display;
      });
  });

  return map;
}

function canonicalName_(name, aliasMap) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '';
  return aliasMap[normalizeName_(trimmed)] || trimmed;
}

function normalizeName_(name) {
  return String(name || '').replace(/\s+/g, '').toLowerCase();
}

/* ============================================================
   日期與雙倍日
   ============================================================ */

function parseDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) return value;

  const text = String(value || '').trim();
  if (!text) return null;

  const parts = text.split(/[\/\-.]/).map(function (part) { return parseInt(part, 10); });
  if (parts.length >= 3 && !parts.some(isNaN)) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/** 統一成 YYYY/M/D，與現有榮譽牆資料的格式一致。 */
function normalizeDate_(value) {
  const date = parseDate_(value);
  if (!date) return String(value || '').trim();
  return date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate();
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];

function isDoubleDay_(dateValue, dateText, setting) {
  const raw = String(setting || '').trim();
  if (!raw) return false;

  const entries = raw.split(/[,，、;；]/)
    .map(function (entry) { return entry.trim(); })
    .filter(Boolean);

  if (!entries.length) return false;

  const weekday = dateValue ? WEEKDAY_LABELS[dateValue.getDay()] : '';

  return entries.some(function (entry) {
    const cleaned = entry.replace(/^(每週|每周|週|周|星期|禮拜)/, '');
    if (cleaned && cleaned === weekday) return true;
    if (/^[0-6]$/.test(entry) && dateValue && Number(entry) === dateValue.getDay()) return true;
    return normalizeDate_(entry) === dateText;
  });
}

/* ============================================================
   既有工具（維持原行為）
   ============================================================ */

function getTargetSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (!spreadsheet) {
    throw new Error('找不到指定的 Google 試算表，請確認 SPREADSHEET_ID 與帳號權限。');
  }

  const sheets = spreadsheet.getSheets();
  const sheetByGid = sheets.find(function (sheet) {
    return sheet.getSheetId() === SHEET_GID;
  });

  if (sheetByGid) return sheetByGid;

  const sheetByName = spreadsheet.getSheetByName(SHEET_NAME);
  if (sheetByName) return sheetByName;

  if (!sheets.length) {
    throw new Error('指定的 Google 試算表中沒有可寫入的工作表。');
  }

  return sheets[0];
}

function ensureHeaders_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), 1);
  let headers = sheet
    .getRange(1, 1, 1, lastColumn)
    .getDisplayValues()[0]
    .map(function (value) { return String(value || '').trim(); });

  const hasAnyHeader = headers.some(Boolean);

  if (!hasAnyHeader) {
    sheet.getRange(1, 1, 1, REQUIRED_HEADERS.length).setValues([REQUIRED_HEADERS]);
    return REQUIRED_HEADERS.slice();
  }

  REQUIRED_HEADERS.forEach(function (header) {
    if (headers.indexOf(header) === -1) {
      headers.push(header);
      sheet.getRange(1, headers.length).setValue(header);
    }
  });

  return headers;
}

function validate_(record) {
  if (!record['怎麼稱呼你呢']) throw new Error('缺少玩家名稱');
  if (!record['日期']) throw new Error('缺少遊玩日期');
  if (!record['劇本']) throw new Error('缺少劇本');
  if (!record['角色']) throw new Error('缺少角色');
  if (!/^[1-5]$/.test(record['給予評價'])) throw new Error('評價必須為 1 到 5');
}

function clean_(value, maxLength) {
  return String(value == null ? '' : value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
    .slice(0, maxLength);
}

/** 以字元數計算長度，中文一字算一字。 */
function charLength_(text) {
  return Array.from(String(text || '').replace(/\s+/g, '')).length;
}

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 支援 JSONP，讓靜態網站可以跨網域即時讀取點數。 */
function maybeJsonp_(params, payload) {
  const callback = String((params && params.callback) || '').trim();

  if (callback && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) {
    return ContentService
      .createTextOutput(callback + '(' + JSON.stringify(payload) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return jsonResponse_(payload);
}
