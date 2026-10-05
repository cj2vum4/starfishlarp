// 從 YouTube 頻道的公開 RSS 抓最新影片，依標題對應劇本，
// 把影片網址填進 scripts.js 的 youtube 欄位，並進 scripts.js / video.js 版號。
//
// 對應規則（只處理 youtube 欄位還是空的劇本，手動填的永遠不會被蓋掉）：
//   1. 說明欄裡有劇本頁網址（…/starfishlarp/7人/王座.html）→ 最準，優先採用
//   2. 標題裡用《》「」『』【】包住劇本名 → 一定對得到（短名如「45」「你好」只認這種）
//   3. 劇本名 5 個字以上，標題直接包含也算
//   同一支影片對到多個劇本時取名字最長的；同一個劇本有多支影片時，一般影片優先於 Shorts，再取最新的。
//   不想讓某個劇本自動填，把它的 youtube 設成 "-"。
//
// 環境變數：
//   YT_CHANNEL    頻道 ID（UC 開頭）、@handle 或頻道網址
//   YT_FEED_FILE  （測試用）直接讀本機 RSS 檔，不連網
//   YT_FULL=1     完整掃描頻道所有影片（RSS 只有最新 15 支，補舊影片用；
//                 逐支讀影片頁取說明欄，較慢，Actions 手動執行時預設開啟）
//
// 手動登記（上傳完影片馬上填，不必等排程，也不受標題規則限制）：
//   node .github/scripts/sync-youtube.mjs --set <劇本名或id> <影片網址或ID>
//   會覆寫該劇本原本的 youtube，並全站進版號；之後 commit 推 main 即可。
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const SCRIPTS_FILE = path.join(ROOT, 'scripts.js');

const YT_HEADERS = {
    'Accept-Language': 'zh-TW,zh;q=0.9',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    'Cookie': 'CONSENT=YES+1; SOCS=CAI'
};

async function fetchText(url) {
    const res = await fetch(url, { headers: YT_HEADERS });
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
        const description = decodeXml((e.match(/<media:description>([\s\S]*?)<\/media:description>/) || [])[1] || '');
        return { id, title, description, published, shorts: link.includes('/shorts/') };
    }).filter(v => v.id);
}

function loadScripts() {
    const ctx = { window: {}, document: { getElementById: () => null } };
    vm.runInNewContext(fs.readFileSync(SCRIPTS_FILE, 'utf8'), ctx);
    return ctx.window.SCRIPTS;
}

const norm = s => String(s || '').normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '');

function safeDecode(s) {
    try { return decodeURIComponent(s); } catch (_) { return s; }
}

/** 說明欄裡出現的劇本頁網址（例：…/starfishlarp/7人/王座.html，中文可被網址編碼）。 */
function matchByLink(description, scripts) {
    const text = safeDecode(description.replace(/%(?![0-9A-Fa-f]{2})/g, '%25'));
    return scripts.find(s => s.file && text.includes('starfishlarp/' + s.file)) || null;
}

/** 這支影片對應哪個劇本（說明欄網址優先，其次標題取最長的劇本名），沒有就回傳 null。 */
function matchVideo(video, scripts) {
    return matchByLink(video.description || '', scripts) || matchScript(video.title, scripts);
}

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
    let next = now.slice(0, 10).replace(/-/g, '') + '-yt' + now.slice(11, 19).replace(/:/g, '');
    if (next === old) next += 'b'; // 同一秒內連續登記也要換新版號
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

/** --set 劇本 影片：直接登記一支影片（覆寫原值）。 */
function setVideo(target, value) {
    const scripts = loadScripts();
    const key = norm(target);
    const s = scripts.find(x => x.id === target) ||
        scripts.find(x => [x.name, x.reviewKey, path.basename(x.file || '', '.html')].map(norm).includes(key));
    if (!s) throw new Error(`找不到劇本：${target}`);
    const raw = String(value || '').trim();
    const m = raw.match(/^([\w-]{11})$/) ||
        raw.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
    if (!m) throw new Error(`看不懂影片網址：${raw}`);
    const url = videoUrl({ id: m[1], shorts: raw.includes('/shorts/') });
    if (s.youtube === url) {
        console.log(`${s.name} 已經是 ${url}，不用改`);
        return;
    }
    fs.writeFileSync(SCRIPTS_FILE, writeYoutube(fs.readFileSync(SCRIPTS_FILE, 'utf8'), s.id, url));
    loadScripts();
    bumpVersion();
    console.log(`已登記 ${s.name}：${url}`);
}

// ── 完整掃描：頻道「影片」「Shorts」分頁 + 逐支讀說明欄 ─────────────
function jsonString(raw) {
    try { return JSON.parse('"' + raw + '"'); } catch (_) { return ''; }
}

async function listChannelIds(channelId, tab) {
    const html = await fetchText(`https://www.youtube.com/channel/${channelId}/${tab}`);
    const key = (html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || [])[1];
    const clientVersion = (html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/) || [])[1] || '2.20240101.00.00';
    const ids = new Set();
    const collect = text => {
        for (const m of text.matchAll(/"videoId":"([\w-]{11})"/g)) ids.add(m[1]);
        return (text.match(/"continuationCommand":\{"token":"([^"]+)"/) || [])[1];
    };
    let token = collect(html);
    for (let page = 0; token && key && page < 30; page++) {
        const res = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${key}`, {
            method: 'POST',
            headers: { ...YT_HEADERS, 'Content-Type': 'application/json' },
            body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion, hl: 'zh-TW' } }, continuation: token })
        });
        if (!res.ok) break;
        token = collect(await res.text());
    }
    return [...ids];
}

async function fetchVideoInfo(id, shorts) {
    const html = await fetchText(`https://www.youtube.com/watch?v=${id}`);
    const details = html.slice(html.indexOf('"videoDetails"'));
    const title = jsonString((details.match(/"title":"((?:\\.|[^"\\])*)"/) || [])[1] || '');
    const description = jsonString((details.match(/"shortDescription":"((?:\\.|[^"\\])*)"/) || [])[1] || '');
    const published = (html.match(/"publishDate":"([^"]+)"/) || [])[1] || '';
    return { id, title, description, published, shorts };
}

async function listAllVideos(channelId, scripts) {
    const used = new Set(scripts.map(s => String(s.youtube || '')).join(' ').match(/[\w-]{11}/g) || []);
    const regular = await listChannelIds(channelId, 'videos');
    const shorts = await listChannelIds(channelId, 'shorts').catch(() => []);
    const all = [...regular.map(id => [id, false]), ...shorts.filter(id => !regular.includes(id)).map(id => [id, true])];
    console.log(`完整掃描：一般影片 ${regular.length} 支、Shorts ${shorts.length} 支（已登記的略過）`);
    const videos = [];
    for (const [id, isShort] of all) {
        if (used.has(id)) continue;
        try { videos.push(await fetchVideoInfo(id, isShort)); }
        catch (err) { console.log(`  ${id} 讀取失敗：${err.message}`); }
    }
    return videos;
}

async function main() {
    const setAt = process.argv.indexOf('--set');
    if (setAt >= 0) {
        setVideo(process.argv[setAt + 1], process.argv[setAt + 2]);
        return;
    }

    const scripts = loadScripts();
    let videos;
    if (process.env.YT_FEED_FILE) {
        videos = parseFeed(fs.readFileSync(process.env.YT_FEED_FILE, 'utf8'));
    } else {
        if (!process.env.YT_CHANNEL) {
            console.log('::warning::尚未設定 YT_CHANNEL，略過');
            return;
        }
        const channelId = await resolveChannelId(process.env.YT_CHANNEL);
        if (process.env.YT_FULL === '1') {
            try { videos = await listAllVideos(channelId, scripts); }
            catch (err) { console.log(`::warning::完整掃描失敗，改用 RSS：${err.message}`); }
        }
        if (!videos) {
            videos = parseFeed(await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`));
        }
    }
    console.log(`待比對 ${videos.length} 支影片`);

    const picked = new Map(); // script.id → video
    for (const v of videos) {
        const s = matchVideo(v, scripts);
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
