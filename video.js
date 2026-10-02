/* ============================================================
   劇本介紹影片（共用元件）
   - 讀 scripts.js 裡該劇本的 youtube 欄位，有填才出現「▶ 介紹影片」按鈕
   - 點了才載入 YouTube 播放器（不拖慢劇本頁的 3D 背景與 BGM）
   - 播放時暫停 BGM，關閉影片後恢復
   劇本對應：用目前頁面路徑比對 scripts.js 的 file 欄位
   版號：video.js?v= 必須與 scripts.js?v= 相同（會用同一個版號載入 scripts.js）
   youtube 欄位可填影片 ID（11 碼）或整串網址（watch / youtu.be / shorts 皆可）
   ============================================================ */
(function () {
    'use strict';

    const SELF_SCRIPT = document.currentScript ||
        document.querySelector('script[src*="video.js"]');

    function scriptsUrl() {
        if (!SELF_SCRIPT || !SELF_SCRIPT.src) return '';
        // 劇本頁的 video.js?v= 與 scripts.js?v= 用同一個版號，
        // 所以直接沿用自己的版號去載 scripts.js，不必另外維護
        const m = SELF_SCRIPT.src.match(/video\.js\?(?:[^#]*&)?v=([^&#]+)/);
        return SELF_SCRIPT.src.replace(/video\.js(\?.*)?$/, 'scripts.js' + (m ? '?v=' + m[1] : ''));
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

    /** 回傳 { id, vertical }；欄位空白或格式不對回傳 null。 */
    function parseYoutube(value) {
        const raw = String(value || '').trim();
        if (!raw) return null;
        if (/^[\w-]{11}$/.test(raw)) return { id: raw, vertical: false };
        const m = raw.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
        if (!m) return null;
        return { id: m[1], vertical: /\/shorts\//.test(raw) };
    }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function mount(script, video) {
        const css = `
        .vd-fab {
            position: fixed; right: 20px; bottom: 140px; z-index: 9998;
            display: flex; align-items: center; gap: 8px;
            padding: 12px 18px; border: none; border-radius: 30px;
            background: linear-gradient(135deg, #ff4e50, #c4122f);
            color: #fff; font-size: .95rem; font-weight: 700; cursor: pointer;
            box-shadow: 0 8px 24px rgba(0,0,0,.4);
            font-family: '微軟正黑體', sans-serif;
            transition: transform .2s, box-shadow .2s;
            animation: vd-pulse 2.6s ease-in-out infinite;
        }
        .vd-fab:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 12px 32px rgba(0,0,0,.5); }
        @keyframes vd-pulse {
            0%, 100% { box-shadow: 0 8px 24px rgba(0,0,0,.4), 0 0 0 0 rgba(255,78,80,.55); }
            50%      { box-shadow: 0 8px 24px rgba(0,0,0,.4), 0 0 0 10px rgba(255,78,80,0); }
        }
        @media (prefers-reduced-motion: reduce) { .vd-fab { animation: none; } }
        .vd-overlay {
            position: fixed; inset: 0; z-index: 9999;
            background: rgba(6,5,10,.86); backdrop-filter: blur(6px);
            display: none; align-items: center; justify-content: center;
            padding: 24px 16px;
            font-family: '微軟正黑體', sans-serif;
        }
        .vd-overlay.open { display: flex; animation: vd-fade .25s ease; }
        @keyframes vd-fade { from { opacity: 0; } to { opacity: 1; } }
        .vd-panel { position: relative; width: 100%; max-width: 960px; }
        .vd-panel.vd-vertical { max-width: min(420px, calc((100vh - 140px) * 9 / 16)); }
        .vd-head {
            display: flex; align-items: center; justify-content: space-between; gap: 12px;
            margin-bottom: 12px; color: #fff;
        }
        .vd-head h2 { margin: 0; font-size: 1.15rem; font-weight: 700; line-height: 1.4; }
        .vd-close {
            flex: none; width: 38px; height: 38px; border-radius: 50%;
            border: none; cursor: pointer; font-size: 1.2rem;
            background: rgba(255,255,255,.12); color: #fff;
            transition: background .2s, transform .2s;
        }
        .vd-close:hover { background: rgba(255,255,255,.25); transform: rotate(90deg); }
        .vd-frame {
            position: relative; width: 100%; aspect-ratio: 16 / 9;
            border-radius: 12px; overflow: hidden; background: #000;
            box-shadow: 0 30px 70px rgba(0,0,0,.6);
        }
        .vd-vertical .vd-frame { aspect-ratio: 9 / 16; }
        .vd-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; }
        .vd-link {
            display: inline-block; margin-top: 12px;
            color: rgba(255,255,255,.7); font-size: .85rem; text-decoration: none;
        }
        .vd-link:hover { color: #fff; text-decoration: underline; }
        @media (max-width: 600px) {
            .vd-fab { right: 14px; bottom: 128px; padding: 10px 15px; font-size: .85rem; }
            .vd-head h2 { font-size: 1rem; }
        }`;
        const styleEl = document.createElement('style');
        styleEl.textContent = css;
        document.head.appendChild(styleEl);

        const fab = document.createElement('button');
        fab.className = 'vd-fab';
        fab.type = 'button';
        fab.innerHTML = '▶ 介紹影片';
        document.body.appendChild(fab);

        const watchUrl = video.vertical
            ? 'https://www.youtube.com/shorts/' + video.id
            : 'https://www.youtube.com/watch?v=' + video.id;

        const overlay = document.createElement('div');
        overlay.className = 'vd-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.innerHTML =
            '<div class="vd-panel' + (video.vertical ? ' vd-vertical' : '') + '">' +
                '<div class="vd-head"><h2>' + escapeHtml(script.name) + '｜劇本介紹</h2>' +
                '<button class="vd-close" type="button" aria-label="關閉">✕</button></div>' +
                '<div class="vd-frame"></div>' +
                '<a class="vd-link" href="' + watchUrl + '" target="_blank" rel="noopener">在 YouTube 觀看・訂閱頻道 ↗</a>' +
            '</div>';
        document.body.appendChild(overlay);

        const frame = overlay.querySelector('.vd-frame');
        const bgm = document.getElementById('bgm');
        let resumeBgm = false;

        function openModal() {
            // 播放器每次開啟才建立、關閉就移除，關掉影片聲音一定會停
            frame.innerHTML = '<iframe src="https://www.youtube-nocookie.com/embed/' + video.id +
                '?autoplay=1&rel=0&playsinline=1" title="' + escapeHtml(script.name) + ' 劇本介紹影片"' +
                ' allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
            overlay.classList.add('open');
            document.body.style.overflow = 'hidden';
            if (bgm && !bgm.paused) {
                resumeBgm = true;
                try { bgm.pause(); } catch (_) {}
            }
        }
        function closeModal() {
            if (!overlay.classList.contains('open')) return;
            overlay.classList.remove('open');
            frame.innerHTML = '';
            document.body.style.overflow = '';
            if (bgm && resumeBgm) {
                resumeBgm = false;
                const p = bgm.play();
                if (p && p.catch) p.catch(() => {});
            }
        }
        fab.addEventListener('click', openModal);
        overlay.querySelector('.vd-close').addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
    }

    function init() {
        loadScripts().then((list) => {
            const script = findCurrentScript(list);
            const video = script && parseYoutube(script.youtube);
            if (!video) return;
            mount(script, video);
            // 首頁卡片的「▶ 影片」連到 劇本頁#video，進來直接打開影片
            if (location.hash === '#video') document.querySelector('.vd-fab').click();
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})();
