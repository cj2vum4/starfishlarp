/**
 * 劇本頁共用看圖：點海報／角色圖 → 原頁跳出全螢幕大圖
 *
 * 用法：劇本頁結尾加 <script src="../lightbox.js?v=日期"></script>
 * - 對象：src 位於 img/劇本/ 底下的 <img>（輪播、動態填入的圖也算）
 * - 不想被放大的圖：在 img 或其祖先加 data-no-zoom
 * - 原本包著 <a href="圖檔"> 的圖也會改用這裡開，不再跳新分頁
 * 操作：兩指縮放／雙擊放大、放大後拖曳、左右滑或方向鍵換張、
 *       點背景／✕／Esc／手機返回鍵關閉
 */
(function () {
    'use strict';
    if (window.__sfLightbox) return;
    window.__sfLightbox = true;

    var MAX_SCALE = 5;
    var DBL_SCALE = 2.5;

    function isZoomable(img) {
        if (!img || img.tagName !== 'IMG') return false;
        if (img.closest('[data-no-zoom], #sf-lb')) return false;
        var src = img.getAttribute('src') || '';
        if (src.indexOf('img/劇本/') === -1 && src.indexOf(encodeURI('img/劇本/')) === -1) return false;
        // 小圖示不放大；還沒載入（lazy）或藏起來的圖量不到尺寸，照樣收進圖集
        var r = img.getBoundingClientRect();
        return !(r.width > 0 && (r.width < 40 || r.height < 40));
    }

    // 疊放式輪播（以 opacity 切換）點到的可能是透明那張，改抓目前看得到的那張
    function visibleOf(img) {
        if (parseFloat(getComputedStyle(img).opacity) >= 0.5 || !img.parentElement) return img;
        var best = img, bestOp = -1;
        Array.prototype.forEach.call(img.parentElement.children, function (el) {
            if (el.tagName !== 'IMG') return;
            var op = parseFloat(getComputedStyle(el).opacity);
            if (op > bestOp) { bestOp = op; best = el; }
        });
        return best;
    }

    function collect() {
        var seen = {}, list = [];
        Array.prototype.forEach.call(document.images, function (img) {
            if (!isZoomable(img)) return;
            var src = img.currentSrc || img.src;
            if (seen[src]) return;
            seen[src] = true;
            list.push({ src: src, alt: img.alt || '' });
        });
        return list;
    }

    var css = '' +
        'img[data-sf-zoom]{cursor:zoom-in}' +
        '#sf-lb{position:fixed;inset:0;z-index:2147483000;display:none;background:rgba(0,0,0,.92);' +
        'touch-action:none;user-select:none;-webkit-user-select:none;overscroll-behavior:contain;' +
        'font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif;color:#fff;opacity:0;transition:opacity .2s}' +
        '#sf-lb.open{display:block}#sf-lb.show{opacity:1}' +
        '#sf-lb .sf-lb-img{position:absolute;left:50%;top:50%;max-width:100vw;max-height:100vh;max-height:100dvh;' +
        'transform-origin:center center;will-change:transform;-webkit-user-drag:none;cursor:grab}' +
        '#sf-lb .sf-lb-img.anim{transition:transform .25s ease}' +
        '#sf-lb button{position:absolute;border:0;background:rgba(255,255,255,.14);color:#fff;border-radius:999px;' +
        'width:44px;height:44px;font-size:22px;line-height:44px;padding:0;cursor:pointer;' +
        '-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);-webkit-tap-highlight-color:transparent}' +
        '#sf-lb button:hover{background:rgba(255,255,255,.26)}' +
        '#sf-lb button:focus:not(:focus-visible){outline:none;box-shadow:none}' +
        '#sf-lb .sf-lb-close{top:calc(12px + env(safe-area-inset-top));right:12px}' +
        '#sf-lb .sf-lb-prev,#sf-lb .sf-lb-next{top:50%;margin-top:-22px}' +
        '#sf-lb .sf-lb-prev{left:10px}#sf-lb .sf-lb-next{right:10px}' +
        '#sf-lb .sf-lb-bar{position:absolute;left:0;right:0;bottom:0;padding:10px 16px calc(14px + env(safe-area-inset-bottom));' +
        'text-align:center;font-size:14px;letter-spacing:.04em;background:linear-gradient(transparent,rgba(0,0,0,.6));pointer-events:none}' +
        '#sf-lb .sf-lb-count{opacity:.7;margin-left:8px}' +
        '#sf-lb.single .sf-lb-prev,#sf-lb.single .sf-lb-next,#sf-lb.single .sf-lb-count{display:none}' +
        '@media (hover:none){#sf-lb .sf-lb-prev,#sf-lb .sf-lb-next{display:none}}';

    var root, imgEl, capEl, countEl;
    var items = [], index = 0, isOpen = false, pushed = false;
    var s = 1, tx = 0, ty = 0;

    function build() {
        var style = document.createElement('style');
        style.textContent = css;
        document.head.appendChild(style);

        root = document.createElement('div');
        root.id = 'sf-lb';
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.setAttribute('aria-label', '圖片檢視');
        root.innerHTML =
            '<img class="sf-lb-img" alt="" draggable="false">' +
            '<button class="sf-lb-close" type="button" aria-label="關閉">✕</button>' +
            '<button class="sf-lb-prev" type="button" aria-label="上一張">‹</button>' +
            '<button class="sf-lb-next" type="button" aria-label="下一張">›</button>' +
            '<div class="sf-lb-bar"><span class="sf-lb-cap"></span><span class="sf-lb-count"></span></div>';
        document.body.appendChild(root);
        imgEl = root.querySelector('.sf-lb-img');
        capEl = root.querySelector('.sf-lb-cap');
        countEl = root.querySelector('.sf-lb-count');

        root.querySelector('.sf-lb-close').addEventListener('click', function (e) { e.stopPropagation(); close(); });
        root.querySelector('.sf-lb-prev').addEventListener('click', function (e) { e.stopPropagation(); go(-1); });
        root.querySelector('.sf-lb-next').addEventListener('click', function (e) { e.stopPropagation(); go(1); });
        root.addEventListener('pointerdown', onDown);
        root.addEventListener('pointermove', onMove);
        root.addEventListener('pointerup', onUp);
        root.addEventListener('pointercancel', onUp);
        root.addEventListener('wheel', onWheel, { passive: false });
        // 頁面自己的觸控／點擊特效（燭光、花瓣…）不要在看圖時被觸發
        ['click', 'touchstart', 'touchmove', 'touchend'].forEach(function (t) {
            root.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true });
        });
    }

    function apply(anim) {
        imgEl.classList.toggle('anim', !!anim);
        imgEl.style.transform = 'translate(-50%,-50%) translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
    }

    function bounds() {
        var w = imgEl.offsetWidth * s, h = imgEl.offsetHeight * s;
        return { x: Math.max(0, (w - innerWidth) / 2), y: Math.max(0, (h - innerHeight) / 2) };
    }

    function clampPan() {
        if (s <= 1) { s = 1; tx = 0; ty = 0; return; }
        var b = bounds();
        tx = Math.min(b.x, Math.max(-b.x, tx));
        ty = Math.min(b.y, Math.max(-b.y, ty));
    }

    // 以螢幕座標 (px,py) 為中心縮放到 ns
    function zoomAt(px, py, ns, base) {
        base = base || { s: s, tx: tx, ty: ty, px: px, py: py };
        ns = Math.min(MAX_SCALE, Math.max(1, ns));
        var cx = innerWidth / 2, cy = innerHeight / 2;
        var qx = (base.px - cx - base.tx) / base.s, qy = (base.py - cy - base.ty) / base.s;
        s = ns;
        tx = px - cx - qx * s;
        ty = py - cy - qy * s;
    }

    function show(i) {
        index = (i + items.length) % items.length;
        var it = items[index];
        s = 1; tx = 0; ty = 0; apply(false);
        imgEl.src = it.src;
        imgEl.alt = it.alt;
        capEl.textContent = it.alt;
        countEl.textContent = (index + 1) + ' / ' + items.length;
    }

    function go(d) { if (items.length > 1) show(index + d); }

    var prevOverflow = '';
    function open(img) {
        if (!root) build();
        items = collect();
        var src = img.currentSrc || img.src;
        var i = items.map(function (x) { return x.src; }).indexOf(src);
        if (i < 0) { items.unshift({ src: src, alt: img.alt || '' }); i = 0; }
        root.classList.toggle('single', items.length < 2);
        show(i);
        if (!isOpen) {
            isOpen = true;
            prevOverflow = document.documentElement.style.overflow;
            document.documentElement.style.overflow = 'hidden';
            root.classList.add('open');
            requestAnimationFrame(function () { root.classList.add('show'); });
            try { history.pushState({ sfLightbox: 1 }, ''); pushed = true; } catch (e) { pushed = false; }
        }
        root.querySelector('.sf-lb-close').focus({ preventScroll: true });
    }

    function hide() {
        if (!isOpen) return;
        isOpen = false;
        root.classList.remove('show');
        document.documentElement.style.overflow = prevOverflow;
        setTimeout(function () { if (!isOpen) { root.classList.remove('open'); imgEl.removeAttribute('src'); } }, 200);
    }

    function close() {
        if (!isOpen) return;
        if (pushed) { pushed = false; history.back(); } // popstate 會呼叫 hide
        else hide();
    }

    window.addEventListener('popstate', function () { if (isOpen) { pushed = false; hide(); } });

    // 用 window capture 先攔：有些劇本頁自己綁了 Esc 回首頁，看圖時不能讓它收到
    window.addEventListener('keydown', function (e) {
        if (!isOpen) return;
        if (e.key === 'Escape' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowLeft') go(-1);
        else if (e.key === 'ArrowRight') go(1);
    }, true);

    // ── 手勢 ──
    var pts = {}, start = null, lastTap = { t: 0, x: 0, y: 0 }, tapTimer = null;
    var multi = false; // 這一輪觸控是否出現過兩指（放開時不能當成點擊或滑動）

    function list() { return Object.keys(pts).map(function (k) { return pts[k]; }); }

    function beginGesture() {
        var p = list();
        start = { s: s, tx: tx, ty: ty, t: Date.now(), moved: false };
        if (p.length >= 2) {
            start.dist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
            start.px = (p[0].x + p[1].x) / 2;
            start.py = (p[0].y + p[1].y) / 2;
            start.pinch = true;
        } else if (p.length === 1) {
            start.px = p[0].x; start.py = p[0].y;
        }
    }

    function onDown(e) {
        if (e.target.closest('button')) return;
        pts[e.pointerId] = { x: e.clientX, y: e.clientY };
        try { root.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        imgEl.classList.remove('anim');
        if (list().length >= 2) multi = true;
        beginGesture();
    }

    function onMove(e) {
        if (!pts[e.pointerId] || !start) return;
        pts[e.pointerId] = { x: e.clientX, y: e.clientY };
        var p = list();
        if (p.length >= 2 && start.pinch) {
            var d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
            var mx = (p[0].x + p[1].x) / 2, my = (p[0].y + p[1].y) / 2;
            zoomAt(mx, my, start.s * d / start.dist, start);
            start.moved = true;
            apply(false);
        } else if (p.length === 1) {
            var dx = p[0].x - start.px, dy = p[0].y - start.py;
            if (Math.abs(dx) + Math.abs(dy) > 8) start.moved = true;
            if (start.s > 1) { tx = start.tx + dx; ty = start.ty + dy; }
            else { tx = dx; ty = Math.max(0, dy) * 0.6; } // 未放大：跟手預覽換張／下滑關閉
            apply(false);
        }
    }

    function onUp(e) {
        if (!pts[e.pointerId]) return;
        var p0 = pts[e.pointerId];
        delete pts[e.pointerId];
        var remaining = list().length;
        var g = start;
        if (remaining > 0) { beginGesture(); return; } // 雙指放開一指 → 改為單指拖曳
        start = null;
        var wasMulti = multi;
        multi = false;
        if (!g) return;
        if (wasMulti) { clampPan(); apply(true); return; }

        if (!g.moved && Date.now() - g.t < 300) { onTap(p0.x, p0.y, e.target); return; }

        if (g.s <= 1 && !g.pinch) {
            var dx = p0.x - g.px, dy = p0.y - g.py;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) && items.length > 1) { go(dx < 0 ? 1 : -1); return; }
            if (dy > 110 && dy > Math.abs(dx)) { close(); return; }
        }
        clampPan();
        apply(true);
    }

    function onTap(x, y, target) {
        var now = Date.now();
        if (now - lastTap.t < 300 && Math.hypot(x - lastTap.x, y - lastTap.y) < 30) {
            clearTimeout(tapTimer);
            lastTap.t = 0;
            if (s > 1) { s = 1; tx = 0; ty = 0; } else { zoomAt(x, y, DBL_SCALE); clampPan(); }
            apply(true);
            return;
        }
        lastTap = { t: now, x: x, y: y };
        if (target !== imgEl) {
            clearTimeout(tapTimer);
            tapTimer = setTimeout(close, 280); // 等看看是不是雙擊
        }
    }

    function onWheel(e) {
        e.preventDefault();
        zoomAt(e.clientX, e.clientY, s * Math.exp(-e.deltaY * 0.0015));
        clampPan();
        apply(false);
    }

    window.addEventListener('resize', function () { if (isOpen) { clampPan(); apply(false); } });

    // ── 觸發 ──
    document.addEventListener('click', function (e) {
        if (isOpen || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
        var img = e.target.closest && e.target.closest('img');
        if (!img || !isZoomable(img)) return;
        var a = img.closest('a[href]');
        // 連到別頁的連結（不是連到圖檔本身）就照原本行為
        if (a && !/\.(webp|jpe?g|png|gif|avif)(\?|#|$)/i.test(a.getAttribute('href'))) return;
        e.preventDefault();
        open(visibleOf(img));
    });

    function mark() {
        Array.prototype.forEach.call(document.images, function (img) {
            if (!img.hasAttribute('data-sf-zoom') && isZoomable(img)) img.setAttribute('data-sf-zoom', '');
        });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mark);
    else mark();
    window.addEventListener('load', mark);
})();
