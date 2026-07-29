/* ============================================================
   海星劇本殺｜集點系統（榮譽牆共用元件）

   資料來源：Apps Script 的 ?action=summary 端點（JSONP）。
   走 JSONP 而不是 CSV，是因為發布的 CSV 有 5–10 分鐘快取，
   玩家剛送出記錄就會看不到自己的點數。

   點數一律由 Apps Script 計算，這裡只負責顯示。
   彩蛋徽章則相反：判定需要 window.SCRIPTS 的類型資料，
   所以放在前端算，而且它不影響點數，純粹是收集樂趣。
   ============================================================ */
(function () {
    'use strict';

    const ENDPOINT = String(window.STARFISH_PLAY_RECORD_ENDPOINT || '').trim();

    const state = {
        loaded: false,
        ok: false,
        summary: new Map(),   // 歸戶名 → { agent, earned, redeemed, balance, monthEarned, plays, last }
        rewards: [],
        mystery: [],
        doubleDayNote: '',
        monthKey: ''
    };

    /* ── 樣式（跟 reviews.js 一樣自帶，不動榮譽牆原本的 CSS）── */
    const css = `
    .pts-card {
        max-width: 1000px;
        margin: 0 auto 26px;
        padding: 22px 24px 24px;
        border: 1px solid rgba(233, 185, 79, 0.28);
        border-radius: 16px;
        background: linear-gradient(150deg, rgba(46, 34, 18, 0.92), rgba(20, 15, 10, 0.94));
        box-shadow: 0 18px 44px rgba(0, 0, 0, 0.45);
        color: #f2e6cd;
        font-family: '微軟正黑體', sans-serif;
    }
    .pts-card[hidden] { display: none; }

    .pts-head {
        display: flex; flex-wrap: wrap; align-items: baseline;
        justify-content: space-between; gap: 8px 16px;
        padding-bottom: 14px; margin-bottom: 18px;
        border-bottom: 1px solid rgba(233, 185, 79, 0.18);
    }
    .pts-title { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
    .pts-title h3 { margin: 0; font-size: 1.32rem; color: #ffd978; letter-spacing: .04em; }
    .pts-agent {
        font-family: ui-monospace, Menlo, monospace;
        font-size: .9rem; color: #b9aa91; letter-spacing: .1em;
    }
    .pts-name { font-size: 1.05rem; color: #f7ead0; font-weight: 700; }

    .pts-stats { display: flex; flex-wrap: wrap; gap: 10px 30px; margin-bottom: 20px; }
    .pts-stat { display: flex; flex-direction: column; gap: 2px; }
    .pts-stat span { font-size: .78rem; color: #b9aa91; letter-spacing: .1em; }
    .pts-stat b {
        font-size: 1.9rem; line-height: 1.15; font-weight: 700;
        font-variant-numeric: tabular-nums;
    }
    .pts-stat.balance b { color: #ffd978; text-shadow: 0 0 22px rgba(255, 217, 120, .3); }
    .pts-stat:not(.balance) b { font-size: 1.25rem; color: #d9ccb4; }

    .pts-next { margin-bottom: 20px; }
    .pts-next-label {
        display: flex; flex-wrap: wrap; justify-content: space-between;
        gap: 6px 14px; margin-bottom: 8px; font-size: .9rem;
    }
    .pts-next-label b { color: #ffd978; }
    .pts-next-label span { color: #b9aa91; font-variant-numeric: tabular-nums; }
    .pts-bar {
        height: 10px; border-radius: 999px; overflow: hidden;
        background: rgba(255, 255, 255, .08);
    }
    .pts-bar i {
        display: block; height: 100%; border-radius: 999px;
        background: linear-gradient(90deg, #8f6424, #e9b94f 70%, #ffd978);
        transition: width .8s cubic-bezier(.2,.8,.3,1);
    }
    /* 接近下一階時整條發光，最後一哩衝刺 */
    .pts-bar.near i { box-shadow: 0 0 18px rgba(255, 217, 120, .75); }

    .pts-section-title {
        margin: 0 0 12px; font-size: .82rem; letter-spacing: .16em;
        color: #b9aa91; text-transform: uppercase;
    }

    .pts-rewards { display: grid; gap: 8px; margin-bottom: 20px; }
    .pts-reward {
        display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px;
        padding: 10px 14px; border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, .08);
        background: rgba(0, 0, 0, .26);
        font-size: .92rem;
    }
    .pts-reward.ready { border-color: rgba(233, 185, 79, .5); background: rgba(141, 91, 26, .22); }
    .pts-reward-track {
        font-size: .72rem; letter-spacing: .1em; padding: 2px 8px;
        border-radius: 4px; border: 1px solid currentColor; white-space: nowrap;
    }
    .pts-track-保底 { color: #b9aa91; }
    .pts-track-特權 { color: #8ee0a1; }
    .pts-track-榮耀 { color: #ffd978; }
    .pts-track-神秘 { color: #b39ddb; }
    .pts-reward-name { flex: 1; min-width: 120px; }
    .pts-reward-note { width: 100%; font-size: .78rem; color: #9c9080; }
    .pts-reward-cost {
        font-variant-numeric: tabular-nums; white-space: nowrap;
        font-size: .86rem; color: #b9aa91;
    }
    .pts-reward.ready .pts-reward-cost { color: #ffd978; font-weight: 700; }

    .pts-badges { display: flex; flex-wrap: wrap; gap: 8px; }
    .pts-badge {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 7px 13px; border-radius: 999px;
        border: 1px solid rgba(233, 185, 79, .38);
        background: rgba(141, 91, 26, .2);
        font-size: .86rem; color: #f2e6cd; cursor: help;
    }
    .pts-empty { color: #9c9080; font-size: .88rem; margin: 0; }
    .pts-hint { margin: 16px 0 0; font-size: .78rem; color: #8d8272; }

    .pts-greeting {
        margin: -6px 0 18px; font-size: .92rem; color: #d9ccb4;
    }
    .pts-greeting b { color: #ffd978; }

    /* 本月任務：只顯示進度，不給點數 */
    .pts-quests { display: grid; gap: 10px; margin-bottom: 20px; }
    .pts-quest {
        padding: 10px 14px; border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, .08);
        background: rgba(0, 0, 0, .26);
    }
    .pts-quest.done { border-color: rgba(142, 224, 161, .45); background: rgba(40, 90, 55, .22); }
    .pts-quest-top {
        display: flex; flex-wrap: wrap; justify-content: space-between;
        gap: 4px 12px; margin-bottom: 7px; font-size: .9rem;
    }
    .pts-quest-top span { color: #b9aa91; font-variant-numeric: tabular-nums; }
    .pts-quest.done .pts-quest-top span { color: #8ee0a1; }
    .pts-quest-bar { height: 5px; border-radius: 999px; background: rgba(255, 255, 255, .08); overflow: hidden; }
    .pts-quest-bar i {
        display: block; height: 100%; border-radius: 999px;
        background: linear-gradient(90deg, #8f6424, #e9b94f);
    }
    .pts-quest.done .pts-quest-bar i { background: linear-gradient(90deg, #3f8a5c, #8ee0a1); }

    /* 同場戰友 */
    .pts-mates { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
    .pts-mate {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 7px 13px; border-radius: 999px;
        border: 1px solid rgba(255, 255, 255, .14);
        background: rgba(0, 0, 0, .3);
        font-size: .88rem; color: #f2e6cd; cursor: pointer;
        transition: border-color 150ms ease, transform 150ms ease;
    }
    .pts-mate:hover { border-color: rgba(233, 185, 79, .6); transform: translateY(-1px); }
    .pts-mate b { color: #ffd978; font-variant-numeric: tabular-nums; }

    /* 神秘盒開箱紀錄 */
    .pts-mystery { display: grid; gap: 6px; margin-bottom: 20px; }
    .pts-mystery div {
        display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px 12px;
        padding: 8px 14px; border-radius: 8px;
        background: rgba(90, 60, 140, .16);
        border: 1px solid rgba(179, 157, 219, .3);
        font-size: .88rem;
    }
    .pts-mystery span { color: #9c9080; font-size: .8rem; }

    /* ── 榮耀軌 ──────────────────────────────────────────────
       這三種裝飾都是玩家用點數換來的，成本為零但只有網站給得起，
       所以視覺要做得夠有份量。 */

    /* 名字鍍金：金屬光澤沿著文字緩慢流動 */
    .pts-gilded {
        background: linear-gradient(100deg,
            #a87f24 0%, #ffe9a8 36%, #fffaea 46%, #ffe9a8 56%, #a87f24 100%);
        background-size: 240% 100%;
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        color: transparent;
        animation: pts-shimmer 5s linear infinite;
    }
    @keyframes pts-shimmer {
        from { background-position: 240% 0; }
        to { background-position: -240% 0; }
    }

    /* 自訂稱號：做成刻上去的銘牌，跟系統發的稱號區隔開 */
    .pts-custom-title {
        display: inline-block;
        margin-left: 8px;
        padding: 2px 10px;
        border: 1px solid rgba(233, 185, 79, .55);
        border-radius: 3px;
        background: linear-gradient(160deg, rgba(141, 91, 26, .5), rgba(40, 26, 10, .7));
        color: #ffe9a8;
        font-size: .78rem;
        letter-spacing: .06em;
        text-shadow: 0 1px 0 rgba(0, 0, 0, .6);
        vertical-align: middle;
    }

    .pts-legend-mark { margin-left: 6px; filter: drop-shadow(0 0 6px rgba(255, 217, 120, .8)); }

    /* 傳奇殿堂 */
    .pts-hall {
        max-width: 1000px;
        margin: 0 auto 26px;
        padding: 26px 24px 28px;
        border: 1px solid rgba(233, 185, 79, .34);
        border-radius: 16px;
        background:
            radial-gradient(120% 80% at 50% 0%, rgba(141, 91, 26, .34), transparent 62%),
            linear-gradient(180deg, rgba(28, 20, 10, .94), rgba(14, 10, 6, .96));
        box-shadow: 0 20px 50px rgba(0, 0, 0, .5), inset 0 1px 0 rgba(255, 224, 148, .12);
        text-align: center;
        font-family: '微軟正黑體', sans-serif;
    }
    .pts-hall[hidden] { display: none; }
    .pts-hall h3 {
        margin: 0 0 4px;
        font-size: 1.3rem;
        letter-spacing: .22em;
        color: #ffd978;
        text-shadow: 0 0 26px rgba(255, 217, 120, .4);
    }
    .pts-hall p { margin: 0 0 20px; font-size: .82rem; color: #9c9080; letter-spacing: .06em; }
    .pts-hall-names {
        display: flex; flex-wrap: wrap; justify-content: center; gap: 12px 26px;
    }
    .pts-hall-name {
        font-size: 1.45rem;
        font-weight: 700;
        letter-spacing: .08em;
        cursor: pointer;
        transition: transform 180ms ease;
    }
    .pts-hall-name:hover { transform: translateY(-2px); }
    .pts-hall-name small {
        display: block;
        margin-top: 2px;
        font-family: ui-monospace, Menlo, monospace;
        font-size: .68rem;
        font-weight: 400;
        letter-spacing: .14em;
        color: #8d8272;
        -webkit-text-fill-color: #8d8272;
    }

    @media (prefers-reduced-motion: reduce) {
        .pts-gilded { animation: none; background-position: 46% 0; }
    }

    /* 成就卡 */
    .pts-share {
        display: flex; justify-content: center; margin: 4px 0 2px;
    }
    .pts-share button {
        display: inline-flex; align-items: center; gap: 8px;
        padding: 11px 24px; border-radius: 999px;
        border: 1px solid rgba(233, 185, 79, .5);
        background: linear-gradient(145deg, rgba(141, 91, 26, .5), rgba(40, 26, 10, .72));
        color: #ffe9a8; font-size: .95rem; font-weight: 700; cursor: pointer;
        font-family: '微軟正黑體', sans-serif;
        transition: transform 160ms ease, box-shadow 160ms ease;
    }
    .pts-share button:hover {
        transform: translateY(-2px);
        box-shadow: 0 10px 26px rgba(0, 0, 0, .45);
    }
    .pts-share button:disabled { opacity: .5; cursor: default; transform: none; }

    .pts-shot {
        position: fixed; inset: 0; z-index: 10000;
        display: none; align-items: flex-start; justify-content: center;
        padding: 32px 16px; overflow-y: auto;
        background: rgba(6, 4, 9, .88); backdrop-filter: blur(8px);
        font-family: '微軟正黑體', sans-serif;
    }
    .pts-shot.open { display: flex; }
    .pts-shot-inner { width: 100%; max-width: 420px; text-align: center; }
    .pts-shot img {
        width: 100%; height: auto; display: block;
        border-radius: 12px;
        box-shadow: 0 24px 60px rgba(0, 0, 0, .6);
    }
    .pts-shot-actions {
        display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; margin-top: 18px;
    }
    .pts-shot-actions a, .pts-shot-actions button {
        padding: 11px 22px; border-radius: 999px; cursor: pointer;
        font-size: .92rem; font-weight: 700; text-decoration: none;
        border: 1px solid rgba(233, 185, 79, .5);
        background: linear-gradient(145deg, rgba(141, 91, 26, .5), rgba(40, 26, 10, .72));
        color: #ffe9a8; font-family: '微軟正黑體', sans-serif;
    }
    .pts-shot-actions button { border-color: rgba(255,255,255,.2); background: rgba(255,255,255,.08); color: #d9ccb4; }
    .pts-shot-hint { margin: 14px 0 0; font-size: .82rem; color: #9c9080; }

    /* 全站累計案件數 */
    .pts-collective {
        margin: 0 auto 18px; max-width: 1000px; text-align: center;
        color: #b9aa91; font-size: .95rem; font-family: '微軟正黑體', sans-serif;
    }
    .pts-collective b {
        color: #ffd978; font-size: 1.5rem; font-weight: 700;
        font-variant-numeric: tabular-nums; margin: 0 6px;
    }

    .pts-double {
        margin: 0 auto 18px; max-width: 1000px;
        padding: 11px 18px; border-radius: 12px;
        border: 1px solid rgba(233, 185, 79, .42);
        background: linear-gradient(135deg, rgba(141, 91, 26, .34), rgba(70, 43, 13, .24));
        color: #ffd978; font-size: .92rem; text-align: center;
        font-family: '微軟正黑體', sans-serif;
    }

    @media (max-width: 600px) {
        .pts-card { padding: 18px 16px 20px; border-radius: 12px; }
        .pts-stats { gap: 10px 22px; }
        .pts-stat.balance b { font-size: 1.6rem; }
    }
    @media (prefers-reduced-motion: reduce) {
        .pts-bar i { transition: none; }
    }`;

    const styleEl = document.createElement('style');
    styleEl.textContent = css;
    document.head.appendChild(styleEl);

    /* ── 工具 ───────────────────────────────────────────────── */
    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function normalizeName(name) {
        return String(name || '').replace(/\s+/g, '').toLowerCase();
    }

    function parseDate(text) {
        const parts = String(text || '').split(/[\/\-.]/).map((part) => parseInt(part, 10));
        if (parts.length < 3 || parts.some(isNaN)) return null;
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    /* ── 載入點數（JSONP）───────────────────────────────────── */
    function load() {
        if (state.loaded) return Promise.resolve(state);
        state.loaded = true;

        if (!ENDPOINT) return Promise.resolve(state);

        return new Promise((resolve) => {
            const callbackName = 'starfishPointsCb' + Date.now().toString(36);
            const script = document.createElement('script');
            let settled = false;

            const finish = () => {
                if (settled) return;
                settled = true;
                delete window[callbackName];
                script.remove();
                resolve(state);
            };

            window[callbackName] = (payload) => {
                if (payload && payload.ok) {
                    state.ok = true;
                    state.doubleDayNote = payload.doubleDayNote || '';
                    state.monthKey = payload.monthKey || '';
                    state.rewards = Array.isArray(payload.rewards) ? payload.rewards : [];
                    state.mystery = Array.isArray(payload.mystery) ? payload.mystery : [];
                    (payload.summary || []).forEach((item) => {
                        state.summary.set(normalizeName(item.name), item);
                    });
                }
                finish();
            };

            script.src = ENDPOINT +
                (ENDPOINT.includes('?') ? '&' : '?') +
                'action=summary&callback=' + callbackName;
            script.onerror = finish;
            document.head.appendChild(script);

            // 端點沒回應時不要卡住整頁
            setTimeout(finish, 8000);
        });
    }

    function getPlayer(name) {
        return state.summary.get(normalizeName(name)) || null;
    }

    /* ── 彩蛋徽章 ────────────────────────────────────────────
       判定只用榮譽牆已經有的 playRecords 與 window.SCRIPTS，
       不需要額外的資料收集。玩家不會被預告有哪些徽章。 */
    function scriptMetaMap() {
        const map = new Map();
        (window.SCRIPTS || []).forEach((script) => {
            const meta = {
                types: Array.isArray(script.types) ? script.types : [],
                theme: script.theme || ''
            };
            map.set(script.reviewKey || script.name, meta);
            map.set(script.name, meta);
        });
        return map;
    }

    function computeBadges(playerName, playRecords) {
        const records = playRecords[playerName];
        if (!records) return [];

        const meta = scriptMetaMap();
        const badges = [];

        const scriptIds = Object.keys(records);
        const allPlays = [];
        scriptIds.forEach((scriptId) => {
            records[scriptId].forEach((record) => {
                allPlays.push({ scriptId, ...record });
            });
        });

        // 執念：同一本玩三次以上
        const obsessed = scriptIds.filter((id) => records[id].length >= 3);
        if (obsessed.length) {
            badges.push({ icon: '🎭', name: '執念', note: '同一本玩了三次以上：' + obsessed.join('、') });
        }

        // 濫好人：連續三場都給五星
        const rated = allPlays
            .filter((play) => play.date && play.rating)
            .sort((a, b) => (parseDate(a.date) || 0) - (parseDate(b.date) || 0));
        let streak = 0;
        let bestStreak = 0;
        rated.forEach((play) => {
            streak = parseInt(play.rating, 10) === 5 ? streak + 1 : 0;
            bestStreak = Math.max(bestStreak, streak);
        });
        if (bestStreak >= 3) {
            badges.push({ icon: '😇', name: '濫好人', note: '連續 ' + bestStreak + ' 場都給了五星' });
        }

        // 不怕鬼：玩遍所有驚悚類劇本
        const horrorAll = (window.SCRIPTS || []).filter((script) =>
            script.theme === 'horror' || (script.types || []).some((type) => /驚悚|恐怖/.test(type)));
        if (horrorAll.length >= 3) {
            const played = horrorAll.filter((script) =>
                records[script.reviewKey || script.name] || records[script.name]);
            if (played.length === horrorAll.length) {
                badges.push({ icon: '👻', name: '不怕鬼', note: '把所有驚悚本都玩過了' });
            }
        }

        // 雜食動物：玩過五種以上不同標籤
        const typeSet = new Set();
        scriptIds.forEach((id) => {
            const info = meta.get(id);
            if (info) info.types.forEach((type) => typeSet.add(type));
        });
        if (typeSet.size >= 5) {
            badges.push({ icon: '🍱', name: '雜食動物', note: '玩過 ' + typeSet.size + ' 種不同類型的本' });
        }

        // 一日三本：同一天玩了三本以上
        const byDate = {};
        allPlays.forEach((play) => {
            if (!play.date) return;
            byDate[play.date] = (byDate[play.date] || 0) + 1;
        });
        const marathonDate = Object.keys(byDate).find((date) => byDate[date] >= 3);
        if (marathonDate) {
            badges.push({ icon: '🔥', name: '一日三本', note: marathonDate + ' 這天連玩了 ' + byDate[marathonDate] + ' 本' });
        }

        // 開荒者：三本以上是全店第一個玩的
        let pioneered = 0;
        scriptIds.forEach((scriptId) => {
            const mine = records[scriptId]
                .map((record) => parseDate(record.date))
                .filter(Boolean)
                .sort((a, b) => a - b)[0];
            if (!mine) return;

            let isFirst = true;
            for (const other in playRecords) {
                if (other === playerName || !playRecords[other][scriptId]) continue;
                const theirs = playRecords[other][scriptId]
                    .map((record) => parseDate(record.date))
                    .filter(Boolean)
                    .sort((a, b) => a - b)[0];
                if (theirs && theirs < mine) { isFirst = false; break; }
            }
            if (isFirst) pioneered += 1;
        });
        if (pioneered >= 3) {
            badges.push({ icon: '🚩', name: '開荒者', note: '有 ' + pioneered + ' 本是全店第一個玩的' });
        }

        return badges;
    }

    /* ── 同場戰友 ────────────────────────────────────────────
       同一天玩同一本＝同一場。這個關聯早就藏在既有資料裡，
       不需要多收集任何欄位。 */
    function computeTeammates(playerName, playRecords) {
        const mine = playRecords[playerName];
        if (!mine) return [];

        const sessions = new Set();
        Object.keys(mine).forEach((scriptId) => {
            mine[scriptId].forEach((record) => {
                if (record.date) sessions.add(scriptId + '|' + record.date);
            });
        });
        if (!sessions.size) return [];

        const mates = [];
        for (const other in playRecords) {
            if (other === playerName) continue;

            let shared = 0;
            let latest = '';
            let latestValue = 0;

            Object.keys(playRecords[other]).forEach((scriptId) => {
                playRecords[other][scriptId].forEach((record) => {
                    if (!record.date || !sessions.has(scriptId + '|' + record.date)) return;
                    shared += 1;

                    const played = parseDate(record.date);
                    const value = played ? played.getTime() : 0;
                    if (value >= latestValue) { latestValue = value; latest = scriptId; }
                });
            });

            if (shared) mates.push({ name: other, count: shared, latest });
        }

        return mates.sort((a, b) => b.count - a.count).slice(0, 12);
    }

    /* ── 本月任務 ────────────────────────────────────────────
       只顯示進度、不發點數。要發點數就得把判定搬到 Apps Script，
       但那邊沒有劇本類型資料——把 scripts.js 複製一份到試算表
       會變成兩份真相，違反單一資料來源的原則。 */
    function currentMonth() {
        if (state.monthKey) {
            const parts = state.monthKey.split('/').map((part) => parseInt(part, 10));
            if (parts.length === 2 && !parts.some(isNaN)) {
                return { year: parts[0], month: parts[1] - 1 };
            }
        }
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
    }

    function computeQuests(playerName, playRecords) {
        const records = playRecords[playerName];
        if (!records) return [];

        const meta = scriptMetaMap();
        const { year, month } = currentMonth();

        const thisMonth = [];
        const priorScripts = new Set();
        const priorTypes = new Set();

        Object.keys(records).forEach((scriptId) => {
            records[scriptId].forEach((record) => {
                const date = parseDate(record.date);
                const inMonth = date && date.getFullYear() === year && date.getMonth() === month;

                if (inMonth) {
                    thisMonth.push({ scriptId, ...record });
                } else if (date) {
                    priorScripts.add(scriptId);
                    const info = meta.get(scriptId);
                    if (info) info.types.forEach((type) => priorTypes.add(type));
                }
            });
        });

        const freshScripts = new Set();
        const freshTypes = new Set();
        thisMonth.forEach((play) => {
            if (!priorScripts.has(play.scriptId)) freshScripts.add(play.scriptId);
            const info = meta.get(play.scriptId);
            if (info) info.types.forEach((type) => { if (!priorTypes.has(type)) freshTypes.add(type); });
        });

        const longComments = thisMonth.filter((play) =>
            Array.from(String(play.comment || '').replace(/\s+/g, '')).length >= 15).length;

        return [
            { label: '本月完成 3 場', now: thisMonth.length, goal: 3 },
            { label: '本月寫 2 篇 15 字以上的心得', now: longComments, goal: 2 },
            { label: '本月開一本沒玩過的劇本', now: freshScripts.size, goal: 1 },
            { label: '本月碰一種沒玩過的類型', now: freshTypes.size, goal: 1 }
        ];
    }

    /* ── 管家效應：記得玩家上次來是什麼時候 ─────────────────── */
    function greetingFor(playerName, playRecords) {
        const records = playRecords[playerName];
        if (!records) return '';

        let latest = null;
        Object.keys(records).forEach((scriptId) => {
            records[scriptId].forEach((record) => {
                const date = parseDate(record.date);
                if (date && (!latest || date > latest)) latest = date;
            });
        });
        if (!latest) return '';

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const days = Math.round((today - latest) / 86400000);

        if (days <= 0) return '歡迎回來，<b>' + escapeHtml(playerName) + '</b>。今天的記錄已經登記好了。';
        if (days === 1) return '歡迎回來，<b>' + escapeHtml(playerName) + '</b>。昨天那場還記憶猶新吧。';
        if (days <= 14) return '歡迎回來，<b>' + escapeHtml(playerName) + '</b>。上次玩本是 <b>' + days + '</b> 天前。';
        if (days <= 60) return '歡迎回來，<b>' + escapeHtml(playerName) + '</b>。距離上次玩本已經 <b>' + days + '</b> 天了。';
        return '好久不見，<b>' + escapeHtml(playerName) + '</b>。已經 <b>' + days + '</b> 天沒見到你了，這段時間開了不少新本。';
    }

    /* ── 全站累計案件數（集體使命感）────────────────────────── */
    function totalSessions(playRecords) {
        const seen = new Set();
        for (const name in playRecords) {
            for (const scriptId in playRecords[name]) {
                playRecords[name][scriptId].forEach((record) => {
                    seen.add(name + '|' + scriptId + '|' + (record.date || ''));
                });
            }
        }
        return seen.size;
    }

    function renderCollective(container, playRecords) {
        if (!container) return;
        const total = totalSessions(playRecords);
        if (!total) return;
        const players = Object.keys(playRecords).length;
        container.innerHTML = '海星的探員們已經累計破解<b>' + total + '</b>起案件，' +
            '共 <b>' + players + '</b> 位夥伴參與其中';
        container.hidden = false;
    }

    /**
     * 傳奇殿堂：只列出用 500 點兌換過「傳奇殿堂留名」的玩家。
     * 沒有人達標時整個區塊不出現——空的殿堂比沒有殿堂更難看。
     */
    function renderLegendHall(container) {
        if (!container) return;

        const legends = Array.from(state.summary.values())
            .filter((player) => player.legend)
            .sort((a, b) => b.earned - a.earned);

        if (!legends.length) {
            container.hidden = true;
            return;
        }

        container.innerHTML =
            '<h3>傳 奇 殿 堂</h3>' +
            '<p>用 500 點換來的永久席位</p>' +
            '<div class="pts-hall-names">' +
                legends.map((player) =>
                    '<span class="pts-hall-name pts-gilded" data-player="' + escapeHtml(player.name) + '">' +
                        escapeHtml(player.name) +
                        '<small>' + escapeHtml(player.agent || '') + '</small>' +
                    '</span>').join('') +
            '</div>';

        container.hidden = false;

        container.querySelectorAll('.pts-hall-name').forEach((el) => {
            el.addEventListener('click', () => {
                if (typeof state.onSelectPlayer === 'function') {
                    state.onSelectPlayer(el.dataset.player);
                }
            });
        });
    }

    /* ── 成就卡產圖 ──────────────────────────────────────────
       設計方向「案卷編錄」：把玩家的遊玩史當成檔案館裡的標本記錄。
       深墨底、單一金色重音、大量留白；資訊靠痕跡的累積傳達而非文字——
       每一格是一本劇本，填滿代表玩過、空框代表還沒碰，
       收藏的缺口一眼看得出來。文字一律壓到最小，只留必要的標籤。 */

    const CARD = {
        width: 1080,
        minHeight: 1000,
        margin: 84,
        ink: '#0d0a11',
        inkWarm: '#17110b',
        gold: '#d9a844',
        goldBright: '#ffe9a8',
        cream: '#f2e6cd',
        muted: '#6f6858',
        hairline: 'rgba(233, 185, 79, 0.24)',
        serif: '"Noto Serif TC", "Songti TC", Georgia, serif',
        sans: '"PingFang TC", "Microsoft JhengHei", system-ui, sans-serif',
        mono: 'ui-monospace, Menlo, monospace'
    };

    /** 逐字繪製以精確控制字距，順便避開瀏覽器對 ctx.letterSpacing 的支援差異。 */
    function trackedText(ctx, text, x, y, tracking, align) {
        const chars = Array.from(String(text || ''));
        if (!chars.length) return 0;

        const widths = chars.map((char) => ctx.measureText(char).width);
        const total = widths.reduce((sum, w) => sum + w, 0) + tracking * (chars.length - 1);

        let cursor = x;
        if (align === 'center') cursor = x - total / 2;
        else if (align === 'right') cursor = x - total;

        chars.forEach((char, index) => {
            ctx.fillText(char, cursor, y);
            cursor += widths[index] + tracking;
        });

        return total;
    }

    function drawAchievementCard(playerName, playRecords, options) {
        const settings = options || {};
        const player = getPlayer(playerName);
        const badges = computeBadges(playerName, playRecords);
        const records = playRecords[playerName] || {};

        const M = CARD.margin;
        const W = CARD.width;
        const innerWidth = W - M * 2;
        const centerX = W / 2;

        // ── 先算版面再決定畫布高度 ──────────────────────────
        // 固定成 4:5 的話，劇本數少的玩家底部會空一大片，構圖整個垮掉。
        // 讓內容決定框的高度，卡片永遠是滿的。
        const titles = [];
        if (settings.title) titles.push(settings.title);
        if (player && player.title) titles.push(player.title);
        if (player && player.legend) titles.push('傳奇殿堂');

        const allScripts = (window.SCRIPTS || []);
        const total = allScripts.length || Object.keys(records).length;
        const cleared = allScripts.length
            ? allScripts.filter((script) => records[script.reviewKey || script.name] || records[script.name]).length
            : Object.keys(records).length;

        const perRow = 20;
        const gap = 12;
        const cellW = (innerWidth - gap * (perRow - 1)) / perRow;
        const cellH = Math.min(Math.max(Math.round(cellW * 1.25), 38), 70);
        const rows = Math.max(1, Math.ceil(total / perRow));
        const hasBadges = badges.length > 0;

        const eyebrowY = M + 44;
        const topRuleY = eyebrowY + 34;
        const agentY = topRuleY + 150;
        const nameY = agentY + 84;
        const titleY = titles.length ? nameY + 50 : nameY;
        const recordLabelY = titleY + 78;
        const gridTop = recordLabelY + 24;
        const midRuleY = gridTop + rows * (cellH + gap) + 44;
        const statLabelY = midRuleY + 52;
        const statValueY = statLabelY + 56;
        const lowRuleY = statLabelY + 104;
        const badgeLabelY = lowRuleY + 46;
        const badgeChipY = badgeLabelY + 42;
        const contentBottom = hasBadges ? badgeChipY + 18 : lowRuleY;

        const height = Math.max(CARD.minHeight, Math.round(contentBottom + 96 + M));
        const footY = height - M - 8;

        const canvas = document.createElement('canvas');
        canvas.width = W;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        // ── 底：墨色縱向漸層，靠近底部微微轉暖 ──────────────
        const ground = ctx.createLinearGradient(0, 0, 0, height);
        ground.addColorStop(0, CARD.ink);
        ground.addColorStop(0.62, '#110d13');
        ground.addColorStop(1, CARD.inkWarm);
        ctx.fillStyle = ground;
        ctx.fillRect(0, 0, W, height);

        // 頂部一圈極淡的暈光，讓大字有立足點
        const halo = ctx.createRadialGradient(centerX, 190, 0, centerX, 190, 620);
        halo.addColorStop(0, 'rgba(217, 168, 68, 0.13)');
        halo.addColorStop(1, 'rgba(217, 168, 68, 0)');
        ctx.fillStyle = halo;
        ctx.fillRect(0, 0, W, 820);

        // ── 檔案框與四角定位標記 ────────────────────────────
        ctx.strokeStyle = CARD.hairline;
        ctx.lineWidth = 1;
        ctx.strokeRect(M - 26, M - 26, innerWidth + 52, height - (M - 26) * 2);

        const tick = 16;
        ctx.strokeStyle = 'rgba(233, 185, 79, 0.5)';
        [[M - 26, M - 26, 1, 1], [W - M + 26, M - 26, -1, 1],
         [M - 26, height - M + 26, 1, -1], [W - M + 26, height - M + 26, -1, -1]]
            .forEach(function (corner) {
                const x = corner[0], cy = corner[1], dx = corner[2], dy = corner[3];
                ctx.beginPath();
                ctx.moveTo(x + dx * tick, cy);
                ctx.lineTo(x, cy);
                ctx.lineTo(x, cy + dy * tick);
                ctx.stroke();
            });

        ctx.textBaseline = 'alphabetic';

        // ── 眉標 ────────────────────────────────────────────
        ctx.fillStyle = CARD.muted;
        ctx.font = '400 19px ' + CARD.sans;
        trackedText(ctx, '海星劇本殺　探員檔案', centerX, eyebrowY, 9, 'center');

        ctx.strokeStyle = CARD.hairline;
        ctx.beginPath();
        ctx.moveTo(M, topRuleY);
        ctx.lineTo(W - M, topRuleY);
        ctx.stroke();

        // ── 主角：探員編號 ──────────────────────────────────
        ctx.fillStyle = CARD.gold;
        ctx.font = '200 148px ' + CARD.mono;
        ctx.shadowColor = 'rgba(255, 233, 168, 0.34)';
        ctx.shadowBlur = 44;
        trackedText(ctx, player && player.agent ? player.agent : '#—', centerX, agentY, 10, 'center');
        ctx.shadowBlur = 0;

        // ── 玩家名 ──────────────────────────────────────────
        ctx.fillStyle = player && player.gilded ? CARD.goldBright : CARD.cream;
        ctx.font = '600 62px ' + CARD.serif;
        trackedText(ctx, playerName, centerX, nameY, 6, 'center');

        // ── 稱號（系統稱號 + 自訂稱號 + 傳奇殿堂）────────────
        if (titles.length) {
            ctx.font = '400 22px ' + CARD.sans;
            ctx.fillStyle = CARD.gold;
            trackedText(ctx, titles.join('　·　'), centerX, titleY, 4, 'center');
        }

        // ── 案件記錄：填滿＝玩過，空框＝還沒碰 ──────────────
        ctx.fillStyle = CARD.muted;
        ctx.font = '400 17px ' + CARD.sans;
        trackedText(ctx, '案件記錄', M, recordLabelY, 7, 'left');

        ctx.fillStyle = CARD.cream;
        ctx.font = '400 19px ' + CARD.mono;
        trackedText(ctx, cleared + ' / ' + total, W - M, recordLabelY, 3, 'right');

        // 已玩的排在前面，讓填滿的區塊聚成一片，缺口才讀得出來
        for (let i = 0; i < total; i++) {
            const cx = M + (i % perRow) * (cellW + gap);
            const cy = gridTop + Math.floor(i / perRow) * (cellH + gap);

            if (i < cleared) {
                const fill = ctx.createLinearGradient(cx, cy, cx, cy + cellH);
                fill.addColorStop(0, CARD.goldBright);
                fill.addColorStop(1, CARD.gold);
                ctx.fillStyle = fill;
                ctx.fillRect(cx, cy, cellW, cellH);
            } else {
                ctx.strokeStyle = 'rgba(233, 185, 79, 0.2)';
                ctx.lineWidth = 1;
                ctx.strokeRect(cx + 0.5, cy + 0.5, cellW - 1, cellH - 1);
            }
        }

        // ── 三欄數據 ────────────────────────────────────────
        ctx.strokeStyle = CARD.hairline;
        ctx.beginPath();
        ctx.moveTo(M, midRuleY);
        ctx.lineTo(W - M, midRuleY);
        ctx.stroke();

        [['場次', player ? player.plays : Object.keys(records).length],
         ['累積點數', player ? player.earned : '—'],
         ['徽章', badges.length]].forEach(function (stat, index) {
            const x = M + innerWidth * (index * 2 + 1) / 6;

            ctx.fillStyle = CARD.muted;
            ctx.font = '400 16px ' + CARD.sans;
            trackedText(ctx, stat[0], x, statLabelY, 6, 'center');

            ctx.fillStyle = CARD.cream;
            ctx.font = '300 52px ' + CARD.mono;
            trackedText(ctx, String(stat[1]), x, statValueY, 2, 'center');
        });

        ctx.strokeStyle = CARD.hairline;
        ctx.beginPath();
        ctx.moveTo(M, lowRuleY);
        ctx.lineTo(W - M, lowRuleY);
        ctx.stroke();

        // ── 徽章 ────────────────────────────────────────────
        if (hasBadges) {
            ctx.fillStyle = CARD.muted;
            ctx.font = '400 17px ' + CARD.sans;
            trackedText(ctx, '彩蛋徽章', M, badgeLabelY, 7, 'left');

            ctx.font = '400 26px ' + CARD.sans;
            let cursorX = M;
            badges.forEach(function (badge) {
                const label = badge.icon + ' ' + badge.name;
                const chipWidth = ctx.measureText(label).width + 34;
                if (cursorX + chipWidth > W - M) return;

                ctx.strokeStyle = 'rgba(233, 185, 79, 0.32)';
                ctx.lineWidth = 1;
                roundRect(ctx, cursorX, badgeChipY - 28, chipWidth, 46, 23);
                ctx.stroke();

                ctx.fillStyle = CARD.cream;
                ctx.fillText(label, cursorX + 17, badgeChipY + 1);
                cursorX += chipWidth + 12;
            });
        }

        // ── 頁腳 ────────────────────────────────────────────
        ctx.fillStyle = CARD.muted;
        ctx.font = '400 16px ' + CARD.mono;
        trackedText(ctx, new Date().toISOString().slice(0, 10).replace(/-/g, '.'), M, footY, 4, 'left');
        trackedText(ctx, 'STARFISH LARP', W - M, footY, 5, 'right');

        return canvas;
    }

    function roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }

    /** 本月場次，給排行榜的「本月榜」使用。 */
    function monthlyPlays(playerName, playRecords) {
        const records = playRecords[playerName];
        if (!records) return 0;

        const { year, month } = currentMonth();
        let count = 0;
        Object.keys(records).forEach((scriptId) => {
            records[scriptId].forEach((record) => {
                const date = parseDate(record.date);
                if (date && date.getFullYear() === year && date.getMonth() === month) count += 1;
            });
        });
        return count;
    }

    /* ── 渲染 ────────────────────────────────────────────────── */
    function renderProfile(container, playerName, playRecords) {
        if (!container) return;

        if (!playerName) {
            container.hidden = true;
            container.innerHTML = '';
            return;
        }

        container.hidden = false;
        const player = getPlayer(playerName);
        const badges = computeBadges(playerName, playRecords);

        const safeName = escapeHtml(playerName);
        const agent = player && player.agent ? escapeHtml(player.agent) : '';

        // 榮耀軌裝飾：鍍金、自訂稱號、傳奇殿堂標記
        const nameHtml =
            '<span class="pts-name' + (player && player.gilded ? ' pts-gilded' : '') + '">' +
                safeName +
            '</span>' +
            (player && player.legend ? '<span class="pts-legend-mark">👑</span>' : '') +
            (player && player.title
                ? '<span class="pts-custom-title">' + escapeHtml(player.title) + '</span>'
                : '');

        let statsHtml;
        let rewardsHtml;

        if (player) {
            statsHtml =
                '<div class="pts-stats">' +
                    '<div class="pts-stat balance"><span>可用點數</span><b>' + player.balance + '</b></div>' +
                    '<div class="pts-stat"><span>累積獲得</span><b>' + player.earned + '</b></div>' +
                    '<div class="pts-stat"><span>已兌換</span><b>' + player.redeemed + '</b></div>' +
                    '<div class="pts-stat"><span>場次</span><b>' + player.plays + '</b></div>' +
                '</div>' +
                renderNextGoal(player.balance);

            rewardsHtml = renderRewards(player.balance);
        } else if (state.ok) {
            statsHtml = '<p class="pts-empty">這個名字還沒有點數記錄。' +
                '如果你之前用別的名字登記過，可以跟海星說一聲合併起來。</p>';
            rewardsHtml = renderRewards(0);
        } else {
            statsHtml = '<p class="pts-empty">點數服務暫時讀不到，稍後再試。' +
                '下面的徽章與場次仍然是正確的。</p>';
            rewardsHtml = '';
        }

        const badgeHtml = badges.length
            ? '<div class="pts-badges">' + badges.map((badge) =>
                '<span class="pts-badge" title="' + escapeHtml(badge.note) + '">' +
                badge.icon + ' ' + escapeHtml(badge.name) + '</span>').join('') + '</div>'
            : '<p class="pts-empty">還沒有解鎖任何徽章。它們不會事先公告，玩著玩著就會跳出來。</p>';

        const greeting = greetingFor(playerName, playRecords);
        const mates = computeTeammates(playerName, playRecords);
        const quests = computeQuests(playerName, playRecords);
        const opened = state.mystery.filter((item) => normalizeName(item.name) === normalizeName(playerName));

        container.innerHTML =
            '<div class="pts-head">' +
                '<div class="pts-title">' +
                    '<h3>探員檔案</h3>' +
                    (agent ? '<span class="pts-agent">' + agent + '</span>' : '') +
                '</div>' +
                '<span class="pts-name-wrap">' + nameHtml + '</span>' +
            '</div>' +
            (greeting ? '<p class="pts-greeting">' + greeting + '</p>' : '') +
            statsHtml +
            renderQuests(quests) +
            rewardsHtml +
            renderMystery(opened) +
            renderMates(mates) +
            '<p class="pts-section-title">彩蛋徽章</p>' +
            badgeHtml +
            '<div class="pts-share"><button type="button">🪪 產生我的成就卡</button></div>' +
            '<p class="pts-hint">兌換請直接跟現場的海星說，點數會由 GM 手動核銷。</p>';

        // 點戰友的名字就切換到對方的檔案
        container.querySelectorAll('.pts-mate').forEach((chip) => {
            chip.addEventListener('click', () => {
                if (typeof state.onSelectPlayer === 'function') {
                    state.onSelectPlayer(chip.dataset.player);
                }
            });
        });

        container.querySelector('.pts-share button').addEventListener('click', (event) => {
            openAchievementCard(playerName, playRecords, event.currentTarget);
        });
    }

    /* ── 成就卡預覽與下載 ────────────────────────────────── */
    function openAchievementCard(playerName, playRecords, button) {
        button.disabled = true;
        button.textContent = '繪製中…';

        // 讓瀏覽器先把按鈕狀態畫出來再開始畫圖，避免整頁卡住沒有回饋
        setTimeout(() => {
            try {
                const title = typeof state.titleResolver === 'function'
                    ? state.titleResolver(playerName)
                    : '';
                const canvas = drawAchievementCard(playerName, playRecords, { title });

                canvas.toBlob((blob) => {
                    showAchievementOverlay(blob, playerName);
                    button.disabled = false;
                    button.textContent = '🪪 產生我的成就卡';
                }, 'image/png');
            } catch (error) {
                console.error('成就卡繪製失敗:', error);
                button.disabled = false;
                button.textContent = '🪪 產生我的成就卡';
            }
        }, 30);
    }

    function showAchievementOverlay(blob, playerName) {
        const url = URL.createObjectURL(blob);

        let overlay = document.querySelector('.pts-shot');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'pts-shot';
            overlay.innerHTML =
                '<div class="pts-shot-inner">' +
                    '<img alt="成就卡">' +
                    '<div class="pts-shot-actions">' +
                        '<a download>下載圖片</a>' +
                        '<button type="button">關閉</button>' +
                    '</div>' +
                    '<p class="pts-shot-hint">手機長按圖片也可以直接存下來</p>' +
                '</div>';
            document.body.appendChild(overlay);

            const close = () => {
                overlay.classList.remove('open');
                document.body.style.overflow = '';
                const previous = overlay.querySelector('img').src;
                if (previous.startsWith('blob:')) URL.revokeObjectURL(previous);
            };

            overlay.querySelector('button').addEventListener('click', close);
            overlay.addEventListener('click', (event) => {
                if (event.target === overlay) close();
            });
            document.addEventListener('keydown', (event) => {
                if (event.key === 'Escape' && overlay.classList.contains('open')) close();
            });
        }

        const image = overlay.querySelector('img');
        if (image.src && image.src.startsWith('blob:')) URL.revokeObjectURL(image.src);
        image.src = url;

        const link = overlay.querySelector('a');
        link.href = url;
        link.download = '海星探員檔案-' + playerName + '.png';

        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function renderQuests(quests) {
        if (!quests.length) return '';

        const items = quests.map((quest) => {
            const done = quest.now >= quest.goal;
            const percent = Math.min(quest.now / quest.goal, 1) * 100;
            return '<div class="pts-quest' + (done ? ' done' : '') + '">' +
                '<div class="pts-quest-top">' +
                    '<b>' + (done ? '✓ ' : '') + escapeHtml(quest.label) + '</b>' +
                    '<span>' + Math.min(quest.now, quest.goal) + ' / ' + quest.goal + '</span>' +
                '</div>' +
                '<div class="pts-quest-bar"><i style="width:' + percent.toFixed(0) + '%"></i></div>' +
            '</div>';
        }).join('');

        return '<p class="pts-section-title">本月任務</p>' +
            '<div class="pts-quests">' + items + '</div>';
    }

    function renderMates(mates) {
        if (!mates.length) return '';

        const chips = mates.map((mate) =>
            '<span class="pts-mate" data-player="' + escapeHtml(mate.name) + '" ' +
            'title="一起玩過 ' + mate.count + ' 場，最近一次是《' + escapeHtml(mate.latest) + '》">' +
            escapeHtml(mate.name) + ' <b>' + mate.count + '</b></span>').join('');

        return '<p class="pts-section-title">同場戰友</p>' +
            '<div class="pts-mates">' + chips + '</div>';
    }

    function renderMystery(opened) {
        if (!opened.length) return '';

        const items = opened.slice().reverse().map((item) =>
            '<div><b>🎁 ' + escapeHtml(item.prize) + '</b><span>' + escapeHtml(item.date) + '</span></div>'
        ).join('');

        return '<p class="pts-section-title">神秘盒紀錄</p>' +
            '<div class="pts-mystery">' + items + '</div>';
    }

    function renderNextGoal(balance) {
        const upcoming = state.rewards
            .filter((reward) => reward.cost > balance)
            .sort((a, b) => a.cost - b.cost)[0];

        if (!upcoming) {
            if (!state.rewards.length) return '';
            return '<div class="pts-next"><div class="pts-next-label">' +
                '<b>所有獎勵都在兌換範圍內了</b>' +
                '<span>去跟海星換一個吧</span></div></div>';
        }

        const previous = state.rewards
            .filter((reward) => reward.cost <= balance)
            .sort((a, b) => b.cost - a.cost)[0];
        const floor = previous ? previous.cost : 0;
        const span = Math.max(upcoming.cost - floor, 1);
        const percent = Math.min(Math.max((balance - floor) / span, 0), 1) * 100;
        const remaining = upcoming.cost - balance;

        return '<div class="pts-next">' +
            '<div class="pts-next-label">' +
                '<b>下一個目標：' + escapeHtml(upcoming.name) + '</b>' +
                '<span>還差 ' + remaining + ' 點</span>' +
            '</div>' +
            '<div class="pts-bar' + (remaining <= 20 ? ' near' : '') + '">' +
                '<i style="width:' + percent.toFixed(1) + '%"></i>' +
            '</div>' +
        '</div>';
    }

    function renderRewards(balance) {
        if (!state.rewards.length) return '';

        const items = state.rewards
            .slice()
            .sort((a, b) => a.cost - b.cost)
            .map((reward) => {
                const ready = balance >= reward.cost;
                const track = escapeHtml(reward.track || '');
                return '<div class="pts-reward' + (ready ? ' ready' : '') + '">' +
                    (track ? '<span class="pts-reward-track pts-track-' + track + '">' + track + '</span>' : '') +
                    '<span class="pts-reward-name">' + (ready ? '✅ ' : '🔒 ') + escapeHtml(reward.name) + '</span>' +
                    '<span class="pts-reward-cost">' + reward.cost + ' 點' +
                        (ready ? '' : '（還差 ' + (reward.cost - balance) + '）') + '</span>' +
                    (reward.note ? '<span class="pts-reward-note">' + escapeHtml(reward.note) + '</span>' : '') +
                '</div>';
            }).join('');

        return '<p class="pts-section-title">兌換清單</p>' +
            '<div class="pts-rewards">' + items + '</div>';
    }

    function renderDoubleDay(container) {
        if (!container || !state.doubleDayNote) return;
        container.textContent = '⚡ ' + state.doubleDayNote;
        container.hidden = false;
    }

    window.StarfishPoints = {
        load: load,
        getPlayer: getPlayer,
        renderProfile: renderProfile,
        renderDoubleDay: renderDoubleDay,
        renderCollective: renderCollective,
        renderLegendHall: renderLegendHall,
        computeBadges: computeBadges,
        monthlyPlays: monthlyPlays,
        isReady: function () { return state.ok; },
        // 榮譽牆用它接手「點戰友名字就跳到對方檔案」的行為
        setPlayerSelectHandler: function (handler) { state.onSelectPlayer = handler; },
        // 稱號規則留在榮譽牆（單一來源），成就卡透過這個取用，避免兩邊各寫一套門檻
        setTitleResolver: function (resolver) { state.titleResolver = resolver; }
    };
})();
