/* ============================================================
   預約這本（共用元件）
   - 劇本頁右下角出現「📅 預約這本」，點了進 LINE 預約系統，並已選好這本劇本
   - 劇本對應：用目前頁面路徑比對 scripts.js 的 file 欄位（與 video.js 相同）
   - 預約系統以 scripts.js 的 id 對應劇本，所以不用另外維護清單
   版號：booking.js?v= 與 scripts.js?v= 相同（會用同一個版號載入 scripts.js）
   ============================================================ */
(function () {
    'use strict';

    const BOOKING_URL = 'https://liff.line.me/2011840025-6cuU9x8P';
    const SELF_SCRIPT = document.currentScript ||
        document.querySelector('script[src*="booking.js"]');

    function scriptsUrl() {
        if (!SELF_SCRIPT || !SELF_SCRIPT.src) return '';
        const m = SELF_SCRIPT.src.match(/booking\.js\?(?:[^#]*&)?v=([^&#]+)/);
        return SELF_SCRIPT.src.replace(/booking\.js(\?.*)?$/, 'scripts.js' + (m ? '?v=' + m[1] : ''));
    }

    function loadScripts() {
        if (Array.isArray(window.SCRIPTS)) return Promise.resolve(window.SCRIPTS);
        const url = scriptsUrl();
        if (!url) return Promise.resolve([]);
        return new Promise((resolve) => {
            const tag = document.createElement('script');
            tag.src = url;
            tag.onload = () => resolve(Array.isArray(window.SCRIPTS) ? window.SCRIPTS : []);
            tag.onerror = () => resolve([]);
            document.head.appendChild(tag);
        });
    }

    function findCurrentScript(list) {
        let path = '';
        try { path = decodeURIComponent(location.pathname); } catch (_) { path = location.pathname; }
        return list.find(s => s.file && path.endsWith('/' + s.file)) || null;
    }

    function mount(script) {
        const css = `
        .bk-fab {
            position: fixed; right: 20px; bottom: 196px; z-index: 9998;
            display: flex; align-items: center; gap: 8px;
            padding: 12px 18px; border-radius: 30px;
            background: linear-gradient(135deg, #ecd08a, #c8a056);
            color: #1a1208; font-size: .95rem; font-weight: 700; text-decoration: none;
            box-shadow: 0 8px 24px rgba(0,0,0,.4);
            font-family: '微軟正黑體', sans-serif;
            transition: transform .2s, box-shadow .2s;
        }
        .bk-fab:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 12px 32px rgba(0,0,0,.5); }
        @media (max-width: 600px) {
            .bk-fab { right: 14px; bottom: 180px; padding: 10px 15px; font-size: .85rem; }
        }`;
        const styleEl = document.createElement('style');
        styleEl.textContent = css;
        document.head.appendChild(styleEl);

        const fab = document.createElement('a');
        fab.className = 'bk-fab';
        fab.href = BOOKING_URL + '?view=create&game=' + encodeURIComponent(script.id);
        fab.textContent = '📅 預約這本';
        fab.setAttribute('aria-label', '用 LINE 預約「' + script.name + '」');
        document.body.appendChild(fab);
    }

    function init() {
        loadScripts().then(list => {
            const script = findCurrentScript(list);
            if (script && script.id) mount(script);
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
