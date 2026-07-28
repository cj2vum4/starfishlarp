# 海星劇本殺 · 前端專案全面審查報告

> 審查日期：2026-07-28
> 審查範圍：`cj2vum4/starfishlarp` 全部 196 個 git 追蹤檔案（64 個 HTML、10 個共用 JS、2 個 CSS、設定檔、靜態資源）
> 審查方式：靜態閱讀 + 資料完整性腳本驗證 + Chromium (Playwright) 實際載入 11 個頁面觀察 console / 網路 / 版面
> **本階段未修改任何專案檔案**（僅新增此報告）

---

## 1. Executive Summary

### 整體健康度：**中等偏下（C+）**

這是一個**完成度相當高、但地基脆弱**的純前端專案。它做對了很多事——單一資料來源、PWA、Service Worker 快取策略、共用 3D 特效引擎有 WebGL fallback 與 reduced-motion 尊重、玩本記錄表單有 honeypot 與完整 aria 標記。以一個「Vibe Coding + 個人興趣」專案來說，工程品質明顯高於平均。

但同時存在**若干立即傷害使用者與經營者的問題**，而且這些問題都不是「風格不夠好」，是「功能真的壞掉」或「資料真的外洩」。

### 最嚴重的問題（需要立刻處理）

| # | 問題 | 一句話說明 |
|---|------|-----------|
| 1 | **訂位表單 100% 失敗** | `主持人資訊.html` 的 `<form action="https://formspree.io/f/YOUR_FORM_ID">` 佔位符從未替換。這是全站唯一的線上訂位入口（頁面上有 4 個「立即訂位」CTA 導向它），**每一位填完表單的客人都只會看到「表單送出失敗」的 alert**。這是直接的生意損失。 |
| 2 | **榮譽牆有兩處可被實際執行的 Stored XSS** | 已在無頭瀏覽器實測成功執行注入的 JS。攻擊來源是「任何人都能填的公開表單 / 公開 Apps Script 端點」。 |
| 3 | **76 MB 正版劇本 PDF 公開可下載** | `劇本資料/` 內含角色劇本、搜證卡、手冊、台詞卡、故事背景，全部隨 GitHub Pages 公開。這同時是**劇透風險**與**著作權風險**。 |
| 4 | **GM 頁面零防護且從公開頁一鍵直達** | `7人/天才在左我在右.html` 有明顯按鈕連到含全部 GM 筆記與答案的 `-GM.html`。玩家點下去就爆雷。 |
| 5 | **榮譽牆會因為第三方 CDN 失敗而整頁空白** | 實測：Tone.js 載不到 → `ReferenceError: Tone is not defined` → 整個初始化中斷 → **0 張卡片、玩家清單永遠停在「讀取資料中」**。 |

### 最值得優先改善的部分

1. **修好會直接影響營收與名譽的三件事**：訂位表單、榮譽牆 XSS、劇本 PDF 下架。
2. **把「第三方 CDN 掛掉就整頁死」的依賴改成有 fallback**（Tone.js、PapaParse、Supabase JS、Tailwind、AOS 全都是硬依賴）。
3. **修好篩選/排序的兩個實測 bug**（預設順序無法還原、標籤分裂導致漏本）。

### 是否適合繼續維持純前端？

**適合，但有三個功能必須認清它們「現在不是安全的」：**

- ✅ 劇本瀏覽、篩選、介紹頁、PWA — 純前端完全足夠，做得也好。
- ⚠️ 玩本記錄 / 榮譽牆 — 純前端 + Google Sheet 可以繼續用，但要接受「任何人都能偽造記錄」，並且**必須先做輸出轉義**。
- ❌ GM 工具 / 劇本內容資料庫 / 訂位表單 — 這三個本質上需要「只有特定人能看 / 能寫」，純前端做不到。目前的做法等於沒有防護。

### 是否存在需要立即處理的安全問題？

**是。** 依嚴重度排序：

1. 榮譽牆 Stored XSS（已實測可執行任意 JS）
2. `劇本資料/` 76 MB 劇本 PDF 公開
3. Supabase `game_state` / `player_state` 表可被任何人讀寫（anon key 公開在 3 個檔案中）
4. 玩家記錄資料經由 3 個不受信任的第三方 CORS proxy 轉送

**好消息：git 歷史中沒有真正的機密外洩。** 全歷史掃描只找到 `.env.example` 中的佔位字串（`sk-ant-api03-...`、`eyJhbGciOiJIUzI1...`），沒有真實金鑰被提交過。Supabase 使用的是設計上就可公開的 `sb_publishable_` key，問題不在「金鑰洩漏」而在「RLS 政策放太寬」。

---

## 2. 專案架構摘要

### 2.1 技術棧

| 項目 | 實際使用 |
|------|---------|
| 前端框架 | **無**（原生 HTML + 原生 JS，classic script，非 module） |
| 語言 | JavaScript ES2017+（`async/await`、optional chaining、template literal）。**無 TypeScript** |
| CSS 方案 | **5 套並存**：`index.css`（首頁）、`honor-form.css`（表單頁）、`榮譽牆.html` 內嵌 771 行 CSS、Tailwind Play CDN（`劇本介紹`/`主持人資訊`）、57 個劇本頁各自的 `<style>` |
| UI Library | 無（Tailwind CDN 僅 2 頁使用） |
| Router | **無**。純多頁靜態網站（MPA），每頁一個 `.html` |
| 狀態管理 | 無。全域變數 + `window.SCRIPTS` |
| 資料儲存 | Google Sheet（CSV 讀 / Apps Script 寫）、Supabase Postgres（劇本 OCR 內容 + GM 遊戲狀態）、`localStorage`、`sessionStorage` |
| 第三方服務 | Google Sheets、Google Apps Script ×2、Google Calendar (iframe)、Supabase、postimg.cc（482 張圖）、Formspree（**未設定**）、cdnjs、unpkg、jsDelivr、corsproxy.io、allorigins.win、codetabs.com |
| 建置工具 | **無**。無 bundler、無 transpile、無 minify |
| 套件管理 | **無**。無 `package.json`、無 lock file。唯一 vendored 依賴：`vendor/three.min.js`（670 KB，手動放置） |
| 部署 | GitHub Pages（`https://cj2vum4.github.io/starfishlarp/`），直接服務 repo 根目錄 |
| 測試 | **無** |
| Lint / Formatter / 型別檢查 | **無** |
| 其他 | `ocr_batch.py`（本機 Python 工具，PDF → Claude Vision → Supabase） |

### 2.2 資料夾結構

```
starfishlarp/
├── index.html                    首頁（劇本總覽 + 篩選 + 3D hero）
├── 榮譽牆.html                   玩家記錄牆（1618 行，CSS+HTML+JS 全在一檔）
├── 新增玩本記錄.html              玩本記錄表單
├── 劇本介紹.html                 新手指南（Tailwind CDN）
├── 主持人資訊.html                主持人介紹 + 訂位（Tailwind CDN）
├── 疯兔子搜尋.html                瘋兔子線索搜尋（連 Supabase）※ 檔名用簡體「疯」
├── offline.html                  PWA 離線頁
│
├── scripts.js                    ★ 單一資料來源：window.SCRIPTS（53 筆）
├── scripts-data.js               首頁卡片渲染 + 篩選 + 排序
├── reviews.js                    劇本頁「💬 玩家評價」彈窗（共用）
├── play-record.js                玩本記錄表單邏輯
├── play-record-config.js         Apps Script 端點設定
├── hero.js                       首頁抽屜/篩選標籤橋接 + Three.js hero
├── fx3d.js                       共用 3D 背景特效引擎（664 行）
├── bgm-control.js                BGM 失焦自動停止
├── pwa.js                        PWA 安裝提示 + SW 註冊
├── service-worker.js             App Shell + stale-while-revalidate
├── index.css / honor-form.css    2 支共用 CSS
│
├── 5人/ 6人/ 7人/ 8人以上/        57 個劇本頁 + 52 個 MP3（共 265 MB）
├── 劇本資料/                     ⚠️ 27 個檔案 / 76 MB 正版劇本 PDF、台詞卡、線索、角色海報
├── img/cards/                    27 張卡牌圖（22 MB，僅天才在左 GM/player 使用）
├── pwa/                          5 個 PWA icon
├── vendor/three.min.js           670 KB（deprecated build）
│
├── manifest.webmanifest
├── supabase_schema.sql           ⚠️ 只定義 cards 表，缺 game_state / player_state
├── GoogleAppsScript_玩本記錄.gs   Apps Script 原始碼備份
├── ocr_batch.py                  本機 OCR 工具
├── .env.example / .gitignore / README.md / CLAUDE.md
```

**結構評估：**

| 檢查項 | 結論 |
|--------|------|
| 是否容易理解 | ✅ 是。按人數分資料夾、共用檔放根目錄，對非工程背景維護者很直覺 |
| 相同用途檔案散落 | ⚠️ 部分。CSV 解析、`escapeHtml`、Google Sheet URL 各有 2 份實作 |
| 命名不一致 | ⚠️ `疯兔子搜尋.html`（簡體）vs `瘋兔子_主持.html`（繁體）；`天才在左我在右-GM.html`（連字號）vs `瘋兔子_主持.html`（底線） |
| 資料夾層級過深 | ✅ 否。最深 2 層 |
| 頁面與 Component 混雜 | ⚠️ 無 component 概念（合理，因為沒有框架），但 `榮譽牆.html` 把 CSS/HTML/邏輯/資料全塞一檔 |
| 商業邏輯寫在 UI 中 | ⚠️ 是。CSV 解析、排行榜計算、稱號規則全在 `榮譽牆.html` 的 `<script>` 內 |
| 重複 / 過時檔案 | ⚠️ `6人/太陽問卷.html`、`6人/瘋兔子_主持.html` 無任何入口連結 |
| 未被使用的檔案 | 見 §7 |

### 2.3 頁面與功能地圖

| 功能 | 入口 | 頁面 | 資料來源 | 儲存 | 瀏覽器依賴 | 第三方 | 狀態 |
|------|------|------|---------|------|-----------|--------|------|
| 劇本總覽 / 篩選 / 排序 | 首頁 | `index.html` + `scripts-data.js` + `hero.js` | `scripts.js` | 無 | — | postimg.cc | ⚠️ 排序有 bug（F-01） |
| 3D Hero | 首頁 | `hero.js` | 程序化 Canvas | 無 | WebGL | — | ✅ 正常 |
| 劇本詳細頁 ×53 | 卡片「查看詳情」 | `N人/*.html` | 頁面內硬編 | 無 | WebGL / Audio | postimg.cc | ✅ 正常 |
| 玩家評價彈窗 | 各劇本頁 FAB | `reviews.js` | Google Sheet CSV | `sessionStorage` 10 分鐘 | — | Google | ⚠️ 1 頁對不上（F-07） |
| 榮譽牆 | 首頁抽屜 | `榮譽牆.html` | Google Sheet CSV | 無 | — | cdnjs ×2、3 個 CORS proxy | ❌ XSS + CDN 單點（S-02 / S-03） |
| 新增玩本記錄 | 榮譽牆按鈕 | `新增玩本記錄.html` + `play-record.js` | `scripts.js` | Google Sheet（寫）、`localStorage`（記名字） | — | Apps Script | ⚠️ 假成功（F-03） |
| 劇本介紹 | 首頁抽屜 | `劇本介紹.html` | 靜態 | 無 | — | Tailwind CDN、AOS | ⚠️ CDN 硬依賴 |
| 主持人資訊 | 首頁抽屜 | `主持人資訊.html` | 靜態 | 無 | — | Tailwind、AOS、Google Calendar、Formspree | ❌ **訂位表單完全失效**（S-01） |
| GM 控台（天才在左） | 劇本頁按鈕 | `7人/天才在左我在右-GM.html` | Supabase | Supabase + `localStorage` | — | jsDelivr、Supabase | ❌ 無存取控制（S-05） |
| 玩家端（天才在左） | 劇本頁按鈕 | `7人/天才在左我在右-player.html` | Supabase | 同上 | — | 同上 | ❌ 同上 |
| 瘋兔子線索搜尋 | **無入口**（僅 `瘋兔子_主持.html` 連） | `疯兔子搜尋.html` | Supabase `cards` | 無 | — | Supabase | ❌ 劇本內容公開（S-06） |
| 太陽問卷（前測） | **無入口** | `6人/太陽問卷.html` | 靜態演算法 | Apps Script | — | Apps Script | ❓ 需人工確認 |
| PWA 安裝 / 離線 | 導覽列按鈕 | `pwa.js` + `service-worker.js` + `offline.html` | — | Cache Storage | Service Worker | — | ✅ 正常 |
| BGM | 各劇本頁 | `<audio>` + `bgm-control.js` | 本地 MP3 | — | Audio | — | ⚠️ 無音量控制、停了不會回來（U-01） |

### 2.4 資料流

```
                     ┌─────────────────────────────────────┐
                     │  scripts.js  window.SCRIPTS (53 筆) │  ← 唯一劇本資料來源
                     └──────┬───────────┬──────────┬───────┘
                            │           │          │
              scripts-data.js       榮譽牆.html   play-record.js
              (首頁卡片)            (卡片清單)    (劇本+角色下拉)
                                        │              │
   Google Form ──┐                      │              │
   新增玩本記錄  ─┴──► Apps Script ──► Google Sheet ────┤
                        (寫入)          │  (CSV 發布)   │
                                        ▼               │
                     ┌──────────────────────────────────┴──┐
                     │  CSV → 榮譽牆.html (PapaParse)       │
                     │      → reviews.js (自寫 parser)      │
                     └──────────────────────────────────────┘

   PDF/JPG ──► ocr_batch.py ──► Supabase cards ──► 疯兔子搜尋.html
   GM 操作 ◄──────────────────► Supabase game_state / player_state ◄──── 玩家端
```

**觀察：**
- `window.SCRIPTS` 作為單一資料來源的設計**很好**，53 筆資料無重複 id / file / reviewKey，53 個 `file` 路徑全部存在。
- 但**同一份 Google Sheet CSV 被兩套不同的解析器讀取**（`榮譽牆.html` 用 PapaParse、`reviews.js` 用自寫 parser），且轉義策略不同（`reviews.js` 有 `escapeHtml`、`榮譽牆.html` 沒有）→ 這正是 XSS 只發生在榮譽牆的原因。
- Supabase 這條線與主資料流**完全隔離**，schema 檔也沒跟上實際使用的表。

### 2.5 部署

- GitHub Pages，服務 repo 根目錄，無 build step。
- **部署量：357 MB**（MP3 ≈ 265 MB、劇本 PDF 76 MB、卡牌圖 22 MB）。`.git` 亦達 350 MB。
- 無 `404.html`、無 `robots.txt`、無 `sitemap.xml`、無 `.nojekyll`、無 `.github/workflows`。
- 快取策略：全站共用 JS/CSS 以 `?v=YYYYMMDD` 手動進版；`service-worker.js` 的 `CACHE_VERSION` 需同步（`CLAUDE.md` 有明文規範，**目前有 1 處違反**，見 D-02）。

---

## 3. 正向發現（做得好的地方）

這個專案有相當多值得保留、甚至值得其他專案學習的設計：

1. **`window.SCRIPTS` 單一資料來源落實得很徹底。** 53 筆資料、3 個消費端（首頁卡片 / 榮譽牆 / 玩本記錄表單）全部自動產生。腳本驗證確認：無重複 `id`、無重複 `file`、無重複 `reviewKey`、53 個 HTML 路徑全部存在、53 筆都有海報。這在 Vibe Coding 專案裡非常罕見。

2. **`fx3d.js` 是本專案工程品質最高的檔案。** 它同時做到：`prefers-reduced-motion` 直接不啟動、WebGL 建立失敗自動 fallback 回原 2D、行動裝置自動降密度並限制 DPR、分頁隱藏時暫停渲染、Three.js 路徑由自身 `src` 推導（任何目錄深度都正確）、自架 vendor 不依賴外部 CDN。

3. **`新增玩本記錄.html` + `play-record.js` 的表單品質很好。** 每個欄位都有 `<label for>`、`aria-describedby`、`role="status"` + `aria-live="polite"` 的動態載入提示、honeypot 反機器人欄位、`localStorage` 記住暱稱且有 try/catch（無痕模式不會炸）、送出前檢查 `navigator.onLine`、成功後 focus 移到成功面板。

4. **Service Worker 策略選得對。** 導覽用 network-first（內容永遠新）、靜態資源用 stale-while-revalidate、runtime cache 有 80 筆上限並會 trim、**刻意不忽略 query string**（因為 `?v=` 就是全站失效機制）——而且原始碼裡有註解說明為什麼。

5. **`CLAUDE.md` 是一份真正有用的專案文件。** 明確定義了新增劇本的完整流程、資料欄位規格、主題色對照表、「每頁獨立設計、刻意不共用 CSS」的架構決策理由，以及進版號時必須同步改 `service-worker.js` 的陷阱。

6. **git 歷史乾淨。** 全歷史掃描無真實金鑰外洩，且看得出有主動清理（`homepage-overrides.js`、`jinmen-media.js`、`script-page.css`、一個過期的 workflow 都已刪除）。

7. **`reviews.js` 的轉義是對的。** `escapeHtml()` 涵蓋 `& < > " '` 五個字元，且在所有插值點都有呼叫。`疯兔子搜尋.html` 的 `highlight()` 也做對了關鍵細節——**先轉義再套 `<mark>`**，順序反了就會有洞。

8. **`GoogleAppsScript_玩本記錄.gs` 有防禦性設計。** honeypot 檢查、必填驗證、評價值 `/^[1-5]$/` 白名單、控制字元過濾、長度截斷、表頭自動補齊、相容舊 Google Form 的多個「角色」欄位。

9. **首頁開場動畫的觸發條件考慮得很細緻。** 重整或本 session 首次進站才播、從劇本頁返回不重播（避免煩人）、尊重 `prefers-reduced-motion`，而且用 inline `<style>#intro{display:none}` 做保底以防外部 CSS 被快取成舊版。

10. **PWA 完整度高。** manifest 齊全（含 maskable icon）、離線頁有品牌設計、iOS 有專屬「加入主畫面」引導、新版 SW 裝好自動接管並重整。

---

## 4. 問題總覽表

| ID | 優先級 | 面向 | 問題摘要 | 檔案位置 | 影響 | 成本 | 風險 |
|----|--------|------|---------|---------|------|------|------|
| S-01 | **P0** | 功能/商業 | 訂位表單 action 仍是 `YOUR_FORM_ID` 佔位符，送出必失敗 | `主持人資訊.html:503` | 全站唯一線上訂位入口 100% 失效 | XS | 低 |
| S-02 | **P0** | 安全 | 榮譽牆兩處 `innerHTML` 未轉義 → Stored XSS（已實測執行） | `榮譽牆.html:1157,1221` | 任意 JS 在所有訪客瀏覽器執行 | S | 低 |
| S-04 | **P0** | 安全/法務 | 76 MB 正版劇本 PDF 隨 Pages 公開下載 | `劇本資料/`（27 檔） | 劇透 + 著作權風險 | S | 中 |
| S-03 | **P1** | 可靠性 | Tone.js CDN 失敗 → 榮譽牆整頁空白（實測 0 卡片） | `榮譽牆.html:8-10,893` | 榮譽牆完全不可用 | S | 低 |
| S-05 | **P1** | 安全 | GM 頁無存取控制，且從公開劇本頁一鍵直達；Supabase 表可匿名讀寫 | `7人/天才在左我在右{.,-GM,-player}.html` | 爆雷 + 任何人可竄改場次 | M | 中 |
| S-06 | **P1** | 安全/法務 | 瘋兔子全劇本 OCR 內容存於公開可讀 Supabase 表 | `疯兔子搜尋.html:230-231` 等 3 檔 | 整本劇本可被 dump | S | 低 |
| S-07 | **P1** | 隱私 | 玩家記錄經 3 個不受信任第三方 CORS proxy 轉送 | `榮譽牆.html:868-873` | 暱稱/心得/日期外流 | S | 低 |
| F-01 | **P1** | 功能 | 「預設順序」與「重置篩選」無法還原原始排序（實測） | `scripts-data.js:286-332` | 排序後回不去，只能重整 | S | 低 |
| F-02 | **P1** | 功能 | 5 頁 ESC 鍵導向不存在的 `<子資料夾>/index.html` → 404 | 5 個劇本頁 | 按 ESC 就掉到 404 | XS | 低 |
| F-03 | **P1** | 功能 | `mode:'no-cors'` 使送出結果無法判斷，永遠顯示成功 | `play-record.js:171-185` | 記錄遺失但使用者不知情 | M | 中 |
| F-04 | **P1** | 可靠性 | jsDelivr 失敗 → GM/player 頁 `createClient` throw，整頁死 | `7人/天才在左我在右-GM.html:422,916` | 開場當下工具全掛 | S | 低 |
| D-01 | **P1** | 部署 | 部署量 357 MB（MP3 265 MB + PDF 76 MB） | 全 repo | 逼近 Pages 軟上限、clone 極慢 | M | 中 |
| F-05 | **P2** | 功能/資料 | 標籤體系分裂（新手/新手友善…），篩選會漏本 | `scripts.js` + `index.html:251-262` | 篩「新手」漏掉 5 本 | S | 低 |
| F-06 | **P2** | 資料 | 角色數與人數不符（病嬌男孩 7人1角、吾皇在上 8人9角） | `scripts.js` | 記錄表單角色選項錯誤 | XS | 低 |
| F-07 | **P2** | 功能 | 瘋兔子頁評價名稱解析對不上 reviewKey | `6人/瘋兔子白又白砍下腦袋飛起來.html` | 該劇本評價永遠空白 | XS | 低 |
| F-08 | **P2** | 功能 | 空狀態判斷字串永不成立 | `榮譽牆.html:1522` | 無資料時卡在「讀取資料中」 | XS | 低 |
| A-01 | **P2** | A11y | 9 個 `<a onclick>` 無 `href` | `index.html:107,111,115,148,161,174,310-312` | 鍵盤不可用、無指標游標 | XS | 低 |
| A-02 | **P2** | A11y | 主要互動元件無 focus 樣式 | `index.css:337-358,391` | 鍵盤使用者看不到焦點 | XS | 低 |
| A-03 | **P2** | A11y | 57 個劇本頁僅 1 頁有 `prefers-reduced-motion` | 各劇本頁 `<style>` | 前庭障礙使用者不適 | M | 低 |
| A-04 | **P2** | A11y | 評價彈窗無 focus trap / 焦點回復 / dialog 語意 | `reviews.js:126-152` | 螢幕閱讀器與鍵盤體驗差 | S | 低 |
| P-01 | **P2** | 效能 | `vendor/three.min.js` 670 KB 且為 deprecated build | `vendor/`、54 頁 | 每頁多 670 KB + console 警告 | S | 中 |
| P-02 | **P2** | 效能 | 48 頁 `<audio autoplay>` 無 `preload` 控制 | 各劇本頁 | 每次瀏覽下載 2–14 MB | XS | 低 |
| P-03 | **P2** | 效能 | 441 張圖僅 23 張 lazy、0 張有 width/height | 各劇本頁 | CLS + 首屏過重 | M | 低 |
| P-04 | **P2** | 效能 | Tone.js 14.7.77 整包載入只為 2 個點擊音效 | `榮譽牆.html:10` | ~300 KB 浪費 | S | 低 |
| P-05 | **P2** | 可靠性 | 482 張圖全押 postimg.cc 單一免費圖床，無 fallback | 全站 | 圖床掛掉全站無圖 | L | 中 |
| C-01 | **P2** | 可維護性 | `榮譽牆.html` 單檔 1618 行（CSS+HTML+JS+資料） | `榮譽牆.html` | 難維護、易衝突 | M | 中 |
| C-02 | **P2** | 可維護性 | CSV parser / `escapeHtml` / Sheet URL 各有 2 份 | `榮譽牆.html`、`reviews.js` | 修一邊漏一邊（XSS 即此因） | S | 低 |
| D-02 | **P2** | 部署 | `榮譽牆.html` 載入 `scripts.js` 無 `?v=` | `榮譽牆.html:12` | PWA 使用者拿到舊劇本資料 | XS | 低 |
| U-01 | **P2** | UX | BGM 首次點擊即解除靜音、無音量/靜音鈕、停了不會回來 | 52 個劇本頁 + `bgm-control.js` | 突然放音樂且關不掉 | M | 中 |
| U-02 | **P2** | UX | 榮譽牆便利貼 resize 即全清 | `榮譽牆.html:1600-1609` | 手機捲動時便利貼消失 | XS | 低 |
| I-01 | **P2** | SEO/分享 | `og:url` / `twitter:url` 仍是 `https://example.com/` | `主持人資訊.html:14,21` | LINE/FB 分享預覽壞掉 | XS | 低 |
| I-02 | **P2** | SEO | 56/57 劇本頁無 description、僅 1 頁有 og:*；無 sitemap/robots/404 | 各劇本頁、repo 根 | 搜尋與分享效果差 | M | 低 |
| C-03 | **P3** | 死碼 | `bubbleColors` 9 色陣列完全未使用 | `榮譽牆.html:844-854` | 誤導維護者 | XS | 低 |
| C-04 | **P3** | 死碼 | 5 頁檢查不存在的 `#title` → 每次載入 console.warn | 5 個劇本頁 | console 噪音 | XS | 低 |
| C-05 | **P3** | 效能 | `hero.js` 每次分頁切回可能疊加一條 rAF 迴圈 | `hero.js:194-197` | CPU/電力浪費 | XS | 低 |
| K-01 | **P3** | 工程 | 無 package.json / lint / test / CI / Node 版本宣告 | repo 根 | 無自動防呆 | S | 低 |
| K-02 | **P3** | 安全 | `.gitignore` 只有 `.claude/`，未忽略 `.env` | `.gitignore` | 未來誤提交金鑰風險 | XS | 低 |
| K-03 | **P3** | 一致性 | `supabase_schema.sql` 缺 `game_state`/`player_state` | `supabase_schema.sql` | 無法重建環境 | XS | 低 |
| K-04 | **P3** | 過時 | `ocr_batch.py` 使用 `claude-opus-4-8`（過時 ID） | `ocr_batch.py:136` | 未來呼叫失敗 | XS | 低 |
| O-01 | **P3** | 文件 | README 是流水帳；「總共47個劇本」與實際 53 不符 | `README.md` | 新手無從上手 | S | 低 |
| L-01 | **P3** | 資產 | 龍宴 BGM 走 GitHub Releases，與其他 52 頁不一致；且有錯誤註解 | `8人以上/龍宴.html:751`、`6人/那一束月光.html:704` | 策略混亂 | XS | 低 |
| Q-01 | **P3** | 孤兒 | `太陽問卷.html`、`瘋兔子_主持.html` 無任何入口 | 2 個劇本頁 | 需人工確認 | XS | 低 |
| U-03 | **P3** | 一致性 | 5 套視覺系統並存（共用頁之間） | 共用頁 | 拼接感 | L | 中 |
| P-06 | **P3** | 安全 | 82/84 個 `target="_blank"` 缺 `rel="noreferrer"` | 全站 | referrer 洩漏 | XS | 低 |
| I-03 | **P3** | 一致性 | `lang` 屬性 `zh-Hant` 與 `zh-TW` 混用 | 各頁 | 語音合成/翻譯判斷 | XS | 低 |
| P-07 | **P4** | 效能 | Tailwind Play CDN 用於正式環境 | 2 頁 | FOUC + 執行期編譯 | M | 中 |

---

## 5. 詳細問題說明

### S-01 · 訂位表單使用未替換的 Formspree 佔位符，送出必定失敗

- **優先級**：P0
- **問題面向**：功能正確性 / 商業影響 / 假功能
- **檔案位置**：`主持人資訊.html:497-503`、提交處理 `主持人資訊.html:764-786`
- **相關函式**：`initContactForm()`
- **發現依據**：
  ```html
  <!--
      IMPORTANT: To make this form work, you need to:
      1. Go to https://formspree.io/ and create a new form.
      2. Get your form's endpoint URL (e.g., https://formspree.io/f/xxxxxxxx).
      3. Replace the placeholder "YOUR_FORM_ID" below with your actual form ID.
  -->
  <form id="booking-form" ... action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
  ```
  提交處理器會 `fetch(form.action)`，Formspree 對不存在的 form ID 回傳 404 → `response.ok === false` → 走到 `alert('表單送出失敗，請稍後再試或直接聯絡我。')`。
- **問題說明**：這是**整站唯一的線上訂位入口**。`主持人資訊.html` 中「立即訂位」CTA 出現 4 次（桌機導覽列、手機選單、Hero 區、固定底部 sticky CTA），全部錨點到 `#contact` 這張表單。表單收集姓名、Email、想玩的劇本、預計人數、希望日期時間、希望地點——是完整的商業詢問單。
- **使用者影響**：客人認真填完 6 個欄位、按下「送出訂位需求」，得到的是一個瀏覽器原生 alert 說「表單送出失敗」。多數人不會再去找 Email 或 LINE，直接流失。
- **技術影響**：無資料進入任何系統，也沒有任何監控會發現這件事。
- **建議修正方式**：三選一，優先序如下。
  1. **最省事**：到 formspree.io 建立表單，把 `YOUR_FORM_ID` 換成真實 ID（免費方案每月 50 封）。
  2. **與現有基礎一致**：改用已有的 Google Apps Script 模式（複製 `GoogleAppsScript_玩本記錄.gs` 的結構寫入另一個試算表分頁），這樣不新增第三方依賴。
  3. **最快止血**：先把表單換成明確的 LINE / Email 引導區塊（Email `starfishlarp@gmail.com` 與 LINE 連結頁面上已有），等真正接好再放回來。
- **建議修改範例**（方案 1）：
  ```html
  <form id="booking-form" action="https://formspree.io/f/實際ID" method="POST">
  ```
  同時建議在提交處理加上端點健檢，避免同樣的事再發生：
  ```js
  if (form.action.includes('YOUR_FORM_ID')) {
      alert('線上訂位維護中，請透過 LINE 或 Email 聯絡我。');
      return;
  }
  ```
- **修改成本**：XS（換 ID 5 分鐘）～ S（改走 Apps Script 半天）
- **修改風險**：低
- **驗證方式**：實際填寫並送出一次，確認 (a) 顯示成功訊息、(b) 收件端真的收到。
- **是否需要人工確認**：**是** — 需要專案擁有者決定用哪個方案並提供帳號。

---

### S-02 · 榮譽牆兩處 Stored XSS（已實測可執行任意 JS）

- **優先級**：P0
- **問題面向**：安全性（Stored XSS）
- **檔案位置**：`榮譽牆.html:1157-1163`（印章）、`榮譽牆.html:1221-1225`（排行榜）
- **相關函式**：`updateWallForPlayer()`、`updateLeaderboard()`
- **發現依據**：兩處直接把 CSV 欄位插進 `innerHTML`，沒有任何轉義：
  ```js
  // 榮譽牆.html:1157 — record.character 與 record.date 來自表單
  stamp.innerHTML = `
      <span class="stamp-character">${record.character}</span>
      ...
      <span class="stamp-date">${record.date}</span>
  `;

  // 榮譽牆.html:1221 — player.name 來自表單
  li.innerHTML = `
      <span class="rank">${rankDisplay}</span>
      <span class="player-name" data-player="${player.name}">${player.name}${titleHtml}</span>
      <span class="play-count">${player.count} 次</span>
  `;
  ```
  **實測驗證**（Playwright + 攔截 CSV 回應注入 payload）：
  ```
  XSS via player name  (leaderboard innerHTML): true
  leaderboard html sample: <span class="player-name" data-player="&lt;img src=x ...&gt;">
                           <img src="x" onerror="window.__XSS_NAME=1">...
  XSS via 角色 field  (stamp innerHTML): true
  stamp html sample: <span class="stamp-character"><img src="x" onerror="window.__XSS_CHAR=1"></span>
  ```
  兩個 payload 都真的執行了。
- **問題說明**：資料鏈是「**任何人**都能填的公開表單 → Google Sheet → 公開 CSV → 榮譽牆 `innerHTML`」。攻擊面有兩個入口：(a) 原本的 Google Form；(b) `play-record-config.js` 中公開的 Apps Script `/exec` 端點——它部署為「所有人皆可存取」，任何人都能直接 POST 任意 `name` / `character` 值。`GoogleAppsScript_玩本記錄.gs:157` 的 `clean_()` 只移除控制字元、trim、截斷長度，**不做 HTML 轉義**。
- **使用者影響**：造訪榮譽牆的每一位玩家，瀏覽器都會執行攻擊者植入的 JS。此站無登入機制，所以沒有 session 可竊，但足以做到：頁面塗改、假造彈窗騙取聯絡資訊、導向釣魚站、竊取 `localStorage` 中的暱稱。
- **技術影響**：一筆惡意資料就能污染整個榮譽牆，且因為資料在 Google Sheet 上，重新整理也不會消失，必須手動去 Sheet 刪列。
- **建議修正方式**：`reviews.js` 已經有正確的 `escapeHtml()`（涵蓋 `& < > " '`）。把它抽成共用檔，兩處都用。**注意 `data-player="${player.name}"` 在屬性內，必須轉義 `"` 才安全**——`reviews.js` 的版本有處理。
- **建議修改範例**：
  ```js
  // 新增 escape-html.js（共用），內容取自 reviews.js:261
  window.escapeHtml = function (s) {
      return String(s == null ? '' : s)
          .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
          .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  };

  // 榮譽牆.html:1157
  stamp.innerHTML = `
      <span class="stamp-character">${escapeHtml(record.character)}</span>
      <div class="stamp-divider"></div>
      <div class="stamp-rating">${generateStars(record.rating)}</div>
      <div class="stamp-divider"></div>
      <span class="stamp-date">${escapeHtml(record.date)}</span>
  `;

  // 榮譽牆.html:1221
  const safeName = escapeHtml(player.name);
  li.innerHTML = `
      <span class="rank">${rankDisplay}</span>
      <span class="player-name" data-player="${safeName}">${safeName}${titleHtml}</span>
      <span class="play-count">${player.count} 次</span>
  `;
  ```
  **建議同時在 Apps Script 端加白名單**（縱深防禦），因為端點是公開的：
  ```js
  // GoogleAppsScript_玩本記錄.gs 的 clean_() 之後
  function stripTags_(v) { return String(v).replace(/[<>]/g, ''); }
  ```
- **修改成本**：S（前端 2 處 + 抽共用檔 + 進版號；Apps Script 再半小時）
- **修改風險**：低（純輸出層，不動資料流）
- **驗證方式**：在 Google Sheet 手動加一列，角色欄填 `<img src=x onerror=alert(1)>`，重新載入榮譽牆，確認畫面上顯示的是**文字**而非執行 alert。
- **是否需要人工確認**：否（修法明確）。但**建議人工檢查現有 Sheet 是否已有惡意資料**。

---

### S-04 · 76 MB 正版劇本 PDF 隨 GitHub Pages 公開下載

- **優先級**：P0
- **問題面向**：安全性 / 法務 / 靜態資源
- **檔案位置**：`劇本資料/`（27 個檔案，75,988 KB）
- **發現依據**：`git ls-files 劇本資料` 列出的內容包含：
  - `《疯兔子》手册.pdf`（4.1 MB）— GM 手冊
  - `简菲菲_compressed.pdf`、`简辞_compressed.pdf`、`姜沁_compressed.pdf`、`王之喻_compressed.pdf`、`林云书_compressed.pdf`、`夏瞳_compressed.pdf`（各 7～8 MB）— **六本個人角色劇本**
  - `线索/搜证卡.pdf`（6.2 MB）、`线索/故事背景.pdf`、`线索/飞升仪式.pdf`、`线索/触发线索.pdf`、`线索/还原线索.pdf`、`线索/游戏规则.pdf`、`线索/卡牌线索.pdf`、`线索/第四幕·双搜.docx`
  - `台词卡/` 5 個 PDF、`角色海報/` 7 張 JPG

  GitHub Pages 直接服務 repo 根目錄，因此這些檔案全部可透過
  `https://cj2vum4.github.io/starfishlarp/劇本資料/<檔名>` 直接下載，無需任何認證。
- **問題說明**：這是**購買的正版劇本本體**，不是宣傳素材。角色劇本、搜證卡、還原線索、飛升儀式流程——這些正是劇本殺付費內容的全部價值。
- **使用者影響**：任何拿到（或猜到）路徑的人都能取得完整劇本 → 玩家先看再來玩，整場體驗歸零。
- **技術影響 / 法務影響**：對劇本發行商而言這等同公開散布其著作，是明確的侵權態樣，可能導致下架要求甚至求償。同時佔了 76 MB 部署量。
- **建議修正方式**：
  1. **立即**：把 `劇本資料/` 從 repo 移除（`git rm -r --cached` + 加入 `.gitignore`），改放本機或私有雲端硬碟。
  2. **注意**：僅刪除檔案**不會清掉 git 歷史**——舊 commit 仍可取得。若要徹底移除需 `git filter-repo` 重寫歷史並強推（會影響所有既有 clone）。請評估是否有必要。
  3. `scripts.js` 中 `fengtuz` 的 `poster` 指向 `劇本資料/角色海報/《疯兔子》—主海报.jpg`，**移除前必須先把這張海報搬到別處或上傳圖床**，否則首頁該卡片會破圖。這是全站唯一使用本地海報路徑的劇本。
  4. 若某些檔案（如角色海報）確實需要公開，把它們搬到 `img/` 之類明確的公開資產目錄，與「劇本本體」分開。
- **修改成本**：S（移除 + 修海報路徑）；若要重寫歷史則為 M
- **修改風險**：中（會動到首頁一張海報；重寫歷史風險更高）
- **驗證方式**：部署後直接請求 `https://cj2vum4.github.io/starfishlarp/劇本資料/《疯兔子》手册.pdf` 應回 404；首頁瘋兔子卡片海報仍正常顯示。
- **是否需要人工確認**：**是** — 需確認 (a) 是否有頁面依賴這些檔案（目前掃描僅海報一處）、(b) 是否要重寫 git 歷史。

---

### S-03 · Tone.js CDN 失敗導致榮譽牆整頁空白

- **優先級**：P1
- **問題面向**：可靠性 / 錯誤處理
- **檔案位置**：`榮譽牆.html:8-10`（CDN 載入）、`榮譽牆.html:893-902`（頂層使用）
- **相關函式**：`DOMContentLoaded` 主初始化函式
- **發現依據**：Playwright 實測（外部網路被阻擋時）：
  ```
  ========== 榮譽牆.html ==========
    {"cards":0,"selOpts":1,"selFirst":"-- 讀取資料中 --"}
    ! PAGEERROR: ReferenceError: Tone is not defined
    net: https://cdnjs.cloudflare.com/ajax/libs/PapaParse/5.4.1/papaparse.min.js
    net: https://cdnjs.cloudflare.com/ajax/libs/tone/14.7.77/Tone.js
  ```
  原因是這兩行位於初始化函式的**最前段**，且在任何 try/catch 之外：
  ```js
  const clickSound = new Tone.MembraneSynth({...}).toDestination();  // :893
  const popSound   = new Tone.Synth({...}).toDestination();          // :899
  ```
  一 throw，後面的「動態生成 53 張卡片」「抓 CSV」「填排行榜」全部不會執行。
- **問題說明**：一個**純裝飾用途**的音效庫（點擊時的鼓聲與撕紙聲）成了整頁的硬性前置條件。PapaParse 也是硬依賴（榮譽牆自己不像 `reviews.js` 那樣有內建 CSV parser）。
- **使用者影響**：在 cdnjs 被阻擋的網路（部分企業網路、部分廣告攔截器、中國大陸）或 cdnjs 短暫故障時，榮譽牆是**一片空白** — 沒有卡片、沒有排行榜、玩家下拉永遠停在「-- 讀取資料中 --」，也沒有任何錯誤提示。
- **技術影響**：整頁初始化沒有任何容錯邊界，任何一個 CDN 問題都是全頁級故障。
- **建議修正方式**：
  1. **音效改為可選**：包 try/catch，失敗時降級為 no-op。
  2. **PapaParse 自架**：下載到 `vendor/`（如同已經自架的 Three.js），或直接改用 `reviews.js` 已有的 `parseCSV()`——它已經支援引號、逗號、換行，正好消除 C-02 的重複實作。
- **建議修改範例**：
  ```js
  // 音效降級
  const noop = { triggerAttackRelease() {} };
  let clickSound = noop, popSound = noop, isToneStarted = false;
  try {
      if (window.Tone) {
          clickSound = new Tone.MembraneSynth({...}).toDestination();
          popSound   = new Tone.Synth({...}).toDestination();
      }
  } catch (_) { /* 沒音效不影響主功能 */ }

  async function startAudio() {
      if (!window.Tone || isToneStarted) return;
      try { await Tone.start(); isToneStarted = true; } catch (_) {}
  }
  ```
- **修改成本**：S
- **修改風險**：低
- **驗證方式**：在 DevTools 用 request blocking 擋掉 `cdnjs.cloudflare.com`，重新載入榮譽牆，確認 53 張卡片仍正常顯示、排行榜仍可用，僅無音效。
- **是否需要人工確認**：否

---

### S-05 · GM 頁面無存取控制，且 Supabase 遊戲狀態可被匿名讀寫

- **優先級**：P1
- **問題面向**：純前端架構風險 / 假權限
- **檔案位置**：`7人/天才在左我在右.html:847`（公開入口）、`7人/天才在左我在右-GM.html`（53 KB）、`7人/天才在左我在右-player.html`（94 KB）
- **發現依據**：
  1. 公開劇本頁上有一個顯眼按鈕：
     ```html
     <a href="天才在左我在右-GM.html" style="...background:linear-gradient(135deg,#8b1010,#6b0808)...">
     ```
  2. 全檔搜尋 `password|密碼|prompt(|auth|驗證` → **零命中**。沒有任何存取控制。
  3. GM 頁內含完整劇透，例如：
     > `'V4-STAGE': '【GM筆記 · V4-STAGE 劇場舞臺】…其中一具人偶傾斜…📌 關鍵：傾斜的人偶和日記是重要線索。'`
  4. Supabase 用 anon key 直接 upsert：
     ```js
     await _supa.from('game_state').upsert({ id: sessionId, state: state, ... });   // GM:985
     await _supa.from('player_state').upsert(row);                                   // player:1350
     ```
     能 upsert 成功，代表這兩張表的 RLS 允許匿名 INSERT/UPDATE。
  5. 場次碼產生方式：`'TC-' + Math.random().toString(36).substring(2,6).toUpperCase()` → 僅約 36⁴ ≈ 168 萬組合，且無速率限制。
- **問題說明**：這是典型的「純前端假權限」——用「不放連結」或「網址難猜」當作權限。但這裡連「不放連結」都沒做到，按鈕就在玩家看得到的劇本頁上。
- **使用者影響**：好奇的玩家點進 GM 頁 → 整本劇本的答案與關鍵線索一次看完，這場遊戲直接報廢。此外任何人都能列舉場次碼、讀取或覆寫他人正在進行的遊戲狀態。
- **技術影響**：`supabase_schema.sql` 完全沒有 `game_state` / `player_state` 的定義（見 K-03），代表這兩張表的 RLS 政策沒有版本控制，也沒人能確認目前設定為何。
- **建議修正方式**（依可行性排序，純前端能做到的有限，請務實選擇）：
  1. **立刻可做**：把 `7人/天才在左我在右.html:847` 的 GM 連結移除。主持人自己記網址即可。這一步就解決了 90% 的實際爆雷風險。
  2. **短期可接受**：把 `-GM.html` 改名為不可猜測的檔名（如 `天才在左我在右-gm-7f3a91c4.html`）。這是 security-by-obscurity，**不是真正的安全**，但對「玩家好奇亂點」這個實際威脅模型是有效的。
  3. **收緊 Supabase RLS**：至少限制 `game_state` 的 UPDATE 只能改自己那列，並把場次碼長度提高到 8–10 字元以降低列舉可行性。
  4. **正式做法（需後端）**：Supabase Auth + 以 GM 帳號為條件的 RLS 政策，GM 筆記改成登入後才由 API 取得，而不是寫死在 HTML 裡。
- **修改成本**：XS（移除連結）／S（改檔名 + 調 RLS）／L（真正的 Auth）
- **修改風險**：低（前兩項）／中（動 RLS 需同時測 GM 與 player 兩頁）
- **驗證方式**：以無痕視窗開啟公開劇本頁，確認找不到通往 GM 頁的連結；用 curl 帶 anon key 嘗試 upsert 一個不屬於自己的 `session_id`，確認被 RLS 拒絕。
- **是否需要人工確認**：**是** — 需確認主持人實際的使用流程（是否依賴那顆按鈕），以及 Supabase RLS 現況。

---

### S-06 · 瘋兔子劇本 OCR 全文存於公開可讀的 Supabase 表

- **優先級**：P1
- **問題面向**：安全性 / 法務
- **檔案位置**：`疯兔子搜尋.html:230-231`、`7人/天才在左我在右-GM.html:914-915`、`7人/天才在左我在右-player.html:1181-1182`、`supabase_schema.sql:24-29`
- **發現依據**：
  ```js
  const SUPABASE_URL = "https://mcphigetltedeadvuvqf.supabase.co";
  const SUPABASE_KEY = "sb_publishable_Qdg36jjN…";   // 已遮罩
  ```
  ```sql
  -- supabase_schema.sql:27
  CREATE POLICY "Public read-only" ON cards FOR SELECT USING (true);
  ```
  `cards` 表的內容由 `ocr_batch.py` 產生——把劇本 PDF 逐頁送 Claude Vision OCR 後寫入 `text` 欄位。
- **問題說明**：`sb_publishable_` 是 Supabase 設計上就可公開的金鑰，**所以問題不是金鑰洩漏**，而是「公開金鑰 + `USING (true)` 的 SELECT 政策」等於把整張表開放給全世界。任何人取得 URL 與 key（就寫在 HTML 原始碼裡）都能用一行 curl dump 整本劇本的文字內容。
- **使用者影響**：與 S-04 相同的劇透風險，只是載體從 PDF 換成資料庫。
- **技術影響**：`ocr_batch.py` 也在 repo 中並被部署，等於附上了「這批資料怎麼來的、長什麼樣」的完整說明書，降低了他人利用的門檻。
- **建議修正方式**：
  1. 若 `疯兔子搜尋.html` 只有主持人在用（目前**沒有任何公開頁面連到它**），最簡單的做法是把 `cards` 表的 SELECT 政策從 `USING (true)` 改為需要認證，搜尋頁改成登入後使用。
  2. 折衷做法：在 `cards` 增加 `is_public` 欄位，只把真正可公開的內容（例如遊戲規則）設為 true。
  3. 同時把 `ocr_batch.py` 移出部署範圍（放到 `tools/` 並確認不需要公開）。
- **修改成本**：S
- **修改風險**：低（該頁無公開入口，改壞了影響面極小）
- **驗證方式**：未帶認證的 REST 請求應回 401/空陣列；主持人登入後仍可正常搜尋。
- **是否需要人工確認**：**是** — 需確認 `疯兔子搜尋.html` 的實際使用者與使用情境。

---

### S-07 · 玩家記錄資料經三個不受信任的第三方 CORS proxy 轉送

- **優先級**：P1
- **問題面向**：隱私 / 第三方依賴
- **檔案位置**：`榮譽牆.html:864-873`
- **相關函式**：`fetchPlayData()`
- **發現依據**：
  ```js
  const CORS_SOURCES = [
      () => GOOGLE_SHEET_URL,
      () => 'https://corsproxy.io/?' + encodeURIComponent(GOOGLE_SHEET_URL),
      () => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(GOOGLE_SHEET_URL),
      () => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(GOOGLE_SHEET_URL)
  ];
  ```
- **問題說明**：當直接請求 Google Sheet 失敗（逾時 6 秒或非 200），程式會依序改用三個免費公共 proxy。這些服務會看到**完整的 CSV 內容**：所有玩家暱稱、遊玩日期、飾演角色、評分、心得留言。它們同時也能任意竄改回傳內容（而榮譽牆對回傳資料沒有轉義，見 S-02，兩者組合起來 proxy 方可直接注入 XSS）。
- **使用者影響**：玩家的暱稱與心得可能被第三方留存。多數是化名，但心得內容有時很個人。
- **技術影響**：這三個服務都沒有 SLA，任一個變更 API 或加上速率限制，fallback 鏈就失效；同時它們也是額外的 XSS 注入面。
- **建議修正方式**：程式碼註解裡其實已經寫了正解——
  ```js
  // 【建議】自建 Google Apps Script 代理網址：可完全避開 CORS、讀取快又穩。
  const GAS_PROXY_URL = '';  // ← 目前是空的
  ```
  專案已經有一個運作中的 Apps Script（`play-record-config.js`），加一個 `doGet` 讀 Sheet 並回傳 CSV 即可，然後**把三個公共 proxy 全部移除**。
- **建議修改範例**：
  ```js
  const GAS_PROXY_URL = 'https://script.google.com/macros/s/<你的部署ID>/exec';
  const CORS_SOURCES = [
      () => GOOGLE_SHEET_URL,   // 直連優先
  ];                            // 移除三個公共 proxy
  ```
- **修改成本**：S
- **修改風險**：低（但需先確認 GAS proxy 可用再移除 fallback）
- **驗證方式**：DevTools Network 面板確認只有 `docs.google.com` 與自家 `script.google.com` 的請求。
- **是否需要人工確認**：**是** — 需確認直連 Google Sheet 目前是否穩定（fallback 鏈的存在暗示曾經不穩）。

---

### F-01 · 「預設順序」與「重置篩選」無法還原原始排序

- **優先級**：P1
- **問題面向**：功能正確性
- **檔案位置**：`scripts-data.js:286-332`
- **相關函式**：`sortScripts()`、`resetFilters()`
- **發現依據**：Playwright 實測（`index.html`，1280×900）：
  ```
  initial      : 王座 / 北國之春 / 別來無恙 / 奉天1928 / 孤城
  sort=name    : 45 / 上路 / 天才在左我在右 / 太陽可以是藍色嗎 / 木夕僧之戲
  sort=default : 45 / 上路 / 天才在左我在右 / 太陽可以是藍色嗎 / 木夕僧之戲  ← 應等於 initial
  after reset  : 45 / 上路 / 天才在左我在右 / 太陽可以是藍色嗎 / 木夕僧之戲  ← 應等於 initial
  ```
  根因：
  ```js
  const scriptCards = Array.from(document.querySelectorAll('.script-card:not(.hidden)'));
  if (sortType === 'default') {
      scriptCards.forEach(card => scriptsGrid.appendChild(card));  // 依「當前 DOM 順序」重新 append
      return;                                                       // → 等於什麼都沒做
  }
  ```
  `querySelectorAll` 回傳的就是當前 DOM 順序，而 DOM 順序在上一次排序時已經被改掉了。程式沒有保存原始順序。

  次要問題：`:not(.hidden)` 使被隱藏的卡片留在原位不參與排序，因此「先排序再篩選」與「先篩選再排序」會得到不同的最終排列。
- **使用者影響**：使用者試了「按名稱排序」後想回到原本的推薦順序，發現選「預設順序」沒反應，按「重置篩選」也沒反應——唯一的辦法是重新整理整頁。這是很容易被察覺、也很容易被認為「這網站壞了」的問題。
- **技術影響**：排序狀態與 DOM 耦合，且從 DOM 文字反推資料（`.info-badge:nth-child(2)` 抓時長字串再 `parseFloat`），脆弱且難以擴充。
- **建議修正方式**：以 `scripts` 陣列為排序真值來源，排完再依序 append。
- **建議修改範例**：
  ```js
  function sortScripts() {
      const sortType = document.getElementById('sortFilter').value;
      const grid = document.getElementById('scriptsGrid');
      const byId = new Map(
          Array.from(grid.querySelectorAll('.script-card'))
               .map((el, i) => [scripts[i].id, el])      // renderCards 的順序 == scripts 的順序
      );

      const ordered = [...scripts].sort((a, b) => {
          switch (sortType) {
              case 'name':       return a.name.localeCompare(b.name, 'zh-TW');
              case 'difficulty': return a.difficulty - b.difficulty;
              case 'time':       return a.time - b.time;          // 用數值欄位，不再從 DOM 解析字串
              case 'players':    return a.players - b.players;
              default:           return 0;                        // 'default' → 維持 scripts.js 原始順序
          }
      });

      ordered.forEach(s => { const el = byId.get(s.id); if (el) grid.appendChild(el); });
      applyStaggerAnimationWithinTwoSeconds();
  }
  ```
  這同時解決了「時長排序從 DOM 文字 `parseFloat('4-5')` 反推」的脆弱性——`scripts.js` 本來就有數值 `time` 欄位，註解也寫明「排序用」。
- **修改成本**：S
- **修改風險**：低（僅動 `sortScripts`，`renderCards` 與 `filterScripts` 不變）
- **驗證方式**：排序 → 選「預設順序」→ 前 5 張卡片應回到 `王座 / 北國之春 / 別來無恙 / 奉天1928 / 孤城`。
- **是否需要人工確認**：否

---

### F-02 · 五個劇本頁的 ESC 鍵導向不存在的路徑（404）

- **優先級**：P1
- **問題面向**：功能正確性 / 連結錯誤
- **檔案位置**：
  - `5人/風中有朵雨做的雲.html:985`
  - `6人/你好.html:981`
  - `7人/死者在幻夜中醒來.html:962`
  - `8人以上/南京風沙.html:1019`
  - `8人以上/重慶迷霧.html:1041`
- **發現依據**：
  ```js
  document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
          window.location.href = 'index.html';   // ← 缺少 ../
      }
  });
  ```
  這 5 頁的**返回按鈕**都正確使用 `href="../index.html"`，唯獨這段 JS 少了 `../`。實測確認：
  ```
  GET /6人/index.html -> 404
  ```
  全站掃描：52 頁使用正確的 `../index.html`，這 5 頁的 JS 版本是錯的（`location.href = '../index.html'` 的正確用法在全站 0 命中）。
- **問題說明**：這 5 頁明顯來自同一個模板世代（它們也共用 C-04 的 `#title` 檢查問題）。
- **使用者影響**：兩層。第一，按 ESC 掉到 GitHub 的英文 404 頁（本專案也沒有自訂 `404.html`）。第二，**與 `reviews.js` 衝突**——`reviews.js:152` 註冊了全域 `Escape` 關閉評價彈窗。在這 5 頁上，使用者開啟評價彈窗後按 ESC 想關閉，結果是彈窗關閉的同時整頁跳到 404。
- **技術影響**：「按 ESC 離開頁面」本身就是有問題的互動設計——ESC 的通用語意是「關閉當前層」，不是「離開頁面」。
- **建議修正方式**：**建議直接移除這段 ESC 導航**（而不是補上 `../`）。它與彈窗的 ESC 語意衝突，且返回按鈕已經在頁面上了。若要保留，至少改成僅在沒有開啟彈窗時才觸發。
- **建議修改範例**：
  ```js
  // 建議：整段移除
  // document.addEventListener('keydown', (e) => {
  //     if (e.key === 'Escape') window.location.href = 'index.html';
  // });

  // 若堅持保留，最低限度：
  document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('.rv-overlay.open')) return;   // 彈窗開著就讓彈窗處理
      window.location.href = '../index.html';
  });
  ```
- **修改成本**：XS（5 個檔案各改 1 處）
- **修改風險**：低
- **驗證方式**：在這 5 頁按 ESC，確認不會跳 404；開啟評價彈窗按 ESC，確認只關閉彈窗。
- **是否需要人工確認**：否

---

### F-03 · 玩本記錄以 `no-cors` 送出，失敗也永遠顯示成功

- **優先級**：P1
- **問題面向**：功能正確性 / 假成功
- **檔案位置**：`play-record.js:171-185`、`play-record.js:247-259`
- **相關函式**：`postRecord()`、表單 `submit` 處理器
- **發現依據**：
  ```js
  // Apps Script Web App 跨網域寫入使用 no-cors。
  // 回應會是 opaque，但只要 fetch 沒有拋出網路錯誤，資料就已送達端點。
  await fetch(endpoint, { method: 'POST', mode: 'no-cors', cache: 'no-store', body });
  ```
  註解的推論不成立。`mode:'no-cors'` 回傳 opaque response，`status` 恆為 0、`ok` 恆為 false，程式碼也沒去看它。因此只要 TCP 連線建立成功，就算 Apps Script 回 500、部署被撤銷、`validate_()` 丟出「缺少角色」，前端一律走到 `completeSubmission()` 顯示「記錄已送出」。
- **問題說明**：`GoogleAppsScript_玩本記錄.gs:93-99` 其實有完整的錯誤回傳（`{ ok:false, error:... }`），但前端在 `no-cors` 下**根本讀不到**。伺服端的錯誤處理白寫了。
- **使用者影響**：玩家看到「記錄已送出 ✓ 謝謝你留下這次的角色與心得」，過幾天去榮譽牆發現記錄不在。他不會知道是失敗了，只會覺得網站怪怪的，可能重填多次或直接放棄。
- **技術影響**：整條寫入路徑沒有任何失敗訊號，端點壞掉可能數週無人察覺。
- **建議修正方式**：Apps Script Web App 部署為「所有人皆可存取」時**是支援 CORS 的**（`ContentService` 回應會帶 `Access-Control-Allow-Origin: *`）。改用 `mode:'cors'` 並讀取 JSON 回應即可拿到真實結果。需注意：要避開 CORS preflight，request body 必須維持 `URLSearchParams`（會送成 `application/x-www-form-urlencoded`，屬簡單請求），且**不要**加自訂 header。目前的寫法已經符合這個條件。
- **建議修改範例**：
  ```js
  async function postRecord(payload) {
      const body = new URLSearchParams();
      Object.entries(payload).forEach(([k, v]) => body.set(k, String(v == null ? '' : v)));

      const res = await fetch(endpoint, { method: 'POST', cache: 'no-store', body });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const result = await res.json();
      if (!result.ok) throw new Error(result.error || '寫入失敗');
      return result;
  }
  ```
  現有的 `catch` 區塊已經會呼叫 `showError('送出失敗，請確認網路連線後再試一次。')` 並 `setSubmitting(false)`，所以錯誤路徑不需另外新增。
- **修改成本**：M（改動小，但**必須實測 Apps Script 的 CORS 行為**；若確認不可行，退而求其次是改用隱藏 `<iframe>` + `<form target>` 提交，或至少在 UI 上把「記錄已送出」改成「已送出，請稍後到榮譽牆確認」）
- **修改風險**：中（動到唯一的寫入路徑，改壞會讓所有記錄都送不出去）
- **驗證方式**：故意把端點改成錯誤網址送出 → 應顯示錯誤而非成功；改回正確端點 → 應成功且 Sheet 真的多一列。
- **是否需要人工確認**：**是** — 需實測目前的 Apps Script 部署是否允許 CORS 讀取。

---

### F-04 · jsDelivr 失敗導致 GM / 玩家頁整頁 crash

- **優先級**：P1
- **問題面向**：可靠性
- **檔案位置**：`7人/天才在左我在右-GM.html:422,916`、`7人/天才在左我在右-player.html:416,1183`
- **發現依據**：Playwright 實測：
  ```
  ========== 7人/天才在左我在右-GM.html ==========
    ! PAGEERROR: TypeError: Cannot read properties of undefined (reading 'createClient')
    net: https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js
  ```
  ```js
  const _supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);   // 頂層，無保護
  ```
- **問題說明**：與 S-03 同一類問題。此外這是 `@supabase/supabase-js@2` 的**浮動版本**——jsDelivr 會解析到最新的 v2.x，套件方推出破壞性變更時網站會在無人改動的情況下壞掉。
- **使用者影響**：這是**開場當下才會用到的工具**。CDN 剛好有問題或現場網路擋了 jsDelivr，主持人就在一群玩家面前看到一片空白的控台。
- **技術影響**：GM 與玩家兩頁同時失效，而 `localStorage` 備援邏輯（`gm_state_<sessionId>`）也因為 crash 發生在它之前而完全沒機會執行。
- **建議修正方式**：
  1. 版本鎖定：`@supabase/supabase-js@2.45.0`（明確版號）而非 `@2`。
  2. 加 `onerror` 偵測與明確提示，並讓 `localStorage` 離線模式真的能接手。
- **建議修改範例**：
  ```html
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.0/dist/umd/supabase.min.js"
          onerror="window.__supaCdnFailed=true"></script>
  ```
  ```js
  let _supa = null;
  if (window.supabase && !window.__supaCdnFailed) {
      _supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
      showToast('雲端同步暫時無法使用，改用本機儲存（不會跨裝置同步）');
  }
  // 各處呼叫改為：if (_supa) { await _supa.from(...)... }
  ```
- **修改成本**：S
- **修改風險**：低
- **驗證方式**：DevTools 阻擋 `cdn.jsdelivr.net`，確認頁面仍可操作（僅無雲端同步）。
- **是否需要人工確認**：否

---

### D-01 · 部署量 357 MB，逼近 GitHub Pages 建議上限

- **優先級**：P1
- **問題面向**：部署 / 效能 / 靜態資源
- **檔案位置**：`5人/` `6人/` `7人/` `8人以上/`（52 個 MP3，約 265 MB）、`劇本資料/`（76 MB）、`img/cards/`（22 MB）
- **發現依據**：
  ```
  git ls-files 總計          : 357 MB
  .git                       : 350 MB
  6人/                       : 148 MB（54 檔）
  7人/                       :  65 MB（30 檔）
  5人/                       :  31 MB（12 檔）
  8人以上/                    :  21 MB（13 檔）
  劇本資料/                   :  76 MB（27 檔）
  img/cards/                 :  22 MB（27 檔）
  單檔最大：6人/晴天神社.mp3    : 14.2 MB
  ```
- **問題說明**：GitHub Pages 官方建議 repo 不超過 1 GB、每月流量不超過 100 GB。目前 357 MB 已用掉 1/3，而劇本還在持續新增（README 顯示從 3 本長到 53 本）。以單頁 MP3 平均 5 MB 估算，每月 2 萬次劇本頁瀏覽就會逼近流量上限。
- **使用者影響**：行動網路使用者每開一個劇本頁就被下載數 MB 的背景音樂（見 P-02，多數頁面沒有 `preload` 控制）。
- **技術影響**：`.git` 350 MB 使 clone 極慢；每次 AI 協作 session 都要重新 clone。
- **建議修正方式**：
  1. **先移除 `劇本資料/`**（S-04 本來就該做）→ 立即省 76 MB。
  2. **壓縮 MP3**。這些是背景音樂，128 kbps 單聲道完全夠用。14 MB 的檔案通常可壓到 2–3 MB，整體有機會從 265 MB 降到 60–80 MB。
  3. **統一 BGM 托管策略**。`8人以上/龍宴.html` 已經在用 GitHub Releases（`releases/download/bgm/lxe8.mp3`），`6人/那一束月光.html` 的註解也寫著「托管於 GitHub Releases，不佔 repo 空間」但**實際上檔案還在 repo 裡**（見 L-01）。這個方案顯然開始做了但沒做完——建議要嘛全面採用，要嘛全面放棄並清掉誤導的註解。
  4. `img/cards/` 22 MB 僅供天才在左的 GM/player 兩頁使用，可壓縮或轉 WebP。
- **修改成本**：M（批次壓縮 + 驗證每頁音訊仍可播放）
- **修改風險**：中（動到 52 個頁面引用的檔案）
- **驗證方式**：壓縮後隨機抽 10 頁確認 BGM 仍正常播放且音質可接受；`git ls-files | xargs du -ch | tail -1` 確認總量下降。
- **是否需要人工確認**：**是** — 音質標準需要擁有者判斷。

---

### F-05 · 標籤體系分裂導致篩選漏本

- **優先級**：P2
- **問題面向**：功能正確性 / 資料一致性
- **檔案位置**：`scripts.js`（`types` 欄位）、`index.html:251-262`（篩選 UI）
- **發現依據**：統計 53 筆資料的 `types`，共出現 **76 種不同標籤**，其中存在明顯的同義分裂：

  | 語意 | 分裂出的標籤 |
  |------|------------|
  | 新手友善 | `新手`(17) / `新手友善`(5) |
  | 微恐 | `微恐`(8) / `微恐怖`(1) |
  | 硬核 | `硬核`(12) / `硬核推理`(1) |
  | 日式 | `日式`(9) / `日式推理`(1) |
  | 驚悚 | `驚悚`(5) / `恐怖`(3) |
  | 繁體 | `繁體`(4) / `繁化`(2) |
  | 進階 | `進階`(9) / `進階可玩`(1) |

  實測驗證：
  ```
  新手 filter -> visible: 17   (另有 5 本標為「新手友善」被排除)
  微恐 filter -> visible: 8
  ```
  同時，篩選 UI 只列出 11 種標籤，其餘 65 種（含 `硬核`(12)、`還原`(24)、`本格`(7)、`日式`(9)…）**沒有任何入口可以篩選**。`還原` 是出現最多次的標籤（24 次），卻不在篩選列上。
- **問題說明**：`scripts-data.js:229` 的比對是 `types.includes(typeFilter)` 精確字串比對，沒有正規化。
- **使用者影響**：新手玩家點「新手」，看到 17 本，但實際上有 22 本適合他們——5 本直接看不到。
- **技術影響**：新增劇本時沒有標籤白名單，AI 或人工都可能再造出新的同義詞，問題只會惡化。
- **建議修正方式**：
  1. 在 `scripts.js` 統一標籤用字（把 `新手友善`→`新手`、`微恐怖`→`微恐`、`硬核推理`→`硬核`+`推理`、`繁化`→`繁體`、`進階可玩`→`進階`、`恐怖`→`驚悚`）。
  2. 在 `CLAUDE.md` 增加標籤白名單，比照現有的 `theme` 白名單。
  3. 篩選 UI 改為由資料自動產生（取出現次數 ≥ 3 的標籤），避免手動維護 UI 與資料脫節。
- **建議修改範例**：
  ```js
  // scripts-data.js — 自動產生篩選標籤，取代 index.html 硬編的 11 顆按鈕
  function buildTypeFilters(minCount = 3) {
      const counts = {};
      scripts.forEach(s => s.types.forEach(t => counts[t] = (counts[t] || 0) + 1));
      return Object.entries(counts)
                   .filter(([, n]) => n >= minCount)
                   .sort((a, b) => b[1] - a[1])
                   .map(([t]) => t);
  }
  ```
- **修改成本**：S（統一用字）+ S（UI 自動化）
- **修改風險**：低（`types` 只用於篩選顯示，不影響路由或資料對應）
- **驗證方式**：統一後篩「新手」應得 22 本；篩選列應涵蓋所有主要標籤。
- **是否需要人工確認**：**是** — 哪些標籤該合併需要擁有者對劇本的認知（例如 `恐怖` 與 `驚悚` 是否真的同義）。

---

### F-06 · 兩筆劇本的角色數與人數不符

- **優先級**：P2
- **問題面向**：資料正確性
- **檔案位置**：`scripts.js`（`bingjiao`、`wuhuang` 兩筆）
- **發現依據**：腳本檢查 `characters.length !== players`：
  ```
  病嬌男孩的精分日記  players=7  characters=1   → ["蕭何"]
  吾皇在上           players=8  characters=9
  ```
  其餘 51 筆全部相符。
- **問題說明**：`play-record.js:113-129` 直接依 `script.characters` 產生角色 radio 選項。
- **使用者影響**：玩「病嬌男孩的精分日記」的 7 位玩家中，有 6 位在玩本記錄表單裡**找不到自己的角色**，而且該欄位是 `required`，所以他們根本無法送出記錄。「吾皇在上」則會多出一個不存在的角色選項。
- **技術影響**：這兩筆記錄不會進到榮譽牆，統計失真。
- **建議修正方式**：補齊 `病嬌男孩的精分日記` 缺少的 6 個角色名；核對 `吾皇在上` 是 8 人還是 9 人（可能 `players` 該是 9，也可能多列了一個 NPC）。建議同時加一個資料自檢：
  ```js
  // scripts.js 末尾，開發期自檢
  (function validateScripts() {
      window.SCRIPTS.forEach(s => {
          if (s.characters.length && s.characters.length !== s.players) {
              console.warn('[scripts.js] 角色數與人數不符:', s.name, s.players, s.characters.length);
          }
      });
  })();
  ```
- **修改成本**：XS
- **修改風險**：低
- **驗證方式**：在玩本記錄表單選這兩本，確認角色選項數量正確。
- **是否需要人工確認**：**是** — 需要正確的角色名單。

---

### F-07 · 瘋兔子頁的玩家評價永遠是空的

- **優先級**：P2
- **問題面向**：功能正確性
- **檔案位置**：`6人/瘋兔子白又白砍下腦袋飛起來.html`、`reviews.js:17-28`
- **相關函式**：`resolveScriptName()`
- **發現依據**：`reviews.js` 依「`data-script` → `window.SCRIPT_NAME` → 檔名」的順序決定劇本名，比對時只移除空白（`replace(/\s+/g,'')`），不移除標點。腳本比對 53 筆資料，只有 1 筆對不上：
  ```
  6人/瘋兔子白又白砍下腦袋飛起來.html
    解析結果  : "瘋兔子白又白砍下腦袋飛起來"      （檔名，無逗號）
    reviewKey : "瘋兔子，白又白，砍下腦袋飛起來"   （有全形逗號）
  ```
  該頁也沒有加 `data-script` 覆寫（全站只有 `極目2` 與 `津門遺雲` 兩頁有加）。
- **問題說明**：`CLAUDE.md` 已經寫明了這個陷阱——「若檔名與評價表單名不同，加 `data-script="評價用名稱"`」——只是這一頁漏了。
- **使用者影響**：不管有多少玩家評價過瘋兔子，該頁的評價彈窗永遠顯示「這個劇本還沒有玩家評價，期待你來當第一個！🌟」。
- **技術影響**：檔名與 `reviewKey` 之間缺乏自動驗證，未來新增劇本容易重蹈覆轍。
- **建議修正方式**：
  ```html
  <script src="../reviews.js?v=20260714" data-script="瘋兔子，白又白，砍下腦袋飛起來"></script>
  ```
  更穩健的做法是讓 `reviews.js` 在有 `window.SCRIPTS` 時直接查 `reviewKey`，但劇本頁目前不載入 `scripts.js`，改動較大——建議先用 `data-script` 修好，並在 `CLAUDE.md` 的檢查清單裡加一條。
- **修改成本**：XS
- **修改風險**：低
- **驗證方式**：開啟該頁的評價彈窗，確認能讀到既有評價。
- **是否需要人工確認**：否

---

### F-08 · 榮譽牆空狀態判斷字串永不成立

- **優先級**：P2
- **問題面向**：功能正確性 / 空狀態
- **檔案位置**：`榮譽牆.html:804`、`榮譽牆.html:1522`
- **發現依據**：
  ```html
  <option value="">-- 讀取資料中 --</option>     <!-- :804 -->
  ```
  ```js
  } else if (playerSelector.textContent.includes('讀取中')) {   // :1522
      playerSelector.innerHTML = '<option value="">無玩家資料</option>';
  }
  ```
  `'-- 讀取資料中 --'` 這個字串中並不存在連續子字串 `'讀取中'`（中間隔著「資料」），所以 `includes('讀取中')` 恆為 `false`。
- **問題說明**：當 CSV 讀取成功但沒有任何玩家資料時（初次上線、Sheet 被清空、欄位名變更導致解析不到），這個 else 分支不會執行。
- **使用者影響**：下拉選單永遠停在「-- 讀取資料中 --」，看起來像卡住了，使用者會一直等。
- **技術影響**：`fetchPlayData()` 的 catch 區塊會把 selector 設成「讀取失敗」，所以只有「成功但無資料」這條路徑沒有正確的空狀態。
- **建議修正方式**：不要用字串比對來判斷狀態。
- **建議修改範例**：
  ```js
  if (playerNames.length > 0) {
      playerSelector.innerHTML = '<option value="">-- 請選擇玩家 --</option>';
      playerNames.forEach(name => { /* ... */ });
  } else {
      playerSelector.innerHTML = '<option value="">尚無玩家記錄</option>';
  }
  ```
- **修改成本**：XS
- **修改風險**：低
- **驗證方式**：攔截 CSV 回應只回傳表頭列，確認下拉顯示「尚無玩家記錄」。
- **是否需要人工確認**：否

---

### A-01 · 九個導覽連結使用 `<a onclick>` 但沒有 `href`

- **優先級**：P2
- **問題面向**：Accessibility / UX / SEO
- **檔案位置**：`index.html:107,111,115`（抽屜）、`:148,161,174`（新劇本卡）、`:310,311,312`（頁尾）
- **發現依據**：
  ```html
  <a class="drawer-link" onclick="goToPage('劇本介紹.html')">
  <a class="new-script-card" onclick="goToScript('jimu2')">
  <a onclick="goToPage('榮譽牆.html')">榮譽牆</a>
  ```
  同時 `index.css` 中 `.drawer-link` 與 `.new-script-card` 的規則**都沒有 `cursor:pointer`**（全檔只有 `button{cursor:pointer}` 與 `.filter-select` 兩處設定游標）。
- **問題說明**：沒有 `href` 的 `<a>` 在無障礙樹中不是連結，也不在 tab 順序中。
- **使用者影響**：
  - 鍵盤使用者**完全無法**用 Tab + Enter 進入劇本介紹、榮譽牆、主持人資訊。
  - 螢幕閱讀器不會把它們念成連結。
  - 滑鼠移上去顯示文字選取游標（I-beam），不像可點擊。
  - 無法「在新分頁開啟」或複製連結——這對「新劇本上架」卡片特別可惜。
  - 搜尋引擎爬不到這三個內頁的連結關係。
- **技術影響**：`goToPage()` 只是 `window.location.href = filename`，用真正的 `<a href>` 完全等價且更好。
- **建議修正方式**：改成真連結。`goToScript(id)` 因為要查 `scripts.js` 才知道路徑，可保留 onclick 但補上 href 作為 fallback。
- **建議修改範例**：
  ```html
  <a class="drawer-link" href="劇本介紹.html">…</a>
  <a class="drawer-link" href="榮譽牆.html">…</a>
  <a class="drawer-link" href="主持人資訊.html">…</a>

  <a class="new-script-card" href="7人/極目2九爺我想給您養老.html">…</a>

  <a href="劇本介紹.html">劇本介紹</a>
  ```
  改完後 `goToPage()` 就沒有呼叫者了，可一併移除（`scripts-data.js:281-283`）。
- **修改成本**：XS
- **修改風險**：低
- **驗證方式**：只用鍵盤 Tab 走一遍首頁，確認能到達並開啟三個內頁；滑鼠移上去是手指游標。
- **是否需要人工確認**：否

---

### A-02 · 主要互動元件缺少 focus 樣式

- **優先級**：P2
- **問題面向**：Accessibility
- **檔案位置**：`index.css:337-342`（`.ftag`）、`:354-358`（`.reset-btn`）、`:391-396`（`.detail-btn`）、`:331`（搜尋框）、`:352`（排序下拉）
- **發現依據**：全站 `focus-visible` 只出現 3 次（`index.css:122` 一次、`honor-form.css:263-264` 兩次）。`.ftag` / `.detail-btn` / `.reset-btn` 都只定義了 `:hover` 與 `.active`。搜尋框與排序下拉甚至主動移除輪廓：
  ```css
  .search-box input:focus{outline:none;border-color:var(--bdr-h);box-shadow:0 0 0 4px rgba(200,160,86,.1)}
  .filter-select:focus{outline:none;border-color:var(--bdr-h)}   /* ← 只剩邊框變色，對比極弱 */
  ```
- **使用者影響**：鍵盤使用者在 20 多顆篩選標籤與 53 顆「查看詳情」按鈕之間 Tab 時，完全看不到目前焦點在哪。搜尋框還算有 box-shadow 提示，排序下拉只有微弱的邊框變色。
- **技術影響**：不符 WCAG 2.4.7 (Focus Visible)。
- **建議修正方式**：加一條全域 `:focus-visible` 規則即可覆蓋大部分情況，不影響滑鼠使用者。
- **建議修改範例**：
  ```css
  /* index.css 末尾 */
  .ftag:focus-visible,
  .detail-btn:focus-visible,
  .reset-btn:focus-visible,
  .filter-select:focus-visible,
  .search-box input:focus-visible,
  .drawer-link:focus-visible,
  .new-script-card:focus-visible {
      outline: 2px solid var(--gold-l);
      outline-offset: 3px;
  }
  ```
- **修改成本**：XS
- **修改風險**：低（`:focus-visible` 不影響滑鼠點擊）
- **驗證方式**：鍵盤 Tab 過首頁所有互動元件，確認每個都有清楚的金色外框。
- **是否需要人工確認**：否

---

### A-03 · 57 個劇本頁只有 1 頁支援 `prefers-reduced-motion`

- **優先級**：P2
- **問題面向**：Accessibility
- **檔案位置**：57 個劇本頁的 `<style>` 區塊
- **發現依據**：
  ```
  pages with prefers-reduced-motion: 1 / 57
  ```
  相對地，`index.css:439`、`honor-form.css:364`、`reviews.js:102`、`fx3d.js:31` **都有**正確處理。
- **問題說明**：`fx3d.js` 會在 reduced-motion 下不啟動 3D 層，但各頁自己寫的 2D 背景動畫（花瓣、燈塵、漣漪、霓虹…）與卡片動效不受影響——而 `fx3d.js` 的 `data-hide` 機制正是「3D 成功啟動後才隱藏 2D 層」，所以 reduced-motion 使用者看到的反而是**沒被隱藏的 2D 動畫**。
- **使用者影響**：前庭功能障礙、偏頭痛、暈動症使用者在 53 個劇本頁上會持續看到動態背景。這也是 `CLAUDE.md` 強調「每頁專屬背景動畫」設計方向下的必然副作用。
- **技術影響**：因為 CSS 刻意不共用（這是專案的明確架構決策，應予尊重），無法用一個共用檔一次修好。
- **建議修正方式**：**不建議把 CSS 抽成共用檔**（違反專案架構決策）。建議改為在 `fx3d.js` 注入一段全域的 reduced-motion 樣式——它已經在每頁載入，且已經有注入 `<style>` 的既有做法（`fx3d.js:78-80` 注入 `.container{position:relative;z-index:1}`）。
- **建議修改範例**：
  ```js
  // fx3d.js 最前面，在 reduced-motion 提早 return 之前先注入
  try {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
          var rm = document.createElement('style');
          rm.textContent =
              '*,*::before,*::after{animation-duration:.001ms!important;' +
              'animation-iteration-count:1!important;transition-duration:.001ms!important}';
          document.head.appendChild(rm);
          return;
      }
  } catch (e) {}
  ```
  這樣 53 個頁面一次修好，且完全不需要動任何一頁的專屬 CSS。
- **修改成本**：XS（改 `fx3d.js` 一處 + 全站進版號）
- **修改風險**：低（僅在使用者主動開啟「減少動態」時生效）
- **驗證方式**：作業系統開啟「減少動態效果」，抽 5 個劇本頁確認背景動畫靜止。
- **是否需要人工確認**：否

---

### A-04 · 評價彈窗缺少對話框語意與焦點管理

- **優先級**：P2
- **問題面向**：Accessibility
- **檔案位置**：`reviews.js:121-152`
- **發現依據**：
  ```js
  const overlay = document.createElement('div');
  overlay.className = 'rv-overlay';       // 沒有 role="dialog" / aria-modal
  overlay.innerHTML = '<div class="rv-panel">…';

  function openModal() { overlay.classList.add('open'); document.body.style.overflow='hidden'; … }
  function closeModal() { overlay.classList.remove('open'); document.body.style.overflow=''; }

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
  ```
  缺少：`role="dialog"`、`aria-modal="true"`、`aria-labelledby`、focus trap、開啟時把焦點移入、關閉時把焦點還給 FAB。另外 Escape 監聽是全域且**不檢查彈窗是否開啟**（這正是 F-02 的衝突來源）。
- **使用者影響**：螢幕閱讀器使用者不會被告知進入了對話框；鍵盤使用者 Tab 會跑到彈窗後面的頁面內容；關閉後焦點回到 `<body>`，必須重新 Tab 一次。
- **技術影響**：`document.body.style.overflow` 直接覆寫，若頁面自己也在操作 overflow 會互相打架。
- **建議修正方式**：
  ```js
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', '玩家評價 · ' + SCRIPT_NAME);

  let lastFocused = null;
  function openModal() {
      lastFocused = document.activeElement;
      overlay.classList.add('open');
      document.body.style.overflow = 'hidden';
      overlay.querySelector('.rv-close').focus();
      if (!loaded) { loaded = true; loadReviews(); }
  }
  function closeModal() {
      overlay.classList.remove('open');
      document.body.style.overflow = '';
      if (lastFocused) lastFocused.focus();
  }
  document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) {
          e.stopPropagation();          // 順便擋掉 F-02 那 5 頁的頁面跳轉
          closeModal();
      }
  });
  ```
- **修改成本**：S
- **修改風險**：低（`reviews.js` 是共用檔，改完需全站進版號並同步 `service-worker.js`）
- **驗證方式**：用鍵盤開啟彈窗 → 焦點應在關閉鈕；Tab 不應跑出彈窗；Esc 關閉後焦點回到 FAB。
- **是否需要人工確認**：否

---

### P-01 · Three.js 670 KB 且為已棄用的建置版本

- **優先級**：P2
- **問題面向**：效能 / 過時依賴
- **檔案位置**：`vendor/three.min.js`（669,884 bytes）；由 `index.html:320` 與 `fx3d.js:38-44`（53 頁）載入
- **發現依據**：檔案開頭第一行就是：
  ```js
  console.warn('Scripts "build/three.js" and "build/three.min.js" are deprecated with r150+,
                and will be removed with r160. Please use ES Modules or alternatives: …');
  ```
  Playwright 實測，每一個劇本頁都會印出這則警告。
- **問題說明**：兩件事。第一，這是 Three.js 官方已棄用的 UMD build，未來版本會直接移除。第二，670 KB 是整包 Three.js，而 `fx3d.js` 實際只用到 `WebGLRenderer` / `Scene` / `PerspectiveCamera` / `Points` / `BufferGeometry` / `PointsMaterial` / `CanvasTexture` / `Color` 等一小部分。
- **使用者影響**：每個劇本頁多下載 670 KB（首次；之後有 SW 快取）。在 4G 行動網路上約多 1–2 秒。
- **技術影響**：console 每頁一則警告，稀釋了真正需要注意的錯誤訊息。
- **建議修正方式**：**不建議現在就升級**——`hero.js` 與 `fx3d.js` 都是 classic script，改成 ES Module 需要動 54 個頁面的載入方式，風險與收益不成比例。務實的做法：
  1. 短期：接受現況，但在 `vendor/` 加一個 `README.md` 註明版本與棄用狀態，避免未來有人誤以為可以隨手升級。
  2. 中期：若真要瘦身，考慮用 Three.js 的 tree-shaken 自訂 build（只打包用到的模組），通常可降到 150–200 KB。這需要引入 bundler，是本專案目前沒有的東西，成本不低。
- **修改成本**：S（加說明）／L（自訂 build）
- **修改風險**：低（加說明）／中（換 build 需驗證 54 頁特效）
- **驗證方式**：抽查各種 `data-fx` 的頁面（storm / snow / petals / stars…）確認特效正常。
- **是否需要人工確認**：**是** — 是否值得投入 bundler 需要擁有者決定。

---

### P-02 · 48 個劇本頁的 `<audio autoplay>` 沒有 `preload` 控制

- **優先級**：P2
- **問題面向**：效能 / 流量
- **檔案位置**：48 個劇本頁
- **發現依據**：
  ```
  48 頁：<audio id="bgm" src="…" autoplay loop muted>          ← 無 preload
   4 頁：<audio id="bgm" loop muted><source …>                  ← 無 preload
   1 頁：<audio id="bgm" src="…" autoplay loop muted playsinline preload="auto">
  ```
  MP3 大小：2 MB ～ 14.2 MB，平均約 5 MB。
- **問題說明**：帶 `autoplay` 的 `<audio>`，Chrome 會視同 `preload="auto"` 並下載整個檔案。因為同時有 `muted`，autoplay 政策允許它真的開始播放（靜音播放），所以整個檔案一定會被抓下來——**即使使用者從未點擊解除靜音**。
- **使用者影響**：行動網路使用者每瀏覽一個劇本頁就耗掉數 MB 流量，其中大部分人從未聽到任何聲音。
- **技術影響**：直接放大 D-01 的流量問題。
- **建議修正方式**：因為解除靜音本來就綁在「首次點擊」上（見 U-01），把 `preload` 設為 `none`，等使用者真的要聽再載入。
- **建議修改範例**：
  ```html
  <audio id="bgm" src="晴天神社.mp3" loop muted preload="none"></audio>
  ```
  ```js
  document.addEventListener('click', function () {
      const bgm = document.getElementById('bgm');
      if (!bgm) return;
      bgm.preload = 'auto';
      bgm.muted = false;
      bgm.volume = 0.3;
      bgm.play().catch(() => {});
  }, { once: true });
  ```
  （順帶把音量從預設 1.0 降到 0.3，目前只有 `5人/上路.html` 有做這件事。）
- **修改成本**：S（批次修改 52 頁，模式高度一致）
- **修改風險**：低（但需抽驗多個瀏覽器的 autoplay 行為）
- **驗證方式**：DevTools Network 面板，載入劇本頁但不點擊 → 不應有 MP3 請求；點擊後才開始下載並播放。
- **是否需要人工確認**：否

---

### P-03 · 441 張圖片幾乎都沒有 lazy loading 與尺寸屬性

- **優先級**：P2
- **問題面向**：效能 / CLS
- **檔案位置**：57 個劇本頁
- **發現依據**：
  ```
  總 <img> 標籤數        : 441
  有 loading="lazy"     :  23  (5.2%)
  有 width= 屬性         :   0  (0%)
  有 alt= 屬性           : 435  (98.6%)
  ```
  相對地，`scripts-data.js:360` 產生的首頁卡片**有**加 `loading="lazy"`——做法是對的，只是沒有推廣到劇本頁。
- **問題說明**：每個劇本頁平均有 8 張圖（海報 + 角色頭像 + 場景圖），全部在載入時同時請求。沒有 `width`/`height` 則會在圖片載入完成時造成版面跳動（CLS）。
- **使用者影響**：頁面載入時內容會上下跳動；行動網路上首屏變慢。
- **技術影響**：所有圖片都在 postimg.cc（見 P-05），441 個並發跨網域請求。
- **建議修正方式**：批次為首屏以下的 `<img>` 加上 `loading="lazy"` 與 `decoding="async"`。`width`/`height` 因為每張圖尺寸不同、需逐一查詢，成本較高——折衷做法是用 CSS `aspect-ratio` 為圖片容器保留空間（角色頭像通常是固定比例）。
- **建議修改範例**：
  ```html
  <img src="https://i.postimg.cc/…" alt="夏瞳" loading="lazy" decoding="async">
  ```
  ```css
  /* 各頁自己的 <style> 內，角色頭像容器 */
  .char-avatar { aspect-ratio: 3 / 4; object-fit: cover; }
  ```
- **修改成本**：M
- **修改風險**：低
- **驗證方式**：Lighthouse 的 CLS 分數改善；Network 面板確認捲動時才載入下方圖片。
- **是否需要人工確認**：否

---

### P-05 · 482 張圖片全部依賴單一免費圖床

- **優先級**：P2
- **問題面向**：可靠性 / 第三方依賴
- **檔案位置**：全站（`scripts.js` 的 `poster` 欄位 + 57 個劇本頁）
- **發現依據**：外部網域統計：
  ```
  482  https://i.postimg.cc     ← 幾乎全部的圖片
   10  https://i0.wp.com
    2  https://custom-images.strikinglycdn.com
  ```
  劇本頁的 `<img>` 沒有 `onerror` fallback（`榮譽牆.html:1032-1034` **有**做 placeholder fallback，是好例子，但只有那一頁）。
- **問題說明**：postimg.cc 是免費圖床，無 SLA、無保證長期保存、有權隨時清理或變更政策。全站視覺（劇本海報、角色頭像、場景圖）100% 押在上面。
- **使用者影響**：圖床一旦故障或清檔，全站 53 個劇本頁 + 首頁卡片全部變成破圖，網站基本上不可用。
- **技術影響**：沒有備份、沒有 fallback、沒有本地副本。
- **建議修正方式**：這是**成本最高但風險也最高**的一項，建議分階段：
  1. **立即（XS）**：把 `榮譽牆.html` 已有的 `onerror` placeholder 做法推廣到 `scripts-data.js` 的卡片渲染，至少破圖時有優雅降級。
  2. **短期（S）**：把 482 個圖片 URL 做一次完整備份到本機或雲端硬碟，確保圖床掛掉時有東西可以還原。
  3. **中期（L）**：評估是否要把海報搬到 repo（會增加部署量，與 D-01 衝突）或改用有保障的圖床/物件儲存。
- **建議修改範例**（階段 1）：
  ```js
  // scripts-data.js:360
  const ph = `https://placehold.co/400x566/2b2b2b/eeeeee?text=${encodeURIComponent(s.name)}`;
  `<img src="${img}" alt="${s.name}" class="script-image" loading="lazy"
        onerror="this.onerror=null;this.src='${ph}'">`
  ```
  （注意 `placehold.co` 本身也是第三方，僅作為降級；真正穩妥的做法是用一張本地的通用佔位圖。）
- **修改成本**：XS（fallback）／S（備份）／L（遷移）
- **修改風險**：低（前兩項）／中（遷移）
- **驗證方式**：DevTools 阻擋 `i.postimg.cc`，確認首頁卡片顯示佔位圖而非破圖 icon。
- **是否需要人工確認**：**是** — 遷移與否需要擁有者決定。

---

### C-01 · `榮譽牆.html` 單檔 1618 行，四種關注點混在一起

- **優先級**：P2
- **問題面向**：可維護性
- **檔案位置**：`榮譽牆.html`
- **發現依據**：
  ```
  第    1–12 行  : <head> + 3 個外部 <script>
  第  13–771 行  : 759 行內嵌 CSS
  第 772–832 行  : HTML 結構
  第 833–1615 行 : 782 行 JavaScript（資料轉換 + 商業邏輯 + DOM 渲染 + 動畫 + 音效）
  ```
  同一個 `DOMContentLoaded` 回呼裡包含：Tone.js 音效初始化、4 段 CORS fallback 邏輯、CSV 解析、玩家記錄聚合、稱號規則（`calculateTitle`）、徽章統計（`updateScriptBadges`）、印章渲染、排行榜渲染、便利貼物理位置計算與不規則 clip-path 生成、6 組事件綁定。
- **問題說明**：這是全專案最難維護的檔案，也是**唯一同時有 XSS、CDN 單點、死碼、空狀態 bug 的檔案**——這不是巧合，複雜度直接轉化成缺陷密度。
- **使用者影響**：間接。缺陷難以發現與修復。
- **技術影響**：任何修改都要在 1618 行裡找位置；AI 協作時整檔進 context 成本高；多人/多 session 同時改容易衝突。
- **建議修正方式**：**採漸進式拆分，不要一次重寫。** 建議順序（每一步都可獨立驗證）：
  1. CSS → `honor-wall.css`（純搬移，風險最低，立刻少 759 行）
  2. 資料層 → `honor-data.js`：`fetchPlayData()` + CSV 解析 + 記錄聚合（回傳純資料，不碰 DOM）
  3. 規則層 → `honor-rules.js`：`calculateTitle()` + `updateScriptBadges()` 的統計部分（純函式，最容易寫測試）
  4. 渲染層留在頁面內
  拆分時**順手修掉 S-02 的轉義**與 C-03 的死碼。
- **修改成本**：M
- **修改風險**：中（動到榮譽牆全部功能，需完整回歸測試）
- **驗證方式**：拆分前後對照——53 張卡片、排行榜前 20、選玩家後的印章、點卡片的便利貼、搜尋框，全部行為一致。
- **是否需要人工確認**：否

---

### C-02 · CSV 解析、`escapeHtml`、Sheet URL 各有兩份實作

- **優先級**：P2
- **問題面向**：可維護性 / 重複程式碼
- **檔案位置**：
  | 重複項 | 位置 A | 位置 B |
  |--------|--------|--------|
  | CSV 解析 | `reviews.js:232-259`（自寫，支援引號/逗號/換行） | `榮譽牆.html:986`（PapaParse CDN） |
  | `escapeHtml` | `reviews.js:261-265`（5 字元完整） | `疯兔子搜尋.html:287-289`（只 3 字元，缺 `"` `'`） |
  | Google Sheet CSV URL | `reviews.js:14` | `榮譽牆.html:861` |
  | 星星渲染 | `reviews.js:211-215` `renderStars()` | `榮譽牆.html:1051-1060` `generateStars()` |
- **問題說明**：兩份 CSV 解析各自從**同一份 CSV**讀**同樣的欄位**（`劇本`、`50字以內的心得推薦`、`給予評價`、`心情`、`角色*`），卻產出結構不同的物件，且轉義策略不同。**S-02 的 XSS 就是這個重複造成的**——`reviews.js` 那份有轉義、`榮譽牆.html` 那份沒有。
- **技術影響**：Google Form 欄位改名時要同時改兩個地方；漏改一處就會有一邊靜默失效。
- **建議修正方式**：建立 `csv-utils.js` 共用檔，匯出 `parseCSV()`、`escapeHtml()`、`renderStars()` 與 `SHEET_CSV_URL` 常數。兩邊都改用它，順便讓 `榮譽牆.html` 不再需要 PapaParse（同時解決 S-03 的一半）。
- **建議修改範例**：
  ```js
  // csv-utils.js
  window.StarfishCSV = {
      SHEET_URL: 'https://docs.google.com/spreadsheets/d/e/2PACX-…/pub?output=csv',
      parseCSV(text) { /* 取自 reviews.js:232 */ },
      escapeHtml(s)  { /* 取自 reviews.js:261 */ },
      renderStars(r) { /* 取自 reviews.js:211 */ }
  };
  ```
- **修改成本**：S
- **修改風險**：低（純抽取，行為不變），但需全站進版號 + 同步 `service-worker.js`
- **驗證方式**：榮譽牆與劇本頁評價彈窗的資料顯示完全一致。
- **是否需要人工確認**：否

---

### D-02 · `榮譽牆.html` 載入 `scripts.js` 時沒有版本號

- **優先級**：P2
- **問題面向**：部署 / 快取
- **檔案位置**：`榮譽牆.html:12`
- **發現依據**：全站版本號統計：
  ```
  53  reviews.js?v=20260714
  53  fx3d.js?v=20260714
  53  bgm-control.js?v=20260727
   2  scripts.js?v=20260727-jinmen2      ← index.html + 新增玩本記錄.html
   1  scripts-data.js?v=20260716
  ```
  但 `榮譽牆.html:12` 是：
  ```html
  <script src="scripts.js"></script>       <!-- 沒有 ?v= -->
  ```
- **問題說明**：`CLAUDE.md` 明文規定「**共用 JS 一律帶 `?v=` 版本號**（GitHub Pages 快取 10 分鐘）」。這是唯一的違反處。`service-worker.js` 的 `APP_SHELL` 收錄的是 `./scripts.js?v=20260727-jinmen2`，因此 `榮譽牆.html` 請求的裸 `scripts.js` 會落到 runtime cache 的**另一個** entry，走 stale-while-revalidate——會先回舊快取。
- **使用者影響**：新增劇本後，已安裝 PWA 的使用者在首頁看得到新劇本，但榮譽牆上看不到，且可能持續數天。
- **技術影響**：這是 `CLAUDE.md` 特別警告過的陷阱的實例。
- **建議修正方式**：
  ```html
  <script src="scripts.js?v=20260727-jinmen2"></script>
  ```
  並在 `service-worker.js` 的 `APP_SHELL` 加入 `'./榮譽牆.html'` 已有、但確認 `scripts.js` 只有一個版本被請求。
- **修改成本**：XS
- **修改風險**：低
- **驗證方式**：DevTools Network 確認榮譽牆請求的是帶版號的 URL；新增一筆劇本後在已安裝的 PWA 上確認榮譽牆有出現。
- **是否需要人工確認**：否

---

### U-01 · BGM 首次點擊即解除靜音，無音量控制，且停止後不會恢復

- **優先級**：P2
- **問題面向**：UX
- **檔案位置**：52 個劇本頁的解除靜音腳本、`bgm-control.js:33-41`
- **發現依據**：典型模式（以 `6人/晴天神社.html:687-691` 為例）：
  ```js
  document.addEventListener('click', function(){
      document.getElementById('bgm').muted = false;
  }, {once:true});
  ```
  而 `bgm-control.js` 在失焦/隱藏時會**完全停止並歸零**：
  ```js
  function stopAudio() { audio.pause(); audio.currentTime = 0; }
  window.addEventListener('blur', stopAudio);
  document.addEventListener('visibilitychange', onVisibilityChange, { passive: true });
  ```
  全站僅 `5人/上路.html:893` 有設定 `audio.volume = 0.3`。
- **問題說明**：三個問題疊在一起。
  1. **任何**首次點擊都會解除靜音——包括點「← 返回劇本總覽」、點「💬 玩家評價」、點角色卡。使用者不是在要求播放音樂，只是想操作頁面。
  2. 音量是預設的 1.0（除了一頁）。多數 BGM 是氛圍音樂，全音量偏大。
  3. 解除靜音的監聽是 `{once:true}`。使用者切到別的分頁 → `bgm-control.js` 停掉音樂 → 切回來時監聽器早已被移除，**音樂再也不會播放**，而且頁面上沒有任何按鈕可以重新開始。
  4. 全站沒有任何靜音/音量控制。使用者唯一能停止音樂的方法是關閉分頁。
- **使用者影響**：在安靜環境或公共場合瀏覽劇本頁，點一下就突然全音量播放音樂且關不掉，是很容易造成負面觀感的體驗。
- **技術影響**：頁內腳本與 `bgm-control.js` 對 audio 元素的控制權重疊，行為互相干擾。
- **建議修正方式**：在 `bgm-control.js`（已在每頁載入）加入一顆浮動的播放/靜音按鈕，並把解除靜音的責任從各頁腳本移過來。這樣 52 頁不用逐頁改。
- **建議修改範例**：
  ```js
  // bgm-control.js 內
  const btn = document.createElement('button');
  btn.className = 'bgm-toggle';
  btn.setAttribute('aria-label', '播放背景音樂');
  btn.textContent = '🔇';
  btn.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:9997;' +
      'width:44px;height:44px;border-radius:50%;border:none;cursor:pointer;' +
      'background:rgba(0,0,0,.6);color:#fff;font-size:1.1rem';
  document.body.appendChild(btn);

  btn.addEventListener('click', () => {
      if (audio.muted || audio.paused) {
          audio.muted = false; audio.volume = 0.3;
          audio.play().catch(() => {});
          btn.textContent = '🔊'; btn.setAttribute('aria-label', '關閉背景音樂');
      } else {
          audio.pause();
          btn.textContent = '🔇'; btn.setAttribute('aria-label', '播放背景音樂');
      }
  });
  // stopAudio() 時同步把按鈕圖示改回 🔇
  ```
  同時建議移除各頁的 `{once:true}` 解除靜音腳本，改為完全由使用者主動觸發。
- **修改成本**：M（`bgm-control.js` 改動小，但要移除 52 頁的舊腳本並確認 FAB 不與 `reviews.js` 的評價按鈕重疊——`reviews.js` 的 FAB 在 `bottom:84px`，所以 `bottom:20px` 剛好錯開）
- **修改風險**：中（影響 52 頁）
- **驗證方式**：抽 5 頁確認：載入時無聲、按鈕可播放/停止、切分頁再切回來按鈕仍可用、與評價 FAB 不重疊。
- **是否需要人工確認**：**是** — 「點擊自動播放」可能是刻意的沉浸式設計，需要擁有者確認是否要改。

---

### U-02 · 榮譽牆便利貼在視窗縮放時全部清除

- **優先級**：P2
- **問題面向**：UX / Responsive
- **檔案位置**：`榮譽牆.html:1600-1609`
- **發現依據**：
  ```js
  window.addEventListener('resize', () => {
      clearTimeout(window.resizeTimeout);
      window.resizeTimeout = setTimeout(() => {
          commentBubbleContainer.innerHTML = '';   // 直接清空
      }, 250);
  });
  ```
- **問題說明**：便利貼位置是用 `window.innerWidth/innerHeight` 算出來的絕對像素（`榮譽牆.html:1444-1447`），所以視窗變化後位置會失效——但處理方式是「直接全部清掉」。
- **使用者影響**：**在手機上這個問題被放大很多**。iOS Safari 與 Android Chrome 在捲動時會收合/展開網址列，這會觸發 `resize`。使用者點劇本卡片叫出便利貼、開始閱讀、稍微捲動一下——便利貼全部消失，必須重新點卡片。
- **技術影響**：`window.resizeTimeout` 掛在 global 上，是隱含的全域污染。
- **建議修正方式**：改為只在**寬度**變化時清除（網址列收合只改變高度），或更好的做法是把定位改成相對百分比，resize 時重新計算而不是清除。
- **建議修改範例**：
  ```js
  let lastWidth = window.innerWidth;
  let resizeTimer = null;
  window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
          if (window.innerWidth === lastWidth) return;   // 只有高度變（網址列）→ 不動
          lastWidth = window.innerWidth;
          commentBubbleContainer.innerHTML = '';
      }, 250);
  });
  ```
- **修改成本**：XS
- **修改風險**：低
- **驗證方式**：手機上叫出便利貼後上下捲動，確認便利貼不消失；旋轉螢幕則清除。
- **是否需要人工確認**：否

---

### I-01 · 主持人資訊頁的分享網址仍是 `https://example.com/`

- **優先級**：P2
- **問題面向**：SEO / 分享效果
- **檔案位置**：`主持人資訊.html:14,21`
- **發現依據**：
  ```html
  <meta property="og:url" content="https://example.com/"> <!-- TODO: Replace with actual URL -->
  <meta property="twitter:url" content="https://example.com/"> <!-- TODO: Replace with actual URL -->
  ```
  對照 `index.html:9` 是正確的：`https://cj2vum4.github.io/starfishlarp/index.html`。
- **問題說明**：`og:url` 是分享時的正規網址。這是**最需要被分享的一頁**（招攬客人用），而 og:title / og:description / og:image 都寫得很好，唯獨 URL 是佔位符。
- **使用者影響**：分享到 LINE / Facebook 時，預覽卡片的來源顯示為 `example.com`，看起來像詐騙連結，也可能導致點擊後導向錯誤位置。
- **技術影響**：搜尋引擎可能把 `example.com` 當成 canonical。
- **建議修正方式**：
  ```html
  <meta property="og:url" content="https://cj2vum4.github.io/starfishlarp/主持人資訊.html">
  <meta property="twitter:url" content="https://cj2vum4.github.io/starfishlarp/主持人資訊.html">
  <link rel="canonical" href="https://cj2vum4.github.io/starfishlarp/主持人資訊.html">
  ```
- **修改成本**：XS
- **修改風險**：低
- **驗證方式**：用 Facebook Sharing Debugger 或 LINE 實際分享一次確認預覽正確。
- **是否需要人工確認**：否

---

### I-02 · 劇本頁缺乏基本 SEO 與分享標記；站台缺少 sitemap / robots / 404

- **優先級**：P2
- **問題面向**：SEO / 部署
- **發現依據**：
  ```
  57 個劇本頁：
    有 <title>            : 57/57  ✅
    有 meta description   :  1/57
    有 og:* 標記          :  1/57
    有 <h1>               : 56/57（缺：7人/天才在左我在右-player.html）
  repo 根目錄：
    404.html / robots.txt / sitemap.xml / .nojekyll  → 全部沒有
  ```
- **問題說明**：需要區分優先級——
  - **需要 SEO 的**：`index.html`、`主持人資訊.html`（招客）、`劇本介紹.html`（新手搜尋「劇本殺怎麼玩」）。這三頁的 SEO 標記其實**已經做得不錯**（`主持人資訊.html` 甚至有 JSON-LD 結構化資料），只差 I-01 的 URL。
  - **不太需要 SEO 的**：53 個劇本詳細頁。搜尋「王座 劇本殺」的人多半是想找劇本資訊而非預約，SEO 收益有限。
  - **但分享效果很重要**：主持人很可能把劇本頁連結直接貼到 LINE 群給玩家看。目前貼過去只有標題，沒有海報預覽——這才是真正的損失。
- **使用者影響**：LINE 分享劇本頁沒有海報縮圖，說服力大打折扣。按 ESC 掉到 404 時（F-02）看到的是 GitHub 的英文預設頁。
- **建議修正方式**（按投資報酬率排序）：
  1. **最高 CP 值**：為 53 個劇本頁批次加上 `og:title` / `og:description` / `og:image`。資料全部都在 `scripts.js` 裡（`name` / `types` / `poster`），可以寫一個小腳本批次產生。
  2. 建立 `404.html`（可直接改 `offline.html` 的樣式，已經有品牌設計了）。
  3. 建立 `sitemap.xml`（同樣可從 `scripts.js` 產生）與 `robots.txt`。
  4. 加空的 `.nojekyll` 檔，跳過 GitHub Pages 的 Jekyll 處理，加快部署也避免特殊檔名被過濾。
- **建議修改範例**（劇本頁 og 標記樣板）：
  ```html
  <meta name="description" content="王座 · 7人（4男3女）· 4.5小時 · 神話/陣營/機制 — 海星劇本殺">
  <meta property="og:type" content="article">
  <meta property="og:url" content="https://cj2vum4.github.io/starfishlarp/7人/王座.html">
  <meta property="og:title" content="王座｜海星劇本殺">
  <meta property="og:description" content="7人 · 4.5小時 · 神話/陣營/機制">
  <meta property="og:image" content="https://i.postimg.cc/d0cKpGxL/2021-11-13-195627.jpg">
  ```
- **修改成本**：M（批次腳本 + 驗證）
- **修改風險**：低（純 `<head>` 新增，不影響既有行為）
- **驗證方式**：LINE 分享 3 個劇本頁確認出現海報預覽；`/sitemap.xml` 與 `/404.html` 可正常存取。
- **是否需要人工確認**：否

---

### C-03 ~ C-05、K-01 ~ K-04、O-01、L-01、Q-01、U-03、P-06、I-03（P3 項目彙整）

以下項目影響較小，合併說明：

| ID | 說明 | 檔案 | 建議 |
|----|------|------|------|
| **C-03** | `bubbleColors` 9 色陣列宣告後**零使用**（已被 `stickyNoteColors` 取代） | `榮譽牆.html:844-854` | 可安全刪除。11 行死碼，會誤導維護者以為有兩套配色系統 |
| **C-04** | 5 頁檢查 `requiredElements = ['scrollProgress','title']`，但這些頁面沒有 `id="title"` 的元素 → 每次載入 `console.warn('缺少必要元素:', ['title'])` | `5人/風中有朵雨做的雲.html:742` 等 5 頁 | 從陣列移除 `'title'`，或整段移除（這是 AI 產生的除錯樣板，沒有實際用途） |
| **C-05** | `hero.js` 的 `visibilitychange` 處理器在頁面恢復可見時呼叫 `animate()`，但**沒有取消先前 pending 的 rAF**。實際分頁切換時 rAF 會被瀏覽器暫停，恢復順序是「visibilitychange 事件 → rAF 回呼」，因此每次切換可能疊加一條動畫迴圈 | `hero.js:194-197` | 用 `cancelAnimationFrame` 保存並取消 handle：<br>`let rafId=null;`<br>`function animate(){ if(!running) return; rafId=requestAnimationFrame(animate); …}`<br>`// visibilitychange 時：if(rafId) cancelAnimationFrame(rafId);` |
| **K-01** | 無 `package.json` / lock file / lint / test / CI / Node 版本宣告 | repo 根 | 見 §9 Phase 4 的最小可行測試方案 |
| **K-02** | `.gitignore` 只有 `.claude/`。`.env.example` 存在意味著開發時會有 `.env`，但它沒被忽略 | `.gitignore` | 加入 `.env`、`.env.local`、`node_modules/`、`.DS_Store`、`__pycache__/`。**這是預防性修正**——目前歷史中沒有真實金鑰 |
| **K-03** | `supabase_schema.sql` 只定義 `cards` 表，但程式實際使用 `game_state` 與 `player_state`（各有 upsert/select/realtime channel） | `supabase_schema.sql` | 補上這兩張表的 DDL 與 RLS 政策。沒有這個，Supabase 專案掛掉就無法重建，也沒人能審查目前的權限設定（S-05 的根源） |
| **K-04** | `ocr_batch.py:136` 使用 `model="claude-opus-4-8"`（過時 ID），註解寫「使用最新 Opus」 | `ocr_batch.py:136` | 更新為 `claude-opus-5`。這是本機工具，不影響網站 |
| **O-01** | `README.md` 是每日開發流水帳，沒有安裝/啟動/部署說明。結尾寫「總共47個劇本」，實際是 53 | `README.md` | 保留流水帳（有紀念價值，可移到 `CHANGELOG.md`），README 改為：專案簡介 / 本機預覽指令（`python3 -m http.server`）/ 目錄說明 / 新增劇本流程（指向 `CLAUDE.md`）/ 部署方式 |
| **L-01** | `8人以上/龍宴.html:751` 的 BGM 來自 GitHub Releases，其他 52 頁都是本地 MP3。`6人/那一束月光.html:704` 的註解寫「托管於 GitHub Releases，不佔 repo 空間」，但 `src="那一束月光.mp3"` 是本地檔案且確實在 repo 裡（10.8 MB） | 2 個劇本頁 | 決定統一策略（見 D-01），並修正那句錯誤註解 |
| **Q-01** | `6人/太陽問卷.html`（42 KB，有自己的 Apps Script 端點）與 `6人/瘋兔子_主持.html`（連向 `疯兔子搜尋.html`）**沒有任何頁面連結到它們** | 2 個檔案 | **需要人工確認** — 很可能是刻意用 QR code 或直接傳網址給玩家/主持人使用的。**不建議直接刪除** |
| **U-03** | 5 套視覺系統並存：`index.css`（金色暗黑）、`榮譽牆.html` 內嵌（Bootstrap 風藍灰）、Tailwind CDN ×2（青色科技風）、`honor-form.css`（金色暗黑，與首頁一致）| 共用頁 | `CLAUDE.md` 的「不共用 CSS」原則**只適用於劇本介紹頁**。共用頁之間的不一致確實是拼接感的來源。建議至少讓 `榮譽牆.html` 向 `index.css` 的設計語言靠攏（它是首頁抽屜的主要去處之一）。這是最花時間的一項，優先度低 |
| **P-06** | 84 個 `target="_blank"` 中只有 2 個有 `rel`。現代瀏覽器已隱含 `noopener`，所以安全風險有限，但 referrer 仍會外洩 | 全站 | 批次補 `rel="noopener noreferrer"`。低風險、低效益，可與其他批次修改一起做 |
| **I-03** | `lang` 屬性混用：`index.html` / `榮譽牆.html` / `新增玩本記錄.html` / 57 劇本頁用 `zh-Hant`；`劇本介紹.html` / `主持人資訊.html` 用 `zh-TW` | 2 頁 | 統一為 `zh-Hant`（更精確，涵蓋所有繁體地區） |
| **P-07** | `劇本介紹.html` 與 `主持人資訊.html` 使用 Tailwind Play CDN（`cdn.tailwindcss.com`），官方明文標示不適用於正式環境——它會在瀏覽器端即時編譯 CSS，造成 FOUC 與額外執行開銷；實測 CDN 失敗時整頁樣式全失 | 2 頁 | **不建議現在改**。改掉需要引入建置流程或手寫替代 CSS，成本 M～L，而這兩頁目前運作正常。列為 P4，等有 bundler 時再處理 |

---

## 6. 純前端限制與後端需求

### ✅ 可以繼續使用純前端完成（不需要改變）

| 功能 | 理由 |
|------|------|
| 劇本總覽 / 篩選 / 排序 | 53 筆資料完全靜態，`scripts.js` 作為單一來源已經是很好的設計 |
| 53 個劇本介紹頁 | 純展示內容，每頁獨立設計是刻意的產品決策 |
| 3D Hero 與各頁背景特效 | 純視覺，`fx3d.js` 的 fallback 設計已經很完整 |
| PWA / 離線瀏覽 | Service Worker 就是為此設計的 |
| 劇本介紹（新手指南） | 靜態內容 |

### ⚠️ 純前端可以暫時完成，但存在限制（要認知並接受）

| 功能 | 目前風險 | 暫時可接受的純前端做法 | 正式產品應採用的後端方案 |
|------|---------|---------------------|----------------------|
| **玩本記錄寫入** | Apps Script 端點公開，任何人可 POST 任意記錄（假名字、假評分、含 HTML 的角色名）。無法防重複提交 | 保留 honeypot；**必須**做輸出轉義（S-02）；Apps Script 端加 HTML 標籤過濾與簡單速率限制 | 需要登入的 API，寫入前驗證使用者身分與劇本/角色的合法性 |
| **榮譽牆展示** | 資料來自公開 CSV，任何人都能看到所有玩家的暱稱與心得 | 目前資料是化名 + 自願分享的心得，可接受。但要移除第三方 CORS proxy（S-07） | 需要登入才能看完整記錄；自己的記錄可編輯/刪除 |
| **玩家評價彈窗** | 同上 | `reviews.js` 已正確轉義，可維持 | 同上 |
| **瘋兔子線索搜尋** | 整本劇本可被匿名 dump（S-06） | 收緊 RLS 為需認證；該頁本來就沒有公開入口 | Supabase Auth + 主持人角色 RLS |

### ❌ 正式上線前應加入後端（或至少加入認證）

| 功能 | 為什麼純前端做不到 |
|------|------------------|
| **GM 控台（天才在左）** | 「只有主持人能看 GM 筆記」本質上需要伺服器端授權。目前 GM 筆記寫死在 HTML 裡，任何人 View Source 就全看完。改檔名只是拖延時間 |
| **遊戲場次狀態同步** | `game_state` / `player_state` 目前允許匿名讀寫，任何人可竄改任何場次。需要 Supabase Auth + 以 session 擁有者為條件的 RLS |
| **訂位表單** | 目前完全失效（S-01）。即使修好 Formspree，也只是把資料丟到第三方；若要做檔期衝突檢查、確認信、取消流程，就需要真正的後端 |

### 🚨 必須立即移出前端的資料或功能

| 項目 | 位置 | 為什麼必須立即處理 |
|------|------|------------------|
| **劇本 PDF（角色劇本 / 搜證卡 / 手冊 / 台詞卡）** | `劇本資料/`（76 MB，27 檔） | 正版付費內容公開散布，同時是劇透與著作權風險。這是本次審查中唯一有法務層面影響的項目 |
| **GM 筆記全文** | `7人/天才在左我在右-GM.html`（硬編在 JS 物件中） | 從公開劇本頁一鍵可達，直接毀掉遊戲體驗 |
| **劇本 OCR 全文** | Supabase `cards` 表（`USING (true)` 公開讀取） | 同上，只是換了載體 |

---

## 7. 可刪除或待確認項目

### 🟢 可以安全刪除

| 項目 | 位置 | 依據 |
|------|------|------|
| `bubbleColors` 陣列（11 行） | `榮譽牆.html:844-854` | 全檔僅宣告處 1 次出現，零使用。已被 `stickyNoteColors` 完全取代 |
| `requiredElements` 中的 `'title'` | `5人/風中有朵雨做的雲.html:742` 等 5 頁 | 這些頁面確實沒有 `id="title"` 的元素，檢查必然失敗並印出警告。屬 AI 產生的除錯樣板 |
| ESC 鍵導航（5 處） | 見 F-02 的檔案清單 | 路徑錯誤導致 404，且與 `reviews.js` 的 ESC 語意衝突。返回按鈕已存在 |
| `goToPage()` 函式 | `scripts-data.js:281-283` | 修完 A-01 改用真 `<a href>` 後就沒有呼叫者了 |

### 🟡 很可能可以刪除（建議先確認）

| 項目 | 位置 | 依據 | 需確認什麼 |
|------|------|------|-----------|
| 三個公共 CORS proxy | `榮譽牆.html:870-872` | 隱私與 XSS 風險（S-07），程式碼註解本身就建議改用自建 GAS proxy | 直連 Google Sheet 目前是否穩定 |
| `劇本資料/` 全部 27 檔 | `劇本資料/` | 正版劇本內容不應公開（S-04） | 移除前需先處理 `scripts.js` 中 `fengtuz` 的本地海報路徑 |
| `img/cards/` 27 張（22 MB） | `img/cards/` | 僅 `天才在左我在右-GM/-player.html` 使用 | 若那兩頁要改為需認證，這些圖也應一併保護 |
| 龍宴的 GitHub Releases BGM | `8人以上/龍宴.html:751` | 與其他 52 頁策略不一致（L-01） | 要統一成哪一種 |

### 🔴 需要人工確認（**不要直接刪除**）

| 項目 | 位置 | 為什麼不確定 |
|------|------|-------------|
| `6人/太陽問卷.html`（42 KB） | 無任何入口連結 | 它是「太陽可以是藍色嗎」的**遊戲前測問卷**，有完整的角色分配演算法與自己的 Apps Script 端點（`AKfycbw4y7…`）。很可能是開場前用 QR code 或直接傳網址給玩家填的。**看起來沒被引用，不代表沒在用** |
| `6人/瘋兔子_主持.html` | 無任何入口連結 | 瘋兔子的主持人專用頁，連向 `疯兔子搜尋.html`。同上，很可能是主持人自己存書籤用的 |
| `疯兔子搜尋.html` | 僅被上者連結 | 線索搜尋工具，看起來是實際在用的主持輔助工具 |
| `7人/天才在左我在右-GM.html` / `-player.html` | 從公開劇本頁連結 | **功能是有用的**（Supabase 即時同步的線上開本工具）。問題在於沒有存取控制，不是功能本身沒用 |
| `ocr_batch.py` | 本機工具 | 是產生 Supabase `cards` 資料的工具，仍有價值。但應考慮移出部署範圍 |
| `supabase_schema.sql` | 設定檔 | 內容不完整（缺 2 張表），但不該刪除——該補完 |

### 未使用的套件

**無。** 本專案沒有 `package.json`，唯一的 vendored 依賴 `vendor/three.min.js` 確實被 `index.html` 與 `fx3d.js` 使用。

### 重複程式碼彙整

| 重複項 | 份數 | 位置 |
|--------|------|------|
| CSV 解析 | 2 | `reviews.js:232` / `榮譽牆.html:986`（PapaParse） |
| `escapeHtml` | 2（且不一致） | `reviews.js:261`（5 字元）/ `疯兔子搜尋.html:287`（3 字元） |
| 星星渲染 | 2 | `reviews.js:211` / `榮譽牆.html:1051` |
| Google Sheet CSV URL | 2 | `reviews.js:14` / `榮譽牆.html:861` |
| BGM 解除靜音腳本 | 52（幾乎完全相同） | 各劇本頁 |
| Supabase 連線設定 | 3 | `疯兔子搜尋.html` / GM / player |

---

## 8. 建議重構方向

### 核心原則

1. **不重寫整個專案。** 目前 53 個劇本頁運作正常、視覺各有特色，這是專案最大的資產。
2. **尊重 `CLAUDE.md` 的架構決策。** 「每頁獨立 CSS」是刻意的產品決策，不是技術債。**不要**把劇本頁 CSS 抽成共用檔。
3. **改動集中在「共用層」與「壞掉的東西」**，不碰視覺。

### 建議的資料夾結構（漸進式，不搬動既有頁面）

```
starfishlarp/
├── index.html  榮譽牆.html  新增玩本記錄.html  ...     ← 頁面維持在根目錄（GitHub Pages 路由簡單）
│
├── js/                          ← 新增：共用 JS 集中（目前散在根目錄）
│   ├── data/
│   │   └── scripts.js           劇本資料（單一來源，位置不變較安全，可先不搬）
│   ├── shared/
│   │   ├── csv-utils.js         ★ 新增：parseCSV / escapeHtml / renderStars / SHEET_URL
│   │   └── dom-utils.js         ★ 新增：共用的 DOM 小工具
│   ├── pages/
│   │   ├── home.js              （現 scripts-data.js）
│   │   ├── honor-wall.js        ★ 從 榮譽牆.html 抽出
│   │   └── play-record.js
│   └── widgets/
│       ├── reviews.js           評價彈窗
│       ├── fx3d.js              3D 特效引擎
│       └── bgm-control.js       BGM 控制（+ 新增播放按鈕）
│
├── css/
│   ├── index.css
│   ├── honor-form.css
│   └── honor-wall.css           ★ 從 榮譽牆.html 抽出的 759 行
│
├── vendor/three.min.js
├── tools/ocr_batch.py           ★ 移出根目錄，並排除部署
└── docs/supabase_schema.sql     ★ 補完 game_state / player_state
```

> **注意**：搬動檔案會改變所有 `<script src>` 路徑（含 53 個劇本頁的 `../fx3d.js`）與 `service-worker.js` 的 `APP_SHELL`。**建議只在確實要重構那個檔案時才搬**，不要為了整理而整理。最低成本的做法是：新增的共用檔（`csv-utils.js`）直接放根目錄，與現有慣例一致。

### 「Component 拆分」在無框架專案的對應做法

本專案沒有框架，所以「Component」的對應物是**自我註冊的 widget 腳本**——而 `reviews.js` 已經示範了很好的模式：

```js
(function () {
    'use strict';
    // 1. 從 data-* 或約定的全域變數讀設定
    // 2. 自己注入需要的 CSS
    // 3. 自己建立 DOM 並掛載
    // 4. 自己綁定事件
})();
```

**建議把這個模式推廣到：**

| 新 widget | 取代什麼 | 收益 |
|-----------|---------|------|
| `bgm-control.js` 加入播放按鈕 | 52 頁重複的解除靜音腳本 | 一次修好 U-01，52 頁不用改 |
| `reduced-motion.js`（或併入 `fx3d.js`） | 53 頁缺少的 reduced-motion 支援 | 一次修好 A-03 |
| `page-meta.js`（建置期腳本，非執行期） | 53 頁缺少的 og 標記 | 從 `scripts.js` 批次產生 I-02 |

### Services / Utils / Constants 規劃

```js
// csv-utils.js — 資料存取層（取代兩套重複實作）
window.StarfishCSV = {
    SHEET_URL: '…',
    async fetchRecords()    { /* fetch + parse + 聚合，回傳純資料 */ },
    parseCSV(text)          { /* 取自 reviews.js */ },
    escapeHtml(s)           { /* 取自 reviews.js，5 字元完整版 */ },
    renderStars(rating)     { /* 取自 reviews.js */ }
};

// script-utils.js — 劇本資料存取層
window.StarfishScripts = {
    all()                   { return window.SCRIPTS || []; },
    byId(id)                { return this.all().find(s => s.id === id); },
    byReviewKey(key)        { return this.all().find(s => s.reviewKey === key); },
    allTypes(minCount = 3)  { /* 見 F-05 */ },
    validate()              { /* 見 F-06 的自檢 */ }
};
```

### 資料存取層規劃（為未來接後端鋪路）

目前 CSV 讀取邏輯直接寫在頁面裡。抽成 `StarfishCSV.fetchRecords()` 後，**未來換成真正的 API 只需要改這一個函式**：

```js
// 現在
async fetchRecords() {
    const csv = await fetch(this.SHEET_URL).then(r => r.text());
    return this.parseCSV(csv).map(normalizeRow);
}

// 未來接後端
async fetchRecords() {
    return fetch('/api/play-records', { credentials: 'include' }).then(r => r.json());
}
```

### 未來串接後端時需要改動的部分

| 區塊 | 現況 | 接後端時的改動 | 難度 |
|------|------|--------------|------|
| 劇本資料 | `scripts.js` 靜態陣列 | 幾乎不用改（劇本資料本來就適合靜態） | 極低 |
| 玩本記錄讀取 | CSV → 兩套解析器 | 改 `StarfishCSV.fetchRecords()` 一處 | 低（**前提是先做 C-02 的抽取**） |
| 玩本記錄寫入 | `no-cors` POST Apps Script | 改 `postRecord()` 一處 + 加認證 | 低（**前提是先做 F-03**） |
| GM / 玩家工具 | Supabase anon key 直連 | 加 Supabase Auth + 重寫 RLS | 中 |
| 訂位 | Formspree（未設定） | 改 form action + 加確認流程 | 低～中 |
| 使用者身分 | 無 | 全新功能 | 高 |

**結論：只要先完成 C-02（抽取資料存取層）與 F-03（修正寫入回饋），未來接後端的改動面積會非常小。** 這也是為什麼建議把這兩項排在架構改善階段的最前面。

---

## 9. 優化 Roadmap

### Phase 1：立即修正（P0 / P1，建議 1 週內）

| # | 修改項目 | 涉及檔案 | 成本 | 相依 | 驗證方式 |
|---|---------|---------|------|------|---------|
| 1 | 修好訂位表單（S-01） | `主持人資訊.html:503` | XS～S | 需擁有者提供 Formspree ID 或決定改用 Apps Script | 實際送出一次並確認收到 |
| 2 | 榮譽牆兩處輸出轉義（S-02） | `榮譽牆.html:1157,1221` | S | 建議同時建立 `csv-utils.js` | Sheet 塞入 `<img src=x onerror=alert(1)>`，畫面應顯示為文字 |
| 3 | 移除 `劇本資料/`（S-04） | `劇本資料/`、`scripts.js`（瘋兔子海報） | S | 需先搬移瘋兔子海報 | Pages 上該路徑回 404；首頁瘋兔子卡片海報仍正常 |
| 4 | 移除公開劇本頁的 GM 連結（S-05 第一步） | `7人/天才在左我在右.html:847` | XS | — | 公開頁上找不到 GM 入口 |
| 5 | Tone.js / PapaParse 降級處理（S-03） | `榮譽牆.html:8-10,893` | S | — | 阻擋 cdnjs 後，53 張卡片與排行榜仍正常 |
| 6 | 修好排序「預設順序」（F-01） | `scripts-data.js:286` | S | — | 排序後選預設，前 5 張卡片回到原順序 |
| 7 | 移除 5 頁的 ESC 導航（F-02） | 5 個劇本頁 | XS | — | 按 ESC 不跳 404；彈窗 ESC 正常關閉 |
| 8 | Supabase JS 版本鎖定 + CDN 失敗處理（F-04） | GM / player 兩頁 | S | — | 阻擋 jsDelivr 後頁面仍可操作 |
| 9 | 收緊 Supabase RLS（S-05 / S-06） | Supabase Dashboard、`supabase_schema.sql` | S | 需先確認 `疯兔子搜尋.html` 使用者 | 匿名 dump `cards` 應失敗；GM/player 功能正常 |
| 10 | 移除三個公共 CORS proxy（S-07） | `榮譽牆.html:870-872` | S | 需先確認直連穩定或建好 GAS proxy | Network 面板只剩 Google 網域 |
| 11 | `榮譽牆.html` 的 `scripts.js` 補版號（D-02） | `榮譽牆.html:12` | XS | 需同步 `service-worker.js` | PWA 上新增劇本後榮譽牆有出現 |

**Phase 1 出口條件**：訂位表單可用、無 XSS、劇本內容不再公開、榮譽牆與排序功能正常。

---

### Phase 2：穩定核心功能（P1 / P2，建議 2–3 週）

| # | 修改項目 | 涉及檔案 | 成本 | 相依 | 驗證方式 |
|---|---------|---------|------|------|---------|
| 1 | 修正玩本記錄的送出回饋（F-03） | `play-record.js:171` | M | 需實測 Apps Script CORS | 錯誤端點應顯示失敗；正確端點應真的寫入 |
| 2 | 統一標籤用字 + 篩選 UI 自動產生（F-05） | `scripts.js`、`index.html`、`scripts-data.js`、`CLAUDE.md` | S | 需擁有者確認合併規則 | 篩「新手」應得 22 本 |
| 3 | 補齊角色資料 + 加資料自檢（F-06） | `scripts.js` | XS | 需正確角色名單 | 表單角色選項數量正確 |
| 4 | 瘋兔子頁加 `data-script`（F-07） | `6人/瘋兔子白又白砍下腦袋飛起來.html` | XS | — | 該頁評價彈窗能讀到資料 |
| 5 | 修正榮譽牆空狀態（F-08） | `榮譽牆.html:1522` | XS | — | 空 CSV 時顯示「尚無玩家記錄」 |
| 6 | 便利貼 resize 只在寬度變化時清除（U-02） | `榮譽牆.html:1600` | XS | — | 手機捲動時便利貼不消失 |
| 7 | BGM 加播放/靜音按鈕（U-01） | `bgm-control.js` + 52 頁移除舊腳本 | M | 需擁有者確認是否改變自動播放行為 | 抽 5 頁驗證，不與評價 FAB 重疊 |
| 8 | `<audio preload="none">`（P-02） | 52 個劇本頁 | S | 應與 #7 一起做 | 不點擊時無 MP3 請求 |
| 9 | 壓縮 MP3（D-01） | 52 個 MP3 | M | 需擁有者定音質標準 | 抽 10 頁確認音質可接受；總量下降 |
| 10 | 圖片 fallback（P-05 階段 1） | `scripts-data.js:360` | XS | — | 阻擋 postimg.cc 後顯示佔位圖 |
| 11 | 修正 `og:url`（I-01） | `主持人資訊.html:14,21` | XS | — | Facebook Debugger 預覽正確 |
| 12 | 建立 `404.html` + `.nojekyll`（I-02 部分） | repo 根 | XS | — | 錯誤路徑顯示自訂 404 |

---

### Phase 3：改善架構（P2，建議 3–4 週）

| # | 修改項目 | 涉及檔案 | 成本 | 相依 | 驗證方式 |
|---|---------|---------|------|------|---------|
| 1 | 建立 `csv-utils.js` 共用層（C-02） | 新檔 + `reviews.js` + `榮譽牆.html` | S | Phase 1 #2 應已部分完成 | 兩處資料顯示一致 |
| 2 | 拆出 `honor-wall.css`（C-01 步驟 1） | `榮譽牆.html` → `honor-wall.css` | S | — | 視覺完全一致 |
| 3 | 拆出 `honor-data.js` 資料層（C-01 步驟 2） | `榮譽牆.html` → 新檔 | M | 相依 #1 | 排行榜、印章、徽章數字完全一致 |
| 4 | 拆出 `honor-rules.js` 規則層（C-01 步驟 3） | `榮譽牆.html` → 新檔 | S | 相依 #3 | 稱號與徽章邏輯不變 |
| 5 | 清除死碼（C-03、C-04） | `榮譽牆.html`、5 個劇本頁 | XS | — | console 無多餘警告 |
| 6 | 修正 `hero.js` rAF 洩漏（C-05） | `hero.js:194` | XS | — | 多次切換分頁後 CPU 使用率不上升 |
| 7 | 補完 `supabase_schema.sql`（K-03） | `docs/supabase_schema.sql` | XS | — | 用該 SQL 能重建一個可用的測試專案 |
| 8 | 統一 BGM 托管策略 + 修正錯誤註解（L-01） | 2 個劇本頁 | XS | 相依 Phase 2 #9 | 兩頁 BGM 正常 |
| 9 | 改寫 README（O-01） | `README.md`、新增 `CHANGELOG.md` | S | — | 新手能照著跑起本機預覽 |

---

### Phase 4：品質提升（P2 / P3，建議 4 週以上，可分批進行）

| # | 修改項目 | 涉及檔案 | 成本 | 相依 | 驗證方式 |
|---|---------|---------|------|------|---------|
| 1 | 導覽連結改為真 `<a href>`（A-01） | `index.html` 9 處 | XS | — | 純鍵盤可到達三個內頁 |
| 2 | 加全域 focus 樣式（A-02） | `index.css` | XS | — | Tab 過所有元件都有金色外框 |
| 3 | reduced-motion 全站支援（A-03） | `fx3d.js` | XS | 需全站進版號 | 開啟系統減少動態後抽 5 頁確認 |
| 4 | 評價彈窗 a11y（A-04） | `reviews.js` | S | 需全站進版號 | 螢幕閱讀器測試 + 鍵盤 focus trap |
| 5 | 圖片 lazy + aspect-ratio（P-03） | 57 個劇本頁 | M | — | Lighthouse CLS 改善 |
| 6 | 劇本頁批次補 og 標記（I-02） | 53 個劇本頁（腳本產生） | M | — | LINE 分享有海報預覽 |
| 7 | `sitemap.xml` + `robots.txt`（I-02） | repo 根（腳本產生） | S | 相依 #6 | 可存取且格式正確 |
| 8 | 批次補 `rel="noopener noreferrer"`（P-06） | 全站 82 處 | XS | — | 抽查外連 |
| 9 | 統一 `lang` 屬性（I-03） | 2 頁 | XS | — | — |
| 10 | 建立最小測試方案（見下） | 新增 `package.json` + `tests/` | S | — | `npm test` 全綠 |
| 11 | 榮譽牆視覺向首頁靠攏（U-03） | `honor-wall.css` | L | 相依 Phase 3 #2 | 視覺審核 |
| 12 | `ocr_batch.py` 模型 ID 更新（K-04） | `ocr_batch.py:136` | XS | — | 實跑一次 OCR |

### 最小可行測試方案（符合本專案規模，避免過度工程化）

這個專案**不需要** Unit Test 框架、不需要 Component Test、不需要 E2E。它需要的是「防止已經發生過的錯誤再發生」。建議只做以下三件事：

**1. 資料完整性檢查（最高價值，成本最低）**

```js
// tests/validate-scripts.js — 用 node 直接跑，不需要任何測試框架
const fs = require('fs');
global.document = { getElementById: () => null };
global.window = {};
require('../scripts.js');

const errors = [];
const S = window.SCRIPTS;
const TYPES_WHITELIST = ['推理','情感','歡樂','機制','陣營','沉浸','新手','微恐','無兇手','立意','繁體', /* … */];

S.forEach(s => {
    if (!fs.existsSync(s.file))                    errors.push(`${s.id}: 檔案不存在 ${s.file}`);
    if (s.characters.length !== s.players)         errors.push(`${s.id}: 角色數 ${s.characters.length} ≠ 人數 ${s.players}`);
    if (s.difficulty < 0 || s.difficulty > 5)      errors.push(`${s.id}: difficulty 超出 0–5`);
    if (!s.poster)                                 errors.push(`${s.id}: 缺海報`);
    s.types.forEach(t => { if (!TYPES_WHITELIST.includes(t)) errors.push(`${s.id}: 未知標籤 ${t}`); });

    // reviews.js 名稱解析檢查（F-07 的自動化版本）
    const base = s.file.split('/').pop().replace(/\.html$/, '');
    const html = fs.readFileSync(s.file, 'utf8');
    const ds = (html.match(/data-script="([^"]*)"/) || [])[1];
    if ((ds || base) !== s.reviewKey) errors.push(`${s.id}: 評價名稱解析為「${ds || base}」但 reviewKey 是「${s.reviewKey}」`);
});

['id','file','reviewKey'].forEach(k => {
    const vals = S.map(s => s[k]);
    vals.filter((v, i) => vals.indexOf(v) !== i).forEach(v => errors.push(`重複 ${k}: ${v}`));
});

if (errors.length) { errors.forEach(e => console.error('❌ ' + e)); process.exit(1); }
console.log(`✅ ${S.length} 筆劇本資料檢查通過`);
```

> 這一支腳本就能自動抓到 F-06 與 F-07，而且未來新增劇本時會立刻報錯。

**2. 連結檢查（會抓到 F-02 那類錯誤）**

掃描所有 HTML 的 `href` / `src`（含 `location.href = '...'` 字串），確認本地路徑存在。本次審查就是用這個方法找到 F-02 的。

**3. GitHub Actions（把上面兩支接起來）**

```yaml
# .github/workflows/validate.yml
name: validate
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: node tests/validate-scripts.js
      - run: node tests/check-links.js
```

**明確不建議現在做的（避免過度工程化）：**

| 項目 | 為什麼現在不值得 |
|------|-----------------|
| Jest / Vitest | 沒有純函式模組可測（都在 DOM 裡）。等 Phase 3 抽出 `honor-rules.js` 後再說 |
| Playwright E2E | 維護成本高於收益。手動點一遍首頁 + 榮譽牆只要 3 分鐘 |
| TypeScript | 要改 60+ 個檔案，收益主要是 `scripts.js` 的型別安全——而上面那支 20 行的驗證腳本就達成了同樣目的 |
| ESLint 全套規則 | 沒有 build step，加 lint 會產生大量既有警告卻沒人修。若要加，建議只開 `no-undef` + `no-unused-vars` |

---

## 10. Top 10 優先建議

### 1️⃣ 修好訂位表單（S-01）

- **為什麼優先**：這是全站唯一的線上訂位入口，目前 100% 失敗。每一個認真填完表單的潛在客人都直接流失。這是**本次審查中唯一有立即金錢損失**的問題，而修正成本是 5 分鐘。
- **修改範圍**：`主持人資訊.html:503` 一行（或改走既有的 Apps Script 模式）
- **風險**：低
- **驗證**：實際填寫送出一次，確認收件端真的收到

### 2️⃣ 榮譽牆輸出轉義（S-02）

- **為什麼優先**：已實測可執行任意 JS，攻擊來源是任何人都能提交的公開表單。修正方式明確（`reviews.js` 已有現成的正確實作可直接複用），改動只有 2 處。
- **修改範圍**：`榮譽牆.html:1157,1221` + 建議抽出 `csv-utils.js`
- **風險**：低（純輸出層）
- **驗證**：在 Sheet 塞入 `<img src=x onerror=alert(1)>`，畫面應顯示為文字

### 3️⃣ 移除 `劇本資料/` 並移除 GM 連結（S-04 + S-05 第一步）

- **為什麼優先**：76 MB 正版劇本 PDF 公開下載是**唯一有法務層面影響**的問題；GM 連結則是玩家爆雷的最短路徑。兩者一起處理可以一次消除最主要的「內容外洩」風險，同時省下 76 MB 部署量。
- **修改範圍**：`git rm -r --cached 劇本資料/`、`.gitignore`、`scripts.js`（瘋兔子海報路徑）、`7人/天才在左我在右.html:847`
- **風險**：中（會影響首頁一張海報，需先搬移）
- **驗證**：Pages 上該路徑回 404；首頁瘋兔子卡片仍有海報；公開頁找不到 GM 入口

### 4️⃣ 修好排序「預設順序」（F-01）

- **為什麼優先**：這是使用者**最容易遇到也最容易察覺**的功能 bug。已實測確認：排序後選「預設順序」與按「重置篩選」都無法還原，只能重整整頁。修正同時能移除「從 DOM 文字反推時長」的脆弱邏輯。
- **修改範圍**：`scripts-data.js:286-332`
- **風險**：低（只動 `sortScripts`）
- **驗證**：排序 → 選預設 → 前 5 張卡片應為 `王座 / 北國之春 / 別來無恙 / 奉天1928 / 孤城`

### 5️⃣ 消除第三方 CDN 的硬依賴（S-03 + F-04）

- **為什麼優先**：已實測 Tone.js 載不到就讓**整個榮譽牆變空白**（0 張卡片、玩家清單卡在「讀取資料中」），jsDelivr 載不到就讓 GM 控台整頁 crash。一個裝飾用的音效庫不該是整頁的前置條件。GM 頁更是開場當下才用，最不能失敗。
- **修改範圍**：`榮譽牆.html:893-902`、GM / player 兩頁的 Supabase 初始化
- **風險**：低
- **驗證**：DevTools 阻擋 `cdnjs.cloudflare.com` 與 `cdn.jsdelivr.net`，確認核心功能仍可用

### 6️⃣ 修正玩本記錄的送出回饋（F-03）

- **為什麼優先**：目前 `mode:'no-cors'` 讓送出結果**永遠顯示成功**。玩家以為記錄好了，實際可能沒寫進去，而且沒有任何監控會發現。Apps Script 端已經寫好了完整的錯誤回傳，只是前端讀不到——等於伺服端的錯誤處理白寫了。
- **修改範圍**：`play-record.js:171-185`
- **風險**：中（動到唯一的寫入路徑，需先實測 Apps Script 的 CORS 行為）
- **驗證**：故意用錯誤端點 → 應顯示失敗；正確端點 → Sheet 真的多一列

### 7️⃣ 統一標籤用字並讓篩選 UI 自動產生（F-05）

- **為什麼優先**：53 筆資料用了 76 種標籤，其中 7 組是同義分裂。實測篩「新手」只得 17 本，實際有 22 本——**新手玩家看不到 5 本適合他們的劇本**，這直接影響選本體驗。而且篩選 UI 只列了 11 種標籤，出現最多次的「還原」(24) 根本篩不到。
- **修改範圍**：`scripts.js` 的 `types` 欄位、`index.html:251-262`、`scripts-data.js`、`CLAUDE.md` 加標籤白名單
- **風險**：低（`types` 只用於篩選顯示）
- **驗證**：統一後篩「新手」應得 22 本

### 8️⃣ 移除 5 頁的 ESC 導航（F-02）

- **為什麼優先**：成本 XS 但影響明確——按 ESC 掉 404，而且與評價彈窗的 ESC 關閉衝突（開彈窗後按 ESC 會同時關閉彈窗並跳到 404）。5 個檔案各刪一段。
- **修改範圍**：5 個劇本頁
- **風險**：低
- **驗證**：按 ESC 不跳 404；彈窗 ESC 正常關閉

### 9️⃣ BGM 加播放/靜音控制並停止預載（U-01 + P-02）

- **為什麼優先**：兩個問題疊在一起且互相關聯。目前**任何**首次點擊（包括點返回鍵）都會以全音量解除靜音，而且沒有任何按鈕可以關掉；切分頁再切回來音樂又永遠不會恢復。同時 48 頁沒有 `preload` 控制，每次瀏覽都下載 2–14 MB 的 MP3——即使使用者從未聽到聲音。加一顆按鈕能一次解決體驗與流量兩個問題，而且改在共用的 `bgm-control.js` 裡，52 頁不用逐頁改。
- **修改範圍**：`bgm-control.js` + 52 頁移除舊的解除靜音腳本
- **風險**：中（影響 52 頁）
- **驗證**：抽 5 頁確認載入時無聲、按鈕可播放/停止、與評價 FAB 不重疊

### 🔟 建立資料完整性檢查腳本 + CI（測試方案第 1 項）

- **為什麼優先**：這 20 行的腳本會**自動抓到本次審查中的 F-06 與 F-07**，而且未來每次新增劇本都會即時檢查。以這個專案的規模與協作方式（多次 AI 協作、快速迭代），一個「資料寫錯會立刻報錯」的機制，比任何測試框架都有價值。放在第 10 位是因為它預防未來的問題，而非修復現有的問題——但它應該在 Phase 1 結束後**立刻**建立，這樣後續所有修改都有安全網。
- **修改範圍**：新增 `tests/validate-scripts.js`、`tests/check-links.js`、`.github/workflows/validate.yml`、`package.json`
- **風險**：低（純新增，不動既有程式碼）
- **驗證**：故意把某本劇本的 `characters` 刪掉一個，CI 應該失敗

---

## 附錄：執行驗證紀錄

### 已執行的檢查

| 指令 / 方法 | 結果 |
|------------|------|
| `git ls-files` 全檔清點 | 196 個追蹤檔案，總計 357 MB |
| `scripts.js` 資料完整性腳本 | 53 筆；無重複 `id`/`file`/`reviewKey`；53 個 HTML 路徑全部存在；發現 2 筆角色數不符 |
| 本地連結檢查（自寫 Node 腳本掃描全部 `href`/`src`） | 發現 5 處 `location.href='index.html'` 路徑錯誤（F-02） |
| `python3 -m http.server` + `curl` | 確認 `/6人/index.html` → **404**，證實 F-02 |
| Playwright (Chromium) 載入 11 個頁面 | 收集 console error/warning、網路失敗、水平溢位 |
| Playwright 篩選/排序互動測試 | 證實 F-01（預設順序無法還原）與 F-05（新手篩選漏 5 本） |
| Playwright + 攔截 CSV 注入 payload | **證實 S-02 兩處 XSS 皆可執行任意 JS** |
| git 全歷史機密掃描 | 只找到 `.env.example` 的佔位字串，**無真實金鑰外洩** |

### 執行結果摘要

**Console 錯誤 / 警告：**

| 頁面 | 訊息 | 判定 |
|------|------|------|
| 全部 53 個劇本頁 + 首頁 | `Scripts "build/three.js" ... are deprecated with r150+` | 真實問題（P-01） |
| 5 個劇本頁 | `缺少必要元素: ['title']` | 真實問題（C-04） |
| `榮譽牆.html` | `ReferenceError: Tone is not defined` → **0 張卡片** | 真實問題（S-03） |
| `天才在左我在右-GM/player.html` | `TypeError: Cannot read properties of undefined (reading 'createClient')` | 真實問題（F-04） |
| `劇本介紹.html` / `主持人資訊.html` | `ReferenceError: AOS is not defined` | 真實問題（同類 CDN 硬依賴） |
| 多數頁面 | `ERR_TUNNEL_CONNECTION_FAILED`（postimg.cc / Google Fonts） | **環境限制**，非專案問題 |
| 全部頁面 | `Automatic fallback to software WebGL has been deprecated` | **環境限制**（headless 無 GPU） |

**版面檢查（390×844 手機視窗）：** 測試的 11 個頁面**全部沒有水平溢位**（`scrollWidth === clientWidth`）。RWD 基礎做得不錯。

### 無法執行的檢查

| 項目 | 原因 | 建議 |
|------|------|------|
| Install / Build / Type Check / Lint / Test | **專案沒有 `package.json`**，這些指令不存在 | 見 Phase 4 的最小測試方案 |
| 真實網路下的第三方服務行為 | 沙箱環境的 HTTPS 代理阻擋了 postimg.cc、Google Fonts、cdnjs、unpkg、jsDelivr、Supabase | 需在真實網路重測 |
| Google Sheet CSV 實際內容 | 同上 | 建議人工檢查現有資料是否已含惡意內容（S-02） |
| Apps Script 端點的 CORS 行為 | 同上 | **F-03 的修正方案需要先實測這一項** |
| Supabase RLS 實際政策 | 需要 Dashboard 存取權 | 需擁有者確認 `game_state` / `player_state` 現況 |
| 跨瀏覽器測試（Safari / Firefox / iOS） | 環境只有 Chromium | 建議人工在 iOS Safari 抽驗，特別是 U-02（網址列收合觸發 resize）與 P-02（autoplay 政策） |
| 色彩對比度量測 | 需視覺工具 | 建議用 Lighthouse 或 axe DevTools 補做 |

---

*報告結束。本階段未修改任何既有專案檔案。*
