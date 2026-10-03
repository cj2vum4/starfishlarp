# 海星劇本殺 · 10 秒形象影片

成品：`../starfish-showreel.mp4`（1920×1080、60fps、H.264＋AAC、10.0 秒）

整支片都是程式產生的：畫面用 Canvas 2D＋three.js 逐格繪製，配樂與音效用 Node 合成，
沒有使用任何外部影音素材。用到的圖只有 repo 裡已有的 Logo（`pwa/icon-512.png`）
和《瘋兔子》主海報（`劇本資料/角色海報/`），劇本名稱、角色名、標籤、人數、難度都從 `scripts.js` 讀。

## 分鏡（150 BPM，一拍 0.4 秒）

| 時間 | 段落 | 內容 |
|------|------|------|
| 0.0–1.6 | SC.01 入口 | 羅盤環隨火花畫出、鑰匙孔亮起、「推開門，成為另一個人」，鏡頭穿過鑰匙孔 |
| 1.6–4.0 | SC.02 世界 | 王座→春晝短→瘋兔子→群星→津門遺雲→晴天神社→漓川怪談簿→沸騰跨世紀，每個世界有自己的轉場與視覺，越剪越快 |
| 4.0–6.0 | SC.03 群像 | 最後一格縮成卡片，鏡頭拉遠成 57 張劇本卡的 3D 漩渦，再排成海星，中心鑰匙孔回扣片頭 |
| 6.0–7.6 | SC.04 你 | 推理／情感／驚悚／歡樂 四格甩鏡 → 拉開 →「這一次，你是誰？」，四周浮現所有角色名 |
| 7.6–10.0 | LOGO | 文字由左而右碎成金塵，匯聚成海星 Logo，衝擊波＋光芒，品牌字以網站開場同款「字距收合」定版 |

## 重新產生

需求：Node 18+、Playwright（Chromium）、ffmpeg、python3（只有抓字型時要）。

```bash
cd promo/showreel
python3 fetch-fonts.py                 # 只有改了文案或 scripts.js 新增劇本時才需要
node render.js --out /tmp/reel-frames  # 600 張 PNG，4 核約 8 分鐘
node audio.js /tmp/soundtrack.wav
ffmpeg -framerate 60 -i /tmp/reel-frames/f%04d.png -i /tmp/soundtrack.wav \
  -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -profile:v high \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -c:a aac -b:a 256k -movflags +faststart -shortest ../starfish-showreel.mp4
```

- 直接用瀏覽器開 `index.html`（要透過 http 伺服器，例如在 repo 根目錄 `npx serve`）可以即時預覽；
  `index.html?f=480` 會停在第 480 格。
- `node render.js --only 96,300,540` 只輸出指定幾格，方便調畫面。
- 每一格由多個子格（sub-frame）累積而成，所以快速移動會有真實的動態模糊；
  同一格永遠畫出同一張圖，可以多工平行算。
- 字型（`fonts/`）是 Google Fonts 的 Noto Serif TC／Noto Sans TC 子集、Cinzel、JetBrains Mono，皆為 OFL 授權。
