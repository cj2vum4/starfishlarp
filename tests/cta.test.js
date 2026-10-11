'use strict';

/**
 * 劇本頁預約按鈕檢查：每頁最下方 CTA 都要連到 LINE 預約系統的開團頁，並帶入 scripts.js 的 id。
 *
 * 跑法：node tests/cta.test.js
 * 零相依，不需要 npm install。
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
global.window = {};
global.document = { getElementById: () => null, addEventListener() {}, readyState: 'complete' };
require(path.join(root, 'scripts.js'));

const LIFF = 'https://liff.line.me/2011840025-6cuU9x8P?view=create&amp;game=';
let pass = 0;
const failures = [];

function check(label, ok) {
  if (ok) pass += 1; else failures.push(label);
  if (!ok) console.log('  ❌ ' + label);
}

for (const s of window.SCRIPTS) {
  const file = path.join(root, s.file);
  if (!fs.existsSync(file)) { check(`${s.file}：找不到頁面`, false); continue; }
  const html = fs.readFileSync(file, 'utf8');
  const links = [...html.matchAll(/href="(https:\/\/liff\.line\.me\/[^"]*)"/g)].map(m => m[1]);
  check(`${s.file}：id「${s.id}」LIFF 開團頁收得下（英數、-、_）`, /^[A-Za-z0-9_-]{1,64}$/.test(s.id));
  check(`${s.file}：預約按鈕連到 LINE 開團頁並帶入 game=${s.id}`,
    links.length === 1 && links[0] === LIFF + s.id);
  check(`${s.file}：不再連到 OA 加好友頁（預約一律走開團頁）`, !html.includes('line.me/R/ti/p/'));
  check(`${s.file}：沒有只跳提示、不會跳轉的假預約按鈕`,
    !html.includes('即將跳轉至預約頁面') && !/<a href="#" class="cta-button"/.test(html));
}

console.log(`  ${failures.length ? '❌' : '✅'} ${window.SCRIPTS.length} 個劇本頁的預約按鈕（${pass} 項通過${failures.length ? `，${failures.length} 項失敗` : ''}）`);
if (failures.length) process.exit(1);
