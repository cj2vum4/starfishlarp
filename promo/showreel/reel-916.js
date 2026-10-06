/* ==========================================================
   海星劇本殺 · IG Reels 直式版（9:16 / 1080×1920 / 30fps / 16 秒）
   ----------------------------------------------------------
   共用引擎在 core.js；這裡只有直式的分鏡、版面與時間軸。

   IG Reels 介面安全區（重要文字都放在裡面）：
     上 250px（帳號列）、下 420px（說明文字／音樂列，y > 1500）、
     右側 x > 950、y 1000–1700（愛心／留言／分享鈕）。
   無縫循環：片尾 Logo 中心的鑰匙孔縮放回片頭鑰匙孔的位置與大小，
   金塵、暖光也回到片頭的樣子；Reels 自動重播時接回第一格。

   分鏡（150 BPM，一拍 0.4s；全片 40 拍＝10 小節）
   0.0–2.0   SC.01 入口：第一格鑰匙孔就亮著（停住滑動的手指）、羅盤環、
                         「推開門，成為另一個人」，穿過鑰匙孔
   2.0–6.4   SC.02 世界：八個劇本世界直式重新構圖（0.8 → 0.6 → 0.4 秒，越剪越快）
   6.4–9.2   SC.03 群像：最後一格縮成卡片 → 57 張劇本卡 3D 漩渦 → 排成海星
   9.2–11.2  SC.04 你　：推理／情感／驚悚／歡樂 直書四格甩鏡 → 這一次，你是誰？
   11.2–16.0 LOGO    ：文字化為金塵 → 海星 Logo → 品牌字 → 預約資訊（12.8 起停留約 2.5 秒）
                         → 15.45 起收場，鑰匙孔接回片頭
   ========================================================== */
'use strict';
(function () {
const {
  W, H, FPS, DUR, TAU, GOLD, GOLDL, TXT,
  clamp, lerp, inv, E, rng, hash, vnoise, pulse,
  mk, TA, TB, F, setFont, txt, tw, lgrad, goldText, stars, charRow,
  SCRIPTS, byId, NS, zhNum, A, poster, posterCard, boltPts, keyholePath, build3D, W3, P, buildParticles,
} = window.Reel;
const CX = W / 2, CY = H / 2;

/* ---------- timeline ---------- */
const T_WORLD = 2.0, T_WALL = 6.4, T_YOU = 9.2, T_LOGO = 11.2, T_BOOM = 11.6, T_CTA = 12.8, T_LOOP = DUR - .55;   // T_LOOP：收場開始（之後 0.55 秒接回片頭）
const CUTS = [
  { t: 2.0, d: .8, id: 'wangzuo', draw: cutThrone },
  { t: 2.8, d: .6, id: 'chunzhou', draw: cutSpring, tr: 'iris' },
  { t: 3.4, d: .6, id: 'fengtuz', draw: cutRabbit, tr: 'glitch' },
  { t: 4.0, d: .6, id: 'qunxing', draw: cutStars, tr: 'zoom' },
  { t: 4.6, d: .4, id: 'jinmen', draw: cutTianjin, tr: 'slats' },
  { t: 5.0, d: .4, id: 'qingtian', draw: cutShrine, tr: 'swipe' },
  { t: 5.4, d: .4, id: 'lichuan', draw: cutLichuan, tr: 'shutter' },
  { t: 5.8, d: .6, id: 'feiteng', draw: cutBoil, tr: 'punch' },
];
const IMPACTS = [
  { t: 2.0, a: 26, k: 7 }, { t: 2.8, a: 6, k: 12 }, { t: 3.4, a: 16, k: 10 }, { t: 4.0, a: 8, k: 12 },
  { t: 4.6, a: 12, k: 14 }, { t: 5.0, a: 6, k: 14 }, { t: 5.4, a: 7, k: 14 }, { t: 5.8, a: 10, k: 14 },
  { t: 9.2, a: 16, k: 14 }, { t: 9.4, a: 10, k: 14 }, { t: 9.6, a: 9, k: 14 }, { t: 9.8, a: 9, k: 14 },
  { t: 10.0, a: 8, k: 10 }, { t: 10.4, a: 22, k: 9 }, { t: 11.6, a: 30, k: 6 }, { t: T_CTA, a: 5, k: 12 },
];
const beatAt = t => pulse(t, Math.floor(t / .4 + 1e-6) * .4, 6);

/* 片頭鑰匙孔＝片尾 Logo 位置（循環接縫） */
const KH = { x: 540, y: 640, s: 2.0 }, RING_R = 360;
const LOGO = { x: 540, y: 640, s: 660 };
const LOGO_KH = { x: 540, y: 640 + 6 * 660 / 512, s: .49 * 660 / 512 };   // Logo 圖中鑰匙孔（icon 實測並逐格對位：中心 256,262、約 0.49 倍）

/* 直式專用素材：鳥居、雷電 */
function buildSprites916() {
  A.toriiV = mk(W, H); {
    const c = A.toriiV.ctx;
    c.fillStyle = '#d4402a'; c.beginPath(); c.moveTo(-10, 470); c.quadraticCurveTo(540, 508, 1090, 470); c.lineTo(1110, 422); c.quadraticCurveTo(540, 462, -30, 422); c.closePath(); c.fill();
    c.fillStyle = '#1b1414'; c.beginPath(); c.moveTo(-40, 422); c.quadraticCurveTo(540, 458, 1120, 422); c.lineTo(1132, 396); c.quadraticCurveTo(540, 434, -52, 396); c.closePath(); c.fill();
    c.fillStyle = '#d4402a'; c.fillRect(40, 610, 1000, 42); c.fillRect(118, 468, 66, 1460); c.fillRect(896, 468, 66, 1460); c.fillRect(507, 488, 66, 122);
    c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(118, 468, 16, 1460); c.fillRect(896, 468, 16, 1460);
  }
  A.boltsV = [boltPts(rng(31), 790, -40, 610, 1180), boltPts(rng(57), 250, -40, 430, 1000), boltPts(rng(83), 900, -40, 820, 820)];
}

/* ========================================================
   SC.01 入口
   ======================================================== */
const DUST = Array.from({ length: 210 }, (_, i) => { const r = rng(40 + i); return { x: r() * W, y: r() * H, d: .25 + r() * .75, ph: r() * TAU, s: 4 + r() * 18 }; });
function dust(c, t, z = 1, ax = CX, ay = CY, alpha = 1) {
  if (alpha <= 0) return;
  c.globalCompositeOperation = 'lighter';
  for (const m of DUST) {
    const zz = Math.pow(z, m.d * 1.3), x0 = m.x + Math.sin(t * .7 + m.ph) * 14, y0 = ((m.y - t * 26 * m.d) % H + H) % H;
    const x = ax + (x0 - ax) * zz, y = ay + (y0 - ay) * zz, s = m.s * Math.pow(zz, .7);
    const a = (.16 + .3 * m.d) * alpha * (1 - inv(160, 600, s)); if (a <= 0) continue;
    c.globalAlpha = a; c.drawImage(A.gGold, x - s, y - s, s * 2, s * 2);
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}
function warmBg(c, beat, a = 1) {
  const ax = KH.x, ay = KH.y - 22 * KH.s, g = c.createRadialGradient(ax, ay, 0, ax, ay, 1050);
  g.addColorStop(0, `rgba(120,28,16,${(.34 + beat * .12) * a})`); g.addColorStop(.5, `rgba(50,14,8,${.18 * a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}
/* 發光鑰匙孔（片頭與片尾共用同一支，循環接縫才會一模一樣） */
function drawKeyhole(c, x, y, s, beat, alpha = 1) {
  if (alpha <= 0) return;
  const k = s / 1.6; c.save(); c.globalAlpha = alpha;
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = alpha * (.55 + beat * .45); c.drawImage(A.gCrim, x - 230 * k, y - 250 * k, 460 * k, 460 * k);
  c.globalCompositeOperation = 'source-over'; c.globalAlpha = alpha;
  keyholePath(c, x, y, s);
  const kg = c.createRadialGradient(x, y - 30 * k, 0, x, y, 110 * k); kg.addColorStop(0, '#ffcf9a'); kg.addColorStop(.3, '#ff4a2e'); kg.addColorStop(1, '#4a0a06');
  c.fillStyle = kg; c.fill(); c.strokeStyle = GOLDL; c.lineWidth = 2.6 * k; c.lineJoin = 'round'; c.stroke();
  c.restore();
}
function ring(c, t, prog, alpha = 1) {
  alpha *= inv(0, .02, prog);   // 整個環隨進度淡入：循環接縫的第一格不會冒出刻度或火花
  if (prog <= 0 || alpha <= 0) return;
  const a0 = -Math.PI / 2, a1 = a0 + prog * TAU, R = RING_R, X = KH.x, Y = KH.y;
  c.save(); c.globalAlpha = alpha; c.lineCap = 'round';
  c.strokeStyle = 'rgba(200,160,86,.95)'; c.lineWidth = 2.6; c.beginPath(); c.arc(X, Y, R, a0, a1); c.stroke();
  c.strokeStyle = 'rgba(200,160,86,.45)'; c.lineWidth = 1.2; c.beginPath(); c.arc(X, Y, R - 22, a0, a1); c.stroke();
  for (let i = 0; i < 96; i++) { const ai = a0 + i / 96 * TAU; if (ai > a1) break; const L = i % 12 === 0 ? 18 : 8; c.strokeStyle = i % 12 === 0 ? 'rgba(236,208,138,.8)' : 'rgba(200,160,86,.42)'; c.lineWidth = i % 12 === 0 ? 2.2 : 1.1; c.beginPath(); c.moveTo(X + Math.cos(ai) * (R - 22), Y + Math.sin(ai) * (R - 22)); c.lineTo(X + Math.cos(ai) * (R - 22 - L), Y + Math.sin(ai) * (R - 22 - L)); c.stroke(); }
  for (let k = 0; k < 8; k++) {
    const sc = E.outBack(clamp((prog - k / 8) / .07)); if (sc <= 0) continue; const ak = a0 + k / 8 * TAU;
    c.save(); c.translate(X + Math.cos(ak) * R, Y + Math.sin(ak) * R); c.rotate(ak); c.scale(sc * 1.15, sc * 1.15);
    c.fillStyle = k % 2 ? 'rgba(200,160,86,.8)' : GOLDL; const L = k % 2 ? 18 : 30;
    c.beginPath(); c.moveTo(L, 0); c.lineTo(0, 6); c.lineTo(-12, 0); c.lineTo(0, -6); c.closePath(); c.fill();
    c.beginPath(); c.arc(0, 0, 3.2, 0, TAU); c.fillStyle = '#fff3d0'; c.fill(); c.restore();
  }
  c.setLineDash([2, 13]); c.lineDashOffset = -t * 40; c.strokeStyle = `rgba(200,160,86,${.38 * inv(.3, .9, t)})`; c.lineWidth = 2; c.beginPath(); c.arc(X, Y, R + 52, 0, TAU); c.stroke(); c.setLineDash([]);
  const ha = alpha;
  if (prog < 1 && ha > 0) {
    c.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 16; k++) { const ak = a1 - k * .018, s = 28 - k * 1.4; c.globalAlpha = ha * (1 - k / 16) * .55; c.drawImage(A.gGold, X + Math.cos(ak) * R - s, Y + Math.sin(ak) * R - s, s * 2, s * 2); }
    c.globalAlpha = ha; c.drawImage(A.gWhite, X + Math.cos(a1) * R - 24, Y + Math.sin(a1) * R - 24, 48, 48);
  }
  c.restore();
}
function sceneA(c, t) {
  const base = c.getTransform();
  c.fillStyle = '#060403'; c.fillRect(0, 0, W, H);
  const p = inv(1.6, 2.0, t), dive = E.inExpo(p), z = lerp(1, 1.07, E.inOutCubic(inv(0, 1.6, t))) * Math.pow(64, dive);
  const ax = KH.x, ay = KH.y - 22 * KH.s, beat = beatAt(t);
  warmBg(c, beat);
  dust(c, t, z, ax, ay);
  c.translate(ax, ay); c.scale(z, z); c.rotate(-.42 * E.inCubic(p)); c.translate(-ax, -ay);
  ring(c, t, E.inOutCubic(inv(0, 1.3, t)));
  drawKeyhole(c, KH.x, KH.y, KH.s, beat);
  if (p > 0) {
    c.save(); keyholePath(c, KH.x, KH.y, KH.s); c.clip(); c.setTransform(base);
    c.globalAlpha = inv(.25, .8, p); montage(c, t); c.globalAlpha = 1; c.restore();
    c.save(); keyholePath(c, KH.x, KH.y, KH.s); c.lineJoin = 'round';
    c.strokeStyle = 'rgba(255,190,120,.35)'; c.lineWidth = 9; c.stroke(); c.strokeStyle = GOLDL; c.lineWidth = 2.6; c.stroke(); c.restore();
  }
  c.setTransform(base);
  // 標語：兩行大字（直式第一眼就讀得到）
  const fade = 1 - inv(1.58, 1.74, t);
  if (fade > 0) {
    [['推開門，', 1172, GOLDL, 0], ['成為另一個人', 1292, TXT, 4]].forEach(([line, y, col, k0]) => {
      const row = charRow(line, 540 + (line.endsWith('，') ? 46 : 0), 96, .16);
      row.forEach((o, i) => { const q = inv(.02 + (k0 + i) * .05, .32 + (k0 + i) * .05, t); if (q <= 0) return; const e = E.outCubic(q); txt(c, o.ch, o.x, y + (1 - e) * 22, { px: 96, wt: 900, fill: o.ch === '，' ? GOLD : col, alpha: e * fade }); });
    });
    txt(c, 'OPEN THE DOOR · BECOME SOMEONE ELSE', 540, 1380, { fam: F.cin, wt: 700, px: 21, ls: .34, fill: GOLD, alpha: inv(.95, 1.25, t) * fade * .9 });
  }
}

/* ========================================================
   SC.02 世界 —— 直式構圖
   ======================================================== */
function infoStack(c, s, x, y, o) {
  const { align = 'center', col = TXT, acc = GOLDL, off = 'rgba(255,255,255,.22)', u = 1, tags, px = 32 } = o, a = inv(.03, .14, u);
  if (a <= 0) return;
  txt(c, tags || s.types.slice(0, 3).join(' · '), x, y, { fam: F.sans, wt: 500, px, ls: .12, fill: col, align, alpha: a });
  const meta = `${s.players} PLAYERS  ·  ${String(s.time).replace(/\.0$/, '')} HRS`, mpx = 23;
  const mwText = tw(meta, F.mono, 500, mpx, .1), mw = mwText + 26 + 10 * 10 + 4 * 6;
  const x0 = align === 'center' ? x - mw / 2 : align === 'right' ? x - mw : x;
  txt(c, meta, x0, y + 56, { fam: F.mono, wt: 500, px: mpx, ls: .1, fill: col, align: 'left', alpha: a * .92 });
  c.save(); c.globalAlpha = a; stars(c, x0 + mwText + 26, y + 56, s.difficulty, 10, acc, off, 'left', 6); c.restore();
}
function label(c, s, x, y, u, o = {}) {
  const { align = 'center', fill = GOLDL, px = 30 } = o, q = E.outExpo(inv(0, .16, u)); if (q <= 0) return;
  const w = tw(s, F.cin, 700, px, .5) + 30;
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  c.save(); c.beginPath(); c.rect(x0 - 10, y - px, w * q + 20, px * 2); c.clip();
  txt(c, s, x, y, { fam: F.cin, wt: 700, px, ls: .5, fill, align }); c.restore();
  c.fillStyle = fill; c.globalAlpha = .9; c.fillRect(align === 'center' ? x - w * q * .175 : x0, y + px * .9, w * q * .35, 2); c.globalAlpha = 1;
}
function bigIndex(c, n, x, y, u, col, align = 'right', px = 520) {
  txt(c, String(n).padStart(2, '0'), x + u * 50 * (align === 'right' ? -1 : 1), y, { fam: F.cin, wt: 900, px, fill: null, stroke: col, lw: 2.5, align, alpha: inv(0, .08, u) });
}
/* 直式世界的共同版面：上方英文標＋劇名，中間海報，下方標籤資訊（都在 IG 安全區內） */
const LBL_Y = 300, TTL_Y = 450, P_Y = 985, P_H = 760, INF_Y = 1425;
/* 每個世界的海報：重拍前（穿鑰匙孔、轉場中）就在畫面上，落地時從 1.1 倍收回、之後緩慢推近 */
function hero(c, s, u, o = {}) {
  const q = E.outExpo(inv(0, .22, u)), sc = lerp(1.1, 1, q) * (1 + Math.max(0, u) * .04);
  posterCard(c, poster(s.id), o.x || CX, o.y || P_Y, o.h || P_H, { sc, ...o });
}
function cutThrone(c, u, s) {
  const g = c.createRadialGradient(540, 760, 0, 540, 900, 1350); g.addColorStop(0, '#22407e'); g.addColorStop(.45, '#0b1736'); g.addColorStop(1, '#03060f');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 12; k++) { c.globalAlpha = .13; c.drawImage(A.cloud, ((hash(k * 3.1) * 1700 + u * (60 + k * 30)) % 1900) - 600, 40 + hash(k) * 1600, 1000, 400); }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  bigIndex(c, 1, 1020, 1560, u, 'rgba(220,188,114,.12)');
  c.save(); c.translate(540, P_Y); c.rotate(u * .45 - .3);
  c.strokeStyle = 'rgba(220,188,114,.55)'; c.lineWidth = 1.6; c.beginPath(); c.arc(0, 0, 440, 0, TAU); c.stroke(); c.beginPath(); c.arc(0, 0, 396, 0, TAU); c.stroke();
  c.lineWidth = 2.4; for (let i = 0; i < A.runes.length; i++) { c.save(); c.rotate(i / A.runes.length * TAU); c.translate(0, -418); c.beginPath(); for (const l of A.runes[i]) { c.moveTo(l[0], l[1]); c.lineTo(l[2], l[3]); } c.stroke(); c.restore(); }
  c.restore();
  const fs = [[.05, .15, 0], [.3, .36, 1], [.56, .62, 2]], fl = Math.max(pulse(u, .05, 24), pulse(u, .3, 28) * .7, pulse(u, .56, 28) * .6);
  const on = fs.find(([a, b]) => u >= a && u < b);
  if (on) {
    const b = A.boltsV[on[2]]; c.lineCap = 'round'; c.lineJoin = 'round'; c.globalCompositeOperation = 'lighter';
    const path = pts => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.stroke(); };
    c.strokeStyle = 'rgba(140,170,255,.35)'; c.lineWidth = 22; path(b.pts); c.lineWidth = 9; c.strokeStyle = 'rgba(190,210,255,.6)'; path(b.pts); b.branches.forEach(path);
    c.strokeStyle = '#fff'; c.lineWidth = 3; path(b.pts); c.lineWidth = 1.5; b.branches.forEach(path); c.globalCompositeOperation = 'source-over';
  }
  hero(c, s, u);
  if (u > -.2) { c.fillStyle = `rgba(170,195,255,${fl * .3})`; c.fillRect(0, 0, W, H); }
  const q = E.outExpo(inv(0, .2, u)), sc = lerp(1.32, 1, q) * (1 + u * .05), a = u >= 0 ? 1 : 0;
  if (a > 0) {
    c.save(); c.translate(540, TTL_Y); c.scale(sc, sc);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = .2; c.drawImage(A.gGold, -420, -200, 840, 400); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    txt(c, '王座', 0, 0, { px: 200, ls: .12, fill: goldText(c, 0, -105, 0, 105) });
    c.restore();
  }
  label(c, 'MYTHOLOGY', 540, LBL_Y, u);
  infoStack(c, s, 540, INF_Y, { u, tags: '神話 · 陣營 · 身份轉換' });
}
const PETALS = Array.from({ length: 140 }, (_, i) => { const r = rng(700 + i); return { x: r() * 1500 - 300, y: r() * 2400 - 500, z: .3 + r() * 1.3, rs: (r() - .5) * 6, ph: r() * TAU, sp: .6 + r() * .8 }; });
function cutSpring(c, u, s) {
  c.fillStyle = lgrad(c, 0, 0, W * .25, H, [[0, '#f6b49c'], [.5, '#d55a78'], [1, '#4a0e2a']]); c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = .6; c.drawImage(A.gWhite, 780 - 400, 420 - 400, 800, 800); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  bigIndex(c, 2, 1030, 1580, u, 'rgba(255,255,255,.25)');
  const petal = big => { for (const p of PETALS) { if ((p.z > 1.15) !== big) continue; const tt = u + 1; const x = p.x + tt * (big ? 300 : 260) * p.sp * p.z + (big ? 0 : Math.sin(tt * 2 + p.ph) * 40), y = p.y + tt * (big ? 340 : 300) * p.sp * p.z; c.save(); c.translate(x, y); c.rotate(p.ph + tt * p.rs); const k = big ? p.z * 2.4 : p.z; c.scale(k, k * Math.cos(tt * 3 + p.ph)); c.globalAlpha = big ? .7 : .85; c.drawImage(big ? A.petalB : A.petal, big ? -48 : -32, big ? -48 : -32); c.restore(); } };
  petal(false);
  hero(c, s, u, { rot: .025, frame: '#fff4ee' });
  // 標題：一字一字上浮
  charRow('春晝短', 540, 190, .1).forEach((o, i) => { const q = E.outExpo(inv(i * .05, .22 + i * .05, u)); if (q <= 0) return; const y = TTL_Y + (1 - q) * 100; txt(c, o.ch, o.x + 7, y + 7, { px: 190, fill: 'rgba(80,8,34,.45)', alpha: q }); txt(c, o.ch, o.x, y, { px: 190, fill: '#fffaf6', alpha: q }); });
  label(c, 'ROMANCE', 540, LBL_Y, u, { fill: '#fff' });
  infoStack(c, s, 540, INF_Y, { u, col: '#fff8f4', acc: '#fff', tags: '情感 · 沉浸 · 治癒', px: 30 });
  petal(true);
}
function cutRabbit(c, u, s) {
  c.fillStyle = '#070000'; c.fillRect(0, 0, W, H);
  const img = poster(s.id), step = Math.floor(u * 30), st10 = Math.floor(u * 10), glitch = (u < .06) || (u > .3 && u < .35) || hash(st10 * 7.7) > .78;   // 故障狀態 10Hz 切換，不會紅光頻閃
  const pw = W + 140, ph = pw * img.height / img.width, px0 = -70, py0 = 40 - u * 60, strips = 24;
  for (let k = 0; k < strips; k++) {
    const sy = img.height * k / strips, sh = img.height / strips, off = glitch ? (hash(k * 13.1 + step) - .5) * 120 * (hash(k + step * 3) > .55 ? 1 : 0) : 0;
    c.drawImage(img, 0, sy, img.width, sh, px0 + off, py0 + ph * k / strips, pw, ph / strips + 1);
  }
  if (glitch) { c.globalCompositeOperation = 'screen'; c.globalAlpha = .35; c.drawImage(img, px0 + 18, py0, pw, ph); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
  c.fillStyle = lgrad(c, 0, 640, 0, 1120, [[0, 'rgba(7,0,0,0)'], [1, '#070000']]); c.fillRect(0, 640, W, 480); c.fillStyle = '#070000'; c.fillRect(0, 1119, W, H);
  c.fillStyle = lgrad(c, 0, 0, 0, 280, [[0, '#070000'], [.68, '#070000'], [1, 'rgba(7,0,0,0)']]); c.fillRect(0, 0, W, 280);   // 蓋住海報上緣的簡體宣傳字
  c.fillStyle = 'rgba(160,0,0,.22)'; c.globalCompositeOperation = 'multiply'; c.fillRect(0, 0, W, H); c.globalCompositeOperation = 'source-over';
  c.fillStyle = c.createPattern(A.scan, 'repeat'); c.fillRect(0, 0, W, H);
  const a = u >= 0 ? 1 : 0, j = (glitch ? 16 : 5) * (1 + pulse(u, 0, 8) * 2), jx = vnoise(u * 60) * (glitch ? 14 : 3), jy = vnoise(u * 50 + 9) * (glitch ? 8 : 2);
  if (a > 0) {
    const X = 540 + jx, Y = 1060 + jy, o = { px: 262, alpha: a, op: 'lighter', ls: .02 };
    txt(c, '瘋兔子', X - j, Y, { ...o, fill: '#ff0000' }); txt(c, '瘋兔子', X, Y, { ...o, fill: '#00ff00' }); txt(c, '瘋兔子', X + j, Y, { ...o, fill: '#0000ff' });
    if (glitch) { c.save(); c.beginPath(); c.rect(0, Y - 40 + hash(step) * 60, W, 34); c.clip(); txt(c, '瘋兔子', X + 60, Y, { px: 262, fill: '#ff2a2a', ls: .02 }); c.restore(); }
    txt(c, '白又白，砍下腦袋飛起來', 540, 1232, { px: 40, wt: 700, ls: .12, fill: '#ff3b30', alpha: inv(.02, .08, u) });
  }
  label(c, 'HORROR', 540, 852, u, { fill: '#ff4a3d' });
  infoStack(c, s, 540, 1320, { u, col: '#f6dada', acc: '#ff4a3d', tags: '架空 · 驚悚 · 怪談 · 新手' });
  if (hash(st10 * 3.3 + 1) > .7) { c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, 0, W, H); }
}
const WARP = Array.from({ length: 640 }, (_, i) => { const r = rng(1300 + i); const a = r() * TAU, d = .05 + r() * 1; return { x: Math.cos(a) * d, y: Math.sin(a) * d * 1.7, z: r(), c: r() }; });
function cutStars(c, u, s) {
  const g = c.createRadialGradient(540, 820, 0, 540, 820, 1400); g.addColorStop(0, '#231a63'); g.addColorStop(.5, '#0b0828'); g.addColorStop(1, '#020109');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'lighter';
  [[260, 520, 900, '#6a3cff', .35], [820, 1250, 820, '#1fb6ff', .22], [760, 300, 640, '#ff3cc8', .14]].forEach(([x, y, r, col, al], k) => { const gg = c.createRadialGradient(x + u * 40 * (k - 1), y, 0, x, y, r); gg.addColorStop(0, col); gg.addColorStop(1, 'rgba(0,0,0,0)'); c.globalAlpha = al; c.fillStyle = gg; c.fillRect(0, 0, W, H); });
  c.globalAlpha = 1;
  const sp = lerp(2.6, .12, E.outExpo(inv(-.05, .3, u))), tt = u + 2;
  for (const st of WARP) {
    const z = ((st.z - tt * .18) % 1 + 1) % 1 + .02, z2 = z + sp * .08;
    const x1 = 540 + st.x / z * 300, y1 = P_Y + st.y / z * 300, x2 = 540 + st.x / z2 * 300, y2 = P_Y + st.y / z2 * 300;
    c.strokeStyle = st.c > .7 ? 'rgba(160,220,255,.9)' : 'rgba(255,255,255,.85)'; c.lineWidth = Math.min(3.2, .6 / z); c.globalAlpha = clamp(1.2 - z); c.beginPath(); c.moveTo(x2, y2); c.lineTo(x1, y1); c.stroke();
  }
  c.globalAlpha = 1;
  const pg = c.createRadialGradient(540, 3150, 1500, 540, 3150, 1640); pg.addColorStop(0, 'rgba(0,0,0,0)'); pg.addColorStop(.86, 'rgba(90,190,255,.55)'); pg.addColorStop(1, 'rgba(90,190,255,0)');
  c.fillStyle = pg; c.fillRect(0, 1400, W, 520); c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#020109'; c.beginPath(); c.arc(540, 3150, 1575, 0, TAU); c.fill();
  bigIndex(c, 4, 60, 1520, u, 'rgba(150,215,255,.14)', 'left');
  hero(c, s, u, { frame: '#bfe6ff' });
  const q = E.outExpo(inv(0, .26, u)), ls = lerp(1.0, .4, q), a = inv(0, .06, u);
  if (a > 0) {
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = .55 * a; c.drawImage(A.gCyan, 540 - 420, TTL_Y - 200, 840, 400); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    txt(c, '群星', 540, TTL_Y, { px: 200, ls, wt: 900, fill: '#f4fbff', alpha: a });
  }
  label(c, 'SCI-FI', 540, LBL_Y, u, { fill: '#9fdcff' });
  infoStack(c, s, 540, INF_Y, { u, col: '#e6f4ff', acc: '#9fdcff', tags: '太空 · 機制 · 情感 · 沉浸' });
}
function cutTianjin(c, u, s) {
  c.fillStyle = lgrad(c, 0, 0, W, H, [[0, '#3a2812'], [1, '#120b04']]); c.fillRect(0, 0, W, H);
  c.globalAlpha = .18; c.globalCompositeOperation = 'overlay'; c.drawImage(A.grain[2], 0, 0, W, H); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  const bq = E.outExpo(inv(0, .1, u));
  c.save(); c.beginPath(); c.rect(0, 0, W * bq + 40, H); c.clip(); c.drawImage(A.brush, -260 - u * 90, 560, 2300 * .92, 420 * .92); c.restore();
  hero(c, s, u, { rot: -.02 });
  charRow('津門遺雲', 540, 150, .08).forEach((o, i) => { const q = E.outExpo(inv(.01 + i * .02, .12 + i * .02, u)); if (q <= 0) return; txt(c, o.ch, o.x, TTL_Y - (1 - q) * 60, { px: 150, fill: goldText(c, 0, TTL_Y - 80, 0, TTL_Y + 80), alpha: q }); });
  const ss = lerp(2.4, 1, E.outExpo(inv(.04, .1, u))), sa = inv(.04, .06, u);
  if (sa > 0) { c.save(); c.translate(800, 1300); c.rotate(-.06); c.scale(ss, ss); c.globalAlpha = sa; c.drawImage(A.seal, -80, -80, 160, 160); c.restore(); }
  label(c, 'REPUBLIC ERA', 540, LBL_Y, u * 1.6, { px: 27 });
  infoStack(c, s, 540, INF_Y, { u: u * 1.6, tags: '民國 · 歡樂 · 嘴砲', px: 30 });
  bigIndex(c, 5, 60, 1500, u, 'rgba(236,208,138,.12)', 'left');
}
function cutShrine(c, u, s) {
  c.fillStyle = lgrad(c, 0, 0, 0, H, [[0, '#2f7fd0'], [.55, '#a6d6f6'], [1, '#fff3e2']]); c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'lighter'; c.globalAlpha = .95; c.drawImage(A.gWhite, 820 - 520, 250 - 520, 1040, 1040); c.globalAlpha = 1;
  for (let k = 0; k < 7; k++) { c.globalAlpha = .35; c.drawImage(A.cloud, ((hash(k * 5.3) * 1800 - u * 300 * (1 + k * .2)) % 2000 + 2000) % 2000 - 500, 1000 + hash(k + 2) * 600, 900, 300); }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  const ts = 1.06 - u * .15; c.save(); c.translate(540, 1060); c.scale(ts, ts); c.drawImage(A.toriiV, -540, -900); c.restore();   // 鳥居往下移，橫樑躲到海報後面、不壓標題
  hero(c, s, u, { frame: '#c7331f', shadow: .35 });
  const q = E.outExpo(inv(0, .12, u));
  txt(c, '晴天神社', 540, TTL_Y + (1 - q) * 40, { px: 150, ls: .08, fill: '#10233f', alpha: q });
  label(c, 'SHRINE', 540, LBL_Y, u * 1.5, { fill: '#c7331f' });
  infoStack(c, s, 540, INF_Y, { u: u * 1.5, col: '#10233f', acc: '#c7331f', off: 'rgba(16,35,63,.25)', tags: '日式 · 情感 · 沉浸 · 無兇手' });
}
const WISP = Array.from({ length: 24 }, (_, i) => { const r = rng(1600 + i); return { x: 70 + r() * 940, y: 260 + r() * 1500, s: 40 + r() * 90, ph: r() * TAU }; });
function cutLichuan(c, u, s) {
  c.fillStyle = lgrad(c, 0, 0, 0, H, [[0, '#062729'], [1, '#010708']]); c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 9; k++) { c.globalAlpha = .12; c.drawImage(A.cloud, ((hash(k * 2.7) * 1800 + u * 200 * (k % 2 ? 1 : -1)) % 2000 + 2000) % 2000 - 600, 300 + hash(k + 9) * 1300, 1300, 380); }
  for (const w of WISP) { const f = .7 + .3 * Math.sin(u * 40 + w.ph); c.globalAlpha = .6 * f; const y = w.y - u * 120; c.drawImage(A.gTeal, w.x - w.s, y - w.s * 1.3, w.s * 2, w.s * 2.6); c.globalAlpha = .9 * f; c.drawImage(A.gWhite, w.x - w.s * .18, y - w.s * .1, w.s * .36, w.s * .5); }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  hero(c, s, u, { frame: '#7ff5e2' });
  const a = inv(0, .04, u), T = '漓川怪談簿', TY = TTL_Y, o = { px: 140, ls: .06 };
  txt(c, T, 540, TY, { ...o, fill: '#eafffb', alpha: a });
  const lx = lerp(200, 880, E.inOutCubic(inv(.15, .4, u))), lr = 115;
  if (a > 0) {
    c.save(); c.beginPath(); c.arc(lx, TY, lr, 0, TAU); c.clip(); c.fillStyle = 'rgba(2,20,20,.9)'; c.fillRect(0, 0, W, H);
    c.translate(lx, TY); c.scale(1.35, 1.35); c.translate(-lx, -TY); txt(c, T, 540, TY, { ...o, fill: '#7ff5e2' }); c.restore();
    c.strokeStyle = '#bff8ee'; c.lineWidth = 6; c.beginPath(); c.arc(lx, TY, lr, 0, TAU); c.stroke();
    c.lineWidth = 16; c.lineCap = 'round'; c.beginPath(); c.moveTo(lx + lr * .72, TY + lr * .72); c.lineTo(lx + lr * 1.2, TY + lr * 1.2); c.stroke();
  }
  label(c, 'MYSTERY', 540, LBL_Y, u * 1.5, { fill: '#7ff5e2' });
  infoStack(c, s, 540, INF_Y, { u: u * 1.5, col: '#dffbf6', acc: '#7ff5e2', tags: '日式 · 硬核推理 · 密室' });
}
const CONF = Array.from({ length: 200 }, (_, i) => { const r = rng(1900 + i); const a = r() * TAU, v = 500 + r() * 1500; return { vx: Math.cos(a) * v * .75, vy: Math.sin(a) * v * 1.2 - 500, w: 12 + r() * 18, h: 7 + r() * 11, c: ['#ffffff', '#ffe14a', '#2ad1ff', '#ff3b7f', '#7c4dff', '#3cff9a'][r() * 6 | 0], rs: (r() - .5) * 30, ph: r() * TAU }; });
const BOIL_H = 900; let boilNoPoster = false;   // 海報置中、2:3（＝3D 劇本卡同一個裁切）；縮成卡片時海報另外畫
function cutBoil(c, u, s) {
  const g = c.createRadialGradient(540, 900, 0, 540, 900, 1300); g.addColorStop(0, '#ffc93a'); g.addColorStop(.55, '#ff8a1f'); g.addColorStop(1, '#e8401f');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  c.save(); c.translate(540, 900); c.rotate(u * .8); c.fillStyle = 'rgba(255,255,255,.12)';
  for (let k = 0; k < 18; k++) { c.rotate(TAU / 18); c.beginPath(); c.moveTo(0, 0); c.lineTo(-210, -1700); c.lineTo(210, -1700); c.closePath(); c.fill(); } c.restore();
  for (const f of CONF) { const tt = Math.max(0, u) + .02, x = 540 + f.vx * tt * Math.exp(-tt * 1.5), y = 900 + f.vy * tt * Math.exp(-tt * 1.5) + 900 * tt * tt; c.save(); c.translate(x, y); c.rotate(f.ph + f.rs * tt); c.scale(1, Math.cos(f.ph + tt * 18)); c.fillStyle = f.c; c.fillRect(-f.w / 2, -f.h / 2, f.w, f.h); c.restore(); }
  if (!boilNoPoster) posterCard(c, poster(s.id), CX, CY, BOIL_H, { aspect: 2 / 3, sc: lerp(.3, 1, E.outBack(inv(0, .14, u))), shadow: .45 });
  label(c, 'COMEDY', 540, LBL_Y, u * 1.5, { fill: '#5a1500' });
  txt(c, '沸騰跨世紀', 540, 400, { px: 76, wt: 900, fill: '#fff', stroke: '#5a1500', lw: 9, alpha: inv(.02, .06, u), ls: .06 });
  infoStack(c, s, 540, 1440, { u: u * 1.5, col: '#5a1500', acc: '#5a1500', off: 'rgba(90,21,0,.25)', tags: '歡樂 · 懷舊 · 團建 · 無兇手' });
}
function drawCut(c, i, u) { const k = CUTS[i]; c.save(); k.draw(c, u, byId(k.id)); c.restore(); }
function montage(c, t) {
  let i = CUTS.length - 1; while (i > 0 && t < CUTS[i].t) i--;
  const k = CUTS[i], u = t - k.t, base = c.getTransform();
  const prev = () => drawCut(c, i - 1, t - CUTS[i - 1].t), cur = () => drawCut(c, i, u);
  const TR = { iris: .14, glitch: .07, zoom: .12, slats: .09, swipe: .1, shutter: .06, punch: .12 };
  const d = TR[k.tr]; if (!d || u >= d) { cur(); return; }
  const p = u / d;
  if (k.tr === 'iris') {
    prev(); const r = E.outExpo(p) * 1250; c.save(); c.beginPath(); c.arc(CX, CY, r, 0, TAU); c.clip(); cur(); c.restore();
    c.strokeStyle = '#fff3e0'; c.lineWidth = 10 * (1 - p); c.beginPath(); c.arc(CX, CY, r, 0, TAU); c.stroke();
  } else if (k.tr === 'glitch') {
    cur(); const step = Math.floor(u * 120); TB.ctx.setTransform(1, 0, 0, 1, 0, 0); TB.ctx.clearRect(0, 0, W, H); drawCut(TB.ctx, i - 1, t - CUTS[i - 1].t);
    for (let s = 0; s < 30; s++) { if (hash(s * 9.1 + step) < p * 1.1) continue; const y = Math.floor(hash(s * 3.7 + step) * H), h = 10 + hash(s + step * 5) * 80, off = (hash(s * 1.3 + step) - .5) * 200; c.drawImage(TB, 0, y, W, h, off, y, W, h); }
  } else if (k.tr === 'zoom') {
    const e = E.outCubic(p), s0 = lerp(.82, 1, E.outCubic(p)); c.save(); c.translate(CX, CY); c.scale(s0, s0); c.translate(-CX, -CY); cur(); c.restore();   // 舊畫面很快讓位，轉場落在重拍上
    c.save(); c.globalAlpha = 1 - e; c.translate(CX, CY); c.scale(1 + e * 1.6, 1 + e * 1.6); c.translate(-CX, -CY); prev(); c.restore();
  } else if (k.tr === 'slats') {
    prev(); c.save(); c.beginPath(); const sl = 420, bw = (W + sl) / 8;
    for (let s = 0; s < 8; s++) { const q = E.outCubic(clamp(p * 1.6 - s * .08)); const x = -sl + s * bw; c.moveTo(x, 0); c.lineTo(x + bw * q + 2, 0); c.lineTo(x + bw * q + 2 + sl, H); c.lineTo(x + sl, H); c.closePath(); }
    c.clip(); cur(); c.restore();
  } else if (k.tr === 'swipe') {   // 往上滑——Reels 的手勢
    const e = E.outExpo(p); c.save(); c.translate(0, -H * .3 * e); prev(); c.restore(); c.save(); c.translate(0, H * (1 - e)); cur(); c.restore();
  } else if (k.tr === 'shutter') {
    prev(); c.save(); c.beginPath(); const cw = W / 8; for (let s = 0; s < 8; s++) { const q = E.outCubic(clamp(p * 1.5 - s * .05)); c.rect(s * cw + cw / 2 - cw / 2 * q, 0, cw * q + 1, H); } c.clip(); cur(); c.restore();
  } else if (k.tr === 'punch') {   // 放大回彈切入（不用白閃：沸騰本身就最亮，白閃會多一次明暗閃爍）
    const s0 = lerp(1.18, 1, E.outExpo(p)); c.save(); c.translate(CX, CY); c.scale(s0, s0); c.translate(-CX, -CY); cur(); c.restore();
  }
  c.setTransform(base);
}

/* ========================================================
   SC.03 群像 —— 57 張劇本卡：拉遠 → 漩渦 → 排成海星
   ======================================================== */
const FOV = 58, TANH = Math.tan(FOV / 2 * Math.PI / 180);
const CARD_PX = 820, Z0 = 1.5 * H / (2 * TANH * CARD_PX);          // 起始距離：中間那張卡高 820px
const camZ = t => Z0 + (20.7 - Z0) * E.outCubic(inv(6.6, 8.05, t)) - 1.2 * E.inOutCubic(inv(7.9, 9.2, t));
const V3 = () => new W3.T.Vector3();
function wall(c, t) {
  const { R, S, cam, cards, glc, pts } = W3;
  const spin = -1.0 * E.outCubic(inv(6.6, 7.95, t)), arc = Math.sin(Math.PI * inv(6.6, 8.5, t));   // 縮成卡片交接（6.6）之後才開始旋轉
  const ly = -2.6 * E.inOutCubic(inv(7.3, 8.4, t));    // 海星放在畫面上半，下方留給計數器
  cam.position.set(2.0 * arc, -1.8 * arc + ly, camZ(t)); cam.up.set(Math.sin(.3 * arc), Math.cos(.3 * arc), 0); cam.lookAt(0, ly, 0); cam.updateMatrixWorld();
  const sweep = inv(8.55, 9.1, t) * 1.5 - .2;
  for (const cd of cards) {
    const a = cd.A, b = cd.B, tw0 = spin * (1 + Math.abs(a.z) * .03), cs = Math.cos(tw0), sn = Math.sin(tw0);
    const ax = a.x * cs - a.y * sn, ay = a.x * sn + a.y * cs;
    const st = 7.25 + cd.d * .7, q = E.inOutCubic(inv(st, st + .6, t));
    cd.m.position.set(lerp(ax, b.x, q), lerp(ay, b.y, q), lerp(a.z, b.z, q) + Math.sin(q * Math.PI) * 3.4);
    cd.m.rotation.set(lerp(a.rx, b.rx, q), lerp(a.ry, b.ry, q), lerp(a.rz + tw0, b.rz, q));
    const sc = lerp(a.sc, b.sc, q); cd.m.scale.set(sc, sc, sc);
    cd.mat.color.setScalar(1 + .9 * Math.exp(-Math.pow((cd.s - sweep) / .1, 2)) * (q > .99 ? 1 : 0));
  }
  S.rotation.z = -.22 * E.inOutCubic(inv(8.2, 9.2, t));
  pts.rotation.z = t * .05;
  R.render(S, cam);
  c.drawImage(glc, 0, 0);
  const kq = E.outBack(inv(8.25, 8.65, t));
  if (kq > 0) {
    const o = V3().set(0, 0, .2).applyMatrix4(S.matrixWorld).project(cam), k = kq * 1.25 * 19.5 / camZ(t);
    c.save(); c.translate((o.x + 1) * CX, (1 - o.y) * CY); c.scale(k, k);
    c.globalCompositeOperation = 'lighter'; c.globalAlpha = .8; c.drawImage(A.gCrim, -170, -170, 340, 340); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.drawImage(A.kh, -130, -160); c.restore();
  }
  // 快剪最後一格縮成卡片（直式畫面裁成 2:3）
  if (t < 6.6) {   // 背景淡出，中間的海報縮成同一張 3D 劇本卡
    const p = E.inOutQuart(inv(6.4, 6.6, t)), k = lerp(1, .6, p);
    TA.ctx.setTransform(1, 0, 0, 1, 0, 0); boilNoPoster = true; drawCut(TA.ctx, 7, t - 5.8); boilNoPoster = false;
    c.save(); c.globalAlpha = 1 - p; c.translate(CX, CY); c.scale(k, k); c.drawImage(TA, -CX, -CY); c.restore();
    posterCard(c, poster('feiteng'), CX, CY, lerp(BOIL_H, CARD_PX, p), { aspect: 2 / 3, alpha: 1 - inv(.7, 1, p), shadow: .45 * (1 - p), frame: `rgba(236,208,138,${1 - p})` });
  }
  // 計數器（下方安全區內）
  const cq = inv(6.7, 6.85, t);
  if (cq > 0) {
    const n = Math.round(NS * E.outCubic(inv(6.75, 8.0, t))), nd = Math.max(2, String(NS).length), en = `${NS} WORLDS · ONE DOOR`;
    c.fillStyle = lgrad(c, 0, 1000, 0, 1220, [[0, 'rgba(8,6,3,0)'], [1, 'rgba(8,6,3,.9)']]); c.fillRect(0, 1000, W, H - 1000);
    const numW = tw('0'.repeat(nd), F.cin, 900, 230), labW = Math.max(tw('部劇本', F.serif, 900, 66, .1), tw(en, F.cin, 700, 20, .3)), gw = numW + 34 + labW, x0 = CX - gw / 2, y0 = 1398;
    txt(c, String(n).padStart(nd, '0'), x0, y0, { fam: F.cin, wt: 900, px: 230, align: 'left', base: 'alphabetic', fill: goldText(c, 0, 1210, 0, 1400), alpha: cq });
    const nx = x0 + numW + 34;
    txt(c, '部劇本', nx, y0 - 96, { px: 66, wt: 900, align: 'left', base: 'alphabetic', fill: '#fff6e4', alpha: cq, ls: .1 });
    txt(c, en, nx + 2, y0 - 36, { fam: F.cin, wt: 700, px: 20, ls: .3, align: 'left', base: 'alphabetic', fill: GOLD, alpha: inv(6.95, 7.2, t) });
    txt(c, `一扇門 · ${zhNum(NS)}種人生`, CX, 1470, { px: 40, wt: 700, ls: .18, fill: TXT, alpha: inv(7.95, 8.2, t) });
  }
}

/* ========================================================
   SC.04 你 —— 直書四格、甩鏡、這一次，你是誰？
   ======================================================== */
/* 四格由暗到亮排（驚悚→推理→情感→歡樂），依 U 字順序在重拍上切換（左上→右上→右下→左下）：
   亮度一路往上、不會來回閃爍（WCAG 2.3.1 光敏安全）；情感的粉色也調離「飽和紅」 */
const QD = [
  { k: 'thrill', w: '驚悚', en: 'THRILL', bg: '#0e0101', fg: '#ff2b2b', t: 9.2, x: 0, y: 0, dx: -1, dy: -1 },
  { k: 'deduction', w: '推理', en: 'DEDUCTION', bg: '#0c1a3a', fg: GOLDL, t: 9.4, x: 540, y: 0, dx: 1, dy: -1 },
  { k: 'emotion', w: '情感', en: 'EMOTION', bg: '#c25a7a', fg: '#fff3ea', t: 9.6, x: 540, y: 960, dx: 1, dy: 1 },
  { k: 'joy', w: '歡樂', en: 'JOY', bg: '#ffb21e', fg: '#fffaf0', line: '#5a1500', t: 9.8, x: 0, y: 960, dx: -1, dy: 1 },
];
const QC = QD.map(q => [q.x + 270, q.y + 480]);
const NAMES = (() => {
  const all = [...new Set(SCRIPTS.flatMap(s => s.characters || []))].filter(n => n.length <= 6 && !/^(角色[一二三四五六七八九十]+|候選人)/.test(n)), r = rng(77);   // 排除「角色一」「候選人 A」這類佔位名
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  const cells = []; for (let gy = 0; gy < 14; gy++) for (let gx = 0; gx < 4; gx++) { const x = 150 + gx * 260, y = 150 + gy * 122; if (Math.abs(y - 880) < 270) continue; cells.push([x, y]); }
  return cells.map(([cx, cy], i) => { const q = rng(3000 + i); return { n: all[i % all.length], x: cx + (q() - .5) * 110, y: cy + (q() - .5) * 60, t0: 10.22 + q() * .5, px: 24 + q() * 18, gold: q() < .6, a: .22 + q() * .4 }; });
})();
function quad(c, q, i, t) {
  c.save(); c.beginPath(); c.rect(q.x + 3, q.y + 3, 534, 954); c.clip();
  c.fillStyle = q.bg; c.fillRect(q.x, q.y, 540, 960);
  const cx = q.x + 270, cy = q.y + 480, u = t - q.t;
  if (q.k === 'deduction') { c.strokeStyle = 'rgba(236,208,138,.16)'; c.lineWidth = 2; for (let k = 1; k < 9; k++) { c.beginPath(); c.arc(cx + 120, cy - 220, k * 46 + u * 60, 0, TAU); c.stroke(); } c.beginPath(); c.moveTo(q.x, cy - 220); c.lineTo(q.x + 540, cy - 220); c.moveTo(cx + 120, q.y); c.lineTo(cx + 120, q.y + 960); c.stroke(); }
  if (q.k === 'emotion') { c.globalCompositeOperation = 'lighter'; for (let k = 0; k < 14; k++) { const s = 40 + hash(k) * 120; c.globalAlpha = .25; c.drawImage(A.gPink, q.x + hash(k * 3) * 540 - s, q.y + hash(k * 7) * 960 - s - u * 40, s * 2, s * 2); } c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
  if (q.k === 'thrill') { c.globalCompositeOperation = 'lighter'; c.globalAlpha = .5; c.drawImage(A.gCrim, cx - 400, cy - 500, 800, 1000); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.fillStyle = c.createPattern(A.scan, 'repeat'); c.fillRect(q.x, q.y, 540, 960); }
  if (q.k === 'joy') { c.save(); c.translate(cx, cy); c.rotate(t * 1.2); c.fillStyle = 'rgba(255,255,255,.2)'; for (let k = 0; k < 14; k++) { c.rotate(TAU / 14); c.beginPath(); c.moveTo(0, 0); c.lineTo(-90, -1000); c.lineTo(90, -1000); c.fill(); } c.restore(); }
  const e = E.outExpo(inv(0, .16, u)), a = u >= -.09 ? 1 : 0;   // 甩鏡進來時字已經在，落地只做輕微的放大回彈
  if (a > 0) {
    const s = lerp(1.12, 1, e);
    [...q.w].forEach((ch, k) => {
      const yy = cy - 150 + k * 248;
      c.save(); c.translate(cx, yy); c.scale(s, s);
      if (q.k === 'thrill') { const j = 6 + 10 * pulse(u, 0, 10); txt(c, ch, -j, 0, { px: 236, fill: '#ff0000', op: 'lighter' }); txt(c, ch, j, 0, { px: 236, fill: '#00a0a0', op: 'lighter', alpha: .7 }); }
      else txt(c, ch, 0, 0, { px: 236, fill: q.fg, stroke: q.line || null, lw: 14 });
      c.restore();
    });
    txt(c, q.en, cx, cy - 330, { fam: F.cin, wt: 700, px: 24, ls: .6, fill: q.fg, alpha: inv(.03, .1, u) * .9 });
  }
  txt(c, '0' + (i + 1), q.x + 34, q.y + 46, { fam: F.mono, wt: 600, px: 20, align: 'left', fill: q.fg, alpha: .7 });
  c.restore();
}
function kinetic(c, t) {
  c.fillStyle = '#050403'; c.fillRect(0, 0, W, H);
  dust(c, t, 1, CX, CY, .75);
  for (const nm of NAMES) {
    const a = inv(nm.t0, nm.t0 + .05, t) * (hash(nm.x + Math.floor(t * 30)) > .12 ? 1 : .3); if (a <= 0) continue;
    const k = E.inExpo(inv(10.92, 11.2, t)), x = lerp(nm.x, 540, k), y = lerp(nm.y, 900, k);
    txt(c, nm.n, x, y, { fam: F.serif, wt: 700, px: nm.px * (1 - k * .6), fill: nm.gold ? GOLDL : '#fff', alpha: a * nm.a * (1 - k * .8) });
  }
  const base = c.getTransform(), sp = E.inExpo(inv(10.18, 10.32, t));
  if (sp < 1) {
    // 每個字在重拍上直接切過去，從上一格的方向滑入一小段（帶動態模糊）。
    // 不用甩鏡橫越格子：甩到一半畫面只剩暗底，會多出一次明暗閃爍（WCAG 2.3.1）。
    let qk = 0; while (qk < 3 && t >= QD[qk + 1].t) qk++;
    let cx = QC[qk][0], cy = QC[qk][1];
    if (qk > 0) { const sl = 1 - E.outExpo(clamp((t - QD[qk].t) / .1)); cx += (QC[qk - 1][0] - QC[qk][0]) * .06 * sl; cy += (QC[qk - 1][1] - QC[qk][1]) * .06 * sl; }
    let z = 2 * lerp(1.14, 1, E.outExpo(inv(9.2, 9.42, t)));
    const zo = E.inOutQuart(inv(9.9, 10.04, t)); z = lerp(z, .78, zo); cx = lerp(cx, CX, zo); cy = lerp(cy, 980, zo);   // 拉到 0.78：四格（含英文標）都在安全區內
    c.translate(CX, CY); c.scale(z, z); c.translate(-cx, -cy);
    QD.forEach((q, i) => { c.save(); c.translate(q.dx * sp * 800, q.dy * sp * 1300); quad(c, q, i, t); c.restore(); });   // 四格一開始就都在（甩鏡經過時不會露出黑洞）
    c.setTransform(base);
  }
  drawQuestion(c, 1, t);
}
function drawQuestion(c, alpha, t = T_LOGO) {
  const a1 = inv(10.3, 10.42, t); if (a1 <= 0) return;
  const e1 = E.outCubic(a1);
  txt(c, '這一次，', 540 + 44, 690 + (1 - e1) * 16, { px: 84, wt: 700, ls: .3, fill: GOLDL, alpha: e1 * alpha });
  const q = E.outExpo(inv(10.4, 10.56, t)), a = t >= 10.4 ? 1 : 0;
  if (a > 0) {
    const s = lerp(1.7, 1, q); c.save(); c.translate(540, 900); c.scale(s, s);
    txt(c, '你是誰？', 26, 0, { px: 212, ls: .04, fill: lgrad(c, 0, -110, 0, 110, [[0, '#ffffff'], [.55, '#ffeec8'], [1, GOLDL]]), alpha: a * alpha });
    c.restore();
  }
}

/* ========================================================
   LOGO —— 金塵匯聚 → 海星 → 品牌字 → 預約資訊 → 接回片頭
   ======================================================== */
const EMB = Array.from({ length: 150 }, (_, i) => { const r = rng(5000 + i); return { x: r() * W, y: H + r() * 400, v: 40 + r() * 140, s: 3 + r() * 12, ph: r() * TAU, c: r() < .75 }; });
const SPARK = Array.from({ length: 260 }, (_, i) => { const r = rng(6000 + i); const a = r() * TAU, v = 300 + r() * 1300; return { vx: Math.cos(a) * v * .8, vy: Math.sin(a) * v, s: 4 + r() * 12 }; });
function roundRect(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function logoScene(c, t) {
  const base = c.getTransform();
  c.fillStyle = '#060403'; c.fillRect(0, 0, W, H);
  const dk = .75 * (1 - inv(T_LOGO, 11.55, t)); if (dk > 0) dust(c, t, 1, CX, CY, dk);   // 接住上一幕的金塵
  const out = 1 - inv(T_LOOP, T_LOOP + .22, t);                 // 片尾：字、環、光芒退場
  const lt = inv(11.55, 11.75, t) * (1 - inv(T_LOOP + .05, T_LOOP + .45, t)), push = 1 + .035 * E.inOutCubic(inv(11.6, T_LOOP + .05, t)) * (1 - E.inOutCubic(inv(T_LOOP + .1, T_LOOP + .5, t)));
  c.translate(CX, CY); c.scale(push, push); c.translate(-CX, -CY);
  // 片尾慢慢換回片頭的暖光與金塵
  const back = inv(T_LOOP + .1, T_LOOP + .5, t);
  if (back > 0) { warmBg(c, beatAt(t), back); dust(c, t - DUR, 1, CX, CY, back); }
  const bg = c.createRadialGradient(LOGO.x, LOGO.y, 0, LOGO.x, LOGO.y, 1100); bg.addColorStop(0, `rgba(110,24,14,${.5 * lt})`); bg.addColorStop(.45, `rgba(40,12,6,${.35 * lt})`); bg.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = bg; c.fillRect(0, 0, W, H);
  c.globalCompositeOperation = 'lighter';
  if (lt > 0) {
    c.save(); c.translate(LOGO.x, LOGO.y); c.rotate(t * .12);
    for (let k = 0; k < 16; k++) { c.rotate(TAU / 16); const g = c.createLinearGradient(0, 0, 0, -1600); g.addColorStop(0, `rgba(255,200,120,${.09 * lt})`); g.addColorStop(1, 'rgba(255,200,120,0)'); c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.lineTo(-38 - 30 * hash(k), -1600); c.lineTo(38 + 30 * hash(k), -1600); c.fill(); }
    c.restore();
  }
  for (const m of EMB) { const tt = t - 11.5; if (tt < 0) break; const y = m.y - tt * m.v * 2.2, x = m.x + Math.sin(tt * 2 + m.ph) * 30; c.globalAlpha = .55 * (.6 + .4 * Math.sin(tt * 9 + m.ph)) * inv(11.5, 11.9, t) * (1 - inv(T_LOOP, T_LOOP + .35, t)); c.drawImage(m.c ? A.gGold : A.gCrim, x - m.s, y - m.s, m.s * 2, m.s * 2); }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  // 文字左→右碎裂
  if (t < 11.45) {
    const sx = lerp(P.minx - 80, P.maxx + 80, inv(11.2, 11.35, t));
    const x = TB.ctx; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, W, H); x.drawImage(A.qText, 0, 0);
    x.globalCompositeOperation = 'destination-in'; x.fillStyle = lgrad(x, sx - 60, 0, sx + 60, 0, [[0, 'rgba(0,0,0,0)'], [1, '#000']]); x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over';
    c.drawImage(TB, 0, 0);
  }
  const pa = 1 - inv(11.62, 11.82, t);
  if (pa > 0 && t >= T_LOGO) {
    c.globalCompositeOperation = 'lighter'; const d = P.d;
    for (let b = 0; b < 6; b++) {
      c.fillStyle = P.cols[b]; c.globalAlpha = pa;
      for (let k = 0; k < P.n; k++) {
        const o = k * 10; if (d[o + 8] !== b) continue;
        const st = T_LOGO + d[o + 6], q = E.inOutCubic(inv(st, 11.59, t)), m = 1 - q;
        const x = m * m * d[o] + 2 * m * q * d[o + 4] + q * q * d[o + 2], y = m * m * d[o + 1] + 2 * m * q * d[o + 5] + q * q * d[o + 3];
        const s = d[o + 9] * (1.6 + Math.sin(q * Math.PI) * 2.2); c.fillRect(x - s / 2, y - s / 2, s, s);
        if (k % 14 === 0) { c.globalAlpha = pa * .35; c.drawImage(A.gGold, x - 9, y - 9, 18, 18); c.globalAlpha = pa; }
      }
    }
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  }
  if (t >= 11.57) {
    const sw = inv(T_BOOM, 12.35, t); if (sw > 0 && sw < 1) { c.strokeStyle = `rgba(255,214,150,${.55 * (1 - sw)})`; c.lineWidth = 36 * (1 - sw) + 1; c.beginPath(); c.arc(LOGO.x, LOGO.y, 80 + 1700 * E.outCubic(sw), 0, TAU); c.stroke(); }
    c.globalCompositeOperation = 'lighter';
    for (const s of SPARK) { const tt = t - T_BOOM; if (tt <= 0) break; const k = (1 - Math.exp(-tt * 3.2)) / 3.2, x = LOGO.x + s.vx * k, y = LOGO.y + s.vy * k + 120 * tt * tt, a = 1 - inv(.2, 1.3, tt); if (a <= 0) continue; c.globalAlpha = a; c.drawImage(A.gGold, x - s.s, y - s.s, s.s * 2, s.s * 2); }
    c.globalAlpha = 1;
    // logo（片尾淡出，只留下鑰匙孔）
    const lo = 1 - inv(T_LOOP + .13, T_LOOP + .41, t), la = inv(11.57, 11.7, t) * lo, ls = lerp(1.1, 1, E.outCubic(inv(T_BOOM, 12.3, t))), S = LOGO.s * ls;
    c.globalAlpha = (.5 * la + .45 * pulse(t, T_BOOM, 4) + .12 * Math.max(pulse(t, 13.6, 6), pulse(t, 14.4, 6), pulse(t, 15.2, 6))) * lo; c.drawImage(A.logoGlow, LOGO.x - S / 2, LOGO.y - S / 2, S, S);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    const L = A.logoWork.ctx; L.setTransform(1, 0, 0, 1, 0, 0); L.clearRect(0, 0, 512, 512); L.globalCompositeOperation = 'source-over'; L.drawImage(A.logo, 0, 0);
    const shx = lerp(-200, 720, inv(12.2, 12.8, t));
    if (shx > -200 && shx < 720) { L.globalCompositeOperation = 'source-atop'; L.fillStyle = lgrad(L, shx - 90, 0, shx + 90, 0, [[0, 'rgba(255,248,225,0)'], [.5, 'rgba(255,248,225,.75)'], [1, 'rgba(255,248,225,0)']]); L.setTransform(1, 0, .45, 1, 0, 0); L.fillRect(-300, 0, 1200, 512); L.setTransform(1, 0, 0, 1, 0, 0); }
    c.globalAlpha = la; c.drawImage(A.logoWork, LOGO.x - S / 2, LOGO.y - S / 2, S, S); c.globalAlpha = 1;
    const rp = E.inOutCubic(inv(11.65, 12.45, t)), R = 318;
    if (rp > 0 && out > 0) {
      c.save(); c.globalAlpha = out;
      c.strokeStyle = 'rgba(200,160,86,.75)'; c.lineWidth = 2.2; c.beginPath(); c.arc(LOGO.x, LOGO.y, R, -Math.PI / 2, -Math.PI / 2 + rp * TAU); c.stroke();
      c.strokeStyle = 'rgba(200,160,86,.3)'; c.lineWidth = 1; c.beginPath(); c.arc(LOGO.x, LOGO.y, R + 15, Math.PI / 2, Math.PI / 2 + rp * TAU); c.stroke();
      for (let k = 0; k < 8; k++) { const sc = E.outBack(clamp((rp - k / 8) / .1)); if (sc <= 0) continue; const ak = -Math.PI / 2 + k / 8 * TAU; c.save(); c.translate(LOGO.x + Math.cos(ak) * R, LOGO.y + Math.sin(ak) * R); c.rotate(ak); c.scale(sc, sc); c.fillStyle = GOLDL; c.beginPath(); c.moveTo(k % 2 ? 13 : 22, 0); c.lineTo(0, 5); c.lineTo(-9, 0); c.lineTo(0, -5); c.closePath(); c.fill(); c.restore(); }
      c.restore();
    }
    const fl = pulse(t, T_BOOM, 3.2);
    if (fl > .01) { c.globalCompositeOperation = 'lighter'; c.fillStyle = lgrad(c, 0, 0, W, 0, [[0, 'rgba(255,190,110,0)'], [.5, `rgba(255,236,200,${.9 * fl})`], [1, 'rgba(255,190,110,0)']]); c.fillRect(0, LOGO.y - 2, W, 4); c.globalAlpha = .35 * fl; c.drawImage(A.gGold, -200, LOGO.y - 40, W + 400, 80); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; }
  }
  // 品牌字
  if (out > 0) {
    txt(c, 'STARFISH · MURDER MYSTERY', CX, 1004, { fam: F.cin, wt: 700, px: 26, ls: .44, fill: GOLD, alpha: inv(11.95, 12.45, t) * out });
    const tq = inv(11.78, 12.75, t);
    if (tq > 0) {
      const e = E.outQuart(tq), ls = lerp(.62, .1, e), blur = lerp(12, 0, e), a = clamp(tq / .6) * out;
      const T = TA.ctx, px = 140; T.setTransform(1, 0, 0, 1, 0, 0); T.clearRect(0, 0, W, H);   // 整張清：縮放取樣不會帶到前面殘留的列
      const row = charRow('海星劇本殺', CX, px, ls), x0 = row[0].x - px / 2, x1 = row[row.length - 1].x + px / 2;
      T.fillStyle = lgrad(T, x0, 50, x1, 270, [[0, '#ffffff'], [.4, GOLDL], [.8, GOLD], [1, '#b38a45']]); setFont(T, F.serif, 900, px); T.textAlign = 'center'; T.textBaseline = 'middle';
      row.forEach(o => T.fillText(o.ch, o.x, 160));
      const shx = lerp(x0 - 200, x1 + 200, inv(12.85, 13.35, t));
      if (shx > x0 - 200 && shx < x1 + 200) { T.globalCompositeOperation = 'source-atop'; T.fillStyle = lgrad(T, shx - 70, 0, shx + 70, 0, [[0, 'rgba(255,255,255,0)'], [.5, 'rgba(255,255,255,.85)'], [1, 'rgba(255,255,255,0)']]); T.fillRect(0, 0, W, 320); T.globalCompositeOperation = 'source-over'; }
      c.save(); c.globalAlpha = a; if (blur > .3) c.filter = `blur(${blur.toFixed(1)}px)`; c.drawImage(TA, 0, 0, W, 320, 0, 1138 - 160, W, 320); c.restore();
    }
    const lw = E.outQuart(inv(12.15, 12.85, t)) * 480;
    if (lw > 0) { c.save(); c.globalAlpha = out; c.fillStyle = lgrad(c, CX - lw / 2, 0, CX + lw / 2, 0, [[0, 'rgba(236,208,138,0)'], [.5, GOLDL], [1, 'rgba(236,208,138,0)']]); c.fillRect(CX - lw / 2, 1224, lw, 1.8); c.globalCompositeOperation = 'lighter'; c.globalAlpha = .5 * out; c.drawImage(A.gGold, CX - lw / 2, 1210, lw, 30); c.restore(); }
    txt(c, '沉浸其中 · 探索謎局', CX, 1278, { fam: F.sans, wt: 500, px: 38, ls: .3, fill: TXT, alpha: inv(12.35, 12.9, t) * .92 * out });
    // 預約資訊（IG 下方說明文字之上）
    const cq = E.outCubic(inv(T_CTA, T_CTA + .35, t));
    if (cq > 0) {
      const pw = 640, ph = 96, px0 = CX - pw / 2, py = 1370 - ph / 2 + (1 - cq) * 40;
      c.save(); c.globalAlpha = cq * out;
      c.globalCompositeOperation = 'lighter'; c.globalAlpha = .35 * cq * out; c.drawImage(A.gGold, px0 - 60, py - 40, pw + 120, ph + 80); c.globalCompositeOperation = 'source-over'; c.globalAlpha = cq * out;
      roundRect(c, px0, py, pw, ph, ph / 2); c.fillStyle = lgrad(c, px0, py, px0 + pw, py + ph, [[0, '#f3dc9c'], [.5, GOLDL], [1, '#b98d48']]); c.fill();
      const sh = lerp(px0 - 160, px0 + pw + 160, inv(13.6, 14.1, t));
      if (sh > px0 - 160 && sh < px0 + pw + 160) { c.save(); roundRect(c, px0, py, pw, ph, ph / 2); c.clip(); c.fillStyle = lgrad(c, sh - 80, 0, sh + 80, 0, [[0, 'rgba(255,255,255,0)'], [.5, 'rgba(255,255,255,.7)'], [1, 'rgba(255,255,255,0)']]); c.fillRect(px0, py, pw, ph); c.restore(); }
      txt(c, '立即預約 · 私訊 / LINE', CX, py + ph / 2 + 2, { px: 40, wt: 900, ls: .1, fill: '#1a0f08' });
      c.restore();
      txt(c, '台北 · 南港 · 新竹　｜　IG @larp_starfish', CX, 1446, { fam: F.sans, wt: 500, px: 32, ls: .05, fill: '#f3e8d2', alpha: inv(T_CTA + .15, T_CTA + .4, t) * out });
    }
  }
  // 鑰匙孔：從 Logo 中心長回片頭的大小與位置（Reels 重播接回第一格）
  const ka = inv(T_LOOP + .07, T_LOOP + .19, t);
  if (ka > 0) {
    const kq = E.inOutCubic(inv(T_LOOP + .15, T_LOOP + .51, t));
    drawKeyhole(c, lerp(LOGO_KH.x, KH.x, kq), lerp(LOGO_KH.y, KH.y, kq), lerp(LOGO_KH.s, KH.s, kq), beatAt(t), ka);
  }
  c.setTransform(base);
}

/* ---------- HUD ---------- */
const SC = [[0, 'SC.01', '入口 · THE DOOR'], [2.0, 'SC.02', '世界 · WORLDS'], [6.4, 'SC.03', `群像 · ${NS} SCRIPTS`], [9.2, 'SC.04', '你 · YOU']];
function hud(c, t) {
  const a = inv(.1, .45, t) * (1 - inv(10.85, 11.1, t)); if (a <= 0) return;
  c.save(); c.globalAlpha = a; const m = 44, L = 30, col = 'rgba(255,246,228,.72)';
  c.strokeStyle = col; c.lineWidth = 2;
  [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]].forEach(([x, y, sx, sy]) => { c.beginPath(); c.moveTo(x, y + sy * L); c.lineTo(x, y); c.lineTo(x + sx * L, y); c.stroke(); });
  const f = Math.floor(t * FPS + 1e-6), tc = `00:00:${String(Math.floor(f / FPS)).padStart(2, '0')}:${String(f % FPS).padStart(2, '0')}`;
  const o = { fam: F.mono, wt: 600, px: 17, ls: .14, fill: col, base: 'middle' };
  txt(c, 'STARFISH MYSTERY · REELS', m + 40, m + 6, { ...o, align: 'left' });
  txt(c, tc, W - m - 40, m + 6, { ...o, align: 'right' });
  c.fillStyle = '#ff3b30'; c.globalAlpha = a * (Math.floor(t * 2) % 2 ? .35 : 1); c.beginPath(); c.arc(W - m - 40 - tw(tc, F.mono, 600, 17, .14) - 20, m + 6, 5, 0, TAU); c.fill(); c.globalAlpha = a;
  let k = 0; while (k < SC.length - 1 && t >= SC[k + 1][0]) k++;
  const sq = E.outExpo(inv(SC[k][0], SC[k][0] + .3, t));
  txt(c, SC[k][1], m + 40, H - m - 6, { ...o, align: 'left', fill: GOLDL });
  c.save(); c.beginPath(); c.rect(m + 116, H - m - 30, 380 * sq, 50); c.clip(); txt(c, SC[k][2], m + 120, H - m - 6, { ...o, align: 'left', fam: F.sans, wt: 500, px: 18 }); c.restore();
  const bw = 200, bx = W - m - 40 - bw, by = H - m - 6;
  c.fillStyle = 'rgba(255,246,228,.22)'; c.fillRect(bx, by - 1, bw, 2); c.fillStyle = GOLDL; c.fillRect(bx, by - 1, bw * t / DUR, 2);
  [0, T_WORLD, T_WALL, T_YOU, T_LOGO].forEach(s => { c.fillStyle = t >= s ? GOLDL : 'rgba(255,246,228,.4)'; c.fillRect(bx + bw * s / DUR - 1, by - 6, 2, 12); });
  c.restore();
}

/* ---------- 合成（core 呼叫的掛勾） ---------- */
const subN = t => (t > 1.7 && t < 2.02) || (t > 6.38 && t < 7.7) || (t > 9.3 && t < 10.42) || (t > 11.15 && t < 11.7) ? 7 : (t > 12.3 && t < T_LOOP) ? 3 : 5;
function bloomAmt(t) {
  if (t >= 2.0 && t < 2.8) return .26;
  if (t >= 5.0 && t < 5.4) return .1;
  if (t >= 5.8 && t < 6.6) return lerp(.1, .42, E.inOutCubic(inv(6.42, 6.6, t)));   // 漸變，不跳格
  if (t >= 2.8 && t < 3.4) return .14;
  if (t >= 9.2 && t < 10.4) return lerp(.16, .42, inv(10.2, 10.4, t));
  return .42;
}
window.Reel.use({
  IMPACTS, subN, hud,
  bloom: bloomAmt,
  draw(c, t) {
    if (t < T_WORLD) sceneA(c, t);
    else if (t < T_WALL) montage(c, t);
    else if (t < T_YOU) wall(c, t);
    else if (t < T_LOGO) kinetic(c, t);
    else logoScene(c, t);
  },
  flash(o, t) {
    const fl = Math.max(pulse(t, T_WORLD, 14) * .22, pulse(t, 10.4, 12) * .2, pulse(t, 10.0, 14) * .1, pulse(t, T_BOOM, 14) * .22);
    if (fl > .003) { o.fillStyle = `rgba(255,240,214,${fl})`; o.fillRect(0, 0, W, H); }
    const rf = pulse(t, T_BOOM, 9) * .6;
    if (rf > .003) { o.globalCompositeOperation = 'lighter'; o.globalAlpha = rf; o.drawImage(A.gWhite, LOGO.x - 1500, LOGO.y - 1500, 3000, 3000); o.globalAlpha = 1; o.globalCompositeOperation = 'source-over'; }
  },
  fade: () => 0,   // 不淡入淡出：首尾相接循環
  init() {
    window.Reel.checkIds([...CUTS.map(k => k.id), 'feiteng']);
    buildSprites916();
    buildParticles(x => drawQuestion(x, 1), LOGO);
    build3D({ fov: FOV, first: 'feiteng', spreadX: .72, spreadY: 1.55, dustW: 22, dustH: 40, fogNear: 21 });
    // 第一張卡直接用快剪最後一格（中央 2:3 裁切），縮成卡片時是真正的 match cut
    const crop = mk(480, 720), T = TA.ctx; T.setTransform(1, 0, 0, 1, 0, 0); drawCut(T, 7, .8);
    crop.ctx.drawImage(TA, 0, (H - W * 1.5) / 2, W, W * 1.5, 0, 0, 480, 720);
    crop.ctx.strokeStyle = 'rgba(236,208,138,.85)'; crop.ctx.lineWidth = 2.5; crop.ctx.strokeRect(18, 18, 444, 684);
    const tex = new W3.T.CanvasTexture(crop); tex.colorSpace = W3.T.SRGBColorSpace; tex.anisotropy = 8;
    W3.cards[0].mat.map = tex; W3.cards[0].mat.needsUpdate = true;
  },
});
})();
