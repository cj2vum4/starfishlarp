    (function () {
        // navbar scrolled state
        const nav = document.getElementById('nav');
        const onScroll = () => { if (nav) nav.classList.toggle('scrolled', window.scrollY > 24); };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();

        // drawer
        const toggle  = document.getElementById('navToggle');
        const drawer  = document.getElementById('drawer');
        const overlay = document.getElementById('drawerOverlay');
        const closeBtn = document.getElementById('drawerClose');
        function openDrawer() {
            drawer.classList.add('open'); overlay.classList.add('open');
            toggle.classList.add('active'); toggle.setAttribute('aria-expanded', 'true');
            drawer.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
        }
        function closeDrawer() {
            drawer.classList.remove('open'); overlay.classList.remove('open');
            toggle.classList.remove('active'); toggle.setAttribute('aria-expanded', 'false');
            drawer.setAttribute('aria-hidden', 'true'); document.body.style.overflow = '';
        }
        if (toggle) toggle.addEventListener('click', () =>
            drawer.classList.contains('open') ? closeDrawer() : openDrawer());
        if (overlay) overlay.addEventListener('click', closeDrawer);
        if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
        document.querySelectorAll('.drawer-link').forEach(l =>
            l.addEventListener('click', () => setTimeout(closeDrawer, 120)));
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

        // tag-button filters bridge to hidden <select>s
        const selectMap = { player: 'playerFilter', type: 'typeFilter', diff: 'difficultyFilter' };
        document.querySelectorAll('.ftag').forEach(btn => {
            btn.addEventListener('click', () => {
                const f = btn.dataset.filter, v = btn.dataset.value;
                document.querySelectorAll('.ftag[data-filter="' + f + '"]')
                    .forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const sel = document.getElementById(selectMap[f]);
                if (sel) { sel.value = v; sel.dispatchEvent(new Event('change')); }
            });
        });
        // keep tag buttons in sync when filters reset
        const origReset = window.resetFilters;
        if (typeof origReset === 'function') {
            window.resetFilters = function () {
                origReset();
                document.querySelectorAll('.ftag').forEach(b =>
                    b.classList.toggle('active', b.dataset.value === ''));
            };
        }

        // reveal on scroll
        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver((entries) => {
                entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
            }, { threshold: 0.12 });
            document.querySelectorAll('.reveal').forEach(el => io.observe(el));
        } else {
            document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
        }
    })();

    (function () {
        const canvas = document.getElementById('three-canvas');
        if (!canvas || typeof THREE === 'undefined') return;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        const host = canvas.parentElement;
        let W = host.offsetWidth, H = host.offsetHeight;

        const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isMobile, alpha: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2));
        renderer.setSize(W, H);

        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x090705, 0.05);

        const camera = new THREE.PerspectiveCamera(52, W / H, 0.1, 100);
        camera.position.set(0, 0, 9);

        // lights
        scene.add(new THREE.AmbientLight(0x2a1d10, 1.4));
        const goldLight = new THREE.PointLight(0xc8a056, 90, 40);
        const crimLight = new THREE.PointLight(0x8b1a1a, 70, 40);
        scene.add(goldLight, crimLight);
        const keyLight = new THREE.DirectionalLight(0xffe6b0, 0.5);
        keyLight.position.set(2, 4, 6); scene.add(keyLight);

        // rounded-rect helper
        function rr(ctx, x, y, w, h, r) {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
        }
        // canvas noir cover texture (avoids CORS from remote posters)
        function makeCover(title, sub, c1, c2, accent) {
            const w = 360, h = 540;
            const cv = document.createElement('canvas');
            cv.width = w; cv.height = h;
            const ctx = cv.getContext('2d');
            const g = ctx.createLinearGradient(0, 0, w, h);
            g.addColorStop(0, c1); g.addColorStop(1, c2);
            ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
            // vignette
            const vg = ctx.createRadialGradient(w / 2, h * 0.4, 40, w / 2, h * 0.5, h * 0.75);
            vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.6)');
            ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
            // gold frame
            ctx.strokeStyle = accent; ctx.lineWidth = 3;
            rr(ctx, 22, 22, w - 44, h - 44, 14); ctx.stroke();
            ctx.strokeStyle = 'rgba(236,208,138,.35)'; ctx.lineWidth = 1;
            rr(ctx, 30, 30, w - 60, h - 60, 10); ctx.stroke();
            // top ornament
            ctx.fillStyle = accent;
            ctx.font = '26px serif'; ctx.textAlign = 'center';
            ctx.fillText('✦', w / 2, 78);
            // vertical title
            ctx.fillStyle = '#f3ead2';
            ctx.font = 'bold 56px "Noto Serif TC", serif';
            ctx.textBaseline = 'middle';
            const chars = title.split('');
            const startY = h / 2 - (chars.length - 1) * 31;
            chars.forEach((ch, i) => ctx.fillText(ch, w / 2, startY + i * 62));
            // subtitle
            ctx.fillStyle = accent;
            ctx.font = '18px "Noto Sans TC", sans-serif';
            ctx.fillText(sub, w / 2, h - 70);
            // accent line
            ctx.strokeStyle = accent; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(w / 2 - 34, h - 92); ctx.lineTo(w / 2 + 34, h - 92); ctx.stroke();
            const tex = new THREE.CanvasTexture(cv);
            tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
            return tex;
        }

        const covers = [
            { t: '龍宴',   s: 'THE FEAST',  c1: '#2a1606', c2: '#0c0703', a: '#d9b063' },
            { t: '月光',   s: 'MOONLIGHT',  c1: '#0a1830', c2: '#03060f', a: '#9fc4f0' },
            { t: '瘋兔子', s: 'MAD RABBIT', c1: '#220707', c2: '#0a0302', a: '#c93030' },
        ];
        const cards = [];
        const cardGeo = new THREE.BoxGeometry(2.6, 3.9, 0.1);
        covers.forEach((cf, i) => {
            const tex = makeCover(cf.t, cf.s, cf.c1, cf.c2, cf.a);
            const sideMat = new THREE.MeshStandardMaterial({ color: 0x1a140d, roughness: 0.7, metalness: 0.3 });
            const faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.15 });
            const mats = [sideMat, sideMat, sideMat, sideMat, faceMat, sideMat];
            const mesh = new THREE.Mesh(cardGeo, mats);
            const off = i - 1;
            mesh.position.set(off * 3.05, 0, off === 0 ? 0.6 : -0.4);
            mesh.rotation.y = -off * 0.42;
            mesh.userData = { baseX: mesh.position.x, baseY: mesh.position.y, baseRotY: mesh.rotation.y, phase: i * 1.7 };
            scene.add(mesh); cards.push(mesh);
        });

        // particles
        const pCount = isMobile ? 90 : 220;
        const pGeo = new THREE.BufferGeometry();
        const pos = new Float32Array(pCount * 3);
        const col = new Float32Array(pCount * 3);
        const vel = new Float32Array(pCount);
        const cGold = new THREE.Color(0xc8a056), cCrim = new THREE.Color(0xc93030);
        for (let i = 0; i < pCount; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 20;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 14;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 10 - 2;
            const c = Math.random() > 0.4 ? cGold : cCrim;
            col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
            vel[i] = 0.006 + Math.random() * 0.014;
        }
        pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
        const pMat = new THREE.PointsMaterial({ size: 0.06, vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending });
        const particles = new THREE.Points(pGeo, pMat);
        scene.add(particles);

        // parallax target
        let tx = 0, ty = 0, cx = 0, cy = 0;
        function pointer(x, y) {
            tx = (x / W - 0.5) * 2; ty = (y / H - 0.5) * 2;
        }
        window.addEventListener('mousemove', e => pointer(e.clientX, e.clientY), { passive: true });
        window.addEventListener('touchmove', e => {
            if (e.touches[0]) pointer(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });

        const clock = new THREE.Clock();
        let running = true;
        document.addEventListener('visibilitychange', () => {
            running = !document.hidden;
            if (running) { clock.start(); animate(); }
        });

        function animate() {
            if (!running) return;
            requestAnimationFrame(animate);
            const t = clock.getElapsedTime();
            // lights orbit
            goldLight.position.set(Math.cos(t * 0.5) * 7, Math.sin(t * 0.4) * 4 + 2, 5);
            crimLight.position.set(Math.cos(t * 0.5 + Math.PI) * 7, Math.sin(t * 0.45) * 4 - 1, 4);
            // cards float
            cards.forEach(m => {
                const d = m.userData;
                m.position.y = d.baseY + Math.sin(t * 0.7 + d.phase) * 0.18;
                m.rotation.x = Math.sin(t * 0.5 + d.phase) * 0.05;
                m.rotation.y = d.baseRotY + Math.sin(t * 0.4 + d.phase) * 0.08 + cx * 0.18;
            });
            // particles rise
            const p = pGeo.attributes.position.array;
            for (let i = 0; i < pCount; i++) {
                p[i * 3 + 1] += vel[i];
                if (p[i * 3 + 1] > 7.5) { p[i * 3 + 1] = -7.5; p[i * 3] = (Math.random() - 0.5) * 20; }
            }
            pGeo.attributes.position.needsUpdate = true;
            particles.rotation.y = t * 0.02;
            // camera parallax ease
            cx += (tx - cx) * 0.05; cy += (ty - cy) * 0.05;
            camera.position.x = cx * 1.1;
            camera.position.y = -cy * 0.7;
            camera.lookAt(0, 0, 0);
            renderer.render(scene, camera);
        }
        if (reduce) { renderer.render(scene, camera); } else { animate(); }

        window.addEventListener('resize', () => {
            W = host.offsetWidth; H = host.offsetHeight;
            camera.aspect = W / H; camera.updateProjectionMatrix();
            renderer.setSize(W, H);
        });
    })();
