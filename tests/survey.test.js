'use strict';

/**
 * 角色問卷頁檢查：window.SURVEY.script 必須等於 scripts.js 的某個 reviewKey，
 * 否則預約系統會拒收（只收劇本目錄裡有的名稱）。
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
}
bad.forEach((b) => console.log('  ❌ ' + b));
console.log(`  ${bad.length ? '❌' : '✅'} ${pages.length} 份角色問卷的劇本名稱都對得到 reviewKey`);
if (bad.length) process.exit(1);
