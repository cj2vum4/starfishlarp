/* ============================================================
   fx3d.js — 劇本頁 3D 寫實背景特效引擎（共用元件）
   ------------------------------------------------------------
   用法（每頁一行，放在 </body> 前）：
     <script src="../fx3d.js"
             data-fx="storm"            預設：storm/snow/petals/embers/fog/
                                              fireflies/stars/dust/rain/sand/bubbles
             data-tint="#aecbff"        主色（各頁配自己的色調保持獨特）
             data-density="1"           密度倍率
             data-thunder="1"           （storm 限定）悶雷音效
             data-hide=".petal,#fog">   3D 啟動成功後才隱藏的舊 2D 層
     </script>
   ------------------------------------------------------------
   行為守則：
   - prefers-reduced-motion → 不啟動（保留原 2D 效果）
   - WebGL 建立失敗 / CDN 載不到 → 不啟動（原 2D 效果自然 fallback）
   - 手機自動降密度 + 限 DPR；分頁隱藏時暫停渲染
   ============================================================ */
(function () {
    'use strict';

    var cfgEl = document.currentScript;
    if (!cfgEl) return;
    var FX      = (cfgEl.dataset.fx || 'dust').trim();
    var TINT    = cfgEl.dataset.tint || '#ffffff';
    var DENS    = parseFloat(cfgEl.dataset.density || '1') || 1;
    var THUNDER = cfgEl.dataset.thunder === '1';
    var HIDE    = (cfgEl.dataset.hide || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);

    try { if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch (e) {}

    var MOBILE = /Mobi|Android/i.test(navigator.userAgent) || Math.min(screen.width, screen.height) < 480;
    if (MOBILE) DENS *= 0.55;

    /* ── Three.js 載入（頁面沒有才抓 CDN）────────────────────── */
    function loadThree(cb) {
        if (window.THREE) return cb();
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js';
        s.onload = cb;
        document.head.appendChild(s);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { loadThree(init); });
    } else {
        loadThree(init);
    }

    /* ══════════════════════════════════════════════════════════ */
    function init() {
        var THREE = window.THREE;
        if (!THREE) return;

        var canvas = document.createElement('canvas');
        canvas.setAttribute('aria-hidden', 'true');
        canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block';
        document.body.insertBefore(canvas, document.body.firstChild);

        var renderer;
        try {
            renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
        } catch (e) { canvas.remove(); return; }

        renderer.setClearColor(0x000000, 0);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MOBILE ? 1.5 : 1.75));
        var W = innerWidth, H = innerHeight;
        renderer.setSize(W, H, false);

        var scene  = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 500);
        camera.position.set(0, 0, 60);

        // 內容保底疊在特效之上（與各頁既有 2D 層同一套 z 秩序）
        var st = document.createElement('style');
        st.textContent = '.container{position:relative;z-index:1}';
        document.head.appendChild(st);

        var tint = new THREE.Color(TINT);

        /* ── 視錐換算：z=0 平面的可視範圍 ── */
        function viewSize(z) {
            var d = 60 - z;
            var h = 2 * d * Math.tan(55 * Math.PI / 360);
            return { w: h * camera.aspect, h: h };
        }

        /* ── 程序化貼圖 ─────────────────────────────────────── */
        function glowTex(soft) {
            var c = document.createElement('canvas'); c.width = c.height = 64;
            var x = c.getContext('2d');
            var g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
            g.addColorStop(0, 'rgba(255,255,255,1)');
            g.addColorStop(soft ? 0.25 : 0.5, 'rgba(255,255,255,.45)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            x.fillStyle = g; x.fillRect(0, 0, 64, 64);
            return new THREE.CanvasTexture(c);
        }
        function petalTex() {
            var c = document.createElement('canvas'); c.width = c.height = 64;
            var x = c.getContext('2d');
            x.translate(32, 32); x.rotate(Math.PI / 4);
            var g = x.createLinearGradient(-20, -20, 20, 20);
            g.addColorStop(0, 'rgba(255,255,255,.95)');
            g.addColorStop(1, 'rgba(255,255,255,.35)');
            x.fillStyle = g;
            x.beginPath();
            x.moveTo(0, -22);
            x.bezierCurveTo(16, -14, 16, 10, 0, 22);
            x.bezierCurveTo(-16, 10, -16, -14, 0, -22);
            x.fill();
            return new THREE.CanvasTexture(c);
        }
        function fogTex() {
            var c = document.createElement('canvas'); c.width = c.height = 256;
            var x = c.getContext('2d');
            for (var i = 0; i < 14; i++) {
                var px = 48 + Math.random() * 160, py = 48 + Math.random() * 160, r = 36 + Math.random() * 72;
                var g = x.createRadialGradient(px, py, 0, px, py, r);
                g.addColorStop(0, 'rgba(255,255,255,.09)');
                g.addColorStop(1, 'rgba(255,255,255,0)');
                x.fillStyle = g;
                x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
            }
            return new THREE.CanvasTexture(c);
        }
        function ringTex() {
            var c = document.createElement('canvas'); c.width = c.height = 64;
            var x = c.getContext('2d');
            var g = x.createRadialGradient(32, 32, 18, 32, 32, 30);
            g.addColorStop(0, 'rgba(255,255,255,0)');
            g.addColorStop(0.75, 'rgba(255,255,255,.7)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            x.fillStyle = g; x.beginPath(); x.arc(32, 32, 30, 0, 7); x.fill();
            // 高光點
            var g2 = x.createRadialGradient(22, 20, 0, 22, 20, 8);
            g2.addColorStop(0, 'rgba(255,255,255,.9)'); g2.addColorStop(1, 'rgba(255,255,255,0)');
            x.fillStyle = g2; x.beginPath(); x.arc(22, 20, 8, 0, 7); x.fill();
            return new THREE.CanvasTexture(c);
        }

        /* ── 共用：Points 粒子場 ───────────────────────────────── */
        function makePoints(n, opts) {
            var pos = new Float32Array(n * 3);
            var vs = viewSize(opts.zMin);
            var data = [];
            for (var i = 0; i < n; i++) {
                var z = opts.zMin + Math.random() * (opts.zMax - opts.zMin);
                pos[i * 3]     = (Math.random() - 0.5) * vs.w * 1.2;
                pos[i * 3 + 1] = (Math.random() - 0.5) * vs.h * 1.2;
                pos[i * 3 + 2] = z;
                data.push({
                    sp: opts.spMin + Math.random() * (opts.spMax - opts.spMin),
                    ph: Math.random() * Math.PI * 2,
                    sw: opts.sway * (0.4 + Math.random() * 0.6)
                });
            }
            var geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            var mat = new THREE.PointsMaterial({
                map: opts.tex, color: opts.color, size: opts.size,
                transparent: true, opacity: opts.opacity,
                depthWrite: false, blending: opts.blending || THREE.NormalBlending,
                sizeAttenuation: true
            });
            var pts = new THREE.Points(geo, mat);
            scene.add(pts);
            return { pts: pts, pos: pos, data: data, n: n };
        }
        function wrapY(field, fall, t, windX) {
            var vs = viewSize(-40);
            var half = vs.h * 0.65, halfW = vs.w * 0.65;
            for (var i = 0; i < field.n; i++) {
                var d = field.data[i];
                field.pos[i * 3 + 1] += fall * d.sp;
                field.pos[i * 3] += Math.sin(t * 0.8 + d.ph) * d.sw + (windX || 0);
                if (fall < 0 && field.pos[i * 3 + 1] < -half) field.pos[i * 3 + 1] = half;
                if (fall > 0 && field.pos[i * 3 + 1] > half)  field.pos[i * 3 + 1] = -half;
                if (field.pos[i * 3] > halfW)  field.pos[i * 3] = -halfW;
                if (field.pos[i * 3] < -halfW) field.pos[i * 3] = halfW;
            }
            field.pts.geometry.attributes.position.needsUpdate = true;
        }

        /* ══ 各預設 ══════════════════════════════════════════════ */
        var presets = {

            /* 雪：雙層景深、近大遠小、微風飄移 */
            snow: function () {
                var far  = makePoints(Math.round(260 * DENS), { zMin: -110, zMax: -40, spMin: .5, spMax: 1, sway: .02, tex: glowTex(true), color: tint, size: 1.6, opacity: .7 });
                var near = makePoints(Math.round(90  * DENS), { zMin: -35,  zMax: 20,  spMin: 1, spMax: 1.8, sway: .05, tex: glowTex(true), color: tint, size: 3.2, opacity: .9 });
                return { update: function (dt, t) { wrapY(far, -3.2 * dt, t); wrapY(near, -7 * dt, t, Math.sin(t * .3) * .015); } };
            },

            /* 花瓣：真 3D 面片翻滾飄落 */
            petals: function () {
                var tex = petalTex();
                var group = new THREE.Group(); scene.add(group);
                var list = [];
                var n = Math.round(46 * DENS);
                var vs = viewSize(-30);
                for (var i = 0; i < n; i++) {
                    var s = 0.9 + Math.random() * 1.6;
                    var m = new THREE.Mesh(
                        new THREE.PlaneGeometry(s, s),
                        new THREE.MeshBasicMaterial({ map: tex, color: tint, transparent: true, opacity: .5 + Math.random() * .4, depthWrite: false, side: THREE.DoubleSide })
                    );
                    m.position.set((Math.random() - .5) * vs.w * 1.2, (Math.random() - .5) * vs.h * 1.2, -70 + Math.random() * 90);
                    group.add(m);
                    list.push({ m: m, sp: 2.4 + Math.random() * 3.4, rx: (Math.random() - .5) * 2.4, ry: (Math.random() - .5) * 2.4, rz: (Math.random() - .5) * 1.6, ph: Math.random() * 7, sw: .5 + Math.random() * 1.1 });
                }
                return { update: function (dt, t) {
                    var half = vs.h * 0.62, halfW = vs.w * 0.62;
                    list.forEach(function (p) {
                        p.m.position.y -= p.sp * dt;
                        p.m.position.x += Math.sin(t * .9 + p.ph) * p.sw * dt;
                        p.m.rotation.x += p.rx * dt; p.m.rotation.y += p.ry * dt; p.m.rotation.z += p.rz * dt;
                        if (p.m.position.y < -half) { p.m.position.y = half; p.m.position.x = (Math.random() - .5) * halfW * 2; }
                    });
                } };
            },

            /* 燈燼/火星：加色發光、上升、忽明忽暗 */
            embers: function () {
                var far  = makePoints(Math.round(150 * DENS), { zMin: -90, zMax: -30, spMin: .5, spMax: 1, sway: .04, tex: glowTex(false), color: tint, size: 1.4, opacity: .55, blending: THREE.AdditiveBlending });
                var near = makePoints(Math.round(60  * DENS), { zMin: -25, zMax: 25,  spMin: .8, spMax: 1.6, sway: .08, tex: glowTex(false), color: tint, size: 3, opacity: .8, blending: THREE.AdditiveBlending });
                return { update: function (dt, t) {
                    wrapY(far, 2.2 * dt, t); wrapY(near, 4.5 * dt, t);
                    near.pts.material.opacity = .62 + Math.sin(t * 2.1) * .18;
                    far.pts.material.opacity  = .45 + Math.sin(t * 1.4 + 2) * .12;
                } };
            },

            /* 霧：多層貼圖平面橫向漂移（体積感） */
            fog: function () {
                var tex = fogTex();
                var layers = [];
                var n = Math.round(7 * Math.max(DENS, .6));
                for (var i = 0; i < n; i++) {
                    var z = -100 + i * (110 / n);
                    var vs = viewSize(z);
                    var m = new THREE.Mesh(
                        new THREE.PlaneGeometry(vs.w * 1.7, vs.h * 1.1),
                        new THREE.MeshBasicMaterial({ map: tex, color: tint, transparent: true, opacity: .22 + Math.random() * .16, depthWrite: false })
                    );
                    m.position.set((Math.random() - .5) * vs.w, (Math.random() - .5) * vs.h * .5, z);
                    scene.add(m);
                    layers.push({ m: m, sp: (.6 + Math.random() * 1.3) * (i % 2 ? 1 : -1), w: vs.w, ph: Math.random() * 7 });
                }
                return { update: function (dt, t) {
                    layers.forEach(function (L) {
                        L.m.position.x += L.sp * dt;
                        L.m.material.opacity = Math.max(.1, .22 + Math.sin(t * .25 + L.ph) * .1);
                        if (L.m.position.x >  L.w) L.m.position.x = -L.w;
                        if (L.m.position.x < -L.w) L.m.position.x =  L.w;
                    });
                } };
            },

            /* 螢火/光點：漫遊 + 呼吸脈動（三群相位錯開） */
            fireflies: function () {
                var groups = [];
                for (var gI = 0; gI < 3; gI++) {
                    var f = makePoints(Math.round(22 * DENS), { zMin: -70, zMax: 20, spMin: .3, spMax: .8, sway: .3, tex: glowTex(false), color: tint, size: 2.2 + gI, opacity: .7, blending: THREE.AdditiveBlending });
                    f.phase = gI * 2.1; groups.push(f);
                }
                return { update: function (dt, t) {
                    groups.forEach(function (f) {
                        for (var i = 0; i < f.n; i++) {
                            var d = f.data[i];
                            f.pos[i * 3]     += Math.sin(t * .5 + d.ph) * d.sw * dt * 2;
                            f.pos[i * 3 + 1] += Math.cos(t * .4 + d.ph * 1.7) * d.sw * dt * 2;
                        }
                        f.pts.geometry.attributes.position.needsUpdate = true;
                        f.pts.material.opacity = .35 + (Math.sin(t * 1.6 + f.phase) * .5 + .5) * .5;
                    });
                } };
            },

            /* 星空：深景深星場 + 偶發流星 */
            stars: function () {
                var far = makePoints(Math.round(420 * DENS), { zMin: -140, zMax: -60, spMin: 0, spMax: 0, sway: 0, tex: glowTex(true), color: tint, size: 1.1, opacity: .85 });
                var near = makePoints(Math.round(90 * DENS), { zMin: -55, zMax: -15, spMin: 0, spMax: 0, sway: 0, tex: glowTex(false), color: tint, size: 2, opacity: .9, blending: THREE.AdditiveBlending });
                // 流星
                var meteor = new THREE.Mesh(
                    new THREE.PlaneGeometry(14, .18),
                    new THREE.MeshBasicMaterial({ map: glowTex(true), color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
                );
                meteor.position.z = -50; meteor.rotation.z = -0.5; scene.add(meteor);
                var mT = 3 + Math.random() * 5, mLife = 0;
                return { update: function (dt, t) {
                    scene.rotation.z = t * .004;
                    near.pts.material.opacity = .7 + Math.sin(t * .9) * .2;
                    mT -= dt;
                    if (mT <= 0 && mLife <= 0) {
                        mLife = .9;
                        var vs = viewSize(-50);
                        meteor.position.set((Math.random() * .6 - .1) * vs.w, vs.h * (.15 + Math.random() * .3), -50);
                    }
                    if (mLife > 0) {
                        mLife -= dt;
                        meteor.position.x -= 60 * dt; meteor.position.y -= 32 * dt;
                        meteor.material.opacity = Math.max(0, Math.min(.9, mLife * 2));
                        if (mLife <= 0) mT = 4 + Math.random() * 7;
                    }
                } };
            },

            /* 塵埃/光屑：慢速懸浮 + 大顆 bokeh */
            dust: function () {
                var fine = makePoints(Math.round(180 * DENS), { zMin: -80, zMax: 10, spMin: .1, spMax: .3, sway: .12, tex: glowTex(true), color: tint, size: 1.2, opacity: .5 });
                var bokeh = makePoints(Math.round(24 * DENS), { zMin: -40, zMax: 25, spMin: .1, spMax: .25, sway: .2, tex: glowTex(false), color: tint, size: 5, opacity: .16, blending: THREE.AdditiveBlending });
                return { update: function (dt, t) {
                    wrapY(fine, .7 * dt, t); wrapY(bokeh, .5 * dt, t);
                    bokeh.pts.material.opacity = .12 + Math.sin(t * .7) * .05;
                } };
            },

            /* 雨：線段雨絲、雙層景深 */
            rain: function (speedMul, countMul) {
                speedMul = speedMul || 1; countMul = countMul || 1;
                function rainLayer(n, zMin, zMax, len, op, sp) {
                    var posArr = new Float32Array(n * 2 * 3);
                    var drops = [];
                    var vs = viewSize(zMin);
                    for (var i = 0; i < n; i++) {
                        var x = (Math.random() - .5) * vs.w * 1.3;
                        var y = (Math.random() - .5) * vs.h * 1.3;
                        var z = zMin + Math.random() * (zMax - zMin);
                        drops.push({ x: x, y: y, z: z, sp: sp * (.8 + Math.random() * .5) });
                    }
                    var geo = new THREE.BufferGeometry();
                    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
                    var mat = new THREE.LineBasicMaterial({ color: tint, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
                    var lines = new THREE.LineSegments(geo, mat);
                    scene.add(lines);
                    return { posArr: posArr, drops: drops, n: n, len: len, geo: geo, vs: vs };
                }
                var far  = rainLayer(Math.round(160 * DENS * countMul), -90, -40, 1.6, .28, 55 * speedMul);
                var near = rainLayer(Math.round(70  * DENS * countMul), -35, 15,  3,   .4,  95 * speedMul);
                function step(L, dt) {
                    var half = L.vs.h * .7;
                    for (var i = 0; i < L.n; i++) {
                        var d = L.drops[i];
                        d.y -= d.sp * dt; d.x -= d.sp * .12 * dt;
                        if (d.y < -half) { d.y = half; d.x = (Math.random() - .5) * L.vs.w * 1.3; }
                        L.posArr[i * 6]     = d.x;       L.posArr[i * 6 + 1] = d.y;         L.posArr[i * 6 + 2] = d.z;
                        L.posArr[i * 6 + 3] = d.x + L.len * .12; L.posArr[i * 6 + 4] = d.y + L.len; L.posArr[i * 6 + 5] = d.z;
                    }
                    L.geo.attributes.position.needsUpdate = true;
                }
                return { update: function (dt) { step(far, dt); step(near, dt); } };
            },

            /* 風沙：橫向沙流 + 揚塵，陣風起伏 */
            sand: function () {
                var haze = presets.fog();
                var grains = makePoints(Math.round(220 * DENS), { zMin: -70, zMax: 15, spMin: .6, spMax: 1.4, sway: .05, tex: glowTex(true), color: tint, size: 1.3, opacity: .5 });
                var gust = 0;
                return { update: function (dt, t) {
                    haze.update(dt, t);
                    gust = 6 + Math.sin(t * .5) * 3 + Math.sin(t * 1.7) * 1.5;
                    var vs = viewSize(-30), halfW = vs.w * .7;
                    for (var i = 0; i < grains.n; i++) {
                        var d = grains.data[i];
                        grains.pos[i * 3]     += gust * d.sp * dt;
                        grains.pos[i * 3 + 1] += Math.sin(t + d.ph) * .8 * dt;
                        if (grains.pos[i * 3] > halfW) grains.pos[i * 3] = -halfW;
                    }
                    grains.pts.geometry.attributes.position.needsUpdate = true;
                } };
            },

            /* 氣泡：緩升、擺動、微光圈 */
            bubbles: function () {
                var tex = ringTex();
                var group = new THREE.Group(); scene.add(group);
                var list = [];
                var n = Math.round(36 * DENS);
                var vs = viewSize(-30);
                for (var i = 0; i < n; i++) {
                    var s = .5 + Math.random() * 1.8;
                    var m = new THREE.Mesh(
                        new THREE.PlaneGeometry(s, s),
                        new THREE.MeshBasicMaterial({ map: tex, color: tint, transparent: true, opacity: .25 + Math.random() * .3, depthWrite: false, blending: THREE.AdditiveBlending })
                    );
                    m.position.set((Math.random() - .5) * vs.w, (Math.random() - .5) * vs.h * 1.2, -70 + Math.random() * 85);
                    group.add(m);
                    list.push({ m: m, sp: 1.6 + Math.random() * 2.6, ph: Math.random() * 7, sw: .4 + Math.random() * .8 });
                }
                return { update: function (dt, t) {
                    var half = vs.h * .62;
                    list.forEach(function (b) {
                        b.m.position.y += b.sp * dt;
                        b.m.position.x += Math.sin(t * 1.1 + b.ph) * b.sw * dt;
                        if (b.m.position.y > half) b.m.position.y = -half;
                    });
                } };
            },

            /* 雷暴（王座）：真實分岔閃電 + 雲層悶閃 + 雨 + 悶雷 */
            storm: function () {
                var rain = presets.rain(1.15, .8);

                // 雲層悶閃（遠景整片微亮）
                var vsFar = viewSize(-120);
                var sheet = new THREE.Mesh(
                    new THREE.PlaneGeometry(vsFar.w * 1.6, vsFar.h * 1.6),
                    new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
                );
                sheet.position.z = -120; scene.add(sheet);

                // 閃電本體：主幹 + 分支（中點位移碎形），3 條疊線做輝光
                var boltGroup = new THREE.Group(); scene.add(boltGroup);
                var boltMats = [
                    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
                    new THREE.LineBasicMaterial({ color: tint,     transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
                    new THREE.LineBasicMaterial({ color: tint,     transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
                ];

                function midpoint(a, b, disp, out) {
                    var mx = (a[0] + b[0]) / 2 + (Math.random() - .5) * disp;
                    var my = (a[1] + b[1]) / 2 + (Math.random() - .5) * disp * .4;
                    var mz = (a[2] + b[2]) / 2 + (Math.random() - .5) * disp * .5;
                    out.push([mx, my, mz]);
                }
                function genPath(x0, y0, z0, x1, y1, z1, disp, depth) {
                    var pts = [[x0, y0, z0], [x1, y1, z1]];
                    for (var d = 0; d < depth; d++) {
                        var next = [pts[0]];
                        for (var i = 0; i < pts.length - 1; i++) {
                            var seg = [];
                            midpoint(pts[i], pts[i + 1], disp, seg);
                            next.push(seg[0], pts[i + 1]);
                        }
                        pts = next; disp *= .5;
                    }
                    return pts;
                }
                function buildBolt() {
                    while (boltGroup.children.length) {
                        var ch = boltGroup.children.pop();
                        ch.geometry.dispose();
                    }
                    var vs = viewSize(-45);
                    var topX = (Math.random() - .5) * vs.w * .8;
                    var botX = topX + (Math.random() - .5) * vs.w * .25;
                    var z = -55 + Math.random() * 25;
                    var main = genPath(topX, vs.h * .62, z, botX, -vs.h * .5, z, vs.w * .16, 6);
                    var paths = [main];
                    // 2~3 條分支
                    var nb = 2 + (Math.random() < .5 ? 1 : 0);
                    for (var b = 0; b < nb; b++) {
                        var at = main[4 + ((Math.random() * (main.length - 14)) | 0)];
                        var ex = at[0] + (Math.random() - .5) * vs.w * .3;
                        var ey = at[1] - vs.h * (.15 + Math.random() * .25);
                        paths.push(genPath(at[0], at[1], at[2], ex, ey, at[2], vs.w * .07, 5));
                    }
                    paths.forEach(function (p, pi) {
                        var flat = [];
                        p.forEach(function (v) { flat.push(v[0], v[1], v[2]); });
                        var geo = new THREE.BufferGeometry();
                        geo.setAttribute('position', new THREE.Float32BufferAttribute(flat, 3));
                        for (var mI = 0; mI < 3; mI++) {
                            var line = new THREE.Line(geo, boltMats[mI]);
                            var off = mI * .28;
                            line.position.set((Math.random() - .5) * off, 0, (Math.random() - .5) * off);
                            if (pi > 0) line.scale.setScalar(1); // 分支同幾何
                            boltGroup.add(line);
                        }
                    });
                }

                /* 悶雷（WebAudio 合成：布朗噪音 + 低通 → 低沉滾雷）
                   受自動播放政策限制，第一次點擊後才解鎖 */
                var audioCtx = null, audioReady = false;
                if (THUNDER) {
                    var unlock = function () {
                        try {
                            audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
                            audioCtx.resume().then(function () { audioReady = true; });
                        } catch (e) {}
                        document.removeEventListener('pointerdown', unlock);
                        document.removeEventListener('touchstart', unlock);
                    };
                    document.addEventListener('pointerdown', unlock, { once: false });
                    document.addEventListener('touchstart', unlock, { once: false });
                }
                function thunder(delay) {
                    if (!audioReady || !audioCtx) return;
                    var dur = 2.6 + Math.random() * 2.2;
                    var sr = audioCtx.sampleRate;
                    var buf = audioCtx.createBuffer(1, sr * dur, sr);
                    var d = buf.getChannelData(0), last = 0;
                    for (var i = 0; i < d.length; i++) {
                        var w = Math.random() * 2 - 1;
                        last = (last + 0.02 * w) / 1.02;
                        d[i] = last * 3.2;
                    }
                    var src = audioCtx.createBufferSource(); src.buffer = buf;
                    var lp = audioCtx.createBiquadFilter();
                    lp.type = 'lowpass'; lp.frequency.value = 75 + Math.random() * 70; lp.Q.value = .4;
                    var g = audioCtx.createGain();
                    var t0 = audioCtx.currentTime + delay;
                    g.gain.setValueAtTime(0, t0);
                    g.gain.linearRampToValueAtTime(.28 + Math.random() * .14, t0 + .12 + Math.random() * .25);
                    g.gain.exponentialRampToValueAtTime(.001, t0 + dur);
                    src.connect(lp); lp.connect(g); g.connect(audioCtx.destination);
                    src.start(t0);
                }

                // 打閃時間軸：亮-滅-亮-衰減（雙擊感），雲閃跟隨
                var nextBolt = 2 + Math.random() * 3;
                var phase = -1, pt = 0;
                var PH = [[.09, 1], [.05, 0], [.13, .85], [.32, 0]]; // [時長, 目標亮度]

                return { update: function (dt, t) {
                    rain.update(dt, t);
                    // 遠處隨機微弱雲閃（無閃電時的悶雷氛圍）
                    if (Math.random() < dt * .18) sheet.material.opacity = Math.max(sheet.material.opacity, .05 + Math.random() * .06);
                    sheet.material.opacity = Math.max(0, sheet.material.opacity - dt * .35);

                    nextBolt -= dt;
                    if (nextBolt <= 0 && phase < 0) {
                        buildBolt();
                        phase = 0; pt = 0;
                        thunder(.45 + Math.random() * 1.3);   // 距離感：閃後零點幾秒才滾雷
                        nextBolt = 4.5 + Math.random() * 6;
                    }
                    if (phase >= 0) {
                        pt += dt;
                        var cur = PH[phase];
                        var k = cur[1];
                        boltMats[0].opacity = k;
                        boltMats[1].opacity = k * .5;
                        boltMats[2].opacity = k * .25;
                        sheet.material.opacity = Math.max(sheet.material.opacity, k * .16);
                        if (pt >= cur[0]) {
                            pt = 0; phase++;
                            if (phase >= PH.length) {
                                phase = -1;
                                boltMats.forEach(function (m) { m.opacity = 0; });
                            }
                        } else if (phase === PH.length - 1) {
                            // 最後一段漸弱
                            var fade = 1 - pt / cur[0];
                            boltMats[0].opacity = .85 * fade;
                            boltMats[1].opacity = .4 * fade;
                            boltMats[2].opacity = .2 * fade;
                        }
                    }
                } };
            }
        };

        var effect = (presets[FX] || presets.dust)();

        /* ── 滑鼠視差（桌機）/ 自動漂移（手機）─────────────────── */
        var mx = 0, my = 0;
        if (!MOBILE) {
            document.addEventListener('mousemove', function (e) {
                mx = (e.clientX / innerWidth - .5) * 2;
                my = -(e.clientY / innerHeight - .5) * 2;
            }, { passive: true });
        }

        /* ── 舊 2D 層：3D 第一幀成功後才隱藏 ───────────────────── */
        var legacyHidden = false;
        function hideLegacy() {
            if (legacyHidden || !HIDE.length) { legacyHidden = true; return; }
            legacyHidden = true;
            HIDE.forEach(function (sel) {
                try {
                    document.querySelectorAll(sel).forEach(function (el) { el.style.display = 'none'; });
                } catch (e) {}
            });
        }

        /* ── 主迴圈 ─────────────────────────────────────────── */
        var clock = { last: performance.now() };
        var running = true;
        document.addEventListener('visibilitychange', function () {
            running = !document.hidden;
            if (running) { clock.last = performance.now(); loop(); }
        });
        window.addEventListener('resize', function () {
            W = innerWidth; H = innerHeight;
            renderer.setSize(W, H, false);
            camera.aspect = W / H;
            camera.updateProjectionMatrix();
        });

        var elapsed = 0;
        function loop() {
            if (!running) return;
            requestAnimationFrame(loop);
            var now = performance.now();
            var dt = Math.min(.05, (now - clock.last) / 1000);
            clock.last = now;
            elapsed += dt;

            if (MOBILE) {
                camera.position.x = Math.sin(elapsed * .1) * 1.2;
                camera.position.y = Math.cos(elapsed * .13) * .8;
            } else {
                camera.position.x += (mx * 2.2 - camera.position.x) * .03;
                camera.position.y += (my * 1.4 - camera.position.y) * .03;
            }
            camera.lookAt(0, 0, -30);

            effect.update(dt, elapsed);
            renderer.render(scene, camera);
            hideLegacy();
        }
        loop();
    }
})();
