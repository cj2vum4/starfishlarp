/* ==========================================================
   海星劇本殺 · 10 秒形象影片（motion showreel）
   ----------------------------------------------------------
   決定性渲染：window.renderFrame(f) 畫出第 f 格（t = f/60 秒），
   render.js 逐格擷取後交給 ffmpeg；同一個 f 永遠畫出同一張圖。
   每格以多個子格（sub-frame）累積，做出真正的動態模糊。

   分鏡（150 BPM，一拍 0.4s）
   0.0–1.6  SC.01 入口：羅盤環點亮、鑰匙孔、穿過鑰匙孔
   1.6–4.0  SC.02 世界：八個劇本世界快剪（越剪越快）
   4.0–6.0  SC.03 群像：57 張劇本卡 3D 拉遠 → 排成海星
   6.0–7.6  SC.04 你　：推理／情感／驚悚／歡樂 甩鏡 → 這一次，你是誰？
   7.6–10.0 LOGO    ：文字粒子化 → 匯聚成海星 Logo → 品牌字定版
   ========================================================== */
'use strict';
(function () {
const W = 1920, H = 1080, FPS = 60, DUR = 10, CX = W / 2, CY = H / 2, TAU = Math.PI * 2;
const GOLD = '#c8a056', GOLDL = '#ecd08a', TXT = '#ece3cf';

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
const OUT = document.getElementById('out'), octx = OUT.getContext('2d');
const SCN = mk(W, H), ACC = mk(W, H), TA = mk(W, H), TB = mk(W, H);
const BL1 = mk(480, 270), BL2 = mk(240, 135), CR = mk(W, H), CG = mk(W, H), CB = mk(W, H);
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

/* ---------- timeline ---------- */
const CUTS = [
  { t: 1.6, d: .4, id: 'wangzuo', draw: cutThrone },
  { t: 2.0, d: .4, id: 'chunzhou', draw: cutSpring, tr: 'iris' },
  { t: 2.4, d: .4, id: 'fengtuz', draw: cutRabbit, tr: 'glitch' },
  { t: 2.8, d: .4, id: 'qunxing', draw: cutStars, tr: 'zoom' },
  { t: 3.2, d: .2, id: 'jinmen', draw: cutTianjin, tr: 'slats' },
  { t: 3.4, d: .2, id: 'qingtian', draw: cutShrine, tr: 'slide' },
  { t: 3.6, d: .2, id: 'lichuan', draw: cutLichuan, tr: 'shutter' },
  { t: 3.8, d: .2, id: 'feiteng', draw: cutBoil, tr: 'flash' },
];
const IMPACTS = [
  { t: 1.6, a: 26, k: 7 }, { t: 2.0, a: 6, k: 12 }, { t: 2.4, a: 16, k: 10 }, { t: 2.8, a: 8, k: 12 },
  { t: 3.2, a: 12, k: 14 }, { t: 3.4, a: 6, k: 14 }, { t: 3.6, a: 7, k: 14 }, { t: 3.8, a: 10, k: 14 },
  { t: 6.0, a: 10, k: 14 }, { t: 6.2, a: 9, k: 14 }, { t: 6.4, a: 16, k: 14 }, { t: 6.6, a: 9, k: 14 },
  { t: 6.8, a: 8, k: 10 }, { t: 7.2, a: 22, k: 9 }, { t: 8.0, a: 30, k: 6 },
];
function shake(t) {
  let x = 0, y = 0, r = 0;
  for (const im of IMPACTS) {
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
  A.cloud = mk(512, 256); { const c = A.cloud.ctx, g = c.createRadialGradient(256, 128, 0, 256, 128, 256); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.setTransform(1, 0, 0, .5, 0, 64); c.fillStyle = g; c.fillRect(0, 0, 512, 512); }
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
  // torii
  A.torii = mk(W, H); { const c = A.torii.ctx; c.fillStyle = '#d4402a'; c.beginPath(); c.moveTo(300, 250); c.quadraticCurveTo(960, 300, 1620, 250); c.lineTo(1640, 196); c.quadraticCurveTo(960, 250, 280, 196); c.closePath(); c.fill(); c.fillStyle = '#1b1414'; c.beginPath(); c.moveTo(270, 196); c.quadraticCurveTo(960, 244, 1650, 196); c.lineTo(1660, 172); c.quadraticCurveTo(960, 222, 260, 172); c.closePath(); c.fill(); c.fillStyle = '#d4402a'; c.fillRect(400, 330, 1120, 46); c.fillRect(495, 230, 72, 900); c.fillRect(1353, 230, 72, 900); c.fillRect(925, 262, 70, 72); c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(495, 230, 18, 900); c.fillRect(1353, 230, 18, 900); }
  // lightning bolts
  A.bolts = [boltPts(rng(31), 1260, -40, 1080, 760), boltPts(rng(57), 620, -40, 760, 640)];
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

/* ---------- cards (57 劇本卡，3D 牆用的貼圖) ---------- */
function cardCanvas(s, i) {
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
function build3D() {
  const T = window.THREE, glc = document.createElement('canvas'); glc.width = W; glc.height = H;
  const R = new T.WebGLRenderer({ canvas: glc, antialias: true, preserveDrawingBuffer: true, alpha: false });
  R.setPixelRatio(1); R.setSize(W, H, false);
  const S = new T.Scene(); S.background = new T.Color('#080603'); S.fog = new T.Fog(0x080603, 19, 52);
  const cam = new T.PerspectiveCamera(40, W / H, .05, 200);
  const geo = new T.PlaneGeometry(1, 1.5), boil = SCRIPTS.findIndex(s => s.id === 'feiteng');
  // 海星陣位：5 臂 × 11 張 + 中心 2 張
  const slots = []; for (let k = 0; k < 5; k++) for (let j = 0; j < 11; j++) slots.push(armPose(k, j));
  slots.push({ x: 0, y: 0, z: .12, rx: 0, ry: 0, rz: .31, sc: .9 }, { x: 0, y: 0, z: .1, rx: 0, ry: 0, rz: -.31, sc: .9 });
  const order = SCRIPTS.map((_, i) => i).filter(i => i !== boil), r = rng(2024);
  for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  order.unshift(boil);
  const cards = [];
  order.forEach((si, n) => {
    const s = SCRIPTS[si], tex = new T.CanvasTexture(cardCanvas(s, si)); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 8;
    const mat = new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide }), m = new T.Mesh(geo, mat); S.add(m);
    const q = rng(900 + n);
    let a; if (n === 0) a = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sc: 1 };
    else { const front = n % 4 === 0, ang = n * 2.39996 + q() * .4, rad = front ? 2.4 + q() * 3.6 : 1.7 + q() * 6.5; a = { x: Math.cos(ang) * rad, y: Math.sin(ang) * rad * .8, z: front ? 4.6 + q() * 9 : -1.2 - q() * 30, rx: q() * .7 - .35, ry: q() * .9 - .45, rz: q() * .5 - .25, sc: 1.3 }; }
    cards.push({ m, mat, A: a, B: slots[n], d: q(), s: slots[n].s || 0 });
  });
  // 3D 金塵
  const N = 900, pos = new Float32Array(N * 3), pr = rng(11); for (let i = 0; i < N; i++) { pos[i * 3] = (pr() - .5) * 34; pos[i * 3 + 1] = (pr() - .5) * 20; pos[i * 3 + 2] = -40 + pr() * 56; }
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
  return { x: Math.cos(a) * R.r + nx * lat, y: Math.sin(a) * R.r + ny * lat, z: -.05 * row - .015 * Math.abs(lat), rx: 0, ry: 0, rz: dir - Math.PI / 2 + lat * .35, sc: R.sc, s };
}

/* ---------- particles (文字 → Logo) ---------- */
const P = { n: 0 };
const LOGO = { x: 960, y: 392, s: 600 };
function buildParticles() {
  // 來源：「這一次，」「你是誰？」最終定位的像素
  const c = mk(W, H), x = c.ctx; drawQuestion(x, 1);
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

/* ========================================================
   SC.01 入口 —— 羅盤環、鑰匙孔、穿門
   ======================================================== */
const KH = { x: 960, y: 500, s: 1.6 }, RING_R = 300;
const DUST = Array.from({ length: 150 }, (_, i) => { const r = rng(40 + i); return { x: r() * W, y: r() * H, d: .25 + r() * .75, ph: r() * TAU, s: 4 + r() * 18 }; });
function sceneA(c, t) {
  const base = c.getTransform();
  c.fillStyle = '#060403'; c.fillRect(0, 0, W, H);
  const p = inv(1.2, 1.6, t), dive = E.inExpo(p), z = lerp(1, 1.07, E.inOutCubic(inv(0, 1.2, t))) * Math.pow(64, dive);
  const ax = KH.x, ay = KH.y - 22 * KH.s, beat = Math.max(pulse(t, 0, 6), pulse(t, .4, 6), pulse(t, .8, 6), pulse(t, 1.2, 6));
  // warm radial
  const g = c.createRadialGradient(ax, ay, 0, ax, ay, 820); g.addColorStop(0, `rgba(120,28,16,${.34 + beat * .12})`); g.addColorStop(.5, 'rgba(50,14,8,.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  // dust (parallax zoom)
  c.globalCompositeOperation = 'lighter';
  for (const m of DUST) {
    const zz = Math.pow(z, m.d * 1.3), x0 = m.x + Math.sin(t * .7 + m.ph) * 14, y0 = (m.y - t * 26 * m.d + H) % H;
    const x = ax + (x0 - ax) * zz, y = ay + (y0 - ay) * zz, s = m.s * Math.pow(zz, .7);
    const a = (.16 + .3 * m.d) * inv(0, .5, t) * (1 - inv(160, 600, s)); if (a <= 0) continue;
    c.globalAlpha = a; c.drawImage(A.gGold, x - s, y - s, s * 2, s * 2);
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.translate(ax, ay); c.scale(z, z); c.rotate(-.42 * E.inCubic(p)); c.translate(-ax, -ay);
  // compass ring
  const prog = E.inOutCubic(inv(.04, 1.05, t)), a0 = -Math.PI / 2, a1 = a0 + prog * TAU, R = RING_R;
  if (prog > 0) {
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(200,160,86,.95)'; c.lineWidth = 2.4; c.beginPath(); c.arc(KH.x, KH.y, R, a0, a1); c.stroke();
    c.strokeStyle = 'rgba(200,160,86,.45)'; c.lineWidth = 1; c.beginPath(); c.arc(KH.x, KH.y, R - 20, a0, a1); c.stroke();
    for (let i = 0; i < 96; i++) { const ai = a0 + i / 96 * TAU; if (ai > a1) break; const L = i % 12 === 0 ? 16 : 7; c.strokeStyle = i % 12 === 0 ? 'rgba(236,208,138,.8)' : 'rgba(200,160,86,.42)'; c.lineWidth = i % 12 === 0 ? 2 : 1; c.beginPath(); c.moveTo(KH.x + Math.cos(ai) * (R - 20), KH.y + Math.sin(ai) * (R - 20)); c.lineTo(KH.x + Math.cos(ai) * (R - 20 - L), KH.y + Math.sin(ai) * (R - 20 - L)); c.stroke(); }
    for (let k = 0; k < 8; k++) {
      const sc = E.outBack(clamp((prog - k / 8) / .07)); if (sc <= 0) continue; const ak = a0 + k / 8 * TAU;
      c.save(); c.translate(KH.x + Math.cos(ak) * R, KH.y + Math.sin(ak) * R); c.rotate(ak); c.scale(sc, sc);
      c.fillStyle = k % 2 ? 'rgba(200,160,86,.8)' : GOLDL; const L = k % 2 ? 18 : 30;
      c.beginPath(); c.moveTo(L, 0); c.lineTo(0, 6); c.lineTo(-12, 0); c.lineTo(0, -6); c.closePath(); c.fill();
      c.beginPath(); c.arc(0, 0, 3.2, 0, TAU); c.fillStyle = '#fff3d0'; c.fill(); c.restore();
    }
    // outer dashed ring
    c.setLineDash([2, 13]); c.lineDashOffset = -t * 40; c.strokeStyle = `rgba(200,160,86,${.38 * inv(.3, .9, t)})`; c.lineWidth = 2; c.beginPath(); c.arc(KH.x, KH.y, R + 48, 0, TAU); c.stroke(); c.setLineDash([]);
    // spark head + comet tail
    if (prog < 1) {
      c.globalCompositeOperation = 'lighter';
      for (let k = 0; k < 16; k++) { const ak = a1 - k * .018; const s = 26 - k * 1.3; c.globalAlpha = (1 - k / 16) * .55; c.drawImage(A.gGold, KH.x + Math.cos(ak) * R - s, KH.y + Math.sin(ak) * R - s, s * 2, s * 2); }
      c.globalAlpha = 1; c.drawImage(A.gWhite, KH.x + Math.cos(a1) * R - 22, KH.y + Math.sin(a1) * R - 22, 44, 44);
      c.globalCompositeOperation = 'source-over';
    }
  }
  // keyhole
  const ks = E.outBack(inv(.16, .55, t));
  if (ks > 0) {
    c.save(); c.translate(KH.x, KH.y); c.scale(ks, ks); c.translate(-KH.x, -KH.y);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = .55 + beat * .45; c.drawImage(A.gCrim, KH.x - 230, KH.y - 250, 460, 460); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    keyholePath(c, KH.x, KH.y, KH.s);
    const kg = c.createRadialGradient(KH.x, KH.y - 30, 0, KH.x, KH.y, 110); kg.addColorStop(0, '#ffcf9a'); kg.addColorStop(.3, '#ff4a2e'); kg.addColorStop(1, '#4a0a06');
    c.fillStyle = kg; c.fill();
    c.restore();
  }
  // through the keyhole → 第一個世界
  if (p > 0) {
    c.save(); keyholePath(c, KH.x, KH.y, KH.s); c.clip(); c.setTransform(base);
    c.globalAlpha = inv(.25, .8, p); montage(c, t); c.globalAlpha = 1; c.restore();
    c.save(); keyholePath(c, KH.x, KH.y, KH.s); c.lineJoin = 'round';
    c.strokeStyle = 'rgba(255,190,120,.35)'; c.lineWidth = 9; c.stroke(); c.strokeStyle = GOLDL; c.lineWidth = 2.6; c.stroke(); c.restore();
  } else if (ks > 0) {
    c.save(); keyholePath(c, KH.x, KH.y, KH.s * ks); c.strokeStyle = GOLDL; c.lineWidth = 2.6; c.stroke(); c.restore();
  }
  c.setTransform(base);
  // tagline
  const line = '推開門，成為另一個人', fade = 1 - inv(1.18, 1.34, t);
  if (fade > 0) {
    const row = charRow(line, 960, 42, .42);
    row.forEach((o, i) => { const q = inv(.42 + i * .045, .82 + i * .045, t); if (q <= 0) return; const e = E.outCubic(q); txt(c, o.ch, o.x, 930 + (1 - e) * 18, { px: 42, wt: 700, fill: o.ch === '，' ? GOLD : TXT, alpha: e * fade }); });
    txt(c, 'OPEN THE DOOR · BECOME SOMEONE ELSE', 960, 986, { fam: F.cin, wt: 700, px: 17, ls: .5, fill: GOLD, alpha: inv(.75, 1.05, t) * fade * .85 });
  }
}

/* ========================================================
   SC.02 世界 —— 八個劇本世界快剪
   ======================================================== */
function infoStack(c, s, x, y, o) {
  const { align = 'center', col = TXT, acc = GOLDL, u = 1, tags } = o, a = inv(.03, .14, u);
  if (a <= 0) return;
  txt(c, tags || s.types.slice(0, 3).join(' · '), x, y, { fam: F.sans, wt: 500, px: 28, ls: .14, fill: col, align, alpha: a });
  const meta = `${s.players} PLAYERS  ·  ${String(s.time).replace(/\.0$/, '')} HRS`;
  const mw = tw(meta, F.mono, 500, 20, .12) + 24 + 10 * 9 + 28;
  const x0 = align === 'center' ? x - mw / 2 : align === 'right' ? x - mw : x;
  txt(c, meta, x0, y + 50, { fam: F.mono, wt: 500, px: 20, ls: .12, fill: col, align: 'left', alpha: a * .9 });
  c.save(); c.globalAlpha = a; stars(c, x0 + tw(meta, F.mono, 500, 20, .12) + 28, y + 50, s.difficulty, 9, acc, 'rgba(255,255,255,.22)', 'left', 5); c.restore();
}
function label(c, s, x, y, u, o = {}) {
  const { align = 'center', fill = GOLDL, px = 28 } = o, q = E.outExpo(inv(0, .16, u)); if (q <= 0) return;
  const w = tw(s, F.cin, 700, px, .55) + 30;
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  c.save(); c.beginPath(); c.rect(x0 - 10, y - px, w * q + 20, px * 2); c.clip();
  txt(c, s, x, y, { fam: F.cin, wt: 700, px, ls: .55, fill, align }); c.restore();
  c.fillStyle = fill; c.globalAlpha = .9; c.fillRect(align === 'right' ? x0 + w - w * q * .35 : x0, y + px * .9, w * q * .35, 2); c.globalAlpha = 1;
}
function bigIndex(c, n, x, y, u, col, align = 'right') {
  txt(c, String(n).padStart(2, '0'), x + u * 60 * (align === 'right' ? -1 : 1), y, { fam: F.cin, wt: 900, px: 560, fill: null, stroke: col, lw: 2.5, align, alpha: inv(0, .08, u) });
}
function cutThrone(c, u, s) {
  const g = c.createRadialGradient(960, 360, 0, 960, 420, 1100); g.addColorStop(0, '#22407e'); g.addColorStop(.45, '#0b1736'); g.addColorStop(1, '#03060f');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 9; k++) { const r = hash(k * 3.1); c.globalAlpha = .13; c.drawImage(A.cloud, ((r * 2400 + u * (60 + k * 30)) % 2600) - 600, 60 + hash(k) * 700, 1100, 420); }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  bigIndex(c, 1, 1830, 560, u, 'rgba(220,188,114,.14)');
  // rune ring
  c.save(); c.translate(960, 520); c.rotate(u * .5 - .3);
  c.strokeStyle = 'rgba(220,188,114,.55)'; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 0, 400, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, 360, 0, TAU); c.stroke();
  c.lineWidth = 2.2; for (let i = 0; i < A.runes.length; i++) { c.save(); c.rotate(i / A.runes.length * TAU); c.translate(0, -380); c.beginPath(); for (const l of A.runes[i]) { c.moveTo(l[0], l[1]); c.lineTo(l[2], l[3]); } c.stroke(); c.restore(); }
  c.restore();
  // lightning
  const f1 = u >= .05 && u < .15, f2 = u >= .26 && u < .32, fl = Math.max(pulse(u, .05, 24), pulse(u, .26, 28) * .7);
  if (u > -.2) { c.fillStyle = `rgba(170,195,255,${fl * .3})`; c.fillRect(0, 0, W, H); }
  if (f1 || f2) {
    const b = A.bolts[f1 ? 0 : 1]; c.lineCap = 'round'; c.lineJoin = 'round'; c.globalCompositeOperation = 'lighter';
    const path = pts => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); };
    c.strokeStyle = 'rgba(140,170,255,.35)'; c.lineWidth = 22; path(b.pts); c.lineWidth = 9; c.strokeStyle = 'rgba(190,210,255,.6)'; path(b.pts); b.branches.forEach(path);
    c.strokeStyle = '#fff'; c.lineWidth = 3; path(b.pts); c.lineWidth = 1.5; b.branches.forEach(path); c.globalCompositeOperation = 'source-over';
  }
  // title
  const q = E.outExpo(inv(0, .2, u)), sc = lerp(1.32, 1, q) * (1 + u * .05), a = u >= 0 ? 1 : 0;  // 重拍當格就出現
  if (a > 0) {
    c.save(); c.translate(960, 545); c.scale(sc, sc);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = .2 * a; c.drawImage(A.gGold, -620, -300, 1240, 600); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    txt(c, '王座', 0, 0, { px: 330, ls: .12, fill: goldText(c, 0, -170, 0, 170), alpha: a });
    c.restore();
  }
  label(c, 'MYTHOLOGY', 960, 300, u);
  infoStack(c, s, 960, 780, { u, tags: '神話 · 陣營 · 身份轉換' });
}
const PETALS = Array.from({ length: 90 }, (_, i) => { const r = rng(700 + i); return { x: r() * 2200 - 140, y: r() * 1300 - 200, z: .3 + r() * 1.3, rs: (r() - .5) * 6, ph: r() * TAU, sp: .6 + r() * .8 }; });
function cutSpring(c, u, s) {
  c.fillStyle = lgrad(c, 0, 0, W * .3, H, [[0, '#f6b49c'], [.5, '#d55a78'], [1, '#4a0e2a']]); c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = .6; c.drawImage(A.gWhite, 1400 - 380, 300 - 380, 760, 760); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  bigIndex(c, 2, 1840, 600, u, 'rgba(255,255,255,.28)');
  for (const p of PETALS) {
    if (p.z > 1.15) continue; const tt = u + 1;
    const x = p.x + tt * 260 * p.sp * p.z + Math.sin(tt * 2 + p.ph) * 40, y = p.y + tt * 300 * p.sp * p.z;
    c.save(); c.translate(x, y); c.rotate(p.ph + tt * p.rs); c.scale(p.z, p.z * Math.cos(tt * 3 + p.ph)); c.globalAlpha = .85; c.drawImage(A.petal, -32, -32); c.restore();
  }
  // title — 逐字上浮
  const row = charRow('春晝短', 0, 270, .08);
  row.forEach((o, i) => { const q = E.outExpo(inv(i * .045, .2 + i * .045, u)); if (q <= 0) return; txt(c, o.ch, 210 + 405 + o.x + 8, 568 + (1 - q) * 110, { px: 270, fill: 'rgba(80,8,34,.45)', alpha: q }); txt(c, o.ch, 210 + 405 + o.x, 560 + (1 - q) * 110, { px: 270, fill: '#fffaf6', alpha: q }); });
  label(c, 'ROMANCE', 214, 340, u, { align: 'left', fill: '#fff' });
  infoStack(c, s, 214, 760, { u, align: 'left', col: '#fff8f4', acc: '#fff' , tags: '情感 · 沉浸 · 治癒' });
  for (const p of PETALS) {
    if (p.z <= 1.15) continue; const tt = u + 1;
    const x = p.x + tt * 300 * p.sp * p.z, y = p.y + tt * 340 * p.sp * p.z;
    c.save(); c.translate(x, y); c.rotate(p.ph + tt * p.rs); const k = p.z * 2.4; c.scale(k, k * Math.cos(tt * 3 + p.ph)); c.globalAlpha = .7; c.drawImage(A.petalB, -48, -48); c.restore();
  }
}
function cutRabbit(c, u, s) {
  c.fillStyle = '#070000'; c.fillRect(0, 0, W, H);
  const img = A.rabbit, step = Math.floor(u * 30), glitch = (u < .06) || (u > .2 && u < .25) || hash(step * 7.7) > .78;
  // poster, right side, sliced
  const ph = 1240, pw = ph * img.width / img.height, px0 = 1920 - pw + 60 + u * -40, py0 = -80 - u * 30;
  const strips = 18;
  for (let k = 0; k < strips; k++) {
    const sy = img.height * k / strips, sh = img.height / strips, off = glitch ? (hash(k * 13.1 + step) - .5) * 120 * (hash(k + step * 3) > .55 ? 1 : 0) : 0;
    c.drawImage(img, 0, sy, img.width, sh, px0 + off, py0 + ph * k / strips, pw, ph / strips + 1);
  }
  if (glitch) { c.globalCompositeOperation = 'screen'; c.globalAlpha = .35; c.drawImage(img, px0 + 18, py0, pw, ph); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
  c.fillStyle = lgrad(c, px0 - 10, 0, px0 + 560, 0, [[0, '#070000'], [1, 'rgba(7,0,0,0)']]); c.fillRect(px0 - 10, 0, 580, H);
  c.fillStyle = 'rgba(160,0,0,.22)'; c.globalCompositeOperation = 'multiply'; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
  c.fillStyle = c.createPattern(A.scan, 'repeat'); c.fillRect(0, 0, W, H);
  // title — RGB split
  const a = u >= 0 ? 1 : 0, j = (glitch ? 16 : 5) * (1 + pulse(u, 0, 8) * 2), jx = vnoise(u * 60) * (glitch ? 14 : 3), jy = vnoise(u * 50 + 9) * (glitch ? 8 : 2);
  if (a > 0) {
    const X = 180 + jx, Y = 520 + jy, o = { px: 270, align: 'left', alpha: a, op: 'lighter', ls: .02 };
    txt(c, '瘋兔子', X - j, Y, { ...o, fill: '#ff0000' }); txt(c, '瘋兔子', X, Y, { ...o, fill: '#00ff00' }); txt(c, '瘋兔子', X + j, Y, { ...o, fill: '#0000ff' });
    if (glitch) { c.save(); c.beginPath(); c.rect(0, Y - 40 + hash(step) * 60, W, 34); c.clip(); txt(c, '瘋兔子', X + 70, Y, { px: 270, align: 'left', fill: '#ff2a2a', ls: .02 }); c.restore(); }
    txt(c, '白又白，砍下腦袋飛起來', 186, 712, { px: 42, wt: 700, ls: .18, align: 'left', fill: '#ff3b30', alpha: inv(.02, .08, u) });
  }
  label(c, 'HORROR', 186, 300, u, { align: 'left', fill: '#ff4a3d' });
  infoStack(c, s, 186, 800, { u, align: 'left', col: '#f6dada', acc: '#ff4a3d', tags: '架空 · 驚悚 · 怪談 · 新手' });
  if (hash(step * 3.3 + 1) > .7) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, 0, W, H); }
  bigIndex(c, 3, 1860, 940, u, 'rgba(255,60,50,.22)');
}
const WARP = Array.from({ length: 520 }, (_, i) => { const r = rng(1300 + i); const a = r() * TAU, d = .05 + r() * 1; return { x: Math.cos(a) * d, y: Math.sin(a) * d, z: r(), c: r() }; });
function cutStars(c, u, s) {
  const g = c.createRadialGradient(960, 520, 0, 960, 520, 1150); g.addColorStop(0, '#231a63'); g.addColorStop(.5, '#0b0828'); g.addColorStop(1, '#020109');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'lighter';
  [[520, 300, 900, '#6a3cff', .35], [1500, 700, 800, '#1fb6ff', .22], [1100, 200, 600, '#ff3cc8', .14]].forEach(([x, y, r, col, a], k) => { const gg = c.createRadialGradient(x + u * 40 * (k - 1), y, 0, x, y, r); gg.addColorStop(0, col); gg.addColorStop(1, 'rgba(0,0,0,0)'); c.globalAlpha = a; c.fillStyle = gg; c.fillRect(0, 0, W, H); });
  c.globalAlpha = 1;
  // warp — 從超光速減速抵達
  const sp = lerp(2.6, .12, E.outExpo(inv(-.05, .3, u))), tt = u + 2;
  for (const st of WARP) {
    let z = ((st.z - tt * .18) % 1 + 1) % 1 + .02, z2 = z + sp * .08;
    const x1 = 960 + st.x / z * 300, y1 = 520 + st.y / z * 300, x2 = 960 + st.x / z2 * 300, y2 = 520 + st.y / z2 * 300;
    c.strokeStyle = st.c > .7 ? 'rgba(160,220,255,.9)' : 'rgba(255,255,255,.85)'; c.lineWidth = Math.min(3.2, .6 / z); c.globalAlpha = clamp(1.2 - z); c.beginPath(); c.moveTo(x2, y2); c.lineTo(x1, y1); c.stroke();
  }
  c.globalAlpha = 1;
  // planet horizon
  const pg = c.createRadialGradient(960, 2520, 1500, 960, 2520, 1620); pg.addColorStop(0, 'rgba(0,0,0,0)'); pg.addColorStop(.86, 'rgba(90,190,255,.55)'); pg.addColorStop(1, 'rgba(90,190,255,0)');
  c.fillStyle = pg; c.fillRect(0, 700, W, 380); c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#020109'; c.beginPath(); c.arc(960, 2520, 1560, 0, TAU); c.fill();
  bigIndex(c, 4, 120, 860, u, 'rgba(150,215,255,.16)', 'left');
  const q = E.outExpo(inv(0, .26, u)), ls = lerp(1.4, .5, q), a = inv(0, .06, u);
  if (a > 0) {
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = .55 * a; c.drawImage(A.gCyan, 960 - 560, 500 - 260, 1120, 520); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    txt(c, '群星', 960, 500, { px: 290, ls, wt: 900, fill: '#f4fbff', alpha: a });
  }
  label(c, 'SCI-FI', 960, 268, u, { fill: '#9fdcff' });
  infoStack(c, s, 960, 738, { u, col: '#e6f4ff', acc: '#9fdcff', tags: '太空 · 機制 · 情感 · 沉浸' });
}
function cutTianjin(c, u, s) {
  c.fillStyle = lgrad(c, 0, 0, W, H, [[0, '#3a2812'], [1, '#120b04']]); c.fillRect(0, 0, W, H);
  c.globalAlpha = .18; c.globalCompositeOperation = 'overlay'; c.drawImage(A.grain[2], 0, 0, W, H); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  const bq = E.outExpo(inv(0, .1, u));
  c.save(); c.beginPath(); c.rect(0, 0, W * bq + 40, H); c.clip(); c.drawImage(A.brush, -200 - u * 80, 330); c.restore();
  // vertical title
  const chars = [...'津門遺雲'];
  chars.forEach((ch, i) => { const q = E.outExpo(inv(.01 + i * .02, .12 + i * .02, u)); if (q <= 0) return; txt(c, ch, 1250, 175 + i * 182 - (1 - q) * 60, { px: 172, fill: goldText(c, 0, 80, 0, 900), alpha: q }); });
  const ss = lerp(2.4, 1, E.outExpo(inv(.04, .1, u))), sa = inv(.04, .06, u);
  if (sa > 0) { c.save(); c.translate(1490, 820); c.rotate(-.06); c.scale(ss, ss); c.globalAlpha = sa; c.drawImage(A.seal, -95, -95, 190, 190); c.restore(); }
  label(c, 'REPUBLIC ERA', 200, 420, u * 1.6, { align: 'left' });
  txt(c, '民國・天津衛', 200, 520, { px: 64, wt: 900, align: 'left', fill: '#f3e6c8', alpha: inv(.02, .07, u), ls: .12 });
  infoStack(c, s, 200, 640, { u: u * 1.6, align: 'left', tags: '民國 · 歡樂 · 嘴砲 · 陣營' });
  bigIndex(c, 5, 120, 900, u, 'rgba(236,208,138,.12)', 'left');
}
function cutShrine(c, u, s) {
  c.fillStyle = lgrad(c, 0, 0, 0, H, [[0, '#2f7fd0'], [.6, '#a6d6f6'], [1, '#fff3e2']]); c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = .95; c.drawImage(A.gWhite, 1450 - 520, 250 - 520, 1040, 1040); c.globalAlpha = 1;
  for (let k = 0; k < 6; k++) { c.globalAlpha = .35; c.drawImage(A.cloud, ((hash(k * 5.3) * 2400 - u * 300 * (1 + k * .2)) % 2600) - 300, 560 + hash(k + 2) * 300, 900, 300); }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  const ts = 1.06 - u * .15; c.save(); c.translate(960, 640); c.scale(ts, ts); c.drawImage(A.torii, -960, -640); c.restore();
  const q = E.outExpo(inv(0, .12, u));
  txt(c, '晴天神社', 960, 640 + (1 - q) * 40, { px: 168, ls: .1, fill: '#10233f', alpha: q });
  label(c, 'SHRINE', 960, 480, u * 1.5, { fill: '#c7331f' });
  infoStack(c, s, 960, 800, { u: u * 1.5, col: '#10233f', acc: '#c7331f', tags: '日式 · 情感 · 沉浸 · 無兇手' });
}
const WISP = Array.from({ length: 16 }, (_, i) => { const r = rng(1600 + i); return { x: 120 + r() * 1680, y: 200 + r() * 760, s: 40 + r() * 90, ph: r() * TAU }; });
function cutLichuan(c, u, s) {
  c.fillStyle = lgrad(c, 0, 0, 0, H, [[0, '#062729'], [1, '#010708']]); c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 7; k++) { c.globalAlpha = .12; c.drawImage(A.cloud, ((hash(k * 2.7) * 2400 + u * 200 * (k % 2 ? 1 : -1)) % 2600) - 500, 300 + hash(k + 9) * 600, 1300, 380); }
  for (const w of WISP) { const f = .7 + .3 * Math.sin(u * 40 + w.ph); c.globalAlpha = .6 * f; const y = w.y - u * 120; c.drawImage(A.gTeal, w.x - w.s, y - w.s * 1.3, w.s * 2, w.s * 2.6); c.globalAlpha = .9 * f; c.drawImage(A.gWhite, w.x - w.s * .18, y - w.s * .1, w.s * .36, w.s * .5); }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  const a = inv(0, .04, u), T = '漓川怪談簿';
  txt(c, T, 960, 540, { px: 210, ls: .08, fill: '#eafffb', alpha: a });
  // magnifier lens sweeping
  const lx = lerp(560, 1400, E.inOutCubic(inv(.0, .2, u))), ly = 540, lr = 170;
  if (a > 0) {
    c.save(); c.beginPath(); c.arc(lx, ly, lr, 0, TAU); c.clip(); c.fillStyle = 'rgba(2,20,20,.9)'; c.fillRect(0, 0, W, H);
    c.translate(lx, ly); c.scale(1.35, 1.35); c.translate(-lx, -ly); txt(c, T, 960, 540, { px: 210, ls: .08, fill: '#7ff5e2' }); c.restore();
    c.strokeStyle = '#bff8ee'; c.lineWidth = 6; c.beginPath(); c.arc(lx, ly, lr, 0, TAU); c.stroke();
    c.lineWidth = 16; c.lineCap = 'round'; c.beginPath(); c.moveTo(lx + lr * .72, ly + lr * .72); c.lineTo(lx + lr * 1.2, ly + lr * 1.2); c.stroke();
  }
  label(c, 'MYSTERY', 960, 330, u * 1.5, { fill: '#7ff5e2' });
  infoStack(c, s, 960, 770, { u: u * 1.5, col: '#dffbf6', acc: '#7ff5e2', tags: '日式 · 硬核推理 · 密室' });
}
const CONF = Array.from({ length: 170 }, (_, i) => { const r = rng(1900 + i); const a = r() * TAU, v = 500 + r() * 1500; return { vx: Math.cos(a) * v, vy: Math.sin(a) * v - 400, w: 10 + r() * 16, h: 6 + r() * 10, c: ['#ffffff', '#ffe14a', '#2ad1ff', '#ff3b7f', '#7c4dff', '#3cff9a'][r() * 6 | 0], rs: (r() - .5) * 30, ph: r() * TAU }; });
function cutBoil(c, u, s) {
  const g = c.createRadialGradient(960, 540, 0, 960, 540, 1150); g.addColorStop(0, '#ffc93a'); g.addColorStop(.55, '#ff8a1f'); g.addColorStop(1, '#e8401f');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.save(); c.translate(960, 540); c.rotate(u * .8); c.fillStyle = 'rgba(255,255,255,.12)';
  for (let k = 0; k < 18; k++) { c.rotate(TAU / 18); c.beginPath(); c.moveTo(0, 0); c.lineTo(-170, -1400); c.lineTo(170, -1400); c.closePath(); c.fill(); } c.restore();
  for (const f of CONF) { const tt = Math.max(0, u) + .02, x = 960 + f.vx * tt * Math.exp(-tt * 1.5), y = 540 + f.vy * tt * Math.exp(-tt * 1.5) + 900 * tt * tt; c.save(); c.translate(x, y); c.rotate(f.ph + f.rs * tt); c.scale(1, Math.cos(f.ph + tt * 18)); c.fillStyle = f.c; c.fillRect(-f.w / 2, -f.h / 2, f.w, f.h); c.restore(); }
  const q = E.outBack(inv(0, .14, u)), sc = lerp(.3, 1, q);
  if (q > 0) {
    c.save(); c.translate(960, 540); c.rotate(-.04); c.scale(sc, sc);
    txt(c, '沸騰跨世紀', 12, 14, { px: 200, fill: '#5a1500', ls: .04 });
    txt(c, '沸騰跨世紀', 0, 0, { px: 200, fill: '#ffffff', stroke: '#5a1500', lw: 16, ls: .04 });
    c.restore();
  }
  label(c, 'COMEDY', 960, 330, u * 1.5, { fill: '#fff' });
  infoStack(c, s, 960, 770, { u: u * 1.5, col: '#fff', acc: '#fff', tags: '歡樂 · 懷舊 · 團建 · 無兇手' });
}
function drawCut(c, i, u) { const k = CUTS[i]; c.save(); k.draw(c, u, byId(k.id)); c.restore(); }
function montage(c, t) {
  let i = CUTS.length - 1; while (i > 0 && t < CUTS[i].t) i--;
  const k = CUTS[i], u = t - k.t, base = c.getTransform();
  const prev = () => drawCut(c, i - 1, t - CUTS[i - 1].t), cur = () => drawCut(c, i, u);
  const TR = { iris: .14, glitch: .07, zoom: .12, slats: .09, slide: .09, shutter: .09, flash: .05 };
  const d = TR[k.tr]; if (!d || u >= d) { cur(); return; }
  const p = u / d;
  if (k.tr === 'iris') {
    prev(); const r = E.outExpo(p) * 1250; c.save(); c.beginPath(); c.arc(960, 540, r, 0, TAU); c.clip(); cur(); c.restore();
    c.strokeStyle = '#fff3e0'; c.lineWidth = 10 * (1 - p); c.beginPath(); c.arc(960, 540, r, 0, TAU); c.stroke();
  } else if (k.tr === 'glitch') {
    cur(); const step = Math.floor(u * 120); TB.ctx.setTransform(1, 0, 0, 1, 0, 0); TB.ctx.clearRect(0, 0, W, H); drawCut(TB.ctx, i - 1, t - CUTS[i - 1].t);
    for (let s = 0; s < 22; s++) { if (hash(s * 9.1 + step) < p * 1.1) continue; const y = Math.floor(hash(s * 3.7 + step) * H), h = 10 + hash(s + step * 5) * 70, off = (hash(s * 1.3 + step) - .5) * 260; c.drawImage(TB, 0, y, W, h, off, y, W, h); }
  } else if (k.tr === 'zoom') {
    const e = E.inCubic(p); c.save(); c.translate(960, 540); c.scale(lerp(.82, 1, E.outCubic(p)), lerp(.82, 1, E.outCubic(p))); c.translate(-960, -540); cur(); c.restore();
    c.save(); c.globalAlpha = 1 - e; c.translate(960, 540); c.scale(1 + e * 1.6, 1 + e * 1.6); c.translate(-960, -540); prev(); c.restore();
  } else if (k.tr === 'slats') {
    prev(); c.save(); c.beginPath();
    for (let s = 0; s < 8; s++) { const q = E.outCubic(clamp(p * 1.6 - s * .08)); const x = -400 + s * 330; c.moveTo(x, 0); c.lineTo(x + 330 * q + 2, 0); c.lineTo(x + 330 * q + 2 + 400, H); c.lineTo(x + 400, H); c.closePath(); }
    c.clip(); cur(); c.restore();
  } else if (k.tr === 'slide') {
    const e = E.outExpo(p); c.save(); c.translate(-W * .35 * e, 0); prev(); c.restore(); c.save(); c.translate(W * (1 - e), 0); cur(); c.restore();
  } else if (k.tr === 'shutter') {
    prev(); c.save(); c.beginPath(); for (let s = 0; s < 10; s++) { const q = E.outCubic(clamp(p * 1.5 - s * .05)); c.rect(s * 192 + 96 - 96 * q, 0, 192 * q + 1, H); } c.clip(); cur(); c.restore();
  } else if (k.tr === 'flash') {
    cur(); c.fillStyle = `rgba(255,250,235,${1 - p})`; c.fillRect(0, 0, W, H);
  }
  c.setTransform(base);
}

/* ========================================================
   SC.03 群像 —— 57 張劇本卡：拉遠 → 漩渦 → 排成海星
   ======================================================== */
const camZ = t => 3.7 + 15.3 * E.outCubic(inv(4.2, 5.45, t)) - 2.6 * E.inOutCubic(inv(5.25, 6.0, t));
const V3 = () => new W3.T.Vector3();
function wall(c, t) {
  const { R, S, cam, cards, glc, pts } = W3;
  const spin = -1.0 * E.outCubic(inv(4.15, 5.3, t)), arc = Math.sin(Math.PI * inv(4.2, 5.8, t));
  const lx = -2.5 * E.inOutCubic(inv(4.9, 5.75, t));
  cam.position.set(2.6 * arc + lx, -1.2 * arc, camZ(t)); cam.up.set(Math.sin(.32 * arc), Math.cos(.32 * arc), 0); cam.lookAt(lx, 0, 0); cam.updateMatrixWorld();
  const sweep = inv(5.5, 5.95, t) * 1.5 - .2;
  for (const cd of cards) {
    const a = cd.A, b = cd.B, tw0 = spin * (1 + Math.abs(a.z) * .03), cs = Math.cos(tw0), sn = Math.sin(tw0);
    const ax = a.x * cs - a.y * sn, ay = a.x * sn + a.y * cs;
    const st = 4.78 + cd.d * .55, q = E.inOutCubic(inv(st, st + .5, t));
    cd.m.position.set(lerp(ax, b.x, q), lerp(ay, b.y, q), lerp(a.z, b.z, q) + Math.sin(q * Math.PI) * 3.2);
    cd.m.rotation.set(lerp(a.rx, b.rx, q), lerp(a.ry, b.ry, q), lerp(a.rz + tw0, b.rz, q));
    const sc = lerp(a.sc, b.sc, q); cd.m.scale.set(sc, sc, sc);
    const br = 1 + .9 * Math.exp(-Math.pow((cd.s - sweep) / .1, 2)) * (q > .99 ? 1 : 0); cd.mat.color.setScalar(br);
  }
  S.rotation.z = -.22 * E.inOutCubic(inv(5.2, 6.0, t));
  pts.rotation.z = t * .05;
  R.render(S, cam);
  c.drawImage(glc, 0, 0);
  // 鑰匙孔回扣：海星中心
  const kq = E.outBack(inv(5.42, 5.75, t));
  if (kq > 0) {
    const o = V3().set(0, 0, .2).applyMatrix4(S.matrixWorld).project(cam), k = kq * 1.15 * 18.9 / camZ(t);
    c.save(); c.translate((o.x + 1) * 960, (1 - o.y) * 540); c.scale(k, k);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = .8; c.drawImage(A.gCrim, -170, -170, 340, 340); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.drawImage(A.kh, -130, -160); c.restore();
  }
  // 從快剪最後一格縮成卡片
  if (t < 4.2) {
    const p = E.inOutQuart(inv(4.0, 4.2, t)), ch = lerp(H, 601, p), cw = lerp(W, 401, p), sw = lerp(W, 720, p);
    TA.ctx.setTransform(1, 0, 0, 1, 0, 0); drawCut(TA.ctx, 7, t - 3.8);
    c.save(); c.globalAlpha = 1 - inv(.55, 1, p); c.drawImage(TA, 960 - sw / 2, 0, sw, H, 960 - cw / 2, 540 - ch / 2, cw, ch); c.restore();
    c.strokeStyle = `rgba(236,208,138,${p})`; c.lineWidth = 2; c.strokeRect(960 - cw / 2, 540 - ch / 2, cw, ch);
  }
  // 計數器
  const cq = inv(4.28, 4.42, t);
  if (cq > 0) {
    const n = Math.round(57 * E.outCubic(inv(4.3, 5.3, t)));
    c.fillStyle = lgrad(c, 0, 600, 0, H, [[0, 'rgba(8,6,3,0)'], [1, 'rgba(8,6,3,.85)']]); c.fillRect(0, 600, 900, 480);
    const x0 = 132, y0 = 948;
    txt(c, String(n).padStart(2, '0'), x0, y0, { fam: F.cin, wt: 900, px: 210, align: 'left', base: 'alphabetic', fill: goldText(c, 0, 780, 0, 950), alpha: cq });
    const nx = x0 + tw('00', F.cin, 900, 210) + 34;
    txt(c, '部劇本', nx, y0 - 92, { px: 58, wt: 900, align: 'left', base: 'alphabetic', fill: '#fff6e4', alpha: cq, ls: .12 });
    txt(c, '57 WORLDS · ONE DOOR', nx + 2, y0 - 34, { fam: F.cin, wt: 700, px: 21, ls: .32, align: 'left', base: 'alphabetic', fill: GOLD, alpha: inv(4.5, 4.7, t) });
    txt(c, '一扇門 · 五十七種人生', x0 + 6, y0 - 196, { px: 36, wt: 700, ls: .2, align: 'left', base: 'alphabetic', fill: TXT, alpha: inv(5.4, 5.65, t) });
  }
}

/* ========================================================
   SC.04 你 —— 四種劇本、甩鏡、這一次，你是誰？
   ======================================================== */
const QD = [
  { w: '推理', en: 'DEDUCTION', bg: '#0c1a3a', fg: GOLDL, t: 6.0, x: 0, y: 0, dx: -1, dy: -1 },
  { w: '情感', en: 'EMOTION', bg: '#b4395a', fg: '#fff3ea', t: 6.2, x: 960, y: 0, dx: 1, dy: -1 },
  { w: '驚悚', en: 'THRILL', bg: '#0e0101', fg: '#ff2b2b', t: 6.4, x: 0, y: 540, dx: -1, dy: 1 },
  { w: '歡樂', en: 'JOY', bg: '#ffb21e', fg: '#1d0f04', t: 6.6, x: 960, y: 540, dx: 1, dy: 1 },
];
const NAMES = (() => { const all = [...new Set(SCRIPTS.flatMap(s => s.characters || []))].filter(n => n.length <= 7); const r = rng(77); for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; } const cells = []; for (let gy = 0; gy < 8; gy++) for (let gx = 0; gx < 7; gx++) { const x = 150 + gx * 270, y = 120 + gy * 120; if (Math.abs(y - 530) < 220 && Math.abs(x - 960) < 560) continue; cells.push([x, y]); }
  return cells.map(([cx, cy], i) => { const q = rng(3000 + i); return { n: all[i % all.length], x: cx + (q() - .5) * 150, y: cy + (q() - .5) * 60, t0: 7.0 + q() * .4, px: 20 + q() * 18, gold: q() < .6, a: .22 + q() * .4 }; }); })();
function quad(c, q, i, t) {
  c.save(); c.beginPath(); c.rect(q.x + 3, q.y + 3, 954, 534); c.clip();
  c.fillStyle = q.bg; c.fillRect(q.x, q.y, 960, 540);
  const cx = q.x + 480, cy = q.y + 270, u = t - q.t;
  if (i === 0) { c.strokeStyle = 'rgba(236,208,138,.16)'; c.lineWidth = 2; for (let k = 1; k < 9; k++) { c.beginPath(); c.arc(cx + 260, cy - 40, k * 46 + u * 60, 0, TAU); c.stroke(); } c.beginPath(); c.moveTo(q.x, cy); c.lineTo(q.x + 960, cy); c.moveTo(cx + 260, q.y); c.lineTo(cx + 260, q.y + 540); c.stroke(); }
  if (i === 1) { c.globalCompositeOperation = 'lighter'; for (let k = 0; k < 12; k++) { const s = 40 + hash(k) * 120; c.globalAlpha = .25; c.drawImage(A.gPink, q.x + hash(k * 3) * 960 - s, q.y + hash(k * 7) * 540 - s - u * 40, s * 2, s * 2); } c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
  if (i === 2) { c.globalCompositeOperation = 'lighter'; c.globalAlpha = .5; c.drawImage(A.gCrim, cx - 500, cy - 300, 1000, 600); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.fillStyle = c.createPattern(A.scan, 'repeat'); c.fillRect(q.x, q.y, 960, 540); }
  if (i === 3) { c.save(); c.translate(cx, cy); c.rotate(t * 1.2); c.fillStyle = 'rgba(255,255,255,.2)'; for (let k = 0; k < 14; k++) { c.rotate(TAU / 14); c.beginPath(); c.moveTo(0, 0); c.lineTo(-90, -900); c.lineTo(90, -900); c.fill(); } c.restore(); }
  const e = E.outExpo(inv(0, .16, u)), a = u >= 0 ? 1 : 0;
  if (a > 0) {
    const s = lerp(1.4, 1, e);
    c.save(); c.translate(cx, cy - 22); c.scale(s, s);
    if (i === 2) { const j = 6 + 10 * pulse(u, 0, 10); txt(c, q.w, -j, 0, { px: 232, fill: '#ff0000', op: 'lighter', alpha: a }); txt(c, q.w, j, 0, { px: 232, fill: '#00a0a0', op: 'lighter', alpha: a * .7 }); }
    else txt(c, q.w, 0, 0, { px: 232, fill: q.fg, ls: .06, alpha: a });
    c.restore();
    txt(c, q.en, cx, cy + 150, { fam: F.cin, wt: 700, px: 26, ls: .7, fill: q.fg, alpha: inv(.03, .1, u) * .9 });
  }
  txt(c, '0' + (i + 1), q.x + 40, q.y + 44, { fam: F.mono, wt: 600, px: 18, align: 'left', fill: q.fg, alpha: .7 });
  c.restore();
}
function kinetic(c, t) {
  c.fillStyle = '#050403'; c.fillRect(0, 0, W, H);
  // dust behind
  c.globalCompositeOperation = 'lighter';
  for (const m of DUST) { const x = m.x + Math.sin(t * .7 + m.ph) * 14, y = (m.y - t * 26 * m.d + 3 * H) % H, s = m.s; c.globalAlpha = .1 + .22 * m.d; c.drawImage(A.gGold, x - s, y - s, s * 2, s * 2); }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  // names cloud（每個角色都是一種身份）
  for (const nm of NAMES) {
    const a = inv(nm.t0, nm.t0 + .05, t) * (hash(nm.x + Math.floor(t * 30)) > .12 ? 1 : .3); if (a <= 0) continue;
    const k = E.inExpo(inv(7.36, 7.6, t)), x = lerp(nm.x, 960, k), y = lerp(nm.y, 570, k);
    txt(c, nm.n, x, y, { fam: F.serif, wt: 700, px: nm.px * (1 - k * .6), fill: nm.gold ? GOLDL : '#fff', alpha: a * nm.a * (1 - k * .8) });
  }
  // quadrant grid
  const base = c.getTransform(), sp = E.inExpo(inv(6.98, 7.2, t));
  if (sp < 1) {
    let cx = 480, cy = 270;
    const QC = [[480, 270], [1440, 270], [480, 810], [1440, 810]];
    for (let k = 1; k < 4; k++) { const p = E.inOutQuart(inv(QD[k].t - .085, QD[k].t, t)); cx = lerp(cx, QC[k][0], p); cy = lerp(cy, QC[k][1], p); }
    let z = 2 * lerp(1.14, 1, E.outExpo(inv(6.0, 6.22, t)));
    const zo = E.inOutQuart(inv(6.74, 6.94, t)); z = lerp(z, 1, zo); cx = lerp(cx, 960, zo); cy = lerp(cy, 540, zo);
    c.translate(960, 540); c.scale(z, z); c.translate(-cx, -cy);
    QD.forEach((q, i) => { if (t < q.t - .09) return; c.save(); c.translate(q.dx * sp * 1300, q.dy * sp * 800); quad(c, q, i, t); c.restore(); });
    c.setTransform(base);
  }
  drawQuestion(c, 1, t);
}
function drawQuestion(c, alpha, t = 7.6) {
  const a1 = inv(7.04, 7.22, t); if (a1 <= 0) return;
  const e1 = E.outCubic(a1);
  txt(c, '這一次，', 960 + 40, 425 + (1 - e1) * 16, { px: 74, wt: 700, ls: .34, fill: GOLDL, alpha: e1 * alpha });
  const q = E.outExpo(inv(7.2, 7.36, t)), a = t >= 7.2 ? 1 : 0;
  if (a > 0) {
    const s = lerp(1.7, 1, q); c.save(); c.translate(960, 612); c.scale(s, s);
    txt(c, '你是誰？', 30, 0, { px: 236, ls: .06, fill: lgrad(c, 0, -120, 0, 120, [[0, '#ffffff'], [.55, '#ffeec8'], [1, GOLDL]]), alpha: a * alpha });
    c.restore();
  }
}

/* ========================================================
   LOGO —— 文字化為金塵 → 匯聚成海星 → 品牌定版
   ======================================================== */
const EMB = Array.from({ length: 110 }, (_, i) => { const r = rng(5000 + i); return { x: r() * W, y: H + r() * 300, v: 40 + r() * 140, s: 3 + r() * 12, ph: r() * TAU, c: r() < .75 }; });
const SPARK = Array.from({ length: 240 }, (_, i) => { const r = rng(6000 + i); const a = r() * TAU, v = 300 + r() * 1300; return { vx: Math.cos(a) * v, vy: Math.sin(a) * v * .7, s: 4 + r() * 12 }; });
function logoScene(c, t) {
  const base = c.getTransform();
  c.fillStyle = '#060403'; c.fillRect(0, 0, W, H);
  const lt = inv(7.95, 8.15, t), push = 1 + .035 * E.inOutCubic(inv(8.0, 10, t));
  c.translate(960, 540); c.scale(push, push); c.translate(-960, -540);
  // backdrop glow
  const bg = c.createRadialGradient(LOGO.x, LOGO.y, 0, LOGO.x, LOGO.y, 900); bg.addColorStop(0, `rgba(110,24,14,${.5 * lt})`); bg.addColorStop(.45, `rgba(40,12,6,${.35 * lt})`); bg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'lighter';
  // god rays
  if (lt > 0) {
    c.save(); c.translate(LOGO.x, LOGO.y); c.rotate(t * .12);
    for (let k = 0; k < 14; k++) { c.rotate(TAU / 14); const g = c.createLinearGradient(0, 0, 0, -1100); g.addColorStop(0, `rgba(255,200,120,${.09 * lt})`); g.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.lineTo(-38 - 30 * hash(k), -1100); c.lineTo(38 + 30 * hash(k), -1100); c.fill(); }
    c.restore();
  }
  // embers
  for (const m of EMB) { const tt = t - 7.9; if (tt < 0) break; const y = m.y - tt * m.v * 2.2, x = m.x + Math.sin(tt * 2 + m.ph) * 30; c.globalAlpha = .55 * (.6 + .4 * Math.sin(tt * 9 + m.ph)) * inv(7.9, 8.3, t); c.drawImage(m.c ? A.gGold : A.gCrim, x - m.s, y - m.s, m.s * 2, m.s * 2); }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  // 文字左→右碎裂
  if (t < 7.85) {
    const sx = lerp(P.minx - 80, P.maxx + 80, inv(7.6, 7.75, t));
    const x = TB.ctx; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H); x.drawImage(A.qText, 0, 0);
    x.globalCompositeOperation = 'destination-in'; x.fillStyle = lgrad(x, sx - 60, 0, sx + 60, 0, [[0, 'rgba(0,0,0,0)'], [1, '#000']]); x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over';
    c.drawImage(TB, 0, 0);
  }
  // particles
  const pa = 1 - inv(8.02, 8.22, t);
  if (pa > 0 && t >= 7.6) {
    c.globalCompositeOperation = 'lighter'; const d = P.d;
    for (let b = 0; b < 6; b++) {
      c.fillStyle = P.cols[b]; c.globalAlpha = pa;
      for (let k = 0; k < P.n; k++) {
        const o = k * 10; if (d[o + 8] !== b) continue;
        const st = 7.6 + d[o + 6], q = E.inOutCubic(inv(st, 7.99, t)), m = 1 - q;
        const x = m * m * d[o] + 2 * m * q * d[o + 4] + q * q * d[o + 2], y = m * m * d[o + 1] + 2 * m * q * d[o + 5] + q * q * d[o + 3];
        const s = d[o + 9] * (1.6 + Math.sin(q * Math.PI) * 2.2); c.fillRect(x - s / 2, y - s / 2, s, s);
        if (k % 14 === 0) { c.globalAlpha = pa * .35; c.drawImage(A.gGold, x - 9, y - 9, 18, 18); c.globalAlpha = pa; }
      }
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }
  if (t >= 7.97) {
    // shockwave + sparks
    const sw = inv(8.0, 8.75, t); if (sw > 0 && sw < 1) { c.strokeStyle = `rgba(255,214,150,${.55 * (1 - sw)})`; c.lineWidth = 36 * (1 - sw) + 1; c.beginPath(); c.arc(LOGO.x, LOGO.y, 80 + 1400 * E.outCubic(sw), 0, TAU); c.stroke(); }
    c.globalCompositeOperation = 'lighter';
    for (const s of SPARK) { const tt = t - 8.0; if (tt <= 0) break; const k = (1 - Math.exp(-tt * 3.2)) / 3.2, x = LOGO.x + s.vx * k, y = LOGO.y + s.vy * k + 120 * tt * tt, a = 1 - inv(.2, 1.3, tt); if (a <= 0) continue; c.globalAlpha = a; c.drawImage(A.gGold, x - s.s, y - s.s, s.s * 2, s.s * 2); }
    c.globalAlpha = 1;
    // logo
    const la = inv(7.97, 8.1, t), ls = lerp(1.1, 1, E.outCubic(inv(8.0, 8.7, t))), S = LOGO.s * ls;
    c.globalAlpha = .5 * la + .45 * pulse(t, 8.0, 4); c.drawImage(A.logoGlow, LOGO.x - S / 2, LOGO.y - S / 2, S, S);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    const L = A.logoWork.ctx; L.setTransform(1, 0, 0, 1, 0, 0); L.clearRect(0, 0, 512, 512); L.globalCompositeOperation = 'source-over'; L.drawImage(A.logo, 0, 0);
    const shx = lerp(-200, 720, inv(8.6, 9.2, t));
    if (shx > -200 && shx < 720) { L.globalCompositeOperation = 'source-atop'; L.fillStyle = lgrad(L, shx - 90, 0, shx + 90, 0, [[0, 'rgba(255,248,225,0)'], [.5, 'rgba(255,248,225,.75)'], [1, 'rgba(255,248,225,0)']]); L.setTransform(1, 0, .45, 1, 0, 0); L.fillRect(-300, 0, 1200, 512); L.setTransform(1, 0, 0, 1, 0, 0); }
    c.globalAlpha = la; c.drawImage(A.logoWork, LOGO.x - S / 2, LOGO.y - S / 2, S, S); c.globalAlpha = 1;
    // ring callback
    const rp = E.inOutCubic(inv(8.05, 8.85, t)), R = 286;
    if (rp > 0) {
      c.strokeStyle = 'rgba(200,160,86,.75)'; c.lineWidth = 2; c.beginPath(); c.arc(LOGO.x, LOGO.y, R, -Math.PI / 2, -Math.PI / 2 + rp * TAU); c.stroke();
      c.strokeStyle = 'rgba(200,160,86,.3)'; c.lineWidth = 1; c.beginPath(); c.arc(LOGO.x, LOGO.y, R + 14, Math.PI / 2, Math.PI / 2 + rp * TAU); c.stroke();
      for (let k = 0; k < 8; k++) { const sc = E.outBack(clamp((rp - k / 8) / .1)); if (sc <= 0) continue; const ak = -Math.PI / 2 + k / 8 * TAU; c.save(); c.translate(LOGO.x + Math.cos(ak) * R, LOGO.y + Math.sin(ak) * R); c.rotate(ak); c.scale(sc, sc); c.fillStyle = GOLDL; c.beginPath(); c.moveTo(k % 2 ? 12 : 20, 0); c.lineTo(0, 4.5); c.lineTo(-8, 0); c.lineTo(0, -4.5); c.closePath(); c.fill(); c.restore(); }
    }
    // anamorphic flare
    const fl = pulse(t, 8.0, 3.2);
    if (fl > .01) { c.globalCompositeOperation = 'lighter'; c.fillStyle = lgrad(c, 0, 0, W, 0, [[0, 'rgba(255,190,110,0)'], [.5, `rgba(255,236,200,${.9 * fl})`], [1, 'rgba(255,190,110,0)']]); c.fillRect(0, LOGO.y - 2, W, 4); c.globalAlpha = .35 * fl; c.drawImage(A.gGold, -200, LOGO.y - 40, W + 400, 80); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
  }
  // brand type — 與網站開場相同的「字距收合」
  const ey = inv(8.35, 8.85, t);
  txt(c, 'STARFISH · MURDER MYSTERY', 960, 726, { fam: F.cin, wt: 700, px: 24, ls: .55, fill: GOLD, alpha: ey });
  const tq = inv(8.18, 9.15, t);
  if (tq > 0) {
    const e = E.outQuart(tq), ls = lerp(.9, .18, e), blur = lerp(12, 0, e), a = clamp(tq / .6);
    const T = TA.ctx, px = 124; T.setTransform(1, 0, 0, 1, 0, 0); T.clearRect(0, 0, W, 300);
    const row = charRow('海星劇本殺', 960, px, ls), x0 = row[0].x - px / 2, x1 = row[row.length - 1].x + px / 2;
    T.fillStyle = lgrad(T, x0, 40, x1, 260, [[0, '#ffffff'], [.4, GOLDL], [.8, GOLD], [1, '#b38a45']]); setFont(T, F.serif, 900, px); T.textAlign = 'center'; T.textBaseline = 'middle';
    row.forEach(o => T.fillText(o.ch, o.x, 150));
    const shx = lerp(x0 - 200, x1 + 200, inv(9.25, 9.75, t));
    if (shx > x0 - 200 && shx < x1 + 200) { T.globalCompositeOperation = 'source-atop'; T.fillStyle = lgrad(T, shx - 70, 0, shx + 70, 0, [[0, 'rgba(255,255,255,0)'], [.5, 'rgba(255,255,255,.85)'], [1, 'rgba(255,255,255,0)']]); T.fillRect(0, 0, W, 300); T.globalCompositeOperation = 'source-over'; }
    c.save(); c.globalAlpha = a; if (blur > .3) c.filter = `blur(${blur.toFixed(1)}px)`; c.drawImage(TA, 0, 0, W, 300, 0, 816 - 150, W, 300); c.restore();
  }
  const lw = E.outQuart(inv(8.55, 9.25, t)) * 420;
  if (lw > 0) { c.fillStyle = lgrad(c, 960 - lw / 2, 0, 960 + lw / 2, 0, [[0, 'rgba(236,208,138,0)'], [.5, GOLDL], [1, 'rgba(236,208,138,0)']]); c.fillRect(960 - lw / 2, 893, lw, 1.6); c.globalCompositeOperation = 'lighter'; c.globalAlpha = .5; c.drawImage(A.gGold, 960 - lw / 2, 879, lw, 30); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
  txt(c, '沉浸其中 · 探索謎局', 960, 942, { fam: F.sans, wt: 500, px: 32, ls: .34, fill: TXT, alpha: inv(8.75, 9.3, t) * .92 });
  c.setTransform(base);
}

/* ---------- HUD（片頭到 SC.04 的取景框） ---------- */
const SC = [[0, 'SC.01', '入口 · THE DOOR'], [1.6, 'SC.02', '世界 · WORLDS'], [4.0, 'SC.03', '群像 · 57 SCRIPTS'], [6.0, 'SC.04', '你 · YOU']];
function hud(c, t) {
  const a = inv(.1, .45, t) * (1 - inv(7.45, 7.7, t)); if (a <= 0) return;
  c.save(); c.globalAlpha = a; const m = 52, L = 30, col = 'rgba(255,246,228,.72)';
  c.strokeStyle = col; c.lineWidth = 2;
  [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => { c.beginPath(); c.moveTo(x, y + sy * L); c.lineTo(x, y); c.lineTo(x + sx * L, y); c.stroke(); });
  const f = Math.floor(t * FPS + 1e-6), tc = `00:00:${String(Math.floor(f / FPS)).padStart(2, '0')}:${String(f % FPS).padStart(2, '0')}`;
  const o = { fam: F.mono, wt: 600, px: 16, ls: .16, fill: col, base: 'middle' };
  txt(c, 'STARFISH MYSTERY · SHOWREEL 2026', m + 44, m + 6, { ...o, align: 'left' });
  txt(c, tc, W - m - 44, m + 6, { ...o, align: 'right' });
  c.fillStyle = '#ff3b30'; c.globalAlpha = a * (Math.floor(t * 2) % 2 ? .35 : 1); c.beginPath(); c.arc(W - m - 44 - tw(tc, F.mono, 600, 16, .16) - 20, m + 6, 5, 0, TAU); c.fill(); c.globalAlpha = a;
  let k = 0; while (k < SC.length - 1 && t >= SC[k + 1][0]) k++;
  const sq = E.outExpo(inv(SC[k][0], SC[k][0] + .3, t));
  txt(c, SC[k][1], m + 44, H - m - 6, { ...o, align: 'left', fill: GOLDL });
  c.save(); c.beginPath(); c.rect(m + 120, H - m - 30, 400 * sq, 50); c.clip(); txt(c, SC[k][2], m + 124, H - m - 6, { ...o, align: 'left', fam: F.sans, wt: 500, px: 17 }); c.restore();
  const bw = 300, bx = W - m - 44 - bw, by = H - m - 6;
  c.fillStyle = 'rgba(255,246,228,.22)'; c.fillRect(bx, by - 1, bw, 2); c.fillStyle = GOLDL; c.fillRect(bx, by - 1, bw * t / DUR, 2);
  [0, 1.6, 4.0, 6.0, 7.6].forEach(s => { c.fillStyle = t >= s ? GOLDL : 'rgba(255,246,228,.4)'; c.fillRect(bx + bw * s / DUR - 1, by - 6, 2, 12); });
  c.restore();
}

/* ---------- 合成 ---------- */
function drawScene(c, t) {
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
  const s = shake(t), k = 1 + (Math.abs(s.x) + Math.abs(s.y)) / 700;
  c.translate(CX + s.x, CY + s.y); c.rotate(s.r); c.scale(k, k); c.translate(-CX, -CY);
  if (t < 1.6) sceneA(c, t);
  else if (t < 4.0) montage(c, t);
  else if (t < 6.0) wall(c, t);
  else if (t < 7.6) kinetic(c, t);
  else logoScene(c, t);
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.filter = 'none';
  hud(c, t);
}
const subN = t => (t > 1.3 && t < 1.62) || (t > 3.98 && t < 5.1) || (t > 6.1 && t < 7.0) || (t > 7.55 && t < 8.1) ? 7 : t > 8.6 ? 3 : 5;
function bloomAmt(t) { if (t >= 1.6 && t < 2.0) return .26; if ((t >= 3.4 && t < 3.6) || (t >= 3.8 && t < 4.05)) return .1; if (t >= 2.0 && t < 2.4) return .14; if (t >= 6.0 && t < 7.0) return .16; return .42; }
function caAmt(t) { let a = 0; for (const im of IMPACTS) a += im.a * pulse(t, im.t, 9) * .32; return a + 1.2; }
function post(t) {
  const o = octx; o.setTransform(1, 0, 0, 1, 0, 0); o.globalAlpha = 1; o.globalCompositeOperation = 'source-over'; o.filter = 'none';
  const ca = caAmt(t);
  if (ca > 1.5) {
    [[CR, '#f00', 1 + ca / 960], [CG, '#0f0', 1], [CB, '#00f', 1 - ca / 960]].forEach(([cv, col]) => { const x = cv.ctx; x.globalCompositeOperation = 'source-over'; x.drawImage(ACC, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = col; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over'; });
    o.fillStyle = '#000'; o.fillRect(0, 0, W, H); o.globalCompositeOperation = 'lighter';
    [[CR, 1 + ca / 960], [CG, 1], [CB, 1 - ca / 960]].forEach(([cv, s]) => { o.setTransform(s, 0, 0, s, CX * (1 - s), CY * (1 - s)); o.drawImage(cv, 0, 0); });
    o.setTransform(1, 0, 0, 1, 0, 0); o.globalCompositeOperation = 'source-over';
  } else o.drawImage(ACC, 0, 0);
  // bloom
  const b = bloomAmt(t);
  BL1.ctx.filter = 'brightness(.85) contrast(2.4) blur(4px)'; BL1.ctx.drawImage(OUT, 0, 0, 480, 270); BL1.ctx.filter = 'none';
  BL2.ctx.filter = 'blur(5px)'; BL2.ctx.drawImage(BL1, 0, 0, 240, 135); BL2.ctx.filter = 'none';
  o.globalCompositeOperation = 'lighter'; o.globalAlpha = b; o.drawImage(BL1, 0, 0, W, H); o.globalAlpha = b * .8; o.drawImage(BL2, 0, 0, W, H);
  o.globalAlpha = 1; o.globalCompositeOperation = 'source-over';
  o.drawImage(A.vig, 0, 0);
  // flashes
  const fl = Math.max(pulse(t, 1.6, 14) * .22, pulse(t, 7.2, 12) * .2, pulse(t, 6.8, 14) * .1, pulse(t, 8.0, 14) * .22);
  if (fl > .003) { o.fillStyle = `rgba(255,240,214,${fl})`; o.fillRect(0, 0, W, H); }
  const rf = pulse(t, 8.0, 9) * .6;
  if (rf > .003) { o.globalCompositeOperation = 'lighter'; o.globalAlpha = rf; const fx = t >= 8 ? LOGO.x : KH.x, fy = t >= 8 ? LOGO.y : KH.y; o.drawImage(A.gWhite, fx - 1500, fy - 1100, 3000, 2200); o.globalAlpha = 1; o.globalCompositeOperation = 'source-over'; }
  // grain
  const f = Math.round(t * FPS), gt = A.grain[f % 4], pat = o.createPattern(gt, 'repeat');
  pat.setTransform(new DOMMatrix().translate(hash(f) * 256, hash(f + 9) * 256));
  o.globalCompositeOperation = 'overlay'; o.globalAlpha = .075; o.fillStyle = pat; o.fillRect(0, 0, W, H);
  o.globalAlpha = 1; o.globalCompositeOperation = 'source-over';
  const fade = Math.max(inv(9.72, 10, t), 1 - inv(0, .12, t));
  if (fade > 0) { o.fillStyle = `rgba(0,0,0,${fade})`; o.fillRect(0, 0, W, H); }
}

window.renderFrame = function (f) {
  const t = f / FPS, n = subN(t), shutter = .5 / FPS, a = ACC.ctx;
  a.setTransform(1, 0, 0, 1, 0, 0); a.globalCompositeOperation = 'source-over';
  for (let k = 0; k < n; k++) {
    drawScene(SCN.ctx, Math.min(DUR - 1e-4, t + shutter * k / n));
    a.globalAlpha = 1 / (k + 1); a.drawImage(SCN, 0, 0);
  }
  a.globalAlpha = 1;
  post(t);
  return true;
};
window.reelInfo = { W, H, FPS, DUR, frames: FPS * DUR };

window.reelReady = (async () => {
  await Promise.all([...document.fonts].map(f => f.load()));  // 每個 unicode-range 子集都先載入
  await document.fonts.ready;
  A.logoImg = await loadImg('../../pwa/icon-512.png');
  A.rabbit = await loadImg('../../劇本資料/角色海報/《疯兔子》—主海报.jpg');
  buildSprites(); buildLogo(); buildParticles(); build3D();
  return true;
})();
})();
