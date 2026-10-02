// 從 YouTube 頻道的公開 RSS 抓最新影片，依標題對應劇本，
// 把影片網址填進 scripts.js 的 youtube 欄位，並進 scripts.js / video.js 版號。
//
// 對應規則（只處理 youtube 欄位還是空的劇本，手動填的永遠不會被蓋掉）：
//   1. 標題裡用《》「」『』【】包住劇本名 → 一定對得到（短名如「45」「你好」只認這種）
//   2. 劇本名 5 個字以上，標題直接包含也算
//   同一支影片對到多個劇本時取名字最長的；同一個劇本有多支影片時，一般影片優先於 Shorts，再取最新的。
//   不想讓某個劇本自動填，把它的 youtube 設成 "-"。
//
// 環境變數：
//   YT_CHANNEL    頻道 ID（UC 開頭）、@handle 或頻道網址
//   YT_FEED_FILE  （測試用）直接讀本機 RSS 檔，不連網
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const SCRIPTS_FILE = path.join(ROOT, 'scripts.js');

async function fetchText(url) {
    const res = await fetch(url, { headers: { 'Accept-Language': 'zh-TW,zh;q=0.9' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}：${url}`);
    return res.text();
}

async function resolveChannelId(input) {
    const raw = String(input || '').trim();
    const direct = raw.match(/(UC[\w-]{22})/);
    if (direct) return direct[1];
    const handle = raw.match(/@[\w.\-·一-鿿]+/);
    if (!handle) throw new Error(`看不懂 YT_CHANNEL：${raw}`);
    const html = await fetchText('https://www.youtube.com/' + encodeURI(handle[0]));
    const m = html.match(/feeds\/videos\.xml\?channel_id=(UC[\w-]{22})/) ||
        html.match(/"externalId":"(UC[\w-]{22})"/) ||
        html.match(/itemprop="identifier" content="(UC[\w-]{22})"/);
    if (!m) throw new Error(`找不到 ${handle[0]} 的頻道 ID`);
    return m[1];
}

function decodeXml(s) {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
        .replace(/&amp;/g, '&');
}

function parseFeed(xml) {
    return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => {
        const id = (e.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/) || [])[1];
        const title = decodeXml((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || '');
        const link = (e.match(/<link rel="alternate" href="([^"]+)"/) || [])[1] || '';
        const published = (e.match(/<published>([^<]+)<\/published>/) || [])[1] || '';
        return { id, title, published, shorts: link.includes('/shorts/') };
    }).filter(v => v.id);
}

function loadScripts() {
    const ctx = { window: {}, document: { getElementById: () => null } };
    vm.runInNewContext(fs.readFileSync(SCRIPTS_FILE, 'utf8'), ctx);
    return ctx.window.SCRIPTS;
}

const norm = s => String(s || '').normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '');

/** 這支影片對應哪個劇本（取最長的劇本名），沒有就回傳 null。 */
function matchScript(title, scripts) {
    const bracketed = [...title.matchAll(/[《「『【]([^》」』】]+)[》」』】]/g)].map(m => norm(m[1]));
    const whole = norm(title);
    let best = null;
    for (const s of scripts) {
        const names = new Set([s.name, s.reviewKey, path.basename(s.file || '', '.html')].map(norm).filter(Boolean));
        for (const n of names) {
            const hit = bracketed.includes(n) || (n.length >= 5 && whole.includes(n));
            if (hit && (!best || n.length > best.len)) best = { script: s, len: n.length };
        }
    }
    return best && best.script;
}

function videoUrl(v) {
    return v.shorts ? `https://www.youtube.com/shorts/${v.id}` : `https://youtu.be/${v.id}`;
}

/** 在 scripts.js 該劇本那一行寫入 youtube 欄位（每筆劇本一行）。 */
function writeYoutube(text, id, url) {
    const lines = text.split('\n');
    const i = lines.findIndex(l => l.includes(`"id":${JSON.stringify(id)}`));
    if (i < 0) throw new Error(`scripts.js 找不到 id=${id} 那一行`);
    const value = `"youtube":${JSON.stringify(url)}`;
    if (/"youtube":"[^"]*"/.test(lines[i])) {
        lines[i] = lines[i].replace(/"youtube":"[^"]*"/, value);
    } else if (lines[i].includes('"characters":')) {
        lines[i] = lines[i].replace('"characters":', value + ',"characters":');
    } else {
        lines[i] = lines[i].replace(/\}(,?)\s*$/, `,${value}}$1`);
    }
    return lines.join('\n');
}

/** scripts.js 與 video.js 共用同一個版號：全站一起換，並同步 service-worker。 */
function bumpVersion() {
    const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const old = (index.match(/scripts\.js\?v=([\w-]+)/) || [])[1];
    if (!old) throw new Error('index.html 找不到 scripts.js?v=');
    const now = new Date(Date.now() + 8 * 3600e3).toISOString(); // 台灣時間
    const next = now.slice(0, 10).replace(/-/g, '') + '-yt' + now.slice(11, 16).replace(':', '');
    const pattern = new RegExp(`((?:scripts|video)\\.js\\?v=)${old.replace(/[-]/g, '\\-')}(?![\\w-])`, 'g');

    const files = [];
    const walk = dir => {
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            if (ent.name.startsWith('.') || ent.name === 'vendor' || ent.name === 'node_modules' || ent.name === '劇本資料') continue;
            const p = path.join(dir, ent.name);
            if (ent.isDirectory()) walk(p);
            else if (/\.(html|js)$/.test(ent.name)) files.push(p);
        }
    };
    walk(ROOT);

    let changed = 0;
    for (const f of files) {
        let s = fs.readFileSync(f, 'utf8');
        const before = s;
        s = s.replace(pattern, `$1${next}`);
        if (f.endsWith('service-worker.js')) {
            s = s.replace(/const CACHE_VERSION = '[^']*';/, `const CACHE_VERSION = '${next}';`);
        }
        if (s !== before) { fs.writeFileSync(f, s); changed++; }
    }
    console.log(`版號 ${old} → ${next}（${changed} 個檔案）`);
}

async function main() {
    let xml;
    if (process.env.YT_FEED_FILE) {
        xml = fs.readFileSync(process.env.YT_FEED_FILE, 'utf8');
    } else {
        if (!process.env.YT_CHANNEL) {
            console.log('::warning::尚未設定 YT_CHANNEL，略過');
            return;
        }
        const channelId = await resolveChannelId(process.env.YT_CHANNEL);
        xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
    }

    const videos = parseFeed(xml);
    const scripts = loadScripts();
    console.log(`頻道最新 ${videos.length} 支影片`);

    const picked = new Map(); // script.id → video
    for (const v of videos) {
        const s = matchScript(v.title, scripts);
        console.log(`  ${v.id} ${v.shorts ? '[Shorts] ' : ''}${v.title} → ${s ? s.name : '（沒對到劇本）'}`);
        if (!s || String(s.youtube || '').trim()) continue;
        const cur = picked.get(s.id);
        const better = !cur || (cur.shorts && !v.shorts) ||
            (cur.shorts === v.shorts && v.published > cur.published);
        if (better) picked.set(s.id, v);
    }

    if (!picked.size) {
        console.log('沒有新影片要填');
        return;
    }

    let text = fs.readFileSync(SCRIPTS_FILE, 'utf8');
    const summary = [];
    for (const [id, v] of picked) {
        const name = scripts.find(s => s.id === id).name;
        text = writeYoutube(text, id, videoUrl(v));
        summary.push(`${name}：${videoUrl(v)}`);
    }
    fs.writeFileSync(SCRIPTS_FILE, text);
    loadScripts(); // 寫完再解析一次，確定 scripts.js 沒寫壞
    bumpVersion();

    console.log('新填入：\n' + summary.map(s => '  ' + s).join('\n'));
    if (process.env.GITHUB_OUTPUT) {
        fs.appendFileSync(process.env.GITHUB_OUTPUT, `summary<<EOF\n${summary.join('\n')}\nEOF\n`);
    }
}

main().catch(err => {
    console.error('::error::' + err.message);
    process.exit(1);
});
