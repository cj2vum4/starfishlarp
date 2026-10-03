#!/usr/bin/env python3
"""下載影片用字型（Google Fonts，OFL 授權）→ fonts/ 與 fonts/fonts.css。

中文字型只取影片實際會用到的字（scripts.js＋reel.js 內的全部 CJK 字元），
每 120 字一包向 Google Fonts 要 text= 子集（一次給太多字它會改回整套切片）。
修改 reel.js 的文案或 scripts.js 新增劇本後重跑一次即可。
"""
import os, re, subprocess, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
FAMILIES = [('NSerif', 'Noto+Serif+TC', 900), ('NSerif', 'Noto+Serif+TC', 700), ('NSans', 'Noto+Sans+TC', 500)]
LATIN = [('Cinzel', 'Cinzel:wght@400..900', '400 900', 'cinzel'), ('Mono', 'JetBrains+Mono:wght@100..800', '100 800', 'mono')]

def get(url):
    return subprocess.run(['curl', '-sSf', '-A', UA, url], check=True, capture_output=True).stdout

src = ''.join(open(os.path.join(HERE, p), encoding='utf-8').read() for p in ('../../scripts.js', 'reel.js'))
chars = sorted(set(c for c in src if ord(c) > 0x2E7F) | set('０１２３４５６７８９'))
chunks = [chars[i:i + 120] for i in range(0, len(chars), 120)]
os.makedirs(os.path.join(HERE, 'fonts'), exist_ok=True)
for f in os.listdir(os.path.join(HERE, 'fonts')):
    if f.endswith('.woff2'):
        os.remove(os.path.join(HERE, 'fonts', f))
css = []
for fam, gfam, wt in FAMILIES:
    for n, ch in enumerate(chunks):
        sheet = get(f'https://fonts.googleapis.com/css2?family={gfam}:wght@{wt}&text={urllib.parse.quote("".join(ch))}').decode()
        blocks = re.findall(r'src: url\(([^)]+)\)[^;]*;\s*unicode-range: ([^;]+);', sheet)
        assert len(blocks) == 1, f'{gfam} chunk {n}: expected 1 subset, got {len(blocks)}'
        name = f'{fam.lower()}-{wt}-{n}.woff2'
        open(os.path.join(HERE, 'fonts', name), 'wb').write(get(blocks[0][0]))
        css.append(f"@font-face{{font-family:'{fam}';src:url({name}) format('woff2');font-weight:{wt};font-display:block;unicode-range:{blocks[0][1]}}}")
for fam, gfam, wt, name in LATIN:
    sheet = get(f'https://fonts.googleapis.com/css2?family={gfam}').decode()
    url = re.findall(r'src: url\(([^)]+\.woff2)\)', sheet)[-1]  # 最後一塊＝基本拉丁 U+0000-00FF
    open(os.path.join(HERE, 'fonts', name + '.woff2'), 'wb').write(get(url))
    css.append(f"@font-face{{font-family:'{fam}';src:url({name}.woff2) format('woff2');font-weight:{wt};font-display:block}}")
open(os.path.join(HERE, 'fonts', 'fonts.css'), 'w', encoding='utf-8').write('\n'.join(css) + '\n')
print(f'{len(chars)} CJK chars in {len(chunks)} chunks; {len(css)} @font-face rules')
