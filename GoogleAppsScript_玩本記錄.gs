/**
 * 海星劇本殺｜玩本記錄寫入 Google Sheet
 *
 * 使用方式：
 * 1. 在榮譽牆目前使用的 Google 試算表中開啟：
 *    擴充功能 → Apps Script。
 * 2. 將本檔完整貼入 Code.gs。
 * 3. 修改 SHEET_NAME；若原本回應工作表名稱就是「表單回應 1」可不改。
 * 4. 部署 → 新增部署作業 → 類型選「網頁應用程式」。
 * 5. 執行身分選「我」，存取權限選「所有人」。
 * 6. 複製 /exec 網址，貼到網站的 play-record-config.js。
 *
 * 表頭會沿用榮譽牆目前讀取的名稱：
 * 怎麼稱呼你呢、日期、劇本、角色、給予評價、50字以內的心得推薦、心情。
 */

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
      row: sheet.getLastRow()
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
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error('找不到綁定的 Google 試算表。請從試算表的「擴充功能 → Apps Script」建立此程式。');
  }

  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.getSheets()[0];
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
