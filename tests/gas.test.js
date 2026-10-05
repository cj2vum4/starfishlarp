'use strict';

/**
 * 集點系統的計分與試算表邏輯測試。
 *
 * 跑法：node tests/gas.test.js
 * 零相依，不需要 npm install。
 */

const {
  spreadsheet, freshEnv, setConfig, summaryOf, sheetRows
} = require('./gas-mock');

let pass = 0;
let fail = 0;
const failures = [];

function check(label, actual, expected) {
  const ok = expected === undefined ? Boolean(actual) : actual === expected;
  if (ok) {
    pass += 1;
  } else {
    fail += 1;
    failures.push(label + '：得到 ' + JSON.stringify(actual) +
      (expected === undefined ? '' : '，預期 ' + JSON.stringify(expected)));
  }
  console.log((ok ? '  ✅ ' : '  ❌ ') + label +
    (ok ? '' : ' → 得到 ' + JSON.stringify(actual) +
      (expected === undefined ? '' : '，預期 ' + JSON.stringify(expected))));
}

function group(title) {
  console.log('\n=== ' + title + ' ===');
}

/* 回饋資料的欄位順序：時間戳記, 怎麼稱呼你呢, 日期, 劇本, 角色, 給予評價, 心得, 介紹人 */
const LONG = '這是一段超過十五個字的心得內容用來觸發加分';  // 20 字
const SHORT = '短心得';                                        // 3 字

/* ============================================================
   計分規則
   ============================================================ */
group('計分規則');
{
  freshEnv([
    ['2026/1/5', '海星', '2026/1/5', '瘋兔子', '兔子', '5', LONG, ''],
    ['2026/1/12', '海星', '2026/1/12', '春晝短', '小春', '4', SHORT, ''],
    ['2026/2/8', '海星', '2026/2/8', '瘋兔子', '紅兔', '4', LONG, '']
  ]);

  const ledger = sheetRows('點數帳本');
  const detail = (index) => String(ledger[index][5]);

  // 基本10 + 心得5 + 首玩5 + 首探10 + 新手好運20
  check('生涯第一場拿滿所有加分', Number(ledger[0][4]), 50);
  check('明細寫出每一項來源', /基本10.*心得5.*首玩5.*首探10.*新手好運20/.test(detail(0)), true);

  // 基本10 + 首玩5 + 首探10，心得未達 15 字門檻
  check('心得未達字數門檻不給心得分', Number(ledger[1][4]), 25);
  check('未達門檻的明細不含心得', /心得/.test(detail(1)), false);

  // 基本10 + 心得5，重玩同一本既非首玩也非首探
  check('重玩同一本只拿基本與心得分', Number(ledger[2][4]), 15);

  check('累積點等於三場總和', summaryOf('海星').earned, 90);
  check('場次正確', summaryOf('海星').plays, 3);
}

group('去重與每日上限');
{
  freshEnv([
    ['2026/3/1 20:00', '小明', '2026/3/1', '年輪', '甲', '5', LONG, ''],
    // 同一位玩家、同一劇本、同一天再填一次 → 只收記錄不給點
    ['2026/3/1 21:30', '小明', '2026/3/1', '年輪', '甲', '5', LONG, ''],
    ['2026/3/2', '小明', '2026/3/2', '上路', '乙', '5', LONG, ''],
    ['2026/3/2', '小明', '2026/3/2', '左左', '丙', '5', LONG, ''],
    ['2026/3/2', '小明', '2026/3/2', '群星', '丁', '5', LONG, ''],
    // 同一天第 4 筆 → 超過每日上限
    ['2026/3/2', '小明', '2026/3/2', '你好', '戊', '5', LONG, '']
  ]);

  const skipped = sheetRows('點數帳本').filter((row) => String(row[3]) === 'skip');
  check('未給點的記錄共兩筆', skipped.length, 2);
  check('重複記錄有寫明原因', /重複記錄/.test(String(skipped[0][10])), true);
  check('超過上限有寫明原因', /每日上限/.test(String(skipped[1][10])), true);
  check('超過上限的那筆點數為 0', Number(skipped[1][4]), 0);

  // 3/1 一場 50(基本10+心得5+首玩5+首探10+新手好運20) + 3/2 三場各 30
  check('灌水不會灌到點數', summaryOf('小明').earned, 50 + 30 * 3);
  check('場次仍計入未給點的那筆', summaryOf('小明').plays, 5);
}

group('別名歸戶');
{
  freshEnv([
    ['2026/1/5', '海星', '2026/1/5', '瘋兔子', '兔子', '5', LONG, ''],
    ['2026/1/12', '海星⭐', '2026/1/12', '春晝短', '小春', '5', LONG, '']
  ]);

  check('歸戶前是兩個人', spreadsheet.getSheetByName('點數總覽').getLastRow() - 1, 2);

  const players = spreadsheet.getSheetByName('玩家');
  const rows = players.getRange(2, 1, players.getLastRow() - 1, 8).getValues();
  const target = rows.findIndex((row) => String(row[0]).trim() === '海星') + 2;
  players.getRange(target, 2).setValue('海星⭐');
  global.rebuildPoints_();

  check('設定別名後併成一個人', spreadsheet.getSheetByName('點數總覽').getLastRow() - 1, 1);
  check('兩場都算到同一人', summaryOf('海星').plays, 2);
  // 第二場 基本10+心得5+首玩5+首探10 = 30（新手好運只給生涯第一筆）
  check('別名那場也拿到首探分', summaryOf('海星').earned, 50 + 30);
}

group('介紹人');
{
  freshEnv([
    ['2026/1/5', '海星', '2026/1/5', '瘋兔子', '兔子', '5', LONG, ''],
    ['2026/2/1', '小明', '2026/2/1', '年輪', '甲', '5', LONG, '海星'],
    // 第二次填介紹人不該再結算一次
    ['2026/2/5', '小明', '2026/2/5', '上路', '乙', '5', LONG, '海星']
  ]);

  check('介紹人拿到 10 點', summaryOf('海星').earned, 50 + 10);
  // 50(新手好運那場) + 10(被介紹) + 30(第二場)
  check('被介紹者拿到 10 點', summaryOf('小明').earned, 50 + 10 + 30);

  // 只認表單來源，否則「本月介紹 1 位新朋友」這個任務說明也會被算進來
  const referralRows = sheetRows('點數帳本')
    .filter((row) => String(row[8]).trim() === '表單' && /介紹/.test(String(row[5])));
  check('介紹只結算一次（雙方各一列）', referralRows.length, 2);
}

group('作廢與手動列');
{
  freshEnv([
    ['2026/1/5', '海星', '2026/1/5', '瘋兔子', '兔子', '5', LONG, ''],
    ['2026/2/8', '海星', '2026/2/8', '春晝短', '小春', '5', LONG, '']
  ]);

  const before = summaryOf('海星').earned;
  const ledger = spreadsheet.getSheetByName('點數帳本');

  // GM 手動記一筆兌換
  ledger.appendRow([new Date(), '海星', '海星', 'redeem', -50, '折抵 50 元',
    '', '2026/3/1', '手動', '有效', 'GM 核銷', '']);
  global.rebuildPoints_();

  check('手動兌換扣到餘額', summaryOf('海星').balance, before - 50);
  check('累積點不受兌換影響', summaryOf('海星').earned, before);

  // 把第二場標成作廢
  const rows = ledger.getRange(2, 1, ledger.getLastRow() - 1, 12).getValues();
  const target = rows.findIndex((row) =>
    String(row[6]) === '春晝短' && String(row[3]) === 'earn') + 2;
  ledger.getRange(target, 10).setValue('作廢');
  global.rebuildPoints_();

  // 春晝短那場是 基本10+心得5+首玩5+首探10 = 30
  check('作廢後該場點數消失', summaryOf('海星').earned, before - 30);
  check('重算後手動列仍在',
    sheetRows('點數帳本').some((row) => String(row[8]).trim() === '手動'), true);

  global.rebuildPoints_();
  global.rebuildPoints_();
  check('重複重算不會重複給點', summaryOf('海星').earned, before - 30);
  check('重複重算不會複製手動列',
    sheetRows('點數帳本').filter((row) => String(row[8]).trim() === '手動').length, 1);
}

group('探員編號');
{
  freshEnv([
    ['2026/1/5', '海星', '2026/1/5', '瘋兔子', '兔子', '5', LONG, ''],
    ['2026/2/1', '小明', '2026/2/1', '年輪', '甲', '5', LONG, '']
  ]);

  check('依首次遊玩順序發號', summaryOf('海星').agent, '#001');
  check('第二位玩家接續編號', summaryOf('小明').agent, '#002');

  const before = summaryOf('海星').agent;
  global.rebuildPoints_();
  check('重算不會重新發號', summaryOf('海星').agent, before);

  // GM 為了設別名先手動建一列、編號留空 → 重算要補發而不是跳過
  const players = spreadsheet.getSheetByName('玩家');
  players.appendRow(['阿華', '', '', '', '', '', '', '']);
  spreadsheet.getSheetByName('表單回應 1')
    .appendRow(['2026/3/1', '阿華', '2026/3/1', '上路', '乙', '5', LONG, '']);
  global.rebuildPoints_();

  check('編號留空的既有列會補發', summaryOf('阿華').agent, '#003');
}

/* ============================================================
   雙倍日
   ============================================================ */
group('雙倍日關鍵字');
{
  // 在當月找出確定的平日與假日，避免寫死日期造成測試隨時間失效
  const now = new Date();
  const findWeekday = (target) => {
    for (let day = 1; day <= 28; day++) {
      const date = new Date(now.getFullYear(), now.getMonth(), day);
      if (date.getDay() === target) return date;
    }
    return null;
  };
  const text = (date) =>
    date.getFullYear() + '/' + (date.getMonth() + 1) + '/' + date.getDate();

  const wed = findWeekday(3);
  const sat = findWeekday(6);

  check('「平日」對週三成立', global.isDoubleDay_(wed, text(wed), '平日'), true);
  check('「平日」對週六不成立', global.isDoubleDay_(sat, text(sat), '平日'), false);
  check('「假日」對週六成立', global.isDoubleDay_(sat, text(sat), '假日'), true);
  check('「假日」對週三不成立', global.isDoubleDay_(wed, text(wed), '假日'), false);
  check('「週末」是「假日」的同義詞', global.isDoubleDay_(sat, text(sat), '週末'), true);
  check('單一星期字仍然有效', global.isDoubleDay_(wed, text(wed), '三'), true);
  check('指定日期仍然有效', global.isDoubleDay_(wed, text(wed), text(wed)), true);
  check('多個條件以逗號分隔', global.isDoubleDay_(sat, text(sat), '一,六'), true);
  check('空設定不觸發', global.isDoubleDay_(wed, text(wed), ''), false);
}

group('雙倍日實際計分');
{
  // 2026/2/8 是週日
  freshEnv([
    ['2026/2/6', '海星', '2026/2/6', '瘋兔子', '兔子', '5', LONG, ''],
    ['2026/2/8', '海星', '2026/2/8', '春晝短', '小春', '5', LONG, '']
  ], { doubleDay: '平日' });

  const ledger = sheetRows('點數帳本');
  const friday = ledger.find((row) => String(row[6]) === '瘋兔子');
  const sunday = ledger.find((row) => String(row[6]) === '春晝短');

  check('2026/2/6 是週五', new Date(2026, 1, 6).getDay(), 5);
  check('2026/2/8 是週日', new Date(2026, 1, 8).getDay(), 0);
  check('平日那場加倍', Number(friday[4]), 50 * 2);
  check('平日那場明細標註', /雙倍日/.test(String(friday[5])), true);
  check('假日那場不加倍', Number(sunday[4]), 30);
}

/* ============================================================
   神秘盒
   ============================================================ */
group('神秘盒');
{
  freshEnv([
    ['2026/1/5', '海星', '2026/1/5', '瘋兔子', '兔子', '5', LONG, ''],
    ['2026/2/1', '海星', '2026/2/1', '年輪', '甲', '5', LONG, ''],
    ['2026/2/8', '海星', '2026/2/8', '上路', '乙', '5', LONG, '']
  ]);

  check('神秘盒分頁已建立', spreadsheet.getSheetByName('神秘盒') !== null, true);
  check('有預設獎品', sheetRows('神秘盒').length > 0, true);

  let unknown = '';
  try { global.openMysteryBox_('不存在的人'); } catch (error) { unknown = error.message; }
  check('名字打錯說找不到玩家，而不是點數不足', /找不到玩家/.test(unknown), true);

  const before = summaryOf('海星').balance;
  const result = global.openMysteryBox_('海星');

  check('抽出了獎品', typeof result.prize === 'string' && result.prize.length > 0, true);
  check('扣了 30 點', result.cost, 30);
  check('餘額同步扣除', summaryOf('海星').balance, before - 30);
  check('累積點不受影響', summaryOf('海星').earned, before);

  const payload = global.buildPublicPayload_();
  check('開箱紀錄進 payload', payload.mystery.length, 1);
  check('紀錄掛在正確的人身上', payload.mystery[0].name, '海星');
  check('紀錄有獎品名稱', payload.mystery[0].prize, result.prize);

  global.rebuildPoints_();
  check('重算後開箱紀錄仍在', global.buildPublicPayload_().mystery.length, 1);
  check('重算後餘額仍是扣過的', summaryOf('海星').balance, before - 30);

  // 點數不足要擋下
  spreadsheet.getSheetByName('點數帳本').appendRow([
    new Date(), '海星', '海星', 'redeem', -999, '清空', '', '2026/3/1', '手動', '有效', '', '']);
  global.rebuildPoints_();
  let poor = '';
  try { global.openMysteryBox_('海星'); } catch (error) { poor = error.message; }
  check('點數不足會被擋下', /不足/.test(poor), true);
}

group('神秘盒抽獎隨機性');
{
  freshEnv([['2026/1/5', '海星', '2026/1/5', '瘋兔子', '兔子', '5', LONG, '']]);

  const ledger = spreadsheet.getSheetByName('點數帳本');
  const seen = new Set();
  for (let i = 0; i < 300 && seen.size < 3; i++) {
    ledger.appendRow([new Date(), '海星', '海星', 'adjust', 100, '測試補點',
      '', '2026/3/1', '手動', '有效', '', '']);
    try { seen.add(global.openMysteryBox_('海星').prize); } catch (error) { break; }
  }
  check('會抽到不同獎品（不是固定回第一個）', seen.size >= 2, true);
}

/* ============================================================
   榮耀軌
   ============================================================ */
group('榮耀軌');
{
  freshEnv([
    ['2026/1/5', '海星', '2026/1/5', '瘋兔子', '兔子', '5', LONG, ''],
    ['2026/2/1', '小明', '2026/2/1', '年輪', '甲', '5', LONG, '']
  ]);

  const players = spreadsheet.getSheetByName('玩家');
  const headers = players.getRange(1, 1, 1, 8).getDisplayValues()[0];
  check('玩家分頁有鍍金欄', headers.indexOf('鍍金') >= 0, true);
  check('玩家分頁有自訂稱號欄', headers.indexOf('自訂稱號') >= 0, true);
  check('玩家分頁有傳奇殿堂欄', headers.indexOf('傳奇殿堂') >= 0, true);
  check('榮耀軌欄位加在最後面，不會推移既有資料', headers.indexOf('備註'), 4);

  const rows = players.getRange(2, 1, players.getLastRow() - 1, 8).getValues();
  const target = rows.findIndex((row) => String(row[0]).trim() === '海星') + 2;
  players.getRange(target, 6).setValue(true);
  players.getRange(target, 7).setValue('兔子剋星');
  players.getRange(target, 8).setValue('TRUE');

  const decorated = summaryOf('海星');
  check('payload 帶出鍍金', decorated.gilded, true);
  check('payload 帶出自訂稱號', decorated.title, '兔子剋星');
  check('payload 帶出傳奇殿堂', decorated.legend, true);

  const plain = summaryOf('小明');
  check('沒打勾的人不帶裝飾',
    plain.gilded === false && plain.title === '' && plain.legend === false, true);
}

/* ============================================================
   心得按讚與精選
   ============================================================ */
group('心得按讚與精選');
{
  freshEnv([
    ['2026/1/5', '海星', '2026/1/5', '瘋兔子', '兔子', '5', LONG, ''],
    ['2026/2/1', '小明', '2026/2/1', '年輪', '甲', '5', LONG, '']
  ]);

  check('心得互動分頁已建立', spreadsheet.getSheetByName('心得互動') !== null, true);

  const before = summaryOf('小明').earned;

  let last;
  for (let i = 0; i < 3; i++) {
    last = global.recordLike_({ script: '年輪', date: '2026/2/1', author: '小明' });
  }
  check('回傳累計讚數', last.likes, 3);
  check('同一則心得只佔一列', sheetRows('心得互動').length, 1);
  check('作者依讚數得點（3 讚 x 2）', summaryOf('小明').earned, before + 6);

  const payload = global.buildPublicPayload_();
  check('payload 帶出互動資料', payload.interactions.length, 1);
  check('互動資料含讚數', payload.interactions[0].likes, 3);
  check('預設非精選', payload.interactions[0].featured, false);

  // 再按 10 次 → 應停在上限 10 點
  for (let i = 0; i < 10; i++) {
    global.recordLike_({ script: '年輪', date: '2026/2/1', author: '小明' });
  }
  check('讚點數受上限保護', summaryOf('小明').earned, before + 10);

  spreadsheet.getSheetByName('心得互動').getRange(2, 5).setValue('TRUE');
  global.rebuildPoints_();
  check('精選再加 20 點', summaryOf('小明').earned, before + 30);
  check('payload 標記精選', global.buildPublicPayload_().interactions[0].featured, true);

  global.rebuildPoints_();
  global.rebuildPoints_();
  check('重複重算不會重複累加', summaryOf('小明').earned, before + 30);
  check('讚的列標成系統來源',
    sheetRows('點數帳本').some((row) => String(row[8]).trim() === '心得讚'), true);

  check('缺作者會被拒絕',
    global.recordLike_({ script: '年輪', date: '2026/2/1', author: '' }).ok, false);
  check('缺劇本會被拒絕',
    global.recordLike_({ script: '', date: '2026/2/1', author: '小明' }).ok, false);
}

/* ============================================================
   每月任務
   ============================================================ */
group('每月任務');
{
  // 場次目標 3、心得 2、新本 1、揪團 1
  freshEnv([
    ['2026/5/1', '海星', '2026/5/1', '年輪', '甲', '5', LONG, ''],
    ['2026/5/2', '海星', '2026/5/2', '上路', '乙', '5', LONG, ''],
    ['2026/5/3', '海星', '2026/5/3', '左左', '丙', '5', SHORT, ''],
    // 小明只玩一場，達不到場次目標
    ['2026/5/4', '小明', '2026/5/4', '群星', '丁', '5', LONG, '']
  ], { quests: true });

  const payload = global.buildPublicPayload_();
  check('payload 帶出任務定義', payload.quests.length, 4);
  check('任務有點數', payload.quests.every((quest) => quest.points > 0), true);
  check('說明裡的 {目標} 已替換成數字',
    payload.quests.find((quest) => quest.id === '場次').label, '本月完成 3 場');

  const questRows = sheetRows('點數帳本')
    .filter((row) => String(row[8]).trim() === '任務');
  const earned = (name, id) => questRows.find((row) =>
    String(row[2]) === name && String(row[5]).indexOf(
      payload.quests.find((quest) => quest.id === id).label) === 0);

  check('海星達成場次任務', Boolean(earned('海星', '場次')), true);
  check('場次任務發 20 點', Number(earned('海星', '場次')[4]), 20);
  check('海星達成心得任務（2 篇長心得）', Boolean(earned('海星', '心得')), true);
  check('海星達成新本任務', Boolean(earned('海星', '新本')), true);
  check('沒人介紹就沒有揪團任務', Boolean(earned('海星', '揪團')), false);

  check('小明沒達成場次任務', Boolean(earned('小明', '場次')), false);
  check('小明達成新本任務', Boolean(earned('小明', '新本')), true);

  // 基本 50+30+25(短心得) = 105，加上場次20+心得15+新本15 = 155
  check('海星總分含任務點數', summaryOf('海星').earned, 105 + 50);

  check('進度寫進分頁',
    sheetRows('任務進度').some((row) =>
      String(row[1]) === '海星' && String(row[2]) === '場次' && Number(row[3]) === 3), true);
  check('未達成的也寫進度',
    sheetRows('任務進度').some((row) =>
      String(row[1]) === '小明' && String(row[2]) === '場次' && Number(row[3]) === 1), true);

  global.rebuildPoints_();
  global.rebuildPoints_();
  check('重複重算不會重複發任務點', summaryOf('海星').earned, 105 + 50);
  check('重複重算不會重複寫進度',
    sheetRows('任務進度').filter((row) =>
      String(row[1]) === '海星' && String(row[2]) === '場次').length, 1);

  // GM 停用某個任務 → 點數要跟著消失
  const questSheet = spreadsheet.getSheetByName('任務');
  const rows = questSheet.getRange(2, 1, questSheet.getLastRow() - 1, 5).getValues();
  const target = rows.findIndex((row) => String(row[0]).trim() === '場次') + 2;
  questSheet.getRange(target, 5).setValue('FALSE');
  global.rebuildPoints_();
  check('停用任務後點數消失', summaryOf('海星').earned, 105 + 30);

  // 改目標也要立刻生效
  questSheet.getRange(target, 5).setValue('TRUE');
  questSheet.getRange(target, 3).setValue(10);
  global.rebuildPoints_();
  check('目標拉高後變成未達成', summaryOf('海星').earned, 105 + 30);
  check('說明跟著目標走',
    global.buildPublicPayload_().quests.find((q) => q.id === '場次').label, '本月完成 10 場');
}

group('每月任務：揪團與跨月');
{
  freshEnv([
    ['2026/5/1', '海星', '2026/5/1', '年輪', '甲', '5', LONG, ''],
    ['2026/6/1', '小明', '2026/6/1', '上路', '乙', '5', LONG, '海星']
  ], { quests: true });

  const questRows = sheetRows('點數帳本')
    .filter((row) => String(row[8]).trim() === '任務');

  const juggle = questRows.find((row) =>
    String(row[2]) === '海星' && /介紹/.test(String(row[5])));
  check('介紹人在被介紹者那一場的月份達成揪團', Boolean(juggle), true);
  check('揪團記在 6 月而不是 5 月', String(juggle[7]), '2026/06');
  check('揪團任務發 30 點', Number(juggle[4]), 30);

  // 5 月與 6 月各自結算，跨月之後舊的任務點數不會消失
  const months = new Set(questRows
    .filter((row) => String(row[2]) === '海星')
    .map((row) => String(row[7])));
  check('海星在兩個月份都有任務記錄', months.size, 2);
}

group('重算時哪些列會被重建');
{
  // 這組鎖住「哪些來源是系統產生的」這個分界。
  // 任務與心得讚要能重建（改設定後生效），
  // LINE 回歸禮與 GM 手動列則是一次性的，重算絕對不能清掉。
  freshEnv([
    ['2026/5/1', '海星', '2026/5/1', '年輪', '甲', '5', LONG, ''],
    ['2026/5/2', '海星', '2026/5/2', '上路', '乙', '5', LONG, ''],
    ['2026/5/3', '海星', '2026/5/3', '左左', '丙', '5', LONG, '']
  ], { quests: true });

  const ledger = spreadsheet.getSheetByName('點數帳本');
  ledger.appendRow([new Date(), '海星', '海星', 'bonus', 100, '老玩家回歸禮（LINE 綁定）',
    '', '', 'LINE', '有效', '', 'return-bonus|海星']);
  ledger.appendRow([new Date(), '海星', '海星', 'adjust', 50, 'GM 補登',
    '', '2026/5/4', '手動', '有效', '', '']);
  global.recordLike_({ script: '年輪', date: '2026/5/1', author: '海星' });

  const sourcesAfter = () => {
    const counts = {};
    sheetRows('點數帳本').forEach((row) => {
      const source = String(row[8]).trim();
      counts[source] = (counts[source] || 0) + 1;
    });
    return counts;
  };

  const before = sourcesAfter();
  check('四種來源都在帳本裡',
    ['表單', '任務', 'LINE', '手動', '心得讚'].every((source) => before[source] > 0), true);

  global.rebuildPoints_();
  global.rebuildPoints_();
  const after = sourcesAfter();

  check('LINE 回歸禮重算後只有一列（不會被重建或清掉）', after['LINE'], 1);
  check('GM 手動列重算後只有一列', after['手動'], 1);
  check('任務列不會每次重算就疊加', after['任務'], before['任務']);
  check('心得讚列不會每次重算就疊加', after['心得讚'], before['心得讚']);

  const bonus = sheetRows('點數帳本').find((row) => String(row[8]).trim() === 'LINE');
  check('回歸禮點數原封不動', Number(bonus[4]), 100);
  check('回歸禮仍算進累積點',
    summaryOf('海星').earned > 100, true);
}

/* ============================================================
   月報
   ============================================================ */
group('月報');
{
  // 2026/6/1 週一、6/6 週六、6/8 週一；7/6 週一、7/11 週六
  freshEnv([
    ['2026/6/1', '海星', '2026/6/1', '年輪', '甲', '5', LONG, ''],
    ['2026/6/1', '小明', '2026/6/1', '年輪', '乙', '4', LONG, '海星'],
    ['2026/6/6', '海星', '2026/6/6', '上路', '丙', '5', LONG, ''],
    ['2026/6/8', '海星', '2026/6/8', '神樂湯', '丁', '5', LONG, ''],
    ['2026/7/6', '海星', '2026/7/6', '左左', '戊', '5', LONG, ''],
    ['2026/7/6', '阿華', '2026/7/6', '左左', '己', '4', LONG, ''],
    ['2026/7/11', '小明', '2026/7/11', '群星', '庚', '5', LONG, '']
  ]);

  check('6/1 是週一', new Date(2026, 5, 1).getDay(), 1);
  check('6/6 是週六', new Date(2026, 5, 6).getDay(), 6);

  global.buildMonthlyReport_();

  const report = spreadsheet.getSheetByName('月報');
  const headers = report.getRange(1, 1, 1, 13).getDisplayValues()[0];
  const rows = report.getRange(2, 1, report.getLastRow() - 1, 13).getValues();
  const cell = (month, column) =>
    rows.find((row) => row[0] === month)[headers.indexOf(column)];

  check('兩個月份', rows.length, 2);
  check('6月場次（年輪/上路/神樂湯）', cell('2026/06', '場次'), 3);
  check('同一場多人填表算一場', cell('2026/06', '填表人次'), 4);
  check('每場平均填表', cell('2026/06', '每場平均填表'), 1.3);
  check('6月平日場次（6/1、6/8）', cell('2026/06', '平日場次'), 2);
  check('6月假日場次（6/6）', cell('2026/06', '假日場次'), 1);
  check('平日佔比', cell('2026/06', '平日佔比'), '67%');
  check('6月活躍玩家', cell('2026/06', '活躍玩家'), 2);
  check('6月新玩家', cell('2026/06', '新玩家'), 2);
  // 海星 6/1→6/6 隔 5 天、6/6→6/8 隔 2 天 → 平均 3.5 → 4
  check('平均回訪間隔', cell('2026/06', '平均回訪間隔(天)'), 4);
  check('介紹人筆數', cell('2026/06', '介紹人筆數'), 1);
  check('發出點數有算到', cell('2026/06', '發出點數') > 0, true);

  check('7月場次', cell('2026/07', '場次'), 2);
  check('7月平日場次', cell('2026/07', '平日場次'), 1);
  check('7月假日場次', cell('2026/07', '假日場次'), 1);
  check('7月只有阿華是新玩家', cell('2026/07', '新玩家'), 1);
  check('7月活躍玩家', cell('2026/07', '活躍玩家'), 3);

  global.buildMonthlyReport_();
  const again = report.getRange(2, 1, report.getLastRow() - 1, 13).getValues();
  check('重跑不會重複列', again.length, 2);
  check('重跑後數字不變', again.find((row) => row[0] === '2026/06')[1], 3);
}

/* ============================================================
   對外端點
   ============================================================ */
group('對外端點');
{
  freshEnv([['2026/1/5', '海星', '2026/1/5', '瘋兔子', '兔子', '5', LONG, '']]);

  const payload = global.buildPublicPayload_();
  check('回傳 ok', payload.ok, true);
  check('帶出 monthKey', /^\d{4}\/\d{1,2}$/.test(payload.monthKey), true);
  check('帶出獎勵清單', payload.rewards.length > 0, true);
  check('獎勵含四種軌道',
    new Set(payload.rewards.map((item) => item.track)).size, 4);
  check('下架的獎勵不會出現', payload.rewards.every((item) => item.active), true);

  // doPost 寫入後應該立刻反映在點數上
  const response = global.doPost({
    parameter: {
      name: '新玩家', date: '2026/4/1', script: '年輪',
      character: '甲', rating: '5', comment: LONG
    }
  });
  const parsed = JSON.parse(response);
  check('doPost 回傳成功', parsed.ok, true);
  check('doPost 回傳本場得點', parsed.award && parsed.award.points > 0, true);
  check('新玩家立刻出現在總覽', summaryOf('新玩家') !== null, true);

  // 蜜罐欄位有值 → 偽裝成功但不寫入
  const before = spreadsheet.getSheetByName('表單回應 1').getLastRow();
  global.doPost({ parameter: { website: 'bot', name: '機器人', date: '2026/4/2',
    script: '年輪', character: '甲', rating: '5', comment: LONG } });
  check('蜜罐攔下機器人', spreadsheet.getSheetByName('表單回應 1').getLastRow(), before);

  // 驗證失敗要回報原因（doPost 內部會 console.error，這裡壓掉避免誤以為測試爆了）
  const realError = console.error;
  console.error = () => {};
  const bad = JSON.parse(global.doPost({
    parameter: { name: '測試', date: '2026/4/1', script: '年輪', character: '甲', rating: '9' }
  }));
  console.error = realError;
  check('評價超出範圍會被拒絕', bad.ok, false);
  check('拒絕時回報原因', /評價/.test(String(bad.error)), true);
}

/* ============================================================ */
console.log('\n' + '─'.repeat(52));
if (fail) {
  console.log('失敗項目：');
  failures.forEach((line) => console.log('  • ' + line));
}
console.log('通過 ' + pass + ' 項，失敗 ' + fail + ' 項');
process.exit(fail ? 1 : 0);
