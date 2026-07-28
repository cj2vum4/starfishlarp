/* 劇本資料：單一來源 window.SCRIPTS（定義於 scripts.js）。
   新增/修改劇本請改 scripts.js，不要在這裡維護資料。 */

/* 標籤同義詞：同一個概念在 scripts.js 裡有不同寫法，
   篩選是精確字串比對，不對齊就會漏本
   （例：篩「新手」會漏掉 5 本標為「新手友善」的劇本）。
   卡片上仍顯示原始標籤文字，這裡只影響篩選比對。 */
const TYPE_ALIASES = {
    '新手友善': ['新手'],
    '微恐怖': ['微恐'],
    '繁化': ['繁體'],
    '進階可玩': ['進階'],
    '硬核推理': ['硬核', '推理'],
    '日式推理': ['日式', '推理'],
    '恐怖': ['驚悚']
};

function normalizeTypes(types) {
    const normalized = new Set();
    (types || []).forEach(type => {
        (TYPE_ALIASES[type] || [type]).forEach(t => normalized.add(t));
    });
    return Array.from(normalized);
}

const scripts = (window.SCRIPTS || []).map(script => Object.assign({}, script, {
    // 篩選專用的標籤清單；script.types 保持原樣供卡片顯示
    filterTypes: normalizeTypes(script.types)
}));

    // DOM載入後執行的初始化函式
    document.addEventListener('DOMContentLoaded', () => {
        renderCards();
        // 綁定篩選事件監聽
        document.getElementById('playerFilter').addEventListener('change', () => {
            updateAvailableOptions();
            filterScripts();
        });
        document.getElementById('typeFilter').addEventListener('change', () => {
            updateAvailableOptions();
            filterScripts();
        });
        document.getElementById('difficultyFilter').addEventListener('change', () => {
            updateAvailableOptions();
            filterScripts();
        });
        
        // 綁定搜索事件監聽
        document.getElementById('searchInput').addEventListener('input', () => {
            filterScripts();
        });
        
        // 綁定排序事件監聽
        document.getElementById('sortFilter').addEventListener('change', () => {
            sortScripts();
        });
        
        // 初始化可用選項和篩選
        updateAvailableOptions();
        filterScripts();
        applyStaggerAnimationWithinTwoSeconds();
    });
    
    // 更新可用選項的函式
    function updateAvailableOptions() {
        const playerFilter = document.getElementById('playerFilter').value;
        const typeFilter = document.getElementById('typeFilter').value;
        const difficultyFilter = document.getElementById('difficultyFilter').value;
        
        // 根據當前篩選條件找出符合的劇本
        let filteredScripts = scripts.filter(script => {
            let match = true;
            if (playerFilter && script.players != playerFilter) match = false;
            if (typeFilter && !script.filterTypes.includes(typeFilter)) match = false;
            if (difficultyFilter && script.difficulty != difficultyFilter) match = false;
            return match;
        });
        
        // 更新人數選項
        updatePlayerOptions(filteredScripts, typeFilter, difficultyFilter);
        
        // 更新類型選項
        updateTypeOptions(filteredScripts, playerFilter, difficultyFilter);
        
        // 更新難度選項
        updateDifficultyOptions(filteredScripts, playerFilter, typeFilter);
        
        // 更新篩選結果數量
        updateFilteredCount(filteredScripts.length);
    }
    
    // 更新人數選項
    function updatePlayerOptions(baseScripts, typeFilter, difficultyFilter) {
        const playerSelect = document.getElementById('playerFilter');
        const currentValue = playerSelect.value;
        
        // 找出在其他條件下可用的人數
        let availablePlayers = new Set();
        scripts.forEach(script => {
            let match = true;
            if (typeFilter && !script.filterTypes.includes(typeFilter)) match = false;
            if (difficultyFilter && script.difficulty != difficultyFilter) match = false;
            if (match) {
                availablePlayers.add(script.players);
            }
        });
        
        // 更新選項
        const options = playerSelect.querySelectorAll('option');
        options.forEach(option => {
            if (option.value === '') return; // 保留"全部人數"選項
            const playerCount = parseInt(option.value);
            if (availablePlayers.has(playerCount)) {
                option.style.display = 'block';
                option.disabled = false;
            } else {
                option.style.display = 'none';
                option.disabled = true;
            }
        });
        
        // 如果當前選擇的選項不可用，清空選擇
        if (currentValue && !availablePlayers.has(parseInt(currentValue))) {
            playerSelect.value = '';
        }
    }
    
    // 更新類型選項
    function updateTypeOptions(baseScripts, playerFilter, difficultyFilter) {
        const typeSelect = document.getElementById('typeFilter');
        const currentValue = typeSelect.value;
        
        // 找出在其他條件下可用的類型
        let availableTypes = new Set();
        scripts.forEach(script => {
            let match = true;
            if (playerFilter && script.players != playerFilter) match = false;
            if (difficultyFilter && script.difficulty != difficultyFilter) match = false;
            if (match) {
                script.filterTypes.forEach(type => availableTypes.add(type));
            }
        });
        
        // 更新選項
        const options = typeSelect.querySelectorAll('option');
        options.forEach(option => {
            if (option.value === '') return; // 保留"全部類型"選項
            if (availableTypes.has(option.value)) {
                option.style.display = 'block';
                option.disabled = false;
            } else {
                option.style.display = 'none';
                option.disabled = true;
            }
        });
        
        // 如果當前選擇的選項不可用，清空選擇
        if (currentValue && !availableTypes.has(currentValue)) {
            typeSelect.value = '';
        }
    }
    
    // 更新難度選項
    function updateDifficultyOptions(baseScripts, playerFilter, typeFilter) {
        const difficultySelect = document.getElementById('difficultyFilter');
        const currentValue = difficultySelect.value;
        
        // 找出在其他條件下可用的難度
        let availableDifficulties = new Set();
        scripts.forEach(script => {
            let match = true;
            if (playerFilter && script.players != playerFilter) match = false;
            if (typeFilter && !script.filterTypes.includes(typeFilter)) match = false;
            if (match) {
                availableDifficulties.add(script.difficulty);
            }
        });
        
        // 更新選項
        const options = difficultySelect.querySelectorAll('option');
        options.forEach(option => {
            if (option.value === '') return; // 保留"全部難度"選項
            const difficulty = parseInt(option.value);
            if (availableDifficulties.has(difficulty)) {
                option.style.display = 'block';
                option.disabled = false;
            } else {
                option.style.display = 'none';
                option.disabled = true;
            }
        });
        
        // 如果當前選擇的選項不可用，清空選擇
        if (currentValue && !availableDifficulties.has(parseInt(currentValue))) {
            difficultySelect.value = '';
        }
    }

    // 解析 CSS 時間字串為秒數（支援 s / ms）
    function parseCssTimeToSeconds(timeString) {
        if (!timeString) return 0;
        const first = String(timeString).split(',')[0].trim();
        if (first.endsWith('ms')) return parseFloat(first) / 1000;
        if (first.endsWith('s')) return parseFloat(first);
        const val = parseFloat(first);
        return isNaN(val) ? 0 : val;
    }

    // 將可見的卡片動畫錯開時間壓縮在 2 秒內完成顯示
    // 首次進場與篩選/排序共用：cardIn 淡入上移，全部在 2 秒內錯開播完
    function applyStaggerAnimationWithinTwoSeconds() {
        const container = document.getElementById('scriptsGrid');
        if (!container) return;
        const visibleCards = Array.from(container.querySelectorAll('.script-card'))
            .filter(card => !card.classList.contains('hidden'));
        if (visibleCards.length === 0) return;

        // 先關掉動畫再 reflow，讓 cardIn 可重新播放（篩選/排序重播）
        visibleCards.forEach(card => { card.style.animation = 'none'; });
        void container.offsetWidth;
        visibleCards.forEach(card => { card.style.animation = ''; });

        const durationSec = parseCssTimeToSeconds(getComputedStyle(visibleCards[0]).animationDuration);
        const maxTotalSec = 2; // 最晚在 2 秒內完成（含動畫本身的時間）
        const latestStartSec = Math.max(0, maxTotalSec - durationSec);
        const stepSec = visibleCards.length > 1 ? (latestStartSec / (visibleCards.length - 1)) : 0;

        visibleCards.forEach((card, index) => {
            card.style.animationDelay = (index * stepSec).toFixed(3) + 's';
            card.style.animationPlayState = 'running';
        });
    }

    // 篩選功能
    function filterScripts() {
        const playerFilter = document.getElementById('playerFilter').value;
        const typeFilter = document.getElementById('typeFilter').value;
        const difficultyFilter = document.getElementById('difficultyFilter').value;
        const searchQuery = document.getElementById('searchInput').value.toLowerCase();
        
        const scriptCards = document.querySelectorAll('.script-card');
        const noResultsEl = document.getElementById('noResults');
        let visibleCount = 0;

        scriptCards.forEach(card => {
            const players = card.dataset.players;
            const types = card.dataset.types.split(',');
            const difficulty = card.dataset.difficulty;
            const title = card.querySelector('.script-title').textContent.toLowerCase();
            
            let shouldShow = true;
            if (playerFilter && players !== playerFilter) {
                shouldShow = false;
            }
            if (typeFilter && !types.includes(typeFilter)) {
                shouldShow = false;
            }
            if (difficultyFilter && difficulty !== difficultyFilter) {
                shouldShow = false;
            }
            if (searchQuery && !title.includes(searchQuery)) {
                shouldShow = false;
            }
            
            if (shouldShow) {
                card.classList.remove('hidden');
                visibleCount++;
            } else {
                card.classList.add('hidden');
            }
        });

        // 根據 visibleCount 決定是否顯示 "查無結果"
        if (visibleCount === 0) {
            noResultsEl.classList.remove('hidden');
        } else {
            noResultsEl.classList.add('hidden');
        }
        
        // 更新篩選結果數量
        updateFilteredCount(visibleCount);
        // 重新計算動畫延遲，確保可見卡片在 2 秒內完成顯示
        applyStaggerAnimationWithinTwoSeconds();
    }

    // 更新篩選結果數量
    function updateFilteredCount(count) {
        const filteredCountEl = document.getElementById('filteredCount');
        if (filteredCountEl) {
            filteredCountEl.textContent = count;
        }
    }

    // 重置篩選函式
    function resetFilters() {
        document.getElementById('playerFilter').value = '';
        document.getElementById('typeFilter').value = '';
        document.getElementById('difficultyFilter').value = '';
        document.getElementById('searchInput').value = '';
        document.getElementById('sortFilter').value = 'default';
        updateAvailableOptions();
        filterScripts();
        sortScripts();
    }

    // 前往指定頁面的函式
    function goToPage(filename) {
        window.location.href = filename;
    }

    // 排序功能
    // 以 scripts 陣列為排序依據（而非目前的 DOM 順序），
    // 「預設順序」才能真的還原成 scripts.js 的原始排列。
    // 排序涵蓋全部卡片（含被篩選隱藏的），避免先排序再篩選與
    // 先篩選再排序得到不同結果。
    function sortScripts() {
        const sortType = document.getElementById('sortFilter').value;
        const scriptsGrid = document.getElementById('scriptsGrid');
        if (!scriptsGrid) return;

        const cardById = new Map(
            Array.from(scriptsGrid.querySelectorAll('.script-card'))
                 .map(card => [card.dataset.id, card])
        );

        const ordered = scripts.slice().sort((a, b) => {
            switch (sortType) {
                case 'name':       return a.name.localeCompare(b.name, 'zh-TW');
                case 'difficulty': return a.difficulty - b.difficulty;
                case 'time':       return a.time - b.time;
                case 'players':    return a.players - b.players;
                default:           return 0;   // 維持 scripts.js 的原始順序
            }
        });

        ordered.forEach(script => {
            const card = cardById.get(script.id);
            if (card) scriptsGrid.appendChild(card);
        });

        // 重新計算動畫延遲，確保可見卡片在 2 秒內完成顯示
        applyStaggerAnimationWithinTwoSeconds();
    }

    // 前往劇本詳細頁面的函式
    function goToScript(scriptId) {
        const script = scripts.find(s => s.id === scriptId);
        if (script && script.file) {
            window.location.href = script.file;
        } else {
            console.error('找不到ID為 ' + scriptId + ' 的劇本檔案。');
            alert('抱歉，找不到該劇本的詳細介紹頁面。');
        }
    }

// Dynamically generate card DOM from scripts data
function renderCards() {
    const grid = document.getElementById('scriptsGrid');
    if (!grid) return;
    grid.innerHTML = scripts.map(s => {
        const img    = s.poster || '';
        const badgeData = [
            '👥 ' + (s.playersLabel || (s.players + '人')),
            '⏰ ' + (s.timeLabel || (s.time + '小時')),
            '⭐ ' + s.difficulty + '星',
        ];
        const badges = badgeData.map(b => `<span class="info-badge">${b}</span>`).join('');
        const types  = s.types.map(t => `<span class="type-tag">${t}</span>`).join('');
        return `<article class="script-card" data-id="${s.id}" data-theme="${s.theme}" data-players="${s.players}" data-types="${s.filterTypes.join(',')}" data-difficulty="${s.difficulty}">
            <div class="card-media">
                <img src="${img}" alt="${s.name}" class="script-image" loading="lazy">
                <span class="corner-diff">${s.players}人</span>
            </div>
            <div class="card-body">
                <h3 class="script-title">${s.name}</h3>
                <div class="script-info">${badges}</div>
                <div class="script-types">${types}</div>
                <button class="detail-btn" onclick="goToScript('${s.id}')">查看詳情 →</button>
            </div>
        </article>`;
    }).join('\n');
}
