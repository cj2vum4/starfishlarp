#!/usr/bin/env node
/* ==========================================================
   海星劇本殺 · 形象影片配樂／音效（程序合成，無外部素材）
   150 BPM、D 小調；所有事件時間與分鏡檔的畫面節點一一對齊。
   用法：node audio.js [--fmt 169|916] [out.wav]   → 48kHz / 16-bit / 立體聲
     169（預設）＝16:9 形象影片 10.0 秒（reel.js）
     916        ＝IG Reels 直式 16.0 秒（reel-916.js），尾音折回開頭，循環播放無縫
   ========================================================== */
'use strict';
const fs = require('fs');
const USAGE = 'Usage: node audio.js [--fmt 169|916] [out.wav]';
let FMT = '169', outPath = null;
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a === '--fmt') FMT = process.argv[++i];
  else if (a.startsWith('--fmt=')) FMT = a.slice(6);
  else if (a.startsWith('-') || outPath) { console.error(USAGE); process.exit(2); }
  else outPath = a;
}
if (!['169', '916'].includes(FMT)) { console.error(USAGE); process.exit(2); }
/* 劇本數（計數器的滴答聲數量）直接讀 scripts.js，與畫面一致 */
const NS = (() => { const box = { window: {}, document: { getElementById: () => null, querySelector: () => null, addEventListener() {}, readyState: 'complete' } }; try { require('vm').runInNewContext(fs.readFileSync(require('path').join(__dirname, '../../scripts.js'), 'utf8'), box); } catch { /* 後面的 DOM 程式會失敗，但資料已在 window.SCRIPTS */ } const s = box.window.SCRIPTS; if (!Array.isArray(s) || !s.length) throw new Error('scripts.js 讀不到 window.SCRIPTS'); return s.length; })();
const SR = 48000, DUR = FMT === '916' ? 16 : 10, TAIL = FMT === '916' ? 2 : 0;   // 直式多算 2 秒尾音，之後折回開頭
const N = Math.round(SR * (DUR + TAIL)), TAU = Math.PI * 2;
const L = new Float32Array(N), R = new Float32Array(N), RL = new Float32Array(N), RR = new Float32Array(N); // dry + reverb send

/* ---------- helpers ---------- */
let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const noise = () => rnd() * 2 - 1;
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const midi = m => 440 * Math.pow(2, (m - 69) / 12);
const NOTE = { D1: 26, A1: 33, Bb1: 34, C2: 36, D2: 38, F2: 41, G2: 43, A2: 45, Bb2: 46, C3: 48, D3: 50, E3: 52, F3: 53, Fs3: 54, G3: 55, Gs3: 56, A3: 57, Bb3: 58, C4: 60, Cs4: 61, D4: 62, E4: 64, F4: 65, Fs4: 66, G4: 67, A4: 69, Bb4: 70, C5: 72, D5: 74, E5: 76, F5: 77, Fs5: 78, A5: 81, D6: 86, F6: 89, A6: 93, D7: 98 };
const hz = n => midi(NOTE[n]);
/* RBJ biquad，可逐樣本改參數 */
class BQ {
  constructor() { this.x1 = this.x2 = this.y1 = this.y2 = 0; }
  set(type, f, q = .707) {
    f = clamp(f, 10, SR * .45); const w = TAU * f / SR, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
    let b0, b1, b2, a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else { b0 = a; b1 = 0; b2 = -a; } // bandpass (0 dB peak)
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0; return this;
  }
  p(x) { const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
}
/* 把一段單聲道訊號以等功率 pan 寫進總線；fn(i, tt) 回傳樣本 */
function voice(t0, dur, fn, { gain = 1, pan = 0, send = .2, panFn = null } = {}) {
  const i0 = Math.max(0, Math.round(t0 * SR)), i1 = Math.min(N, Math.round((t0 + dur) * SR));
  for (let i = i0; i < i1; i++) {
    const tt = (i - Math.round(t0 * SR)) / SR, v = fn(tt) * gain * Math.min(1, (dur - tt) / .008); if (!v) continue; // 尾端 8ms 淡出，避免截斷爆音
    const p = panFn ? panFn(tt) : pan, a = (p + 1) * Math.PI / 4, l = Math.cos(a) * v, r = Math.sin(a) * v;
    L[i] += l; R[i] += r; RL[i] += l * send; RR[i] += r * send;
  }
}
const saw = ph => 2 * (ph - Math.floor(ph + .5));

/* ---------- instruments ---------- */
function kick(t, g = 1, { f0 = 170, f1 = 46, dec = .32 } = {}) {
  let ph = 0; voice(t, .7, tt => { const f = f1 + (f0 - f1) * Math.exp(-tt * 32); ph += f / SR; return (Math.sin(TAU * ph) * Math.exp(-tt / dec) + (tt < .004 ? noise() * .5 * (1 - tt / .004) : 0)) * .9; }, { gain: g, send: .05 });
}
function boom(t, g = 1, len = 2.6) {
  let ph = 0; const lp = new BQ().set('lp', 160, .8);
  voice(t, len, tt => { const f = 26 + 64 * Math.exp(-tt * 7); ph += f / SR; const s = Math.sin(TAU * ph) * Math.exp(-tt / (len * .42)); const n = lp.p(noise()) * Math.exp(-tt * 5) * 1.4; return Math.tanh((s + n) * 1.8) * .95; }, { gain: g, send: .25 });
  voice(t, .08, tt => noise() * Math.exp(-tt * 70) * .7, { gain: g * .6, send: .4 });
}
function snare(t, g = 1) {
  const bp = new BQ().set('bp', 1900, .7); let ph = 0;
  voice(t, .3, tt => { ph += 185 / SR; return bp.p(noise()) * Math.exp(-tt * 18) * 1.6 + Math.sin(TAU * ph) * Math.exp(-tt * 30) * .5; }, { gain: g, send: .25, pan: .05 });
}
function hat(t, g = 1, open = false) {
  const hp = new BQ().set('hp', 8200, .8); voice(t, open ? .25 : .06, tt => hp.p(noise()) * Math.exp(-tt * (open ? 14 : 60)), { gain: g, send: .08, pan: .25 });
}
function tick(t, f = 2100, g = 1, pan = 0) {
  const bp = new BQ().set('bp', f, 6); let ph = 0;
  voice(t, .09, tt => { ph += f / SR; return Math.sin(TAU * ph) * Math.exp(-tt * 90) * .7 + bp.p(noise()) * Math.exp(-tt * 120) * 1.5; }, { gain: g, send: .35, pan });
}
function bell(t, f, g = 1, dur = 2.2, pan = 0) {
  const parts = [[1, 1, 1], [2.0, .45, .7], [2.76, .3, .5], [5.4, .18, .3], [8.93, .08, .2]];
  voice(t, dur, tt => { let s = 0; for (const [m, a, d] of parts) s += Math.sin(TAU * f * m * tt) * a * Math.exp(-tt / (dur * d * .45)); return s * .35 * Math.min(1, tt * 400); }, { gain: g * 1.3, send: .45, pan });
}
function gong(t, f, g = 1, dur = 2.5) {
  const parts = [[1, 1], [1.48, .6], [2.17, .5], [2.83, .35], [3.9, .25], [5.1, .15]];
  voice(t, dur, tt => { let s = 0; parts.forEach(([m, a], k) => s += Math.sin(TAU * f * m * tt * (1 + .004 * Math.exp(-tt * 3)) + k) * a * Math.exp(-tt * (1.2 + k * .6))); return Math.tanh(s * .6) * Math.min(1, tt * 300); }, { gain: g, send: .5 });
}
function whoosh(t, dur, f0, f1, g = 1, p0 = -.6, p1 = .6, q = 1.2) {
  const bp = new BQ(); let k = 0;
  voice(t, dur, tt => { const u = tt / dur; if (k++ % 16 === 0) bp.set('bp', f0 * Math.pow(f1 / f0, u), q); const env = Math.pow(Math.sin(Math.PI * u), 2.2); return bp.p(noise()) * env * 2.2; }, { gain: g, send: .3, panFn: tt => p0 + (p1 - p0) * tt / dur });
}
function riser(t0, t1, g = 1, f0 = 180, f1 = 1600) {
  const d = t1 - t0, bp = new BQ(); let ph = 0, ph2 = 0, k = 0;
  voice(t0, d, tt => { const u = tt / d, env = Math.pow(u, 2.6); if (k++ % 16 === 0) bp.set('bp', 400 * Math.pow(18, u), 1.5); const f = f0 * Math.pow(f1 / f0, u * u); ph += f / SR; ph2 += f * 1.007 / SR; return (bp.p(noise()) * 1.5 + (saw(ph) + saw(ph2)) * .18) * env; }, { gain: g, send: .35, panFn: tt => Math.sin(tt * 9) * .4 });
}
function revCymbal(t0, t1, g = 1) {
  const d = t1 - t0, hp = new BQ().set('hp', 5200, .7);
  voice(t0, d, tt => hp.p(noise()) * Math.pow(tt / d, 3.2) * 1.4, { gain: g, send: .4 });
}
function braam(t, notes, dur, g = 1, bright = 900) {
  const lp = [new BQ(), new BQ()]; const ph = notes.map(() => [rnd(), rnd(), rnd()]); let k = 0;
  voice(t, dur, tt => {
    const env = Math.min(1, tt * 60) * Math.exp(-tt / (dur * .35)), cut = 120 + bright * Math.exp(-tt * 2.2);
    if (k++ % 16 === 0) { lp[0].set('lp', cut, 1.1); lp[1].set('lp', cut, 1.1); }
    let s = 0; notes.forEach((n, j) => { const f = hz(n); [0.996, 1, 1.005].forEach((dt, m) => { ph[j][m] += f * dt / SR; s += saw(ph[j][m]); }); });
    return Math.tanh(lp[1].p(lp[0].p(s * .28)) * 2.4) * env;
  }, { gain: g, send: .35 });
}
function pad(t0, t1, notes, g = 1, fOpen = 2400, att = .6) {
  const d = t1 - t0, lp = new BQ(), hp = new BQ().set('hp', 150, .7), ph = notes.map(() => [rnd(), rnd()]); let k = 0;
  voice(t0, d + 1.2, tt => {
    const env = Math.min(1, tt / att) * (tt > d ? Math.exp(-(tt - d) * 3) : 1);
    if (k++ % 32 === 0) lp.set('lp', 300 + fOpen * Math.min(1, tt / d), .9);
    let s = 0; notes.forEach((n, j) => { const f = hz(n); ph[j][0] += f * .997 / SR; ph[j][1] += f * 1.004 / SR; s += saw(ph[j][0]) + saw(ph[j][1]); });
    return hp.p(lp.p(s * .12)) * env;
  }, { gain: g, send: .55, panFn: tt => Math.sin(tt * 1.3) * .3 });
}
function bass(t, n, dur, g = 1) {
  const lp = new BQ(); let ph = 0, k = 0; const f = hz(n);
  voice(t, dur, tt => { if (k++ % 16 === 0) lp.set('lp', 180 + 1400 * Math.exp(-tt * 18), 1.4); ph += f / SR; const env = Math.min(1, tt * 500) * (1 - clamp((tt - dur + .02) / .02)); return Math.tanh(lp.p(saw(ph) + Math.sin(TAU * ph) * .8) * 1.6) * env * .55; }, { gain: g, send: .04 });
}
function stab(t, notes, g = 1, dur = .3) {
  const lp = new BQ(); const ph = notes.map(() => [rnd(), rnd()]); let k = 0;
  voice(t, dur + .3, tt => { if (k++ % 16 === 0) lp.set('lp', 500 + 3800 * Math.exp(-tt * 9), .8); const env = Math.min(1, tt * 300) * Math.exp(-tt / (dur * .5)); let s = 0; notes.forEach((n, j) => { const f = hz(n); ph[j][0] += f / SR; ph[j][1] += f * 1.006 / SR; s += saw(ph[j][0]) + saw(ph[j][1]); }); return lp.p(s * .14) * env; }, { gain: g * 1.4, send: .4 });
}
function glitch(t, dur, g = 1) {
  let hold = 0, v = 0, ph = 0;
  voice(t, dur, tt => { const gate = Math.floor(tt * 34) % 3 !== 1 ? 1 : 0; if (hold-- <= 0) { hold = 40 + (rnd() * 200 | 0); v = noise(); } ph += (300 + 1800 * ((Math.floor(tt * 24) * 7) % 5) / 5) / SR; return (v * .7 + (ph % 1 < .5 ? .35 : -.35)) * gate * (1 - tt / dur); }, { gain: g, send: .15, panFn: tt => Math.sin(tt * 40) * .7 });
}
function thunder(t, g = 1) {
  const lp = new BQ().set('lp', 700, .6), lp2 = new BQ().set('lp', 140, .7);
  voice(t, 1.6, tt => { const crack = tt < .25 ? noise() * Math.exp(-tt * 14) * (rnd() < .3 ? 1.6 : .6) : 0; return lp.p(crack) * 1.3 + lp2.p(noise()) * Math.exp(-tt * 1.8) * 2.2 * Math.min(1, tt * 20); }, { gain: g, send: .5, pan: .3 });
}
function sweepDown(t, g = 1) { let ph = 0; voice(t, .55, tt => { ph += (2600 * Math.exp(-tt * 7) + 120) / SR; return Math.sin(TAU * ph) * Math.exp(-tt * 5) * .5; }, { gain: g, send: .6, panFn: tt => -.5 + tt * 2 }); }
function grains(t0, t1, n, g = 1, f = 6000) { for (let k = 0; k < n; k++) { const t = t0 + rnd() * (t1 - t0); tick(t, f * (.6 + rnd() * .9), g * (.2 + rnd() * .5), rnd() * 2 - 1); } }
function pop(t, g = 1) { const bp = new BQ().set('bp', 2400, .9); voice(t, .25, tt => bp.p(noise()) * Math.exp(-tt * 28) * 2.2, { gain: g, send: .3 }); }

/* ==========================================================
   SCORE · 16:9（10 秒）
   ========================================================== */
function score169() {
// SC.01 入口 0.0–1.6：時鐘、羅盤環、鑰匙孔
pad(0, 1.55, ['D2', 'A2', 'D3'], .2, 500, .9);
[0, .4, .8, 1.2].forEach((t, k) => tick(t + .001, k % 2 ? 1500 : 2100, .55, k % 2 ? .3 : -.3));
(() => { let ph = 0; voice(.05, 1.05, tt => { const u = tt / 1.05; ph += (1200 + 2400 * u) / SR; return Math.sin(TAU * ph) * Math.sin(Math.PI * u) * .06 * (1 + Math.sin(tt * 60) * .5); }, { send: .7, panFn: tt => Math.sin(tt * 6) * .8 }); })();
kick(.2, .35, { f0: 90, f1: 38, dec: .5 });
bell(.32, hz('D5'), .25, 2.4, -.2);
riser(.95, 1.6, .9); revCymbal(1.15, 1.6, .7);
whoosh(1.22, .4, 300, 4000, .9, -.4, .4);

// SC.02 世界 1.6–4.0：鼓組＋貝斯 ostinato＋每個世界的音效標記
boom(1.6, .7); braam(1.6, ['D2', 'A2', 'D3'], 1.0, .55, 700); thunder(1.65, .55); thunder(1.86, .3);
const bassLine = ['D2', 'D2', 'D3', 'D2', 'Bb1', 'Bb1', 'Bb2', 'Bb1', 'C2', 'C2', 'C3', 'A1'];
bassLine.forEach((n, k) => bass(1.6 + k * .2, n, .19, .45));
[2.0, 2.4, 2.8, 3.2, 3.4, 3.6, 3.8].forEach(t => kick(t, .7));
[2.2, 2.6, 3.0].forEach(t => kick(t, .45));
[2.0, 2.8].forEach(t => snare(t, .55));
[3.6, 3.7, 3.8, 3.85, 3.9, 3.95].forEach((t, k) => snare(t, .25 + k * .07));
for (let t = 1.6; t < 3.95; t += .1) hat(t, Math.round((t - 1.6) / .1) % 2 ? .18 : .32, Math.abs(t % .4) < .01);
stab(2.0, ['D4', 'F4', 'A4'], .45); bell(2.0, hz('A5'), .3, 1.4, .3); bell(2.08, hz('D6'), .22, 1.2, -.3); bell(2.16, hz('F6'), .18, 1.0, .4); // 春晝短
glitch(2.4, .22, .3); stab(2.4, ['D4', 'Gs3', 'A4'], .4); whoosh(2.38, .1, 500, 6000, .4); // 瘋兔子
sweepDown(2.8, .7); stab(2.8, ['Bb3', 'D4', 'F4'], .4); // 群星
gong(3.2, 196, .32, 1.4); tick(3.21, 900, .5); stab(3.2, ['Bb3', 'D4', 'F4'], .35); // 津門遺雲
whoosh(3.4, .2, 300, 900, .35, .5, -.5, 4); stab(3.4, ['C4', 'E4', 'G4'], .35); // 漓川
bell(3.6, hz('D7'), .14, .7, .5); bell(3.62, hz('A6'), .14, .7, -.5); bell(3.64, hz('F6'), .12, .7, .2); stab(3.6, ['C4', 'E4', 'G4'], .35); // 晴天神社
pop(3.8, .7); pop(3.83, .5); stab(3.8, ['A3', 'Cs4', 'A4'], .45); // 沸騰
whoosh(3.33, .14, 600, 5000, .35, -.8, .8); whoosh(3.52, .12, 600, 5000, .3, .8, -.8);

// SC.03 群像 4.0–6.0：縮成卡片、拉遠、57 聲計數、排成海星
kick(4.0, .9); stab(4.0, ['D4', 'F4', 'A4'], .4, .5); whoosh(3.98, .24, 2500, 300, .55, .3, -.3);
whoosh(4.18, .9, 200, 3000, .9, -.7, .7, .9); boom(4.2, .32, 1.6);
pad(4.2, 6.0, ['D2', 'A2', 'E3', 'F3', 'A3', 'D4'], .32, 2600, .4);
(() => { let last = 0; for (let i = 0; i < SR * 1.1; i += 48) { const t = 4.3 + i / SR, u = clamp((t - 4.3) / 1.0), n = Math.round(NS * (1 - Math.pow(1 - u, 3))); if (n !== last) { tick(t, 3200 + n * 18, .28, (n % 2 ? .4 : -.4)); last = n; } } })();
[4.4, 4.8, 5.2, 5.6].forEach(t => kick(t, .55, { f0: 110, f1: 40, dec: .4 }));
for (let k = 0; k < 16; k++) { const t = 4.9 + k * .045 + rnd() * .03; whoosh(t, .22, 900 + rnd() * 900, 3500 + rnd() * 2000, .16, rnd() * 2 - 1, rnd() * 2 - 1, 1.6); }
bell(5.45, hz('D5'), .3, 1.6); bell(5.6, hz('A5'), .22, 1.4, -.3); bell(5.72, hz('E5'), .2, 1.3, .3); bell(5.84, hz('F5'), .18, 1.2, -.2);
riser(5.35, 6.0, .75, 120, 900); revCymbal(5.55, 6.0, .6);

// SC.04 你 6.0–7.6：四記重擊＋甩鏡、braam、你是誰？
const hits = [[6.0, ['D3', 'Gs3', 'A3', 'D4']], [6.2, ['D3', 'F3', 'A3', 'D4']], [6.4, ['Bb2', 'D3', 'F3', 'Bb3']], [6.6, ['A2', 'E3', 'A3', 'Cs4']]];   // 驚悚→推理→情感→歡樂
hits.forEach(([t, ch], k) => { kick(t, .8); snare(t, .5); stab(t, ch, .4, .22); bass(t, ch[0] === 'Bb2' ? 'Bb1' : ch[0] === 'A2' ? 'A1' : 'D2', .19, .6); if (k) whoosh(t - .09, .1, 800, 6000, .45, k % 2 ? -.8 : .8, k % 2 ? .8 : -.8, 1); });
glitch(6.0, .18, .22);
kick(6.8, .8); whoosh(6.72, .26, 3000, 400, .6, 0, 0, .9); boom(6.8, .25, 1.0);
whoosh(6.96, .3, 400, 2500, .55, -.9, .9, .8);
bell(7.04, hz('D5'), .25, 1.4); bell(7.04, hz('A4'), .18, 1.4);
boom(7.2, .6, 2.0); braam(7.2, ['D2', 'A2', 'D3', 'F3'], 1.2, .75, 1100); snare(7.2, .4);
(() => { let ph = 0, ph2 = 0; voice(7.22, .42, tt => { ph += hz('A4') / SR; ph2 += hz('Bb4') / SR; return (saw(ph) + saw(ph2)) * .05 * (.6 + .4 * Math.sin(tt * TAU * 14)) * Math.min(1, tt * 8); }, { send: .5, panFn: tt => Math.sin(tt * 7) * .5 }); })();
grains(7.0, 7.5, 40, .35, 4200);
revCymbal(7.32, 7.6, .55); whoosh(7.38, .24, 500, 3000, .4, -.5, .5);

// LOGO 7.6–10：金塵、吸氣、BOOM、品牌和弦、閃光
grains(7.6, 7.98, 120, .3, 7000);
riser(7.55, 7.98, .8, 220, 2400); revCymbal(7.62, 7.98, .7);
boom(8.0, .8, 2.6); braam(8.0, ['D2', 'A2', 'D3', 'Fs3', 'A3'], 1.8, .75, 1400); kick(8.0, .8); thunder(8.02, .25);
pad(8.0, 9.4, ['D3', 'A3', 'D4', 'Fs4', 'A4', 'E5'], .42, 3200, .08);
[['D5', 8.1], ['Fs5', 8.22], ['A5', 8.34], ['D6', 8.46], ['A5', 8.7], ['D6', 8.95], ['Fs5', 9.25]].forEach(([n, t], k) => bell(t, hz(n), .22 - k * .015, 1.6, k % 2 ? .4 : -.4));
whoosh(8.55, .7, 2000, 9000, .25, -.6, .6, 2); whoosh(9.2, .6, 3000, 11000, .22, -.4, .5, 2);
grains(8.0, 9.6, 60, .14, 9000);
}

/* ==========================================================
   SCORE · 9:16 IG Reels（16 秒＝40 拍，畫面節點見 reel-916.js）
   ========================================================== */
function score916() {
  // SC.01 入口 0.0–2.0：第一格就有聲音（鑰匙孔亮著）
  kick(0, .4, { f0: 90, f1: 38, dec: .5 });
  pad(0, 1.95, ['D2', 'A2', 'D3'], .2, 500, .6);
  [0, .4, .8, 1.2, 1.6].forEach((t, k) => tick(t + .001, k % 2 ? 1500 : 2100, .55, k % 2 ? .3 : -.3));
  (() => { let ph = 0; voice(0, 1.3, tt => { const u = tt / 1.3; ph += (1200 + 2400 * u) / SR; return Math.sin(TAU * ph) * Math.sin(Math.PI * u) * .06 * (1 + Math.sin(tt * 60) * .5); }, { send: .7, panFn: tt => Math.sin(tt * 6) * .8 }); })();
  bell(.2, hz('D5'), .25, 2.4, -.2); bell(.46, hz('A5'), .14, 2.0, .2);
  riser(1.35, 2.0, .9); revCymbal(1.55, 2.0, .7);
  whoosh(1.62, .4, 300, 4000, .9, -.4, .4);

  // SC.02 世界 2.0–6.4
  boom(2.0, .7); braam(2.0, ['D2', 'A2', 'D3'], 1.0, .55, 700); thunder(2.05, .55); thunder(2.3, .3); thunder(2.56, .22);
  ['D2', 'D2', 'D3', 'D2', 'Bb1', 'Bb1', 'Bb2', 'Bb1', 'C2', 'C2', 'C3', 'C2', 'D2', 'D2', 'D3', 'D2', 'Bb1', 'Bb2', 'C2', 'C3', 'A1', 'A2'].forEach((n, k) => bass(2.0 + k * .2, n, .19, .45));
  for (let t = 2.4; t < 6.35; t += .4) kick(t, .7);
  [3.4, 4.6, 5.4, 5.8].forEach(t => kick(t, .6));
  [2.4, 3.2, 4.0, 4.8, 5.6].forEach(t => snare(t, .5));
  [6.0, 6.1, 6.2, 6.25, 6.3, 6.35].forEach((t, k) => snare(t, .25 + k * .07));
  for (let k = 0; k < 44; k++) hat(2.0 + k * .1, k % 2 ? .18 : .32, k % 4 === 0);
  stab(2.8, ['D4', 'F4', 'A4'], .45); bell(2.8, hz('A5'), .3, 1.4, .3); bell(2.88, hz('D6'), .22, 1.2, -.3); bell(2.96, hz('F6'), .18, 1.0, .4);   // 春晝短
  glitch(3.4, .22, .3); stab(3.4, ['D4', 'Gs3', 'A4'], .4); whoosh(3.38, .1, 500, 6000, .4);                                                    // 瘋兔子
  sweepDown(4.0, .7); stab(4.0, ['Bb3', 'D4', 'F4'], .4);                                                                                         // 群星
  whoosh(4.53, .14, 600, 5000, .35, -.8, .8); gong(4.6, 196, .32, 1.4); tick(4.61, 900, .5); stab(4.6, ['Bb3', 'D4', 'F4'], .35);              // 津門遺雲
  whoosh(4.93, .14, 5000, 600, .35, 0, 0); bell(5.0, hz('D7'), .14, .7, .5); bell(5.02, hz('A6'), .14, .7, -.5); bell(5.04, hz('F6'), .12, .7, .2); stab(5.0, ['C4', 'E4', 'G4'], .35);   // 晴天神社（往上滑）
  whoosh(5.33, .12, 600, 5000, .3, .8, -.8); whoosh(5.4, .3, 300, 900, .35, .5, -.5, 4); stab(5.4, ['C4', 'E4', 'G4'], .35);                  // 漓川
  pop(5.8, .7); pop(5.83, .5); stab(5.8, ['A3', 'Cs4', 'A4'], .45);                                                                              // 沸騰

  // SC.03 群像 6.4–9.2
  kick(6.4, .9); stab(6.4, ['D4', 'F4', 'A4'], .4, .5); whoosh(6.38, .24, 2500, 300, .55, .3, -.3);
  whoosh(6.58, 1.3, 200, 3000, .9, -.7, .7, .9); boom(6.6, .32, 1.6);
  pad(6.6, 9.2, ['D2', 'A2', 'E3', 'F3', 'A3', 'D4'], .32, 2600, .5);
  (() => { let last = 0; for (let i = 0; i < SR * 1.35; i += 48) { const t = 6.75 + i / SR, u = clamp((t - 6.75) / 1.25), n = Math.round(NS * (1 - Math.pow(1 - u, 3))); if (n !== last) { tick(t, 3200 + n * 18, .28, (n % 2 ? .4 : -.4)); last = n; } } })();
  [6.8, 7.2, 7.6, 8.0, 8.4, 8.8].forEach(t => kick(t, .55, { f0: 110, f1: 40, dec: .4 }));
  for (let k = 0; k < 18; k++) { const t = 7.4 + k * .055 + rnd() * .03; whoosh(t, .24, 900 + rnd() * 900, 3500 + rnd() * 2000, .15, rnd() * 2 - 1, rnd() * 2 - 1, 1.6); }
  bell(8.3, hz('D5'), .3, 1.6); bell(8.6, hz('A5'), .22, 1.4, -.3); bell(8.74, hz('E5'), .2, 1.3, .3); bell(8.88, hz('F5'), .18, 1.2, -.2);
  riser(8.55, 9.2, .75, 120, 900); revCymbal(8.75, 9.2, .6);

  // SC.04 你 9.2–11.2
  [[9.2, ['D3', 'Gs3', 'A3', 'D4']], [9.4, ['D3', 'F3', 'A3', 'D4']], [9.6, ['Bb2', 'D3', 'F3', 'Bb3']], [9.8, ['A2', 'E3', 'A3', 'Cs4']]].forEach(([t, ch], k) => {   // 驚悚→推理→情感→歡樂
    kick(t, .8); snare(t, .5); stab(t, ch, .4, .22); bass(t, ch[0] === 'Bb2' ? 'Bb1' : ch[0] === 'A2' ? 'A1' : 'D2', .19, .6);
    if (k) whoosh(t - .09, .1, 800, 6000, .45, 0, 0, 1);   // 直式甩鏡：上下
  });
  glitch(9.2, .18, .22);
  whoosh(9.92, .26, 3000, 400, .6, 0, 0, .9); kick(10.0, .8); boom(10.0, .25, 1.0);
  whoosh(10.16, .3, 400, 2500, .55, -.9, .9, .8);
  bell(10.3, hz('D5'), .25, 1.4); bell(10.3, hz('A4'), .18, 1.4);
  boom(10.4, .6, 2.0); braam(10.4, ['D2', 'A2', 'D3', 'F3'], 1.3, .75, 1100); snare(10.4, .4);
  (() => { let ph = 0, ph2 = 0; voice(10.42, .62, tt => { ph += hz('A4') / SR; ph2 += hz('Bb4') / SR; return (saw(ph) + saw(ph2)) * .05 * (.6 + .4 * Math.sin(tt * TAU * 14)) * Math.min(1, tt * 8); }, { send: .5, panFn: tt => Math.sin(tt * 7) * .5 }); })();
  grains(10.22, 10.8, 46, .35, 4200);
  revCymbal(10.9, 11.2, .55); whoosh(10.96, .24, 500, 3000, .4, -.5, .5);

  // LOGO 11.2–16.0：金塵、BOOM、品牌和弦、預約（12.8 起停留）、接回片頭
  grains(11.2, 11.58, 120, .3, 7000);
  riser(11.15, 11.58, .8, 220, 2400); revCymbal(11.22, 11.58, .7);
  boom(11.6, .8, 2.6); braam(11.6, ['D2', 'A2', 'D3', 'Fs3', 'A3'], 1.8, .75, 1400); kick(11.6, .8); thunder(11.62, .25);
  pad(11.6, 15.5, ['D3', 'A3', 'D4', 'Fs4', 'A4', 'E5'], .42, 3200, .08);
  [['D5', 11.7], ['Fs5', 11.82], ['A5', 11.94], ['D6', 12.06], ['A5', 12.3], ['D6', 12.55], ['Fs5', 12.85]].forEach(([n, t], k) => bell(t, hz(n), .22 - k * .015, 1.6, k % 2 ? .4 : -.4));
  whoosh(12.15, .7, 2000, 9000, .25, -.6, .6, 2); whoosh(12.8, .6, 3000, 11000, .22, -.4, .5, 2);
  kick(12.8, .35, { f0: 120, f1: 50, dec: .3 }); bell(12.8, hz('A5'), .2, 1.8, -.2); bell(12.8, hz('D6'), .16, 1.8, .2);   // 預約資訊
  whoosh(13.55, .6, 3000, 11000, .18, -.5, .5, 2);   // 按鈕掃光
  [13.6, 14.4, 15.2].forEach(t => kick(t, .3, { f0: 100, f1: 40, dec: .45 }));   // 停留時的心跳
  [['A5', 13.6], ['Fs5', 14.0], ['E5', 14.4], ['D5', 14.8], ['A4', 15.2]].forEach(([n, t], k) => bell(t, hz(n), .12, 1.6, k % 2 ? .3 : -.3));
  grains(11.6, 15.0, 90, .14, 9000);
  tick(15.6 + .001, 1500, .5, .3); revCymbal(15.62, 16.0, .4);   // 回到片頭的第一聲
}
(FMT === '916' ? score916 : score169)();

/* ---------- reverb (Freeverb-ish) + master ---------- */
function reverb(inp, outp, spread) {
  const combs = [1557, 1617, 1491, 1422, 1277, 1356, 1188, 1116].map(d => ({ b: new Float32Array(d + spread), i: 0, f: 0 }));
  const aps = [556, 441, 341, 225].map(d => ({ b: new Float32Array(d + spread), i: 0 }));
  const fb = .86, damp = .3;
  for (let n = 0; n < N; n++) {
    const x = inp[n] * .015; let s = 0;
    for (const c of combs) { const y = c.b[c.i]; c.f = y * (1 - damp) + c.f * damp; c.b[c.i] = x + c.f * fb; c.i = (c.i + 1) % c.b.length; s += y; }
    for (const a of aps) { const y = a.b[a.i]; a.b[a.i] = s + y * .5; a.i = (a.i + 1) % a.b.length; s = y - s; }
    outp[n] += s;
  }
}
reverb(RL, L, 0); reverb(RR, R, 23);
const hpL = new BQ().set('hp', 34, .7), hpR = new BQ().set('hp', 34, .7);
let raw = 0;
for (let i = 0; i < N; i++) { L[i] = hpL.p(L[i]); R[i] = hpR.p(R[i]); raw = Math.max(raw, Math.abs(L[i]), Math.abs(R[i])); }
if (TAIL) {   // 尾音折回開頭：循環播放時，片尾的殘響自然延續到第一拍
  const n0 = Math.round(SR * DUR);
  for (let i = n0; i < N; i++) { L[i - n0] += L[i]; R[i - n0] += R[i]; }
  raw = 0; for (let i = 0; i < n0; i++) raw = Math.max(raw, Math.abs(L[i]), Math.abs(R[i]));
}
const NO = Math.round(SR * DUR);   // 實際輸出長度
const pre = 1.3 / raw; let peak = 0;   // 只讓最高的 ~3 dB 進入 tanh 軟削峰
for (let i = 0; i < NO; i++) {
  const fade = TAIL ? 1 : 1 - clamp((i / SR - 9.55) / .45);
  L[i] = Math.tanh(L[i] * pre) * fade; R[i] = Math.tanh(R[i] * pre) * fade;
  peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const norm = .75 / peak;   // 取樣峰值 -2.5 dBFS：IG 再轉 AAC 後的 true peak 仍在 -1 dBTP 以下
const buf = Buffer.alloc(44 + NO * 4);
buf.write('RIFF', 0); buf.writeUInt32LE(36 + NO * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12);
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(NO * 4, 40);
for (let i = 0; i < NO; i++) {
  const d = () => (rnd() - rnd()) / 32768;
  buf.writeInt16LE(Math.round(clamp(L[i] * norm + d(), -1, 1) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(clamp(R[i] * norm + d(), -1, 1) * 32767), 46 + i * 4);
}
const out = outPath || (FMT === '916' ? 'soundtrack-916.wav' : 'soundtrack.wav');
fs.writeFileSync(out, buf);
console.log(`${out}: ${DUR}s @ ${SR}Hz`);
