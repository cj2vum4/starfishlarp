/**
 * 海星劇本殺｜玩本記錄寫入 Google Sheet
 *
 * 目標試算表：
 * https://docs.google.com/spreadsheets/d/1hjdPJQo5Z6nVICZsvljihSXoZAJ32DpiAEQikCaog-8/edit?gid=463584243
 *
 * 使用方式：
 * 1. 將本檔完整貼入 Apps Script 專案的 Code.gs。
 * 2. 儲存後選擇：部署 → 新增部署作業 → 網頁應用程式。
 * 3. 執行身分選「我」，存取權限選「所有人」。
 * 4. 複製以 /exec 結尾的網址，貼到網站的 play-record-config.js。
 *
 * 程式會直接開啟下方指定的試算表與工作表分頁，不依賴 Google 表單，
 * 也不要求 Apps Script 必須綁定在試算表內。
 *
 * 表頭沿用榮譽牆目前讀取的名稱：
 * 怎麼稱呼你呢、日期、劇本、角色、給予評價、50字以內的心得推薦、心情。
 */

const SPREADSHEET_ID = '1hjdPJQo5Z6nVICZsvljihSXoZAJ32DpiAEQikCaog-8';
const SHEET_GID = 463584243;
const SHEET_NAME = '表單回應 1';

const REQUIRED_HEADERS = [
  '時間戳記',
  '怎麼稱呼你呢',
  '日期',
  '劇本',
  '角色',
  '給予評價',
  '50字以內的心得推薦',
  '心情'
];

function doGet() {
  return jsonResponse_({
    ok: true,
    service: 'starfishlarp-play-record',
    spreadsheetId: SPREADSHEET_ID,
    sheetGid: SHEET_GID,
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
      '心情': clean_(data.mood, 100)
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

    return jsonResponse_({
      ok: true,
      row: sheet.getLastRow(),
      sheetName: sheet.getName(),
      sheetGid: sheet.getSheetId()
    });
  } catch (error) {
    console.error(error);
    return jsonResponse_({
      ok: false,
      error: String(error && error.message ? error.message : error)
    });
  }
}

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

function jsonResponse_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
