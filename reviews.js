/* ============================================================
   玩家評價彈窗（共用元件）
   - 自動在頁面加一顆「💬 玩家評價」按鈕
   - 點擊後讀取榮譽牆同一份 Google Sheet CSV
   - 篩出本劇本的歷史評論，以便利貼風格顯示
   劇本名稱判斷順序：
     1. <script src="reviews.js" data-script="名稱">
     2. window.SCRIPT_NAME
     3. 檔名（去掉 .html）
   ============================================================ */
(function () {
    'use strict';

    const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vR36D_er_9eC5E2l551e9d09nj4puUiAQUqXbeX_o-c-6FO5AY3jTJ_WX33Xu0SReW06RmSmzzKgNqk/pub?output=csv';

    // ── 取得本頁劇本名稱 ──────────────────────────────────────
    function resolveScriptName() {
        const self = document.currentScript ||
            document.querySelector('script[src*="reviews.js"]');
        if (self && self.dataset && self.dataset.script) return self.dataset.script.trim();
        if (window.SCRIPT_NAME) return String(window.SCRIPT_NAME).trim();
        try {
            const path = decodeURIComponent(location.pathname);
            const base = path.split('/').pop() || '';
            return base.replace(/\.html?$/i, '').trim();
        } catch (_) { return ''; }
    }
    const SCRIPT_NAME = resolveScriptName();
    if (!SCRIPT_NAME) return;

    // ── 樣式 ──────────────────────────────────────────────────
    const css = `
    .rv-fab {
        position: fixed; right: 20px; bottom: 84px; z-index: 9998;
        display: flex; align-items: center; gap: 8px;
        padding: 12px 18px; border: none; border-radius: 30px;
        background: linear-gradient(135deg, #ffb347, #d46a8a);
        color: #fff; font-size: .95rem; font-weight: 700; cursor: pointer;
        box-shadow: 0 8px 24px rgba(0,0,0,.4);
        font-family: '微軟正黑體', sans-serif;
        transition: transform .2s, box-shadow .2s;
    }
    .rv-fab:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 12px 32px rgba(0,0,0,.5); }
    .rv-overlay {
        position: fixed; inset: 0; z-index: 9999;
        background: rgba(8,6,14,.78); backdrop-filter: blur(6px);
        display: none; align-items: flex-start; justify-content: center;
        padding: 40px 16px; overflow-y: auto;
        font-family: '微軟正黑體', sans-serif;
    }
    .rv-overlay.open { display: flex; animation: rv-fade .25s ease; }
    @keyframes rv-fade { from { opacity: 0; } to { opacity: 1; } }
    .rv-panel {
        position: relative; width: 100%; max-width: 920px;
        background: #1c1726; border: 1px solid rgba(255,255,255,.12);
        border-radius: 18px; padding: 28px 24px 34px;
        box-shadow: 0 30px 70px rgba(0,0,0,.6);
    }
    .rv-close {
        position: absolute; top: 14px; right: 16px;
        width: 38px; height: 38px; border-radius: 50%;
        border: none; cursor: pointer; font-size: 1.2rem;
        background: rgba(255,255,255,.1); color: #fff;
        transition: background .2s, transform .2s;
    }
    .rv-close:hover { background: rgba(255,255,255,.22); transform: rotate(90deg); }
    .rv-head { text-align: center; margin-bottom: 22px; }
    .rv-head h2 {
        margin: 0; font-size: 1.6rem; color: #fff;
        background: linear-gradient(120deg,#fff,#ffd9a8 60%,#ffb0c4);
        -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
    }
    .rv-head p { margin: 6px 0 0; font-size: .85rem; color: rgba(255,255,255,.55); }
    .rv-grid {
        display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        gap: 16px;
    }
    .rv-note {
        position: relative; padding: 16px 16px 18px;
        border-radius: 4px; color: #3a3326;
        box-shadow: 0 8px 18px rgba(0,0,0,.35);
        transform: rotate(var(--rot, 0deg));
        transition: transform .2s;
        min-height: 120px; display: flex; flex-direction: column;
    }
    .rv-note:hover { transform: rotate(0deg) scale(1.03); z-index: 2; }
    .rv-note .rv-stars { font-size: .95rem; color: #c0392b; letter-spacing: 1px; margin-bottom: 6px; }
    .rv-note .rv-comment { font-size: .95rem; line-height: 1.55; flex: 1; word-break: break-word; white-space: pre-wrap; }
    .rv-note .rv-meta { margin-top: 10px; font-size: .75rem; color: rgba(0,0,0,.55); display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
    .rv-note .rv-name { font-weight: 700; }
    .rv-note .rv-mood { background: rgba(0,0,0,.08); border-radius: 10px; padding: 1px 8px; }
    .rv-empty, .rv-loading { text-align: center; color: rgba(255,255,255,.7); padding: 40px 10px; font-size: 1rem; }
    @media (max-width: 600px) {
        .rv-fab { right: 14px; bottom: 76px; padding: 10px 15px; font-size: .85rem; }
        .rv-panel { padding: 24px 16px 28px; }
        .rv-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
        .rv-note .rv-comment { font-size: .82rem; }
    }`;
    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    // ── 建立按鈕與彈窗骨架 ────────────────────────────────────
    const fab = document.createElement('button');
    fab.className = 'rv-fab';
    fab.innerHTML = '💬 玩家評價';
    document.body.appendChild(fab);

    const overlay = document.createElement('div');
    overlay.className = 'rv-overlay';
    overlay.innerHTML =
        '<div class="rv-panel">' +
            '<button class="rv-close" aria-label="關閉">✕</button>' +
            '<div class="rv-head"><h2>玩家評價 · ' + escapeHtml(SCRIPT_NAME) + '</h2>' +
            '<p>來自榮譽牆的真實玩家心得</p></div>' +
            '<div class="rv-body"><div class="rv-loading">讀取評價中…</div></div>' +
        '</div>';
    document.body.appendChild(overlay);

    const bodyEl = overlay.querySelector('.rv-body');
    let loaded = false;

    function openModal() {
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        if (!loaded) { loaded = true; loadReviews(); }
    }
    function closeModal() {
        overlay.classList.remove('open');
        document.body.style.overflow = '';
    }
    fab.addEventListener('click', openModal);
    overlay.querySelector('.rv-close').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    // ── 載入並渲染評論 ────────────────────────────────────────
    async function loadReviews() {
        try {
            const rows = await fetchRows();
            const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, '').trim();
            const target = norm(SCRIPT_NAME);
            const reviews = [];
            rows.forEach(row => {
                if (norm(row['劇本']) !== target) return;
                const comment = (row['50字以內的心得推薦'] || '').trim();
                if (!comment) return;
                const chars = [];
                for (const k in row) { if (k.indexOf('角色') === 0 && row[k] && row[k].trim()) chars.push(row[k].trim()); }
                reviews.push({
                    name: (row['怎麼稱呼你呢'] || '匿名玩家').trim(),
                    comment,
                    rating: (row['給予評價'] || '').trim(),
                    mood: (row['心情'] || '').trim(),
                    character: chars.join('、')
                });
            });
            renderReviews(reviews);
        } catch (err) {
            bodyEl.innerHTML = '<div class="rv-empty">評價讀取失敗 😢<br><span style="font-size:.8rem;opacity:.7">' +
                escapeHtml(err.message || '') + '</span></div>';
        }
    }

    function renderReviews(reviews) {
        if (!reviews.length) {
            bodyEl.innerHTML = '<div class="rv-empty">這個劇本還沒有玩家評價，期待你來當第一個！🌟</div>';
            return;
        }
        const colors = ['#fff7a8', '#bdeaff', '#ffd0e0', '#c8f7c5', '#ffe0b3', '#e2d4ff'];
        const html = reviews.map((r, i) => {
            const rot = (Math.random() * 4 - 2).toFixed(2);
            const bg = colors[i % colors.length];
            const stars = renderStars(r.rating);
            const meta = [];
            meta.push('<span class="rv-name">' + escapeHtml(r.name) + '</span>');
            if (r.character) meta.push('<span>飾 ' + escapeHtml(r.character) + '</span>');
            if (r.mood) r.mood.split(/[,，、\s]+/).filter(Boolean).forEach(m =>
                meta.push('<span class="rv-mood">' + escapeHtml(m) + '</span>'));
            return '<div class="rv-note" style="--rot:' + rot + 'deg;background:' + bg + '">' +
                (stars ? '<div class="rv-stars">' + stars + '</div>' : '') +
                '<div class="rv-comment">' + escapeHtml(r.comment) + '</div>' +
                '<div class="rv-meta">' + meta.join('') + '</div>' +
            '</div>';
        }).join('');
        bodyEl.innerHTML =
            '<div style="text-align:center;color:rgba(255,255,255,.55);font-size:.82rem;margin-bottom:14px">' +
            '共 ' + reviews.length + ' 則玩家評價</div>' +
            '<div class="rv-grid">' + html + '</div>';
    }

    function renderStars(ratingStr) {
        const n = parseInt(ratingStr, 10);
        if (isNaN(n) || n < 1 || n > 5) return '';
        return '★'.repeat(n) + '☆'.repeat(5 - n);
    }

    // ── CSV 取得（sessionStorage 快取 10 分鐘）────────────────
    async function fetchRows() {
        const CACHE_KEY = 'rv_csv_cache_v1';
        try {
            const cached = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
            if (cached && Date.now() - cached.t < 600000) return parseCSV(cached.csv);
        } catch (_) {}
        const res = await fetch(CSV_URL);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const csv = await res.text();
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), csv })); } catch (_) {}
        return parseCSV(csv);
    }

    // ── 最小 CSV 解析（支援引號、逗號、換行）────────────────
    function parseCSV(text) {
        const rows = [];
        let row = [], field = '', inQuotes = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i];
            if (inQuotes) {
                if (c === '"') {
                    if (text[i + 1] === '"') { field += '"'; i++; }
                    else inQuotes = false;
                } else field += c;
            } else {
                if (c === '"') inQuotes = true;
                else if (c === ',') { row.push(field); field = ''; }
                else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
                else if (c === '\r') { /* skip */ }
                else field += c;
            }
        }
        if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
        if (!rows.length) return [];
        const headers = rows[0].map(h => h.trim());
        return rows.slice(1).filter(r => r.length && r.some(v => v && v.trim()))
            .map(r => {
                const obj = {};
                headers.forEach((h, idx) => { obj[h] = r[idx] != null ? r[idx] : ''; });
                return obj;
            });
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
})();
