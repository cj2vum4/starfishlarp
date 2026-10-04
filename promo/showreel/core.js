/* ==========================================================
   海星劇本殺 · 形象影片 —— 共用引擎（core）
   ----------------------------------------------------------
   畫面格式無關的部分：數學/緩動、Canvas、字型排版、劇本資料、
   共用素材（光點、花瓣、顆粒、印章…）、Logo 去背、57 張劇本卡、
   3D 劇本牆、文字→Logo 粒子、後製（色差/光暈/暗角/顆粒）、逐格渲染。
   各格式的分鏡寫在自己的檔案（reel.js＝16:9、reel-916.js＝9:16），
   用 Reel.use({...}) 註冊；頁面在載入前以 window.REEL_CFG 指定 W/H/DUR。
   ========================================================== */
'use strict';
(function () {
const CFG = window.REEL_CFG || {};
const W = CFG.W || 1920, H = CFG.H || 1080, FPS = CFG.FPS || 60, DUR = CFG.DUR || 10, CX = W / 2, CY = H / 2, TAU = Math.PI * 2;
const GOLD = '#c8a056', GOLDL = '#ecd08a', TXT = '#ece3cf';
let S = null;   // 目前註冊的分鏡

/* ---------- math ---------- */
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, x) => clamp((x - a) / (b - a));
const E = {
  outExpo: t => t >= 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inExpo: t => t <= 0 ? 0 : Math.pow(2, 10 * t - 10),
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inCubic: t => t * t * t,
  inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  outQuart: t => 1 - Math.pow(1 - t, 4),
  inQuart: t => t * t * t * t,
  inOutQuart: t => t < .5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
  outQuint: t => 1 - Math.pow(1 - t, 5),
  outBack: t => { const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  smooth: t => t * t * (3 - 2 * t),
};
function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); };
const vnoise = x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i), hash(i + 1), u) * 2 - 1; };
const pulse = (t, t0, k) => t < t0 ? 0 : Math.exp(-(t - t0) * k);
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

/* ---------- canvases ---------- */
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.ctx = c.getContext('2d'); return c; }
const OUT = document.getElementById('out'); OUT.width = W; OUT.height = H;   // 輸出畫布尺寸跟著格式走
const octx = OUT.getContext('2d');
const SCN = mk(W, H), ACC = mk(W, H), TA = mk(W, H), TB = mk(W, H);
const BL1 = mk(W / 4, H / 4), BL2 = mk(W / 8, H / 8), CR = mk(W, H), CG = mk(W, H), CB = mk(W, H);
const MC = mk(8, 8).ctx;

/* ---------- type ---------- */
const F = { serif: "'NSerif','Cinzel'", sans: "'NSans','Mono'", cin: "'Cinzel'", mono: "'Mono'" };  // 中文子集不含拉丁字，交給 Cinzel／Mono 補
function setFont(c, fam, wt, px, lsPx = 0) { c.font = `${wt} ${px}px ${fam}`; c.letterSpacing = lsPx + 'px'; }
function txt(c, s, x, y, o = {}) {
  const { fam = F.serif, wt = 900, px = 40, fill = '#fff', align = 'center', base = 'middle', ls = 0, alpha = 1, stroke = null, lw = 2, op = null } = o;
  if (alpha <= 0) return;
  c.save(); setFont(c, fam, wt, px, ls * px); c.textAlign = align; c.textBaseline = base;
  if (op) c.globalCompositeOperation = op;
  c.globalAlpha *= alpha;
  let xx = x; if (ls) { if (align === 'center') xx += ls * px / 2; else if (align === 'right') xx += ls * px; }
  if (stroke) { c.lineJoin = 'round'; c.strokeStyle = stroke; c.lineWidth = lw; c.strokeText(s, xx, y); }
  if (fill) { c.fillStyle = fill; c.fillText(s, xx, y); }
  c.restore();
}
function tw(s, fam, wt, px, ls = 0) { setFont(MC, fam, wt, px, ls * px); return MC.measureText(s).width - (s.length ? ls * px : 0); }
function lgrad(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, col]) => g.addColorStop(o, col)); return g; }
const goldText = (c, x0, y0, x1, y1) => lgrad(c, x0, y0, x1, y1, [[0, '#fff8e6'], [.4, GOLDL], [.8, GOLD], [1, '#a8823e']]);
function starPath(c, x, y, r) { c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * .45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); }
function stars(c, x, y, n, r, on, off, align = 'left', gap = 7) {
  const w = 10 * r + 4 * gap; const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  for (let i = 0; i < 5; i++) { starPath(c, x0 + r + i * (2 * r + gap), y, r); c.fillStyle = i < n ? on : off; c.fill(); }
}
/* 寬度隨字距收合的逐字排版（品牌字定版用） */
function charRow(str, cx, px, ls) { const n = str.length, tot = n * px + (n - 1) * ls * px; return [...str].map((ch, i) => ({ ch, x: cx - tot / 2 + i * px * (1 + ls) + px / 2 })); }

/* ---------- data ---------- */
const SCRIPTS = window.SCRIPTS || [];
const byId = id => SCRIPTS.find(s => s.id === id) || {};
const THEME = {
  horror:  { en: 'HORROR',    c1: '#3d0909', c2: '#0b0202', acc: '#ff4a3d' },
  mystery: { en: 'MYSTERY',   c1: '#0c3638', c2: '#031010', acc: '#6fe0cf' },
  love:    { en: 'ROMANCE',   c1: '#5e2136', c2: '#1a070e', acc: '#ffa8c0' },
  history: { en: 'REPUBLIC',  c1: '#4d3413', c2: '#140c04', acc: '#ecd08a' },
  ancient: { en: 'ANCIENT',   c1: '#4f1717', c2: '#150505', acc: '#f0b878' },
  desert:  { en: 'DESERT',    c1: '#5e3d17', c2: '#170d04', acc: '#f4be72' },
  mytho:   { en: 'MYTHOLOGY', c1: '#15274f', c2: '#050a18', acc: '#dcbc72' },
  modern:  { en: 'MODERN',    c1: '#2b2645', c2: '#0a0913', acc: '#b4aeff' },
  happy:   { en: 'COMEDY',    c1: '#6e3d0b', c2: '#1f0f02', acc: '#ffcf55' },
  shrine:  { en: 'SHRINE',    c1: '#133d56', c2: '#04111a', acc: '#ff8462' },
  space:   { en: 'SCI-FI',    c1: '#1d1549', c2: '#05040f', acc: '#96d6ff' },
};
const mainName = n => n.split(/[：，]/)[0];
const NS = SCRIPTS.length;   // 劇本總數：計數器、文案、3D 陣位都跟著 scripts.js 走
const ZD = '〇一二三四五六七八九';
const zhNum = n => n >= 100 ? String(n) : n < 10 ? ZD[n] : (n >= 20 ? ZD[Math.floor(n / 10)] : '') + '十' + (n % 10 ? ZD[n % 10] : '');   // 57 → 五十七

/* ---------- 鏡頭震動（衝擊點由分鏡提供） ---------- */
function shake(t) {
  let x = 0, y = 0, r = 0;
  for (const im of S.IMPACTS) {
    const p = pulse(t, im.t, im.k); if (p < .002) continue;
    x += im.a * p * vnoise(t * 38 + im.t * 10); y += im.a * p * vnoise(t * 41 + im.t * 10 + 50); r += im.a * p * .0011 * vnoise(t * 30 + im.t * 7 + 90);
  }
  return { x, y, r };
}

/* ---------- assets / sprites ---------- */
const A = {};
function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('img ' + src)); i.src = src; }); }
function glow(col, size = 128, hard = .22) {
  const c = mk(size, size), g = c.ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, rgba(col, 1)); g.addColorStop(hard, rgba(col, .42)); g.addColorStop(.6, rgba(col, .08)); g.addColorStop(1, rgba(col, 0));
  c.ctx.fillStyle = g; c.ctx.fillRect(0, 0, size, size); return c;
}
function buildSprites() {
  A.gGold = glow([255, 214, 140]); A.gWhite = glow([255, 255, 255]); A.gCrim = glow([255, 70, 50]);
  A.gTeal = glow([110, 255, 225]); A.gCyan = glow([150, 215, 255]); A.gPink = glow([255, 190, 210]);
  // soft cloud
  A.cloud = mk(512, 256); { const c = A.cloud.ctx, g = c.createRadialGradient(256, 128, 0, 256, 128, 256); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.setTransform(1, 0, 0, .5, 0, 64); c.fillStyle = g; c.fillRect(0, -128, 512, 512); }   // 整個橢圓都填到（原本上緣有硬邊）
  // petal + blurred petal
  A.petal = mk(64, 64); petalShape(A.petal.ctx);
  A.petalB = mk(96, 96); A.petalB.ctx.filter = 'blur(7px)'; A.petalB.ctx.drawImage(A.petal, 16, 16); A.petalB.ctx.filter = 'none';
  // grain tiles
  A.grain = [0, 1, 2, 3].map(k => { const c = mk(256, 256), d = c.ctx.createImageData(256, 256), r = rng(77 + k); for (let i = 0; i < d.data.length; i += 4) { const v = 128 + (r() + r() + r() - 1.5) * 120; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } c.ctx.putImageData(d, 0, 0); return c; });
  // vignette
  A.vig = mk(W, H); { const c = A.vig.ctx, g = c.createRadialGradient(CX, CY, 380, CX, CY, 1180); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.7, 'rgba(0,0,0,.32)'); g.addColorStop(1, 'rgba(0,0,0,.78)'); c.fillStyle = g; c.fillRect(0, 0, W, H); }
  // scanlines
  A.scan = mk(4, 4); A.scan.ctx.fillStyle = 'rgba(0,0,0,.42)'; A.scan.ctx.fillRect(0, 0, 4, 2);
  // brush stroke (津門)
  A.brush = mk(2300, 420); { const c = A.brush.ctx, r = rng(9); c.fillStyle = '#0b0703'; for (let i = 0; i < 900; i++) { const x = r() * 2300, w = 40 + r() * 200, yc = 210 + (r() - .5) * 60 * Math.sin(x / 300), h = 260 + r() * 120 * Math.sin(x / 700 + 1) ** 2; c.globalAlpha = .08 + r() * .2; c.fillRect(x, yc - h / 2 + (r() - .5) * 30, w, h); } c.globalAlpha = 1; for (let i = 0; i < 260; i++) { c.fillStyle = 'rgba(11,7,3,.9)'; const x = r() * 2300, y = r() < .5 ? 60 + r() * 40 : 320 + r() * 40; c.fillRect(x, y, 2 + r() * 60, 1 + r() * 3); } }
  // seal stamp
  A.seal = mk(240, 240); { const c = A.seal.ctx; c.fillStyle = '#b8261d'; c.fillRect(14, 14, 212, 212); c.strokeStyle = '#f6e7d0'; c.lineWidth = 6; c.strokeRect(30, 30, 180, 180); txt(c, '津', 120, 76, { px: 86, fill: '#f6e7d0' }); txt(c, '門', 120, 166, { px: 86, fill: '#f6e7d0' }); c.globalCompositeOperation = 'destination-out'; const r = rng(4); for (let i = 0; i < 380; i++) { c.globalAlpha = r() * .7; c.fillRect(r() * 240, r() * 240, 1 + r() * 7, 1 + r() * 3); } }
  A.runes = Array.from({ length: 28 }, (_, i) => { const r = rng(300 + i); return Array.from({ length: 2 + (r() * 2 | 0) }, () => [r() * 14 - 7, r() * 26 - 13, r() * 14 - 7, r() * 26 - 13]); });
  // keyhole glow sprite
  A.kh = mk(260, 320); { const c = A.kh.ctx; c.translate(130, 160); c.shadowColor = 'rgba(255,60,40,.9)'; c.shadowBlur = 40; keyholePath(c, 0, 0, 1.1); c.fillStyle = '#ff5a3c'; c.fill(); c.shadowBlur = 0; keyholePath(c, 0, 0, 1.1); const g = c.createRadialGradient(0, -24, 0, 0, -10, 90); g.addColorStop(0, '#ffd6a0'); g.addColorStop(.35, '#ff4a30'); g.addColorStop(1, '#5a0d08'); c.fillStyle = g; c.fill(); c.strokeStyle = GOLDL; c.lineWidth = 3; c.stroke(); }
}
function petalShape(c) { c.translate(32, 32); c.beginPath(); c.moveTo(0, -26); c.bezierCurveTo(20, -18, 20, 14, 0, 26); c.bezierCurveTo(-20, 14, -20, -18, 0, -26); const g = c.createLinearGradient(0, -26, 0, 26); g.addColorStop(0, '#fff6f8'); g.addColorStop(1, '#ffb6c8'); c.fillStyle = g; c.fill(); c.setTransform(1, 0, 0, 1, 0, 0); }
function boltPts(r, x0, y0, x1, y1) {
  let pts = [[x0, y0], [x1, y1]];
  for (let it = 0, off = 170; it < 7; it++, off *= .55) { const n = [pts[0]]; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; n.push([(a[0] + b[0]) / 2 + (r() - .5) * off, (a[1] + b[1]) / 2 + (r() - .5) * off * .3]); n.push(b); } pts = n; }
  const branches = []; for (let k = 0; k < 4; k++) { const i = 20 + (r() * 80 | 0), p = pts[i]; let q = [p], x = p[0], y = p[1], dir = r() < .5 ? -1 : 1; for (let j = 0; j < 18; j++) { x += dir * (8 + r() * 14); y += 6 + r() * 16; q.push([x, y]); } branches.push(q); }
  return { pts, branches };
}
function keyholePath(c, x, y, s) {
  c.beginPath(); c.moveTo(x + 14.4 * s, y + 8.8 * s); c.lineTo(x + 30 * s, y + 62 * s); c.lineTo(x - 30 * s, y + 62 * s); c.lineTo(x - 14.4 * s, y + 8.8 * s);
  c.arc(x, y - 22 * s, 34 * s, 115 * Math.PI / 180, 425 * Math.PI / 180, false); c.closePath();
}

/* logo：以亮度去背，取得透明底的海星（粒子目標與掃光遮罩都用它） */
function buildLogo() {
  const S = 512, c = mk(S, S); c.ctx.drawImage(A.logoImg, 0, 0, S, S);
  const d = c.ctx.getImageData(0, 0, S, S), p = d.data;
  for (let i = 0; i < p.length; i += 4) {
    const r = p[i], g = p[i + 1], b = p[i + 2], l = (.3 * r + .59 * g + .11 * b) / 255;
    const x = (i / 4) % S - S / 2, y = Math.floor(i / 4 / S) - S / 2, rad = Math.hypot(x, y) / (S / 2);
    let a = E.smooth(inv(.13, .34, l)) * (1 - inv(.86, .97, rad));
    const red = r > g * 1.6 && r > 60; if (red) a = Math.max(a, inv(40, 120, r) * (1 - inv(.2, .3, rad)));
    p[i + 3] = a * 255;
  }
  c.ctx.putImageData(d, 0, 0); A.logo = c;
  A.logoGlow = mk(S, S); A.logoGlow.ctx.filter = 'blur(18px)'; A.logoGlow.ctx.drawImage(c, 0, 0); A.logoGlow.ctx.filter = 'none';
  A.logoWork = mk(S, S);
}

/* ---------- cards (劇本卡，3D 牆用的貼圖) ----------
   有海報（posters/<id>.jpg，由 fetch-posters.py 下載）就用海報；沒有的才用文字設計 */
function posterCard(s, i, img) {
  const cw = 480, ch = 720, c = mk(cw, ch), x = c.ctx, th = THEME[s.theme] || THEME.modern;
  x.fillStyle = '#080603'; x.fillRect(0, 0, cw, ch);
  const k = Math.max(cw / img.width, ch / img.height), w = img.width * k, h = img.height * k;
  x.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);   // cover 裁切，置中
  // 下緣資訊條：劇本名＋人數時長＋難度（小尺寸時也認得出是哪一本）
  x.fillStyle = lgrad(x, 0, 500, 0, ch, [[0, 'rgba(8,6,3,0)'], [.42, 'rgba(8,6,3,.8)'], [1, 'rgba(8,6,3,.96)']]); x.fillRect(0, 500, cw, ch - 500);
  const nm = mainName(s.name), px = Math.min(46, 400 / Math.max(1, [...nm].length));
  x.save(); x.shadowColor = 'rgba(0,0,0,.8)'; x.shadowBlur = 10; txt(x, nm, 240, 622, { px, fill: '#fffaf0', ls: .06 }); x.restore();
  x.fillStyle = th.acc; x.fillRect(240 - 26, 652, 52, 2);
  txt(x, `${s.players}人 · ${s.timeLabel}`, 240 - 52, 682, { fam: F.sans, wt: 500, px: 18, fill: 'rgba(236,227,207,.85)', ls: .06 });
  stars(x, 240 + 92, 682, s.difficulty, 8, GOLDL, 'rgba(236,208,138,.28)', 'center', 4);
  // 框與編號
  x.strokeStyle = 'rgba(236,208,138,.9)'; x.lineWidth = 3; x.strokeRect(10, 10, cw - 20, ch - 20);
  x.strokeStyle = 'rgba(236,208,138,.35)'; x.lineWidth = 1; x.strokeRect(18, 18, cw - 36, ch - 36);
  x.fillStyle = 'rgba(8,6,3,.72)'; x.fillRect(22, 22, 86, 30);
  txt(x, 'No.' + String(i + 1).padStart(2, '0'), 65, 38, { fam: F.cin, wt: 700, px: 16, ls: .12, fill: GOLDL });
  return c;
}
function cardCanvas(s, i) {
  if (A.posters && A.posters[s.id]) return posterCard(s, i, A.posters[s.id]);
  const cw = 480, ch = 720, c = mk(cw, ch), x = c.ctx, th = THEME[s.theme] || THEME.modern, r = rng(500 + i);
  x.fillStyle = lgrad(x, 0, 0, 0, ch, [[0, th.c1], [1, th.c2]]); x.fillRect(0, 0, cw, ch);
  const g = x.createRadialGradient(240, 260, 0, 240, 260, 340); g.addColorStop(0, th.acc + '55'); g.addColorStop(1, th.acc + '00'); x.fillStyle = g; x.fillRect(0, 0, cw, ch);
  // motif
  x.save(); x.strokeStyle = th.acc; x.fillStyle = th.acc; x.globalAlpha = .22; x.lineWidth = 2;
  const m = s.theme;
  if (m === 'horror') { x.lineWidth = 10; for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(90 + k * 70, 120); x.lineTo(300 + k * 70, 560); x.stroke(); } }
  else if (m === 'mystery') { for (let k = 1; k < 7; k++) { x.beginPath(); x.arc(240, 330, k * 34, 0, TAU); x.stroke(); } }
  else if (m === 'love') { for (let k = 0; k < 14; k++) { x.save(); x.translate(r() * cw, r() * ch); x.rotate(r() * TAU); x.scale(.5 + r(), .5 + r()); x.drawImage(A.petal, -32, -32); x.restore(); } }
  else if (m === 'space') { for (let k = 0; k < 90; k++) { x.fillRect(r() * cw, r() * ch, 2, 2); } x.beginPath(); x.ellipse(240, 330, 190, 46, -.3, 0, TAU); x.stroke(); x.beginPath(); x.arc(240, 330, 90, 0, TAU); x.stroke(); }
  else if (m === 'happy') { x.translate(240, 330); for (let k = 0; k < 16; k++) { x.rotate(TAU / 16); x.beginPath(); x.moveTo(0, 0); x.lineTo(-20, -420); x.lineTo(20, -420); x.fill(); } }
  else if (m === 'shrine') { x.globalAlpha = .3; x.fillRect(80, 170, 320, 18); x.fillRect(110, 220, 260, 12); x.fillRect(140, 170, 18, 420); x.fillRect(322, 170, 18, 420); }
  else if (m === 'mytho') { x.lineWidth = 5; x.beginPath(); x.moveTo(300, 90); x.lineTo(200, 300); x.lineTo(280, 300); x.lineTo(170, 600); x.stroke(); }
  else if (m === 'modern') { for (let k = 0; k < 12; k++) { x.beginPath(); x.moveTo(0, k * 60); x.lineTo(cw, k * 60); x.stroke(); x.beginPath(); x.moveTo(k * 48, 0); x.lineTo(k * 48, ch); x.stroke(); } }
  else { x.beginPath(); x.arc(240, 300, 130, 0, TAU); x.fill(); for (let k = 0; k < 6; k++) x.fillRect(60, 470 + k * 14, 360, 3); }
  x.restore();
  // frame
  x.strokeStyle = 'rgba(236,208,138,.85)'; x.lineWidth = 2.5; x.strokeRect(18, 18, cw - 36, ch - 36);
  x.strokeStyle = 'rgba(236,208,138,.35)'; x.lineWidth = 1; x.strokeRect(28, 28, cw - 56, ch - 56);
  // title — 直書，長名分兩欄（右欄先讀）
  const nm = mainName(s.name), chars = [...nm], cols = chars.length > 6 ? 2 : 1, per = Math.ceil(chars.length / cols);
  const px = Math.min(cols === 1 ? 112 : 84, 400 / per), top = 300 - per * px / 2 + px / 2 - 20;
  x.save(); x.shadowColor = th.acc; x.shadowBlur = 26;
  for (let k = 0; k < chars.length; k++) { const col = Math.floor(k / per), row = k % per, cx = cols === 1 ? 240 : 240 + (col === 0 ? px * .62 : -px * .62); txt(x, chars[k], cx, top + row * px * 1.02, { px, fill: '#fffaf0' }); }
  x.restore();
  const sub = s.name.slice(nm.length).replace(/^[：，]/, '');
  if (sub) txt(x, sub.length > 14 ? sub.slice(0, 13) + '…' : sub, 240, 548, { fam: F.serif, wt: 700, px: 20, fill: 'rgba(255,250,240,.75)' });
  txt(x, th.en, 240, 596, { fam: F.cin, wt: 700, px: 22, ls: .38, fill: th.acc });
  stars(x, 240, 634, s.difficulty, 10, GOLDL, 'rgba(236,208,138,.25)', 'center');
  txt(x, `${s.players}人 · ${s.timeLabel}`, 240, 672, { fam: F.sans, wt: 500, px: 19, fill: 'rgba(236,227,207,.8)', ls: .1 });
  txt(x, 'No.' + String(i + 1).padStart(2, '0'), 46, 54, { fam: F.cin, wt: 700, px: 16, ls: .15, fill: 'rgba(236,208,138,.7)', align: 'left' });
  return c;
}

/* ---------- 3D wall (three.js) ---------- */
const W3 = {};
function build3D(opt = {}) {
  const T = window.THREE, glc = document.createElement('canvas'); glc.width = W; glc.height = H;
  const R = new T.WebGLRenderer({ canvas: glc, antialias: true, preserveDrawingBuffer: true, alpha: false });
  R.setPixelRatio(1); R.setSize(W, H, false);
  const S = new T.Scene(); S.background = new T.Color('#080603'); S.fog = new T.Fog(0x080603, opt.fogNear || 19, 52);
  const SX = opt.spreadX || 1, SY = opt.spreadY || .8, DX = opt.dustW || 34, DY = opt.dustH || 20;   // 直式把漩渦與金塵拉高
  const cam = new T.PerspectiveCamera(opt.fov || 40, W / H, .05, 200);
  const geo = new T.PlaneGeometry(1, 1.5), boil = SCRIPTS.findIndex(s => s.id === (opt.first || 'feiteng'));  // 第一張＝快剪最後一格縮成的那張
  // 海星陣位：5 臂 × 11 張（57 部時再加中心 2 張）；劇本少於 55 部時先拿掉臂尖，多於 55 部時都疊在中心
  let slots = []; for (let k = 0; k < 5; k++) for (let j = 0; j < 11; j++) slots.push(armPose(k, j));
  if (NS < slots.length) { const keep = slots.map((s, i) => [s.row, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, NS).map(p => p[1]).sort((a, b) => a - b); slots = keep.map(i => slots[i]); }
  const extra = NS - slots.length; for (let c = 0; c < extra; c++) slots.push({ x: 0, y: 0, z: .12 - .02 * c, rx: 0, ry: 0, rz: extra === 1 ? 0 : .62 * (.5 - c / (extra - 1)), sc: .9 });
  const order = SCRIPTS.map((_, i) => i).filter(i => i !== boil), r = rng(2024);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  if (boil >= 0) order.unshift(boil);
  const cards = [];
  order.forEach((si, n) => {
    const s = SCRIPTS[si], tex = new T.CanvasTexture(cardCanvas(s, si)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 8;
    const mat = new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide }), m = new T.Mesh(geo, mat); S.add(m);
    const q = rng(900 + n);
    let a; if (n === 0) a = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sc: 1 };
    else { const front = n % 4 === 0, ang = n * 2.39996 + q() * .4, rad = front ? 2.4 + q() * 3.6 : 1.7 + q() * 6.5; a = { x: Math.cos(ang) * rad * SX, y: Math.sin(ang) * rad * SY, z: front ? 4.6 + q() * 9 : -1.2 - q() * 30, rx: q() * .7 - .35, ry: q() * .9 - .45, rz: q() * .5 - .25, sc: 1.3 }; }
    cards.push({ m, mat, A: a, B: slots[n], d: q(), s: slots[n].s || 0 });
  });
  // 3D 金塵
  const N = 900, pos = new Float32Array(N * 3), pr = rng(11); for (let i = 0; i < N; i++) { pos[i * 3] = (pr() - .5) * DX; pos[i * 3 + 1] = (pr() - .5) * DY; pos[i * 3 + 2] = -40 + pr() * 56; }
  const pg = new T.BufferGeometry(); pg.setAttribute('position', new T.BufferAttribute(pos, 3));
  const ptex = new T.CanvasTexture(A.gGold); ptex.colorSpace = T.SRGBColorSpace;
  const pts = new T.Points(pg, new T.PointsMaterial({ size: .16, map: ptex, transparent: true, depthWrite: false, blending: T.AdditiveBlending, color: 0xffd9a0, opacity: .9 }));
  S.add(pts);
  Object.assign(W3, { T, R, S, cam, cards, glc, pts });
}
/* 一臂 11 張：由粗到細 3-3-2-2-1，沿臂微彎，像海星的腕 */
const ARM_ROWS = [{ r: 1.4, n: 3, w: .52, sc: .96 }, { r: 2.45, n: 3, w: .4, sc: .84 }, { r: 3.4, n: 2, w: .26, sc: .72 }, { r: 4.25, n: 2, w: .17, sc: .6 }, { r: 5.0, n: 1, w: 0, sc: .5 }];
function armPose(k, j) {
  let row = 0, idx = j; while (idx >= ARM_ROWS[row].n) { idx -= ARM_ROWS[row].n; row++; }
  const R = ARM_ROWS[row], s = R.r / 5, a0 = Math.PI / 2 + k * TAU / 5, a = a0 - .3 * s * s;
  const lat = (idx - (R.n - 1) / 2) * R.w * 2 / Math.max(1, R.n - 1) * (R.n === 3 ? 1 : .5) * (R.n > 1 ? 1 : 0);
  const dir = a - .6 * s * .3, nx = -Math.sin(dir), ny = Math.cos(dir);
  return { x: Math.cos(a) * R.r + nx * lat, y: Math.sin(a) * R.r + ny * lat, z: -.05 * row - .015 * Math.abs(lat), rx: 0, ry: 0, rz: dir - Math.PI / 2 + lat * .35, sc: R.sc, s, row };
}

/* ---------- particles (文字 → Logo) ---------- */
const P = { n: 0 };
function buildParticles(drawSrc, LOGO) {
  P.logo = LOGO;
  // 來源：「這一次，」「你是誰？」最終定位的像素
  const c = mk(W, H), x = c.ctx; drawSrc(x);
  const d = x.getImageData(0, 0, W, H).data, src = [], r = rng(8);
  for (let y = 0; y < H; y += 3) for (let xx = 0; xx < W; xx += 3) { const i = (y * W + xx) * 4; if (d[i + 3] > 140) src.push([xx, y, d[i], d[i + 1], d[i + 2]]); }
  A.qText = c;
  // 目標：Logo 像素（亮處權重高）
  const l = A.logo.ctx.getImageData(0, 0, 512, 512).data, tgt = [];
  for (let y = 0; y < 512; y += 2) for (let xx = 0; xx < 512; xx += 2) { const i = (y * 512 + xx) * 4, a = l[i + 3] / 255; if (a > .35 && r() < a) tgt.push([LOGO.x + (xx - 256) * LOGO.s / 512, LOGO.y + (y - 256) * LOGO.s / 512, l[i], l[i + 1], l[i + 2]]); }
  const n = 4600; P.n = n; P.d = new Float32Array(n * 10);
  let minx = 1e9, maxx = -1e9; src.forEach(p => { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); });
  P.minx = minx; P.maxx = maxx;
  for (let k = 0; k < n; k++) {
    const s = src[Math.floor(r() * src.length)], tg = tgt[Math.floor(r() * tgt.length)], o = k * 10;
    const ang = Math.atan2(s[1] - LOGO.y, s[0] - LOGO.x) + 1.4 + r() * .9, rad = 260 + r() * 520;
    P.d[o] = s[0]; P.d[o + 1] = s[1]; P.d[o + 2] = tg[0]; P.d[o + 3] = tg[1];
    P.d[o + 4] = LOGO.x + Math.cos(ang) * rad; P.d[o + 5] = LOGO.y + Math.sin(ang) * rad;
    P.d[o + 6] = (s[0] - minx) / (maxx - minx) * .13 + r() * .03; P.d[o + 7] = r(); P.d[o + 8] = k % 6; P.d[o + 9] = .7 + r() * .9;
  }
  P.cols = ['#fff3d6', '#ffe1a0', '#f2c46e', '#d9a14e', '#ffd0a8', '#ff9a6a'];
}

/* ---------- 合成 ---------- */
function drawScene(c, t) {
  c.reset();   // 每個子格都從乾淨的 context 開始（lineCap、虛線…都不會從上一格帶過來）
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);   // 先清成黑：子格之間不殘留上一格的像素（渲染才會完全決定性）
  // 震動時放大到足以蓋滿畫面（平移＋微旋轉都要涵蓋），邊緣不露出底色
  const s = shake(t), ar = Math.abs(s.r), cover = Math.max(1 + 2 * (Math.abs(s.x) + ar * CY) / W, 1 + 2 * (Math.abs(s.y) + ar * CX) / H) + .002 * Math.min(1, Math.abs(s.x) + Math.abs(s.y) + ar * 1000);   // 安全邊隨震動淡掉，不會在停震那格跳一下
  const k = Math.max(1 + (Math.abs(s.x) + Math.abs(s.y)) / 700, s.x || s.y ? cover : 1);   // 保留原本的震動放大量，只在不夠蓋滿時再加大
  c.translate(CX + s.x, CY + s.y); c.rotate(s.r); c.scale(k, k); c.translate(-CX, -CY);
  S.draw(c, t);
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
  S.hud(c, t);
}
function caAmt(t) { let a = 0; for (const im of S.IMPACTS) a += im.a * pulse(t, im.t, 9) * .32; return a + 1.2; }
function post(t) {
  const o = octx; o.setTransform(1, 0, 0, 1, 0, 0); o.globalAlpha = 1; o.globalCompositeOperation = 'source-over'; o.filter = 'none';
  const ca = caAmt(t);
  if (ca > 1.5) {
    [[CR, '#f00'], [CG, '#0f0'], [CB, '#00f']].forEach(([cv, col]) => { const x = cv.ctx; x.globalCompositeOperation = 'source-over'; x.drawImage(ACC, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over'; });
    o.fillStyle = '#000'; o.fillRect(0, 0, W, H); o.globalCompositeOperation = 'lighter';
    [[CR, 1 + 2 * ca / 960], [CG, 1 + ca / 960], [CB, 1]].forEach(([cv, s]) => { o.setTransform(s, 0, 0, s, CX * (1 - s), CY * (1 - s)); o.drawImage(cv, 0, 0); });   // 三個色版只放大不縮小：邊緣不會缺色
    o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over';
  } else o.drawImage(ACC, 0, 0);
  // bloom
  const b = S.bloom(t);
  BL1.ctx.filter = 'brightness(.85) contrast(2.4)'; BL1.ctx.drawImage(OUT, 0, 0, W / 4, H / 4);   // 先鋪一層未模糊的：邊緣模糊取不到外面時用它，不會變黑
  BL1.ctx.filter = 'brightness(.85) contrast(2.4) blur(4px)'; BL1.ctx.drawImage(OUT, 0, 0, W / 4, H / 4); BL1.ctx.filter = 'none';
  BL2.ctx.drawImage(BL1, 0, 0, W / 8, H / 8); BL2.ctx.filter = 'blur(5px)'; BL2.ctx.drawImage(BL1, 0, 0, W / 8, H / 8); BL2.ctx.filter = 'none';
  o.globalCompositeOperation = 'lighter'; o.globalAlpha = b; o.drawImage(BL1, 0, 0, W, H); o.globalAlpha = b * .8; o.drawImage(BL2, 0, 0, W, H);
  o.globalAlpha = 1; o.globalCompositeOperation = 'source-over';
  o.drawImage(A.vig, 0, 0);
  S.flash(o, t);   // 衝擊閃光（分鏡決定時間點與位置）
  // grain
  const f = Math.round(t * FPS), gt = A.grain[f % 4], pat = o.createPattern(gt, 'repeat');
  pat.setTransform(new DOMMatrix().translate(hash(f) * 256, hash(f + 9) * 256));
  o.globalCompositeOperation = 'overlay'; o.globalAlpha = .075; o.fillStyle = pat; o.fillRect(0, 0, W, H);
  o.globalAlpha = 1; o.globalCompositeOperation = 'source-over';
  const fade = S.fade(t);
  if (fade > 0) { o.fillStyle = `rgba(0,0,0,${fade})`; o.fillRect(0, 0, W, H); }
}

window.renderFrame = function (f) {
  const t = f / FPS, n = S.subN(t), shutter = .5 / FPS, a = ACC.ctx;
  a.setTransform(1, 0, 0, 1, 0, 0); a.globalCompositeOperation = 'source-over';
  for (let k = 0; k < n; k++) {
    drawScene(SCN.ctx, Math.min(DUR - 1e-4, t + shutter * k / n));
    a.globalAlpha = 1 / (k + 1); a.drawImage(SCN, 0, 0);
  }
  a.globalAlpha = 1;
  post(t);
  return true;
};
window.reelInfo = { W, H, FPS, DUR, frames: Math.round(FPS * DUR) };

async function start() {
  await Promise.all([...document.fonts].map(f => f.load()));  // 每個 unicode-range 子集都先載入
  await document.fonts.ready;
  A.logoImg = await loadImg('../../pwa/icon-512.png');
  A.rabbit = await loadImg('../../劇本資料/角色海報/《疯兔子》—主海报.jpg');
  // 劇本海報（posters/index.json 列出已下載的 id；沒有清單或單張失敗都改用文字卡）
  A.posters = {};
  const ids = await fetch('posters/index.json').then(r => r.ok ? r.json() : [], () => []);
  await Promise.all(ids.map(id => loadImg(`posters/${encodeURIComponent(id)}.jpg`).then(img => { A.posters[id] = img; }, () => {})));
  buildSprites(); buildLogo(); await S.init();
  return true;
}
window.Reel = {
  W, H, FPS, DUR, CX, CY, TAU, GOLD, GOLDL, TXT,
  clamp, lerp, inv, E, rng, hash, vnoise, pulse, rgba,
  mk, SCN, ACC, TA, TB, F, setFont, txt, tw, lgrad, goldText, starPath, stars, charRow,
  SCRIPTS, byId, THEME, mainName, NS, zhNum,
  checkIds(ids) { const miss = [...new Set(ids)].filter(id => !SCRIPTS.some(s => s.id === id)); if (miss.length) throw new Error('scripts.js 找不到影片要用的劇本 id：' + miss.join(', ')); },
  A, loadImg, glow, petalShape, boltPts, keyholePath, cardCanvas, build3D, W3, ARM_ROWS, armPose, P, buildParticles,
  use(scene) { S = scene; window.reelReady = start(); return window.reelReady; },
};
})();
