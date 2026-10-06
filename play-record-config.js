/*
 * Google Apps Script 玩本記錄寫入端點。
 * 劇本與角色資料一律由 scripts.js 的 window.SCRIPTS 提供。
 */
window.STARFISH_PLAY_RECORD_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbz2jFZhU9tSm-WvZaC_lLSovG2zy3Up2-HNlK6sO6xyfnFDQu8DxRUIKmhDBg1AHMDsDg/exec';

/*
 * 點數總覽的快速副本：預約系統（Supabase）在 Apps Script 每次重算後更新，
 * 約 0.2 秒就能讀到（Apps Script 本身要 1 秒，快取過期時約 10 秒）。
 * 讀不到時回傳 null，由呼叫端改走原本的 Apps Script JSONP。
 */
window.STARFISH_RECORDS_API =
  'https://qrcpmxejhqrvvpnjehri.supabase.co/functions/v1/api/public/records';

window.starfishFetchSummary = function (timeoutMs) {
  var url = String(window.STARFISH_RECORDS_API || '').trim();
  if (!url || typeof fetch !== 'function') return Promise.resolve(null);
  var controller = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = setTimeout(function () { if (controller) controller.abort(); }, timeoutMs || 4000);
  return fetch(url, controller ? { signal: controller.signal } : {})
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (payload) { return payload && payload.ok && Array.isArray(payload.summary) ? payload : null; })
    .catch(function () { return null; })
    .then(function (payload) { clearTimeout(timer); return payload; });
};
