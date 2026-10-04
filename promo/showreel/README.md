# 海星劇本殺 · 形象影片

| 成品 | 規格 | 分鏡檔 |
|------|------|--------|
| `../starfish-showreel.mp4` | 16:9 · 1920×1080 · 60fps · 10.0 秒 | `index.html` → `reel.js` |
| `../starfish-reel-916.mp4` | 9:16 IG Reels · 1080×1920 · 30fps · 16.0 秒，可無縫循環 | `index-916.html` → `reel-916.js` |
| `../starfish-reel-916-cover.jpg` | Reels 封面（1080×1920，片中 14.6 秒那一格） | — |

兩支片共用 `core.js`（數學、字型排版、素材、57 張劇本卡、3D 劇本牆、粒子、後製、逐格渲染）；
各格式只在自己的分鏡檔裡寫版面與時間軸，用 `Reel.use({...})` 註冊。

整支片都是程式產生的：畫面用 Canvas 2D＋three.js 逐格繪製，配樂與音效用 Node 合成，
沒有使用任何外部影音素材。用到的圖只有 repo 裡已有的 Logo（`pwa/icon-512.png`）
和《瘋兔子》主海報（`劇本資料/角色海報/`），劇本名稱、角色名、標籤、人數、難度都從 `scripts.js` 讀。

## 16:9 分鏡（150 BPM，一拍 0.4 秒）

| 時間 | 段落 | 內容 |
|------|------|------|
| 0.0–1.6 | SC.01 入口 | 羅盤環隨火花畫出、鑰匙孔亮起、「推開門，成為另一個人」，鏡頭穿過鑰匙孔 |
| 1.6–4.0 | SC.02 世界 | 王座→春晝短→瘋兔子→群星→津門遺雲→漓川怪談簿→晴天神社→沸騰跨世紀，每個世界有自己的轉場與視覺，越剪越快 |
| 4.0–6.0 | SC.03 群像 | 最後一格縮成卡片，鏡頭拉遠成 57 張劇本卡的 3D 漩渦，再排成海星，中心鑰匙孔回扣片頭 |
| 6.0–7.6 | SC.04 你 | 驚悚／推理／情感／歡樂 四格由暗到亮、在重拍上切換 → 拉開 →「這一次，你是誰？」，四周浮現所有角色名 |
| 7.6–10.0 | LOGO | 文字由左而右碎成金塵，匯聚成海星 Logo，衝擊波＋光芒，品牌字以網站開場同款「字距收合」定版 |

## 9:16 IG Reels 版（16 秒 = 40 拍 = 10 小節）

| 時間 | 段落 | 內容 |
|------|------|------|
| 0.0–2.0 | 入口 | 第一格鑰匙孔就亮著（滑過也停得住），羅盤環畫出，兩行大字「推開門，／成為另一個人」，穿過鑰匙孔 |
| 2.0–6.4 | 世界 | 同樣八個世界，直式重新構圖（春晝短、津門遺雲改直書），0.8 → 0.6 → 0.4 秒越剪越快；神社那一刀是「往上滑」 |
| 6.4–9.2 | 群像 | 卡片漩渦拉高、海星放在畫面上半，計數器在下方安全區 |
| 9.2–11.2 | 你 | 驚悚／推理／情感／歡樂 直書 2×2 四格，由暗到亮在重拍上切換，拉開 →「這一次，你是誰？」 |
| 11.2–16.0 | LOGO | 金塵匯聚成 Logo、品牌字；12.8 起預約資訊（私訊／LINE、台北·南港·新竹、IG @larp_starfish）停留約 2.5 秒；15.45 起收場，Logo 中心的鑰匙孔縮放回片頭位置，Reels 重播時接回第一格 |

- 版面避開 IG Reels 介面：上 250px、下 420px（y > 1500）、右側 x > 950 且 y 1000–1700；重要文字都在安全區內。
- 配樂同一組樂器、另一份 cue 表（`node audio.js --fmt 916`），多算 2 秒尾音再折回開頭，循環時殘響不會斷。
- IG 以 30fps 播放，所以直式版直接算 30fps（每格多個子格累積、快門 1/60 秒），不是從 60fps 抽格；要 60fps 預覽可開 `index-916.html?fps=60`。
- 響度約 -14.5 LUFS、峰值 -2.4 dBFS：IG 轉碼成 AAC 後 true peak 仍在 -1 dBTP 以下。
- 上傳時封面請選 `starfish-reel-916-cover.jpg`（不選的話 IG 會用第一格——只有鑰匙孔）。

## 光敏安全（WCAG 2.3.1）

快剪、全畫面色塊、白閃很容易超過「任一秒內不超過 3 次閃爍」的上限（含紅色閃爍）。兩支片都照這幾條做過檢查：

- 連續快切的畫面排成亮度單向變化（例：四格 驚悚→推理→情感→歡樂、16:9 快剪 津門→漓川→神社→沸騰），不要亮暗交替。
- 不用甩鏡橫越暗色格子（甩到一半只剩暗底＝多一次閃爍），改成重拍直接切、從來的方向滑入一小段。
- 亮的世界不再加白閃；故障效果的狀態以 10Hz 切換，不逐格亂跳；粉色避開「飽和紅」。
- 改了分鏡請重新量：把渲染出的 PNG 用 25% 畫面面積的滑動視窗，算線性亮度變化 ≥10%（暗態 < 0.8）與飽和紅變化的來回次數，任一秒內的轉換次數要 ≤ 6（＝3 次閃爍）。目前 16:9 最多 2 次、9:16 最多 2 次。

## 重新產生

需求：Node 18+、Playwright（Chromium）、ffmpeg、python3（只有抓字型時要）。

```bash
cd promo/showreel
python3 fetch-fonts.py                 # 只有改了文案或 scripts.js 新增劇本時才需要
# 16:9
node render.js --out /tmp/reel-frames                          # 600 張 PNG，4 核約 8 分鐘
node audio.js /tmp/soundtrack.wav
ffmpeg -framerate 60 -i /tmp/reel-frames/f%04d.png -i /tmp/soundtrack.wav \
  -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
  -c:v libx264 -preset slow -crf 16 -profile:v high \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -c:a aac -b:a 256k -movflags +faststart -shortest ../starfish-showreel.mp4

# 9:16 IG Reels
node render.js --page index-916.html --out /tmp/reel916-frames  # 480 張 PNG（30fps），約 6 分鐘
node audio.js --fmt 916 /tmp/soundtrack-916.wav
ffmpeg -framerate 30 -i /tmp/reel916-frames/f%04d.png -i /tmp/soundtrack-916.wav \
  -vf "scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
  -c:v libx264 -preset slow -crf 16 -profile:v high \
  -color_primaries bt709 -color_trc bt709 -colorspace bt709 -color_range tv \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest ../starfish-reel-916.mp4
cp /tmp/reel916-frames/f0438.png /tmp/cover.png && ffmpeg -i /tmp/cover.png -q:v 2 ../starfish-reel-916-cover.jpg
```

> 色彩：PNG 是 sRGB，轉 YUV 時要明確用 BT.709 矩陣（`out_color_matrix=bt709`）並標 `-color_range tv`；
> 只寫 `-pix_fmt yuv420p` 會用 BT.601 矩陣、卻標成 709，手機播放時深紅會偏橘。

- 直接用瀏覽器開 `index.html`／`index-916.html`（要透過 http 伺服器，例如在 repo 根目錄 `npx serve`）可以即時預覽；
  `?f=480` 會停在第 480 格。
- `node render.js --only 96,300,540` 只輸出指定幾格，方便調畫面。
- 每一格由多個子格（sub-frame）累積而成，所以快速移動會有真實的動態模糊；
  每個子格都先清成黑再畫，同一格永遠畫出同一張圖（與渲染順序、平行數無關），可以多工平行算。
- 字型（`fonts/`）是 Google Fonts 的 Noto Serif TC／Noto Sans TC 子集、Cinzel、JetBrains Mono，皆為 OFL 授權。
