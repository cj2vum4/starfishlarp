#!/usr/bin/env node
/* 逐格擷取 → PNG 序列（可多工平行），再交給 ffmpeg 合成。
   用法：node render.js [--out DIR] [--workers 4] [--from 0] [--to 600] [--only 0,90,300]
   需要 Playwright（Chromium）；會在 repo 根目錄起一個臨時靜態伺服器。 */
const http = require('http'), fs = require('fs'), path = require('path');
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(__dirname, '../..'), OUT = path.resolve(arg('out', path.join(__dirname, 'frames')));
const WORKERS = +arg('workers', 4), FROM = +arg('from', 0), TO = +arg('to', 600);
const ONLY = arg('only', '') ? arg('only').split(',').map(Number) : null;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
(async () => {
  await new Promise(r => server.listen(0, r));
  const url = `http://127.0.0.1:${server.address().port}/promo/showreel/index.html?capture`;
  fs.mkdirSync(OUT, { recursive: true });
  const frames = ONLY || Array.from({ length: TO - FROM }, (_, i) => FROM + i);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader-webgl', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'] });
  let next = 0, done = 0; const t0 = Date.now();
  await Promise.all(Array.from({ length: Math.min(WORKERS, frames.length) }, async () => {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
    page.on('pageerror', e => { console.error('pageerror', e); process.exit(1); });
    page.on('console', m => { if (m.type() === 'error') console.error('console', m.text()); });
    await page.goto(url); await page.evaluate(() => window.reelReady);
    const canvas = await page.$('#out');
    while (next < frames.length) {
      const f = frames[next++];
      await page.evaluate(f => window.renderFrame(f), f);
      await canvas.screenshot({ path: path.join(OUT, `f${String(f).padStart(4, '0')}.png`) });
      if (++done % 20 === 0 || done === frames.length) process.stdout.write(`\r${done}/${frames.length} frames · ${((Date.now() - t0) / done).toFixed(0)} ms/frame   `);
    }
    await page.close();
  }));
  console.log(`\ndone in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${OUT}`);
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
