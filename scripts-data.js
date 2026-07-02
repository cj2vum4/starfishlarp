/* 劇本資料：單一來源 window.SCRIPTS（定義於 scripts.js）。
   新增/修改劇本請改 scripts.js，不要在這裡維護資料。 */
const scripts = (window.SCRIPTS || []);

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
            if (typeFilter && !script.types.includes(typeFilter)) match = false;
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
            if (typeFilter && !script.types.includes(typeFilter)) match = false;
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
                script.types.forEach(type => availableTypes.add(type));
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
            if (typeFilter && !script.types.includes(typeFilter)) match = false;
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
    // 首次進場：每張卡各自進視野時 3D 飛入集結；之後（篩選/排序）沿用 2 秒錯開淡入
    // idle → running（IO 掛上後，重播路徑只處理 dataset.flown 的卡）
    let entranceState = 'idle';

    function applyStaggerAnimationWithinTwoSeconds() {
        const container = document.getElementById('scriptsGrid');
        if (!container) return;
        const cards = Array.from(container.querySelectorAll('.script-card'));
        const visibleCards = cards.filter(card => !card.classList.contains('hidden'));
        if (visibleCards.length === 0) return;

        if (entranceState === 'idle') {
            entranceState = 'running';
            setupPerCardEntrance(cards);
            return;
        }

        // 篩選/排序：只重播「已經飛入過」的卡片；還沒飛的交給各自的 IO
        const flownCards = visibleCards.filter(card => card.dataset.flown === '1');
        if (flownCards.length === 0) return;
        flownCards.forEach(card => {
            card.style.animation = '';
            card.style.opacity = '';
        });
        void container.offsetWidth; // 強制 reflow 讓動畫可重播

        const durationSec = parseCssTimeToSeconds(getComputedStyle(flownCards[0]).animationDuration);
        const maxTotalSec = 2; // 最晚在 2 秒內完成（含動畫本身的時間）
        const latestStartSec = Math.max(0, maxTotalSec - durationSec);
        const stepSec = flownCards.length > 1 ? (latestStartSec / (flownCards.length - 1)) : 0;

        flownCards.forEach((card, index) => {
            card.style.animationDelay = (index * stepSec).toFixed(3) + 's';
            card.style.animationPlayState = 'running';
        });
    }

    // 每張卡片各自進入視野時才 3D 飛入集結——效果跟著捲動一路發生，
    // 手機/桌機都看得到（整片網格一次觸發的話，畫面外的卡會在看不到時播完）
    function setupPerCardEntrance(cards) {
        if (!('IntersectionObserver' in window)) {
            cards.forEach(card => flyInCard(card, 0));
            return;
        }
        const io = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                io.unobserve(entry.target);
                // 同一批進視野的卡片用隨機相位錯開
                flyInCard(entry.target, Math.random() * 0.4);
            });
        }, { threshold: 0.05, rootMargin: '0px 0px -6% 0px' });
        cards.forEach(card => io.observe(card));
    }

    // 單張卡片：凌亂 3D 飛入 → 歸位
    function flyInCard(card, extraDelay) {
        const mobile = window.matchMedia('(max-width: 768px)').matches;
        // 手機不用 blur（低階機 filter 動畫吃效能），但距離/翻轉保持明顯
        const X = mobile ? 40 : 46;   // ±vw
        const Y = mobile ? 30 : 34;   // ±vh
        const Zmin = mobile ? -520 : -680, Zspan = mobile ? 800 : 1040;
        const R = mobile ? 38 : 42;   // ±deg（X/Y 軸翻轉）

        const set = (k, v) => card.style.setProperty(k, v);
        set('--fx', (Math.random() * X * 2 - X).toFixed(1) + 'vw');
        set('--fy', (Math.random() * Y * 2 - Y).toFixed(1) + 'vh');
        set('--fz', (Zmin + Math.random() * Zspan).toFixed(0) + 'px');
        set('--frx', (Math.random() * R * 2 - R).toFixed(1) + 'deg');
        set('--fry', (Math.random() * R * 2 - R).toFixed(1) + 'deg');
        set('--frz', (Math.random() * 36 - 18).toFixed(1) + 'deg');
        set('--fdur', (mobile ? 1.0 + Math.random() * 0.6 : 1.35 + Math.random() * 1.0).toFixed(2) + 's');
        set('--fdelay', (extraDelay || 0).toFixed(2) + 's');
        set('--fblur', mobile ? '0px' : '9px');

        card.classList.add('fly-in');
        card.addEventListener('animationend', function onEnd(e) {
            if (e.animationName !== 'cardAssemble') return;
            card.removeEventListener('animationend', onEnd);
            card.classList.remove('fly-in');
            card.dataset.flown = '1';
            // 蓋掉底層 cardIn(paused)，避免卡片又隱形；之後篩選重播時會清回來
            card.style.animation = 'none';
            card.style.opacity = '1';
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
    function sortScripts() {
        const sortType = document.getElementById('sortFilter').value;
        const scriptCards = Array.from(document.querySelectorAll('.script-card:not(.hidden)'));
        const scriptsGrid = document.getElementById('scriptsGrid');
        
        if (sortType === 'default') {
            // 恢復原始順序
            scriptCards.forEach(card => {
                scriptsGrid.appendChild(card);
            });
            return;
        }
        
        scriptCards.sort((a, b) => {
            switch (sortType) {
                case 'name':
                    const nameA = a.querySelector('.script-title').textContent;
                    const nameB = b.querySelector('.script-title').textContent;
                    return nameA.localeCompare(nameB, 'zh-TW');
                    
                case 'difficulty':
                    const diffA = parseInt(a.dataset.difficulty);
                    const diffB = parseInt(b.dataset.difficulty);
                    return diffA - diffB;
                    
                case 'time':
                    const timeA = parseFloat(a.querySelector('.info-badge:nth-child(2)').textContent.replace('⏰ ', '').replace('小時', ''));
                    const timeB = parseFloat(b.querySelector('.info-badge:nth-child(2)').textContent.replace('⏰ ', '').replace('小時', ''));
                    return timeA - timeB;
                    
                case 'players':
                    const playersA = parseInt(a.dataset.players);
                    const playersB = parseInt(b.dataset.players);
                    return playersA - playersB;
                    
                default:
                    return 0;
            }
        });
        
        // 重新排列卡片
        scriptCards.forEach(card => {
            scriptsGrid.appendChild(card);
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
        return `<article class="script-card" data-theme="${s.theme}" data-players="${s.players}" data-types="${s.types.join(',')}" data-difficulty="${s.difficulty}">
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
