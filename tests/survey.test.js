'use strict';

/**
 * 角色問卷頁檢查：window.SURVEY.script 必須等於 scripts.js 的某個 reviewKey，
 * 否則預約系統會拒收（只收劇本目錄裡有的名稱）；每份都要有必填的遊玩日期題（預約系統靠它分場次）。
 *
 * 跑法：node tests/survey.test.js
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
global.window = {};
global.document = { getElementById: () => null, addEventListener() {}, readyState: 'complete' };
require(path.join(root, 'scripts.js'));
const keys = new Set(window.SCRIPTS.map((s) => s.reviewKey || s.name));

const dir = path.join(root, '問卷');
const pages = fs.readdirSync(dir).filter((f) => f.endsWith('.html'));
const bad = [];
for (const f of pages) {
  const html = fs.readFileSync(path.join(dir, f), 'utf8');
  const m = /window\.SURVEY\s*=\s*\{\s*script:\s*(['"])(.*?)\1/.exec(html);
  if (!m) bad.push(`${f}：找不到 window.SURVEY.script`);
  else if (!keys.has(m[2])) bad.push(`${f}：script「${m[2]}」不是 scripts.js 裡任何劇本的 reviewKey`);
  if (!/survey\.js\?v=/.test(html)) bad.push(`${f}：survey.js 沒有帶 ?v= 版號`);
  // 預約系統依「劇本＋遊玩日期」分場次、收齊通知店家、配對角色：每份問卷都要有必填的日期題，
  // 存檔欄名（label，沒有就是題目文字）要含「日期」。
  const dates = html.split('\n').filter((line) => /["']?type["']?\s*:\s*["']date["']/.test(line));
  const ok = dates.some((line) => /["']?required["']?\s*:\s*true/.test(line) &&
    (/["']?label["']?\s*:\s*["'][^"']*日期/.test(line) || (!/["']?label["']?\s*:/.test(line) && /["']?title["']?\s*:\s*["'][^"']*日期/.test(line))));
  if (!ok) bad.push(`${f}：沒有必填的遊玩日期題（type: 'date'，題目或 label 含「日期」），預約系統分不出場次`);
}
bad.forEach((b) => console.log('  ❌ ' + b));
console.log(`  ${bad.length ? '❌' : '✅'} ${pages.length} 份角色問卷的劇本名稱都對得到 reviewKey、都有遊玩日期題`);
if (bad.length) process.exit(1);
