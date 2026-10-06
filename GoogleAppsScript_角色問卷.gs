/**
 * 海星劇本殺｜角色分配問卷（所有劇本共用一支）
 *
 * 目標試算表（角色問卷總表）：
 * https://docs.google.com/spreadsheets/d/1NrmyrSq3UqoU0m-2JWVJsvF18VKwW18n-P-w-iyYb5M/edit
 *
 * 使用方式（只需做一次，之後新增劇本問卷都不用再動這裡）：
 * 1. 到 https://script.google.com 新增專案，把本檔完整貼進 Code.gs 後存檔。
 * 2. 函式下拉選單選「checkSetup」，按「執行」並完成授權（確認讀得到總表）。
 * 3. 部署 → 新增部署作業 → 類型選「網頁應用程式」。
 *    執行身分：我；誰可以存取：所有人。
 * 4. 複製以 /exec 結尾的網址，貼到網站 survey.js 最上方的 SURVEY_ENDPOINT。
 *
 * 之後改了本檔要「管理部署作業 → 編輯 → 版本選新版本」，網址才會沿用。
 *
 * ── 資料怎麼存 ─────────────────────────────────────────────
 * 每個劇本一個分頁，分頁名＝問卷頁送來的劇本名稱，第一次有人填就自動建立。
 * 第一欄「時間戳記」，其後依題目文字當欄名，跟 Google 表單匯出的格式一樣，
 * 所以舊表單的回應可以直接整段貼到同名分頁底下。
 * 欄位是用「表頭文字」對應的：題目改字或新增題目時會自動在最右邊加新欄，
 * 不會蓋掉舊資料；表頭不要手動改名，否則會被當成新題目另開一欄。
 * 可以自己在最右邊加欄位（例如「分配角色」「備註」），程式不會動到。
 */

const SPREADSHEET_ID = '1NrmyrSq3UqoU0m-2JWVJsvF18VKwW18n-P-w-iyYb5M';
const TIMESTAMP_HEADER = '時間戳記';
const MAX_FIELDS = 80;
const MAX_VALUE_LENGTH = 5000;

function doGet() {
  return json_({ ok: true, service: '角色問卷' });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json_({ ok: false, error: 'bad_json' });
  }

  // 蜜罐欄位：真人看不到也不會填，機器人填了就直接丟掉（回 ok 讓它別重試）
  if (body.website) return json_({ ok: true });

  const sheetName = cleanSheetName_(body.script);
  if (!sheetName) return json_({ ok: false, error: 'bad_script' });

  const fields = Array.isArray(body.fields) ? body.fields.slice(0, MAX_FIELDS) : [];
  const pairs = fields
    .filter(function (f) { return f && typeof f.label === 'string' && f.label.trim(); })
    .map(function (f) {
      return { label: f.label.trim().slice(0, 200), value: cellValue_(f.value) };
    });
  if (!pairs.length) return json_({ ok: false, error: 'empty' });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = getOrCreateSheet_(ss, sheetName);
    const headers = ensureHeaders_(sheet, pairs.map(function (p) { return p.label; }));

    const row = headers.map(function () { return ''; });
    row[0] = new Date();
    pairs.forEach(function (p) {
      const col = headers.indexOf(p.label);
      if (col > 0) row[col] = p.value;
    });
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true });
}

/** 部署前手動執行一次：確認權限與試算表 ID 正確。 */
function checkSetup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Logger.log('已連到試算表：' + ss.getName() + '（目前 ' + ss.getSheets().length + ' 個分頁）');
}

function getOrCreateSheet_(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (sheet) return sheet;
  sheet = ss.insertSheet(name);
  sheet.getRange(1, 1).setValue(TIMESTAMP_HEADER);
  sheet.setFrozenRows(1);
  return sheet;
}

/** 回傳整列表頭；缺的題目依序加在最右邊。 */
function ensureHeaders_(sheet, labels) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  if (!headers[0]) headers[0] = TIMESTAMP_HEADER;

  const missing = labels.filter(function (label, i) {
    return label !== TIMESTAMP_HEADER && headers.indexOf(label) === -1 && labels.indexOf(label) === i;
  });
  // 空白表頭格可以重用，免得中間留洞
  while (headers.length > 1 && headers[headers.length - 1] === '') headers.pop();
  missing.forEach(function (label) { headers.push(label); });

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  if (sheet.getFrozenRows() < 1) sheet.setFrozenRows(1);
  return headers;
}

function cleanSheetName_(name) {
  if (typeof name !== 'string') return '';
  const cleaned = name.replace(/[\[\]\*\?\/\\:]/g, '').trim().slice(0, 60);
  return cleaned;
}

/** 數字（線性刻度）原樣存；陣列（複選）用「, 」串起來，與 Google 表單匯出一致；
 *  文字開頭是 = + - @ 的加 ' 防公式注入。 */
function cellValue_(value) {
  if (typeof value === 'number' && isFinite(value)) return value;
  let text = Array.isArray(value) ? value.map(String).join(', ') : (value == null ? '' : String(value));
  text = text.slice(0, MAX_VALUE_LENGTH);
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return text;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
