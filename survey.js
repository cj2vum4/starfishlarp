/**
 * 海星劇本殺｜角色分配問卷引擎（所有劇本問卷共用）
 *
 * 問卷頁只要：
 *   1. 放一個 <div id="survey"></div>
 *   2. 用 window.SURVEY 寫題目（見 問卷/奉天1928.html）
 *   3. 載入本檔 <script src="../survey.js?v=日期"></script>
 * 外觀用 CSS 變數調整（--sv-accent / --sv-text / --sv-muted / --sv-card / --sv-border / --sv-field），
 * 每頁自己決定背景與氛圍。
 *
 * window.SURVEY = {
 *   script: '奉天1928',            // 總表分頁名稱（通常＝scripts.js 的 reviewKey）
 *   questions: [
 *     { type: 'text' | 'textarea', title, desc?, required?, placeholder? },
 *     { type: 'radio' | 'checkbox', title, options: [...], other?: true, required? },
 *     { type: 'scale', title, min: 1, max: 5, minLabel, maxLabel, required? },
 *     { type: 'date', title, required? },
 *     { type: 'info', title, desc? },               // 純說明文字（情境敘述、分段標題），不收答案
 *   ],
 *   任一題可加 showIf: { title: '某題題目', in: ['選項A'] }，該題答案在清單內才顯示（分支題組）；
 *   隱藏的題目不檢查必填、也不送出。
 *   assign: function (answers) { return { '建議角色': '…' }; },  // 選填：依答案算角色，結果一起存進總表
 *   done: { title: '…', text: '…', link?: { href, text } },   // 送出後畫面
 * };
 * answers 以題目文字為鍵：answers['您的生理性別是？'] === '男'
 */
(function () {
    'use strict';

    // 部署 GoogleAppsScript_角色問卷.gs 後，把 /exec 網址貼在這裡（所有問卷共用）
    var SURVEY_ENDPOINT = 'https://script.google.com/macros/s/AKfycbx5Fyc528P0kL6sdNAdNcYElbQj8xhJb7dkIm0khATVeRizzouNcI04MGhcrmBUxiHM/exec';

    var config = window.SURVEY;
    var root = document.getElementById('survey');
    if (!config || !root) return;

    var endpoint = config.endpoint || SURVEY_ENDPOINT;
    var draftKey = 'starfish-survey-draft:' + config.script;

    injectStyle();

    var form = document.createElement('form');
    form.className = 'sv-form';
    form.noValidate = true;
    form.autocomplete = 'off';

    config.questions.forEach(function (q, i) {
        form.appendChild(renderQuestion(q, i));
    });

    // 蜜罐：給機器人填的，真人看不到
    var trap = document.createElement('input');
    trap.name = 'website';
    trap.tabIndex = -1;
    trap.setAttribute('aria-hidden', 'true');
    trap.className = 'sv-trap';
    form.appendChild(trap);

    var status = el('p', 'sv-status');
    status.setAttribute('role', 'alert');
    var submit = el('button', 'sv-submit', config.submitText || '送出');
    submit.type = 'submit';
    form.appendChild(submit);
    form.appendChild(status);

    var done = el('div', 'sv-done');
    done.hidden = true;
    var doneTitle = el('h2', 'sv-done-title', (config.done && config.done.title) || '已收到你的回覆');
    var doneExtra = el('div', 'sv-done-extra');
    var doneText = el('p', 'sv-done-text', (config.done && config.done.text) || '角色將由主持人分配，當天見！');
    done.appendChild(doneTitle);
    done.appendChild(doneExtra);
    done.appendChild(doneText);
    if (config.done && config.done.link) {
        var doneLink = el('a', 'sv-done-link', config.done.link.text);
        doneLink.href = config.done.link.href;
        doneLink.target = '_blank';
        doneLink.rel = 'noopener';
        done.appendChild(doneLink);
    }

    root.appendChild(form);
    root.appendChild(done);

    restoreDraft();
    updateVisibility();
    form.addEventListener('input', saveDraft);
    form.addEventListener('change', saveDraft);
    form.addEventListener('change', updateVisibility);
    form.addEventListener('submit', onSubmit);

    // ── 題目 ────────────────────────────────────────────────

    function renderQuestion(q, index) {
        if (q.type === 'info') {
            var info = el('section', 'sv-q sv-info');
            info.dataset.index = index;
            if (q.title) info.appendChild(el('h2', 'sv-info-title', q.title));
            if (q.desc) info.appendChild(el('p', 'sv-desc', q.desc));
            return info;
        }
        var box = el('fieldset', 'sv-q');
        box.dataset.index = index;
        var legend = el('legend', 'sv-title', q.title);
        if (q.required) {
            var star = el('span', 'sv-required', ' *');
            star.setAttribute('aria-label', '必填');
            legend.appendChild(star);
        }
        box.appendChild(legend);
        if (q.desc) box.appendChild(el('p', 'sv-desc', q.desc));

        var name = 'q' + index;
        if (q.type === 'text' || q.type === 'textarea' || q.type === 'date') {
            var input = document.createElement(q.type === 'textarea' ? 'textarea' : 'input');
            input.name = name;
            input.className = 'sv-input';
            if (q.type === 'textarea') input.rows = 4;
            else input.type = q.type;
            input.placeholder = q.placeholder || '你的回答';
            input.setAttribute('aria-label', q.title);
            box.appendChild(input);
        } else if (q.type === 'radio' || q.type === 'checkbox') {
            var list = el('div', 'sv-options');
            q.options.forEach(function (opt) {
                list.appendChild(choice(q.type, name, opt, opt));
            });
            if (q.other) {
                var otherLabel = choice(q.type, name, '__other__', '其他：');
                var otherText = document.createElement('input');
                otherText.type = 'text';
                otherText.name = name + '-other';
                otherText.className = 'sv-input sv-other';
                otherText.setAttribute('aria-label', '其他');
                otherText.addEventListener('input', function () {
                    otherLabel.querySelector('input').checked = otherText.value.trim() !== '';
                });
                otherLabel.appendChild(otherText);
                list.appendChild(otherLabel);
            }
            box.appendChild(list);
        } else if (q.type === 'scale') {
            var scale = el('div', 'sv-scale');
            var min = q.min == null ? 1 : q.min;
            var max = q.max == null ? 5 : q.max;
            if (q.minLabel) scale.appendChild(el('span', 'sv-scale-label', q.minLabel));
            var dots = el('div', 'sv-scale-dots');
            for (var v = min; v <= max; v++) {
                var dot = el('label', 'sv-scale-dot');
                var r = document.createElement('input');
                r.type = 'radio';
                r.name = name;
                r.value = String(v);
                dot.appendChild(r);
                dot.appendChild(el('span', '', String(v)));
                dots.appendChild(dot);
            }
            scale.appendChild(dots);
            if (q.maxLabel) scale.appendChild(el('span', 'sv-scale-label', q.maxLabel));
            box.appendChild(scale);
        }
        box.appendChild(el('p', 'sv-error', ''));
        return box;
    }

    function choice(type, name, value, text) {
        var label = el('label', 'sv-choice');
        var input = document.createElement('input');
        input.type = type;
        input.name = name;
        input.value = value;
        label.appendChild(input);
        label.appendChild(el('span', '', text));
        return label;
    }

    // ── 讀值 / 驗證 ────────────────────────────────────────

    function readAnswer(q, index) {
        var name = 'q' + index;
        if (q.type === 'text' || q.type === 'textarea' || q.type === 'date') {
            return form.elements[name].value.trim();
        }
        var checked = Array.prototype.filter.call(form.querySelectorAll('input[name="' + name + '"]'), function (i) {
            return i.checked;
        }).map(function (i) {
            if (i.value !== '__other__') return i.value;
            var other = form.elements[name + '-other'].value.trim();
            return other || '';
        }).filter(Boolean);

        if (q.type === 'scale') return checked.length ? Number(checked[0]) : '';
        if (q.type === 'radio') return checked[0] || '';
        return checked;
    }

    function isVisible(q) {
        if (!q.showIf) return true;
        var target = -1;
        config.questions.forEach(function (other, i) { if (target === -1 && other.title === q.showIf.title) target = i; });
        if (target === -1 || !isVisible(config.questions[target])) return false;
        var value = readAnswer(config.questions[target], target);
        var values = Array.isArray(value) ? value : [value];
        return values.some(function (v) { return q.showIf.in.indexOf(v) !== -1; });
    }

    function isAnswerable(q) {
        return q.type !== 'info' && isVisible(q);
    }

    function updateVisibility() {
        config.questions.forEach(function (q, i) {
            if (!q.showIf) return;
            form.querySelector('.sv-q[data-index="' + i + '"]').hidden = !isVisible(q);
        });
    }

    function isEmpty(value) {
        return value === '' || (Array.isArray(value) && value.length === 0);
    }

    function validate() {
        var firstBad = null;
        config.questions.forEach(function (q, i) {
            var box = form.querySelector('.sv-q[data-index="' + i + '"]');
            if (!isAnswerable(q)) return;
            var bad = !!q.required && isEmpty(readAnswer(q, i));
            box.classList.toggle('sv-invalid', bad);
            box.querySelector('.sv-error').textContent = bad ? '這是必填問題' : '';
            if (bad && !firstBad) firstBad = box;
        });
        if (firstBad) {
            firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
            var focusable = firstBad.querySelector('input, textarea');
            if (focusable) focusable.focus({ preventScroll: true });
        }
        return !firstBad;
    }

    // ── 送出 ───────────────────────────────────────────────

    function onSubmit(event) {
        event.preventDefault();
        status.textContent = '';
        if (!validate()) return;
        if (!endpoint) {
            status.textContent = '問卷還沒開放收件，請直接私訊海星 LINE 告訴我們 🙏';
            return;
        }

        var answers = {};
        var fields = [];
        config.questions.forEach(function (q, i) {
            if (!isAnswerable(q)) return;
            var value = readAnswer(q, i);
            answers[q.title] = value;
            fields.push({ label: q.title, value: value });
        });

        var extra = {};
        if (typeof config.assign === 'function') {
            try {
                extra = config.assign(answers) || {};
            } catch (err) {
                extra = {};
            }
            Object.keys(extra).forEach(function (label) {
                fields.push({ label: label, value: extra[label] });
            });
        }

        submit.disabled = true;
        submit.textContent = '送出中…';

        // text/plain 是「簡單請求」，不會觸發 CORS 預檢；Apps Script 轉址後的回應允許跨網域讀取
        fetch(endpoint, {
            method: 'POST',
            body: JSON.stringify({ script: config.script, fields: fields, website: trap.value })
        }).then(function (res) {
            return res.json();
        }).then(function (data) {
            if (!data || !data.ok) throw new Error((data && data.error) || 'failed');
            clearDraft();
            showDone(extra);
        }).catch(function () {
            submit.disabled = false;
            submit.textContent = config.submitText || '送出';
            status.textContent = '送出失敗，請檢查網路後再按一次；一直失敗的話請私訊海星 LINE。';
        });
    }

    function showDone(extra) {
        if (typeof config.renderResult === 'function') {
            try { config.renderResult(doneExtra, extra); } catch (err) { /* 結果畫面壞掉不影響已送出 */ }
        }
        form.hidden = true;
        done.hidden = false;
        window.scrollTo({ top: root.offsetTop - 20, behavior: 'smooth' });
    }

    // ── 草稿（重新整理不會整份重填）───────────────────────────

    function saveDraft() {
        var data = {};
        Array.prototype.forEach.call(form.elements, function (input) {
            if (!input.name || input === trap) return;
            if (input.type === 'radio' || input.type === 'checkbox') {
                if (input.checked) (data[input.name] = data[input.name] || []).push(input.value);
            } else if (input.value) {
                data[input.name] = input.value;
            }
        });
        try { localStorage.setItem(draftKey, JSON.stringify(data)); } catch (err) { /* 無痕模式等 */ }
    }

    function restoreDraft() {
        var data;
        try { data = JSON.parse(localStorage.getItem(draftKey) || 'null'); } catch (err) { data = null; }
        if (!data) return;
        Array.prototype.forEach.call(form.elements, function (input) {
            if (!input.name || !(input.name in data)) return;
            var saved = data[input.name];
            if (input.type === 'radio' || input.type === 'checkbox') {
                input.checked = Array.isArray(saved) && saved.indexOf(input.value) !== -1;
            } else {
                input.value = saved;
            }
        });
    }

    function clearDraft() {
        try { localStorage.removeItem(draftKey); } catch (err) { /* ignore */ }
    }

    // ── 小工具 ─────────────────────────────────────────────

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) node.className = className;
        if (text != null) node.textContent = text;
        return node;
    }

    function injectStyle() {
        var css = [
            '#survey{--sv-accent:#c9a227;--sv-text:#f5ecd9;--sv-muted:rgba(245,236,217,.65);',
            '--sv-card:rgba(20,14,8,.72);--sv-border:rgba(201,162,39,.35);--sv-field:rgba(255,255,255,.06);--sv-error:#ff8a7a;color:var(--sv-text);color-scheme:var(--sv-scheme,dark)}',
            '.sv-form{display:flex;flex-direction:column;gap:16px}',
            '.sv-q{margin:0;padding:20px 20px 14px;border:1px solid var(--sv-border);border-radius:14px;background:var(--sv-card);',
            'backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);min-width:0;transition:border-color .2s}',
            '.sv-q.sv-invalid{border-color:var(--sv-error)}',
            '.sv-title{padding:0;font-size:1.05rem;font-weight:600;line-height:1.5;float:left;width:100%;margin-bottom:12px}',
            '.sv-title+*{clear:both}',
            '.sv-required{color:var(--sv-error)}',
            '.sv-info{border-style:dashed}',
            '.sv-info-title{margin:0 0 8px;font-size:1.1rem;color:var(--sv-accent);white-space:pre-line;line-height:1.6}',
            '.sv-info .sv-desc{margin:0;color:var(--sv-text);line-height:1.8}',
            '.sv-info-title+.sv-desc{color:var(--sv-muted)}',
            'input[type=date].sv-input{min-height:48px}',
            '.sv-desc{margin:-4px 0 12px;color:var(--sv-muted);font-size:.9rem;white-space:pre-line;clear:both}',
            '.sv-input{width:100%;box-sizing:border-box;padding:12px 14px;border:1px solid var(--sv-border);border-radius:10px;',
            'background:var(--sv-field);color:var(--sv-text);font:inherit;font-size:16px;line-height:1.5;resize:vertical}',
            '.sv-input:focus{outline:none;border-color:var(--sv-accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--sv-accent) 25%,transparent)}',
            '.sv-input::placeholder{color:var(--sv-muted)}',
            '.sv-options{display:flex;flex-direction:column;gap:8px;clear:both}',
            '.sv-choice{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;cursor:pointer;',
            'background:var(--sv-field);border:1px solid transparent;flex-wrap:wrap}',
            '.sv-choice:has(input:checked){border-color:var(--sv-accent)}',
            '.sv-choice input{accent-color:var(--sv-accent);width:18px;height:18px;margin:0;flex:none}',
            '.sv-other{flex:1 1 160px;padding:6px 10px}',
            '.sv-scale{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:center;clear:both}',
            '.sv-scale-label{color:var(--sv-muted);font-size:.9rem;flex:1 1 0;min-width:5em;text-align:center}',
            '.sv-scale-dots{display:flex;gap:6px}',
            '.sv-scale-dot{display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;font-size:.85rem;color:var(--sv-muted)}',
            '.sv-scale-dot input{accent-color:var(--sv-accent);width:22px;height:22px;margin:0}',
            '@media (max-width:480px){.sv-scale{display:grid;grid-template-columns:1fr 1fr;gap:8px}.sv-scale-dots{grid-column:1/-1;order:-1;justify-content:space-between;padding:0 4px}',
            '.sv-scale-label{min-width:0;text-align:left}.sv-scale-label:last-child{text-align:right}}',
            '.sv-error{margin:8px 0 0;min-height:0;color:var(--sv-error);font-size:.85rem}',
            '.sv-error:empty{display:none}',
            '.sv-trap{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}',
            '.sv-submit{margin-top:8px;padding:15px;border:none;border-radius:999px;font:inherit;font-size:1.1rem;font-weight:700;',
            'letter-spacing:.1em;cursor:pointer;color:var(--sv-on-accent,#1a1208);background:var(--sv-accent);transition:transform .15s,opacity .15s}',
            '.sv-submit:hover{transform:translateY(-1px)}',
            '.sv-submit:disabled{opacity:.6;cursor:wait;transform:none}',
            '.sv-status{margin:0;text-align:center;color:var(--sv-error)}',
            '.sv-status:empty{display:none}',
            '.sv-done{padding:32px 24px;text-align:center;border:1px solid var(--sv-border);border-radius:14px;background:var(--sv-card)}',
            '.sv-done-title{margin:0 0 12px;color:var(--sv-accent)}',
            '.sv-done-link{display:inline-block;margin-top:16px;color:var(--sv-accent)}',
            '.sv-done-text{margin:12px 0 0;color:var(--sv-muted);line-height:1.8;white-space:pre-line}',
            '[hidden]{display:none!important}'
        ].join('');
        var style = document.createElement('style');
        style.textContent = css;
        document.head.insertBefore(style, document.head.firstChild);
    }
})();
