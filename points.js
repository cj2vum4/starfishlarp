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
        summary: new Map(),   // 歸戶名 → { agent, earned, redeemed, balance, plays, last }
        rewards: [],
        doubleDayNote: ''
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
                    state.rewards = Array.isArray(payload.rewards) ? payload.rewards : [];
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

        container.innerHTML =
            '<div class="pts-head">' +
                '<div class="pts-title">' +
                    '<h3>探員檔案</h3>' +
                    (agent ? '<span class="pts-agent">' + agent + '</span>' : '') +
                '</div>' +
                '<span class="pts-name">' + safeName + '</span>' +
            '</div>' +
            statsHtml +
            rewardsHtml +
            '<p class="pts-section-title">彩蛋徽章</p>' +
            badgeHtml +
            '<p class="pts-hint">兌換請直接跟現場的海星說，點數會由 GM 手動核銷。</p>';
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
        computeBadges: computeBadges,
        isReady: function () { return state.ok; }
    };
})();
