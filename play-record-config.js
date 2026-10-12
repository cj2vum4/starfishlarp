/*
 * Google Apps Script 玩本記錄寫入端點（舊的；預約系統還沒切換、或暫時連不上時的備援）。
 * 劇本與角色資料一律由 scripts.js 的 window.SCRIPTS 提供。
 */
window.STARFISH_PLAY_RECORD_ENDPOINT =
  'https://script.google.com/macros/s/AKfycbz2jFZhU9tSm-WvZaC_lLSovG2zy3Up2-HNlK6sO6xyfnFDQu8DxRUIKmhDBg1AHMDsDg/exec';

/*
 * 預約系統（Supabase）。玩本記錄與點數正從 Apps Script 搬過去（店家在 LINE 店家畫面按「切換」那一刻生效）：
 * - 切換前：送出、按讚、心得清單回 503 {live:false}，網站照舊用 Apps Script 與試算表 CSV；
 *   點數總覽 /public/records 回的是 Apps Script 的快速副本。
 * - 切換後：全部改讀寫預約系統，點數在送出當下算好。
 * 預約系統連不上時一律退回舊路線，不會讓玩家送不出去。
 */
window.STARFISH_API_BASE = 'https://qrcpmxejhqrvvpnjehri.supabase.co/functions/v1/api';
window.STARFISH_RECORDS_API = window.STARFISH_API_BASE + '/public/records';

function starfishTimedFetch(url, init, timeoutMs) {
  var controller = typeof AbortController === 'function' ? new AbortController() : null;
  var timer = setTimeout(function () { if (controller) controller.abort(); }, timeoutMs || 4000);
  var options = init || {};
  if (controller) options.signal = controller.signal;
  return fetch(url, options).then(function (response) { clearTimeout(timer); return response; },
    function (error) { clearTimeout(timer); throw error; });
}

/** 點數總覽（ok + summary 才算數）；讀不到回傳 null，由呼叫端改走 Apps Script JSONP。 */
window.starfishFetchSummary = function (timeoutMs) {
  var url = String(window.STARFISH_RECORDS_API || '').trim();
  if (!url || typeof fetch !== 'function') return Promise.resolve(null);
  return starfishTimedFetch(url, {}, timeoutMs || 4000)
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (payload) { return payload && payload.ok && Array.isArray(payload.summary) ? payload : null; })
    .catch(function () { return null; });
};

/**
 * 玩家心得清單（取代試算表 CSV）。script 省略＝全部（榮譽牆）。
 * 回傳與 CSV 相同欄位的列；切換前或讀不到回傳 null，由呼叫端改讀 CSV。
 */
window.starfishFetchPlayRecords = function (script, timeoutMs) {
  var base = String(window.STARFISH_API_BASE || '').trim();
  if (!base || typeof fetch !== 'function') return Promise.resolve(null);
  var url = base + '/public/play-records' + (script ? '?script=' + encodeURIComponent(script) : '');
  return starfishTimedFetch(url, {}, timeoutMs || 5000)
    .then(function (response) { return response.ok ? response.json() : null; })
    .then(function (payload) {
      if (!payload || !payload.ok || payload.live === false || !Array.isArray(payload.records)) return null;
      return payload.records.map(function (r) {
        return { '怎麼稱呼你呢': r.name || '', '日期': r.date || '', '劇本': r.script || '', '角色': r.character || '',
          '給予評價': r.rating == null ? '' : String(r.rating), '50字以內的心得推薦': r.comment || '' };
      });
    })
    .catch(function () { return null; });
};

/**
 * 送到預約系統（text/plain JSON＝「簡單請求」，不觸發 CORS 預檢）。回傳 { status, data }；網路錯誤或逾時會丟出例外。
 * data.live === false（RECORDS_NOT_LIVE）表示店家還沒切換，呼叫端應改送 Apps Script。
 */
window.starfishPostJson = function (path, payload, timeoutMs) {
  var base = String(window.STARFISH_API_BASE || '').trim();
  if (!base || typeof fetch !== 'function') return Promise.reject(new Error('no api'));
  return starfishTimedFetch(base + path, { method: 'POST', cache: 'no-store', body: JSON.stringify(payload) }, timeoutMs || 15000)
    .then(function (response) {
      return response.json().catch(function () { return null; })
        .then(function (data) { return { status: response.status, data: data }; });
    });
};

window.starfishNewId = function () {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return window.crypto.randomUUID();
  var b = new Uint8Array(16);
  (window.crypto || window.msCrypto).getRandomValues(b);
  b[6] = (b[6] & 15) | 64;
  b[8] = (b[8] & 63) | 128;
  var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
};
