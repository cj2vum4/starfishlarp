'use strict';

/**
 * Apps Script 測試用的最小試算表模擬。
 *
 * GoogleAppsScript_玩本記錄.gs 是獨立腳本，沒有任何模組系統，
 * 所以用 vm.runInThisContext 把它的頂層函式送進全域——
 * 這跟 Apps Script 實際的執行方式一致。
 *
 * 注意：整個行程只能載入一次（頂層 const 重複宣告會拋錯）。
 * 各組測試之間請用 resetSheets() 清空資料，不要重新載入。
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const GAS_PATH = path.join(__dirname, '..', 'GoogleAppsScript_玩本記錄.gs');
const RESPONSE_GID = 463584243;

/** 一個分頁 = 一個二維陣列，支援 getRange 系列用到的最小介面。 */
function makeSheet(name, id) {
  const data = [];

  function ensure(rows, columns) {
    while (data.length < rows) data.push([]);
    for (const row of data) {
      while (row.length < columns) row.push('');
    }
  }

  return {
    getName: () => name,
    getSheetId: () => id,
    setFrozenRows: () => {},
    appendRow: (row) => { data.push(row.slice()); },

    getLastRow: () => {
      let last = 0;
      data.forEach((row, index) => {
        if (row.some((cell) => String(cell == null ? '' : cell).trim() !== '')) last = index + 1;
      });
      return last;
    },

    getLastColumn: () => {
      let last = 0;
      data.forEach((row) => row.forEach((cell, index) => {
        if (String(cell == null ? '' : cell).trim() !== '') last = Math.max(last, index + 1);
      }));
      return last;
    },

    getRange: (row, column, numRows = 1, numColumns = 1) => {
      ensure(row + numRows - 1, column + numColumns - 1);
      return {
        getValues: () => {
          const out = [];
          for (let i = 0; i < numRows; i++) {
            const line = [];
            for (let j = 0; j < numColumns; j++) line.push(data[row - 1 + i][column - 1 + j]);
            out.push(line);
          }
          return out;
        },
        getDisplayValues: function () {
          return this.getValues().map((line) =>
            line.map((cell) => cell instanceof Date ? cell.toISOString() : String(cell == null ? '' : cell)));
        },
        setValues: (values) => {
          ensure(row + values.length - 1, column + values[0].length - 1);
          values.forEach((line, i) => line.forEach((cell, j) => {
            data[row - 1 + i][column - 1 + j] = cell;
          }));
        },
        setValue: (value) => { ensure(row, column); data[row - 1][column - 1] = value; },
        setFontWeight: () => {},
        clearContent: () => {
          for (let i = 0; i < numRows; i++) {
            for (let j = 0; j < numColumns; j++) {
              if (data[row - 1 + i]) data[row - 1 + i][column - 1 + j] = '';
            }
          }
        }
      };
    }
  };
}

const sheets = [];

const spreadsheet = {
  getSheets: () => sheets,
  getSheetByName: (name) => sheets.find((sheet) => sheet.getName() === name) || null,
  insertSheet: (name) => {
    const sheet = makeSheet(name, 1000 + sheets.length);
    sheets.push(sheet);
    return sheet;
  }
};

global.SpreadsheetApp = {
  openById: () => spreadsheet,
  getUi: () => ({ alert: () => {}, prompt: () => ({ getSelectedButton: () => null }) })
};

global.ContentService = {
  MimeType: { JSON: 'json', JAVASCRIPT: 'js' },
  createTextOutput: (text) => ({ setMimeType: () => text })
};

global.ScriptApp = {
  getProjectTriggers: () => [],
  newTrigger: () => ({ forSpreadsheet: () => ({ onOpen: () => ({ create: () => {} }) }) }),
  deleteTrigger: () => {}
};

/** 快取與指令碼屬性：各組測試可以用 resetCache() / setScriptProperty() 控制。 */
const cacheStore = new Map();
global.CacheService = {
  getScriptCache: () => ({
    get: (key) => (cacheStore.has(key) ? cacheStore.get(key) : null),
    put: (key, value) => { cacheStore.set(key, value); },
    remove: (key) => { cacheStore.delete(key); }
  })
};
const scriptProperties = new Map();
global.PropertiesService = {
  getScriptProperties: () => ({ getProperty: (key) => (scriptProperties.has(key) ? scriptProperties.get(key) : null) })
};
global.LockService = { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) };

function resetCache() { cacheStore.clear(); }
function setScriptProperty(key, value) {
  if (value == null) scriptProperties.delete(key); else scriptProperties.set(key, value);
}

vm.runInThisContext(fs.readFileSync(GAS_PATH, 'utf8'));

function resetSheets() {
  sheets.length = 0;
  cacheStore.clear();
}

/**
 * 準備一份乾淨的環境：清空分頁、塞入回饋資料、建立所有分頁。
 * rows 的欄位順序與 REQUIRED_HEADERS 一致。
 */
function freshEnv(rows, options) {
  const settings = options || {};
  resetSheets();

  // 頂層 const 進的是全域語彙環境，不會掛到 globalThis，
  // 所以這裡用裸參照而不是 global.REQUIRED_HEADERS。
  const headers = REQUIRED_HEADERS;  // eslint-disable-line no-undef
  const responses = makeSheet('表單回應 1', RESPONSE_GID);
  sheets.push(responses);
  responses.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (rows && rows.length) {
    responses.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  global.setupSheets_();

  // 計分斷言預設要跟雙倍日、每月任務脫鉤，否則預設值一改測試就全垮。
  // 這兩項各自有專屬的測試群組。
  setConfig('雙倍日', settings.doubleDay == null ? '' : settings.doubleDay);
  // 不能用清空的——rebuildPoints_ 會再呼叫 setupSheets_，
  // seedIfEmpty_ 看到空分頁就把預設任務補回去了。改成逐列停用。
  if (!settings.quests) disableQuests();

  global.rebuildPoints_();
  return { responses, spreadsheet };
}

/** 把「任務」分頁所有列設成停用，讓計分測試不受每月任務影響。 */
function disableQuests() {
  const sheet = spreadsheet.getSheetByName('任務');
  if (!sheet || sheet.getLastRow() < 2) return;
  for (let row = 2; row <= sheet.getLastRow(); row++) {
    sheet.getRange(row, 5).setValue('FALSE');
  }
}

function setConfig(key, value) {
  const sheet = spreadsheet.getSheetByName('設定');
  const rows = sheet.getRange(2, 1, Math.max(sheet.getLastRow() - 1, 1), 3).getValues();
  const index = rows.findIndex((row) => String(row[0]).trim() === key);
  if (index >= 0) sheet.getRange(index + 2, 2).setValue(value);
  else sheet.appendRow([key, value, '']);
}

/** 以歸戶名取得「點數總覽」那一列，找不到回傳 null。 */
function summaryOf(name) {
  return global.buildPublicPayload_().summary.find((item) => item.name === name) || null;
}

function sheetRows(name) {
  const sheet = spreadsheet.getSheetByName(name);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
}

module.exports = {
  sheets, spreadsheet, makeSheet,
  resetSheets, freshEnv, setConfig, disableQuests, summaryOf, sheetRows,
  resetCache, setScriptProperty
};
