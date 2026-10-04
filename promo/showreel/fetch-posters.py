#!/usr/bin/env python3
"""下載每部劇本的海報 → posters/<id>.jpg，並寫出 posters/index.json（有海報的 id 清單）。

海報網址來自 scripts.js 的 poster 欄位（多半是 i.postimg.cc 直連；也有 repo 內的相對路徑）。
統一縮成寬 600px 的 JPEG（3D 劇本牆的卡片貼圖是 480×720，600 寬就夠），整包約 4–6MB。
沒有海報（poster 為空）或下載失敗的劇本，影片會改用文字設計的卡片，不會中斷。
scripts.js 新增劇本或換海報後重跑一次即可。
"""
import json, os, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(HERE, 'posters')
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
LIST_JS = """
const vm = require('vm'), fs = require('fs');
const box = { window: {}, document: { getElementById: () => null, querySelector: () => null, addEventListener() {}, readyState: 'complete' } };
try { vm.runInNewContext(fs.readFileSync(process.argv[1], 'utf8'), box); } catch { /* 後面的 DOM 程式會失敗，資料已在 window.SCRIPTS */ }
process.stdout.write(JSON.stringify(box.window.SCRIPTS.map(s => ({ id: s.id, name: s.name, poster: s.poster || '' }))));
"""

def main():
    scripts = json.loads(subprocess.run(['node', '-e', LIST_JS, os.path.join(ROOT, 'scripts.js')], check=True, capture_output=True).stdout)
    os.makedirs(OUT, exist_ok=True)
    have, missing, failed = [], [], []
    for s in scripts:
        dst = os.path.join(OUT, s['id'] + '.jpg')
        src = s['poster'].strip()
        if not src:
            missing.append(s['name']); continue
        with tempfile.TemporaryDirectory() as td:
            if src.startswith('http'):
                tmp = os.path.join(td, 'poster')
                r = subprocess.run(['curl', '-sSfL', '--max-time', '40', '--retry', '2', '-A', UA, '-o', tmp, src], capture_output=True, text=True)
                if r.returncode:
                    failed.append(f"{s['name']}: {r.stderr.strip().splitlines()[-1] if r.stderr.strip() else 'curl ' + str(r.returncode)}"); continue
            else:
                tmp = os.path.join(ROOT, src)
                if not os.path.exists(tmp):
                    failed.append(f"{s['name']}: 找不到 {src}"); continue
            r = subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-i', tmp, '-frames:v', '1', '-vf', "scale='min(600,iw)':-2", '-q:v', '3', dst], capture_output=True, text=True)
            if r.returncode or not os.path.exists(dst):
                failed.append(f"{s['name']}: 圖片轉檔失敗 {r.stderr.strip()[:120]}"); continue
        have.append(s['id'])
    # 清掉已經不在 scripts.js 的舊海報
    ids = {s['id'] for s in scripts}
    for f in os.listdir(OUT):
        if f.endswith('.jpg') and f[:-4] not in ids:
            os.remove(os.path.join(OUT, f))
    json.dump(sorted(have), open(os.path.join(OUT, 'index.json'), 'w'), indent=0)
    print(f'海報 {len(have)}/{len(scripts)} 部')
    if missing: print('scripts.js 沒有海報（用文字卡）：' + '、'.join(missing))
    if failed:
        print('下載失敗（用文字卡）：\n  ' + '\n  '.join(failed))
        sys.exit(1 if len(failed) == len(scripts) - len(missing) else 0)

if __name__ == '__main__':
    main()
