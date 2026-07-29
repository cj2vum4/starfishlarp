(function () {
    'use strict';

    const endpoint = String(window.STARFISH_PLAY_RECORD_ENDPOINT || '').trim();
    const sourceScripts = Array.isArray(window.SCRIPTS) ? window.SCRIPTS : [];

    const scripts = sourceScripts
        .filter((script) =>
            script &&
            script.name &&
            Array.isArray(script.characters) &&
            script.characters.length > 0
        )
        .map((script) => ({
            id: script.id,
            label: script.name,
            // 保留舊榮譽牆資料鍵，避免既有「拆遷2」記錄失去對應；
            // 使用者介面仍統一顯示「拆遷2買房」。
            value: script.reviewKey || script.name,
            roles: Array.from(new Set(
                script.characters
                    .map((role) => String(role || '').trim())
                    .filter(Boolean)
            ))
        }))
        .sort((a, b) => {
            const aLength = Array.from(a.label.replace(/\s+/g, '')).length;
            const bLength = Array.from(b.label.replace(/\s+/g, '')).length;
            const lengthDifference = aLength - bLength;

            if (lengthDifference !== 0) return lengthDifference;

            return a.label.localeCompare(b.label, 'zh-Hant', {
                numeric: true,
                sensitivity: 'base'
            });
        });

    const form = document.getElementById('playRecordForm');
    const scriptSelect = document.getElementById('scriptSelect');
    const roleField = document.getElementById('roleField');
    const roleLegend = document.getElementById('roleLegend');
    const roleOptions = document.getElementById('roleOptions');
    const roleLoadStatus = document.getElementById('roleLoadStatus');
    const playDate = document.getElementById('playDate');
    const playerName = document.getElementById('playerName');
    const comment = document.getElementById('comment');
    const commentCount = document.getElementById('commentCount');
    const referrer = document.getElementById('referrer');
    const formStatus = document.getElementById('formStatus');
    const submitButton = document.getElementById('submitButton');
    const successPanel = document.getElementById('successPanel');
    const successNote = document.getElementById('successNote');
    const awardCard = document.getElementById('awardCard');
    const awardPoints = document.getElementById('awardPoints');
    const awardDetail = document.getElementById('awardDetail');
    const doubleDayNote = document.getElementById('doubleDayNote');
    const addAnotherButton = document.getElementById('addAnotherButton');
    const setupNote = document.getElementById('setupNote');
    const website = document.getElementById('website');

    const configById = new Map(scripts.map((script) => [script.id, script]));

    function getLocalDateString() {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        return new Date(now.getTime() - offset).toISOString().slice(0, 10);
    }

    function formatSheetDate(value) {
        const parts = String(value || '').split('-');
        if (parts.length !== 3) return value;
        return `${parts[0]}/${Number(parts[1])}/${Number(parts[2])}`;
    }

    function setDefaultDate() {
        const today = getLocalDateString();
        playDate.max = today;
        if (!playDate.value) playDate.value = today;
    }

    function showError(message) {
        formStatus.textContent = message;
        formStatus.hidden = false;
    }

    function clearError() {
        formStatus.textContent = '';
        formStatus.hidden = true;
    }

    function setSubmitting(isSubmitting) {
        submitButton.disabled = isSubmitting;
        submitButton.querySelector('span').textContent = isSubmitting
            ? '正在送出…'
            : '送出玩本記錄';
    }

    function resetRoleChoices(message) {
        roleField.disabled = true;
        roleLegend.textContent = '飾演的角色 *';
        roleOptions.replaceChildren();

        const placeholder = document.createElement('p');
        placeholder.className = 'role-placeholder';
        placeholder.textContent = message || '先選擇劇本，這裡就會出現角色。';
        roleOptions.appendChild(placeholder);

        roleLoadStatus.textContent = scripts.length
            ? '尚未選擇劇本'
            : '找不到可用的劇本角色資料';
        roleLoadStatus.classList.remove('ready');
    }

    function renderRoleChoices(script) {
        roleOptions.replaceChildren();
        roleLegend.textContent = `《${script.label}》飾演的角色 *`;

        script.roles.forEach((role, index) => {
            const label = document.createElement('label');
            label.className = 'role-choice';

            const input = document.createElement('input');
            input.type = 'radio';
            input.id = `role-${script.id}-${index}`;
            input.name = 'character';
            input.value = role;
            input.required = true;

            const text = document.createElement('span');
            text.textContent = role;

            label.append(input, text);
            roleOptions.appendChild(label);
        });

        roleField.disabled = false;
        roleLoadStatus.textContent = `已載入 ${script.roles.length} 個角色選項`;
        roleLoadStatus.classList.add('ready');
    }

    function populateScripts() {
        scripts.forEach((script) => {
            const option = document.createElement('option');
            option.value = script.id;
            option.textContent = script.label;
            scriptSelect.appendChild(option);
        });

        if (scripts.length) {
            roleLoadStatus.textContent = `已載入 ${scripts.length} 本劇本`;
        } else {
            resetRoleChoices('首頁劇本資料尚未載入，請重新整理頁面。');
            scriptSelect.disabled = true;
            showError('無法載入首頁劇本資料，請重新整理後再試。');
        }
    }

    function buildPayload(script) {
        const selectedRole = form.querySelector('input[name="character"]:checked');
        const selectedRating = form.querySelector('input[name="rating"]:checked');

        return {
            timestamp: new Date().toISOString(),
            name: playerName.value.trim(),
            date: formatSheetDate(playDate.value),
            script: script.value,
            scriptLabel: script.label,
            character: selectedRole ? selectedRole.value : '',
            rating: selectedRating ? selectedRating.value : '',
            comment: comment.value.trim(),
            referrer: referrer.value.trim(),
            website: website.value
        };
    }

    async function postRecord(payload) {
        const body = new URLSearchParams();
        Object.entries(payload).forEach(([key, value]) => {
            body.set(key, String(value == null ? '' : value));
        });

        let serverError = null;

        // 先用一般請求送出。Apps Script 會 302 轉到 googleusercontent.com，
        // 那個回應帶著 CORS 標頭，所以這條路徑讀得到得點明細。
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                cache: 'no-store',
                body
            });

            if (response.ok) {
                const result = await response.json();
                if (result && result.ok === false) {
                    serverError = new Error(result.error || '寫入失敗');
                } else {
                    return (result && result.award) || null;
                }
            }
        } catch (error) {
            // 部分瀏覽器或網路環境會擋掉跨域讀取。此時資料通常已經送達，
            // 但無法確認，所以下面用 no-cors 再送一次以免漏記錄。
            // Apps Script 端以「玩家＋劇本＋日期」去重，重送的那筆只會留下記錄、不會重複給點。
            console.warn('無法讀取送出結果，改用 no-cors 重送:', error);
        }

        // 伺服器明確拒絕（例如驗證失敗）就不要重送，直接讓使用者看到原因。
        if (serverError) throw serverError;

        await fetch(endpoint, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-store',
            body
        });

        return null;
    }

    function completeSubmission(award) {
        const points = award ? Number(award.points) : 0;

        if (points > 0) {
            awardPoints.textContent = '+' + points;
            awardDetail.textContent = award.detail ? award.detail.replace(/＋/g, '　＋　') : '';
            awardCard.hidden = false;
            successNote.textContent = '點數已入帳，榮譽牆上的探員檔案同時更新了。';
        } else {
            awardCard.hidden = true;
            successNote.textContent =
                '謝謝你留下這次的角色與心得。點數與榮譽牆會在幾分鐘內同步。';
        }

        form.hidden = true;
        successPanel.hidden = false;
        successPanel.focus();
    }

    /** 用 JSONP 讀雙倍點數日文案：靜態網站跨網域讀 Apps Script 最穩的方式。 */
    function loadDoubleDayNote() {
        if (!endpoint) return;

        const callbackName = 'starfishPoints' + Date.now().toString(36);
        const script = document.createElement('script');
        const cleanup = () => {
            delete window[callbackName];
            script.remove();
        };

        window[callbackName] = (payload) => {
            cleanup();
            const note = payload && payload.doubleDayNote;
            if (!note) return;
            doubleDayNote.textContent = '⚡ ' + note;
            doubleDayNote.hidden = false;
        };

        script.src = endpoint +
            (endpoint.includes('?') ? '&' : '?') +
            'action=summary&callback=' + callbackName;
        script.onerror = cleanup;
        document.head.appendChild(script);
    }

    scriptSelect.addEventListener('change', () => {
        clearError();
        const script = configById.get(scriptSelect.value);
        if (script) renderRoleChoices(script);
        else resetRoleChoices();
    });

    comment.addEventListener('input', () => {
        commentCount.textContent = `${comment.value.length} / 50`;
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearError();

        if (!endpoint) {
            showError('目前尚未設定試算表寫入網址，暫時無法送出。');
            setupNote.hidden = false;
            return;
        }

        if (navigator.onLine === false) {
            showError('目前沒有網路連線。請連線後再送出，避免記錄遺失。');
            return;
        }

        if (website.value) {
            // 蜜罐欄位：機器人填寫時直接偽裝成功，不寫入資料。
            completeSubmission();
            return;
        }

        const script = configById.get(scriptSelect.value);
        if (!script) {
            showError('請先選擇玩過的劇本。');
            scriptSelect.focus();
            return;
        }

        if (playDate.value > playDate.max) {
            showError('遊玩日期不能晚於今天。');
            playDate.focus();
            return;
        }

        if (!form.checkValidity()) {
            form.reportValidity();
            showError('還有必填欄位尚未完成，請檢查後再送出。');
            return;
        }

        const payload = buildPayload(script);
        setSubmitting(true);

        try {
            const award = await postRecord(payload);
            try {
                localStorage.setItem('starfishlarp-player-name', payload.name);
            } catch (_) {
                // 無痕模式可能停用 localStorage，不影響送出。
            }
            completeSubmission(award);
        } catch (error) {
            console.error('送出玩本記錄失敗:', error);
            showError(error.message || '送出失敗，請確認網路連線後再試一次。');
            setSubmitting(false);
        }
    });

    addAnotherButton.addEventListener('click', () => {
        const savedName = playerName.value;
        form.reset();
        resetRoleChoices();
        commentCount.textContent = '0 / 50';
        clearError();
        setDefaultDate();
        playerName.value = savedName;
        setSubmitting(false);
        awardCard.hidden = true;
        successPanel.hidden = true;
        form.hidden = false;
        scriptSelect.focus();
    });

    populateScripts();
    resetRoleChoices();
    setDefaultDate();
    loadDoubleDayNote();

    if (!endpoint) setupNote.hidden = false;

    try {
        playerName.value = localStorage.getItem('starfishlarp-player-name') || '';
    } catch (_) {
        // 記住名稱是非必要功能。
    }
})();