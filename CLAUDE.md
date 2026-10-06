# 海星劇本殺 - 新增劇本標準流程

> 架構重點：
> 1. **劇本資料只有一份來源 `scripts.js`**（`window.SCRIPTS` 陣列）。
>    `index.html`（卡片）與 `榮譽牆.html`（評價）都讀它，卡片由
>    `scripts-data.js` 的 `renderCards()` 自動產生，**不要再手寫卡片 HTML**。
> 2. **每個劇本介紹頁都是獨立設計、擁有自己的 CSS 與特色**，
>    刻意「不共用樣式表」——每頁的配色、背景動畫、版面氛圍都要貼合該劇本主題，
>    做出辨識度。**不要**把各頁 CSS 抽成共用檔。

## 一、在 `scripts.js` 新增一筆資料（唯一的資料來源）

在 `window.SCRIPTS` 陣列尾端加入：

```js
{
    "id": "shortid",
    "name": "劇本名稱",
    "file": "N人/劇本名稱.html",
    "players": N,
    "playersLabel": "X男Y女",       // 卡片👥顯示，可寫「7人不限」「可反串」等
    "time": 4.5,                     // 數字，排序用
    "timeLabel": "4-5小時",          // ⏰顯示，可寫範圍
    "difficulty": D,                 // 0–5，須與⭐一致
    "types": ["標籤1", "標籤2"],
    "theme": "THEME",
    "poster": "img/劇本/劇本名稱/海報.webp",  // repo 內海報路徑（相對網站根目錄），未取得先留 ""
    "reviewKey": "劇本名稱",         // 榮譽牆/問卷 CSV「劇本」欄對應鍵；通常＝name
    "characters": ["角色A", "角色B"], // 角色名單（新增玩本記錄表單的角色下拉；與頁面角色卡一致）
    "youtube": ""                    // 選填：YT 劇本介紹影片 ID 或網址，有填劇本頁才出現「▶ 介紹影片」
}
```

**規則：**
- `theme`：`horror` / `mystery` / `love` / `history` / `ancient` / `desert` / `mytho` / `modern` / `happy` / `shrine` / `space`
- `difficulty` 與 ⭐ 星數必須一致（0–5）
- `reviewKey`：若劇本在評價表單裡用的名字與 `name` 不同（例如別名、去掉前綴），填表單實際用的字串；否則＝`name`
- `youtube`：可填 11 碼影片 ID 或整串網址（watch / youtu.be / shorts；shorts 會用直式播放器）。
  有填的劇本：劇本頁出現「▶ 介紹影片」（`video.js`），首頁卡片右上角出現「▶ 影片」。
  **通常不用手填**：上傳影片的流程見下方「六、上傳劇本介紹影片」；另有 GitHub Action
  「同步 YouTube 影片」每 2 小時讀頻道 RSS 當備援（說明欄有劇本頁網址、或標題用《劇本名》就對得到）。
  手填的值永遠不會被自動覆蓋；不想自動填某個劇本就填 `"-"`。
- **`scripts.js?v=` 與劇本頁的 `video.js?v=` 共用同一個版號**（video.js 用自己的版號去載 scripts.js），
  進版時一起全站替換
- **預約一律走 LINE OA**（`https://line.me/R/ti/p/@825gdzws`）：劇本頁只在最下方 CTA 放預約按鈕、連到 LINE OA；
  右下浮動按鈕只放「玩家評價」與「▶ 介紹影片」，**不要再加預約浮動按鈕**（舊的 booking.js 已移除）
- 卡片、榮譽牆清單、badges 全部自動產生，**不需手動改 index.html 或 榮譽牆.html**

---

## 二、建立劇本 HTML 頁面（N人/劇本名稱.html）— 每頁獨立設計

**核心原則：這一頁就是這個劇本的專屬視覺，CSS 全部寫在該頁 `<style>` 內、自成一格。**
可參考同類型的既有頁（如驚悚→`瘋兔子白又白…`、情感→`春昼短`、民國→`津門遺雲`），
但每頁請依主題做出自己的配色與招牌背景動畫，不要複製成一模一樣。

### 必備內容

1. **專屬背景動畫** — 貼合主題（花瓣/燈塵/星空/漣漪/霓虹…），每頁不同。
   建議直接掛共用 3D 引擎：`<script src="../fx3d.js" data-fx="預設" data-tint="#主色">`
   （預設：storm/snow/petals/embers/fog/fireflies/stars/dust/rain/sand/bubbles；
   王座式雷暴加 `data-thunder="1"`；`data-hide` 可在 3D 啟動後隱藏舊 2D 層，
   WebGL 不支援時自動 fallback 回原 2D 效果）
2. **返回按鈕** — `<a href="../index.html" class="back-btn">← 返回劇本總覽</a>`
3. **海報區** — `.poster-image`（或多張輪播），海報待上傳時用 `.poster-placeholder`
4. **主要內容 2 欄 grid**：
   - **遊戲資訊卡**：劇本名稱、遊戲時間、遊戲人數、推理程度（★星數）、劇本標籤、發行/作者
   - **角色介紹卡**：每個角色含 emoji（或頭像）、姓名/身份、性別年齡、一句描述
   - **故事背景卡**（`.card.description`，跨 2 欄）
   - **劇本介紹卡**（`.card.description`，跨 2 欄）
5. **CTA 按鈕** — `立即預約…`，連到 LINE OA：`<a href="https://line.me/R/ti/p/@825gdzws" class="cta-button" target="_blank">`
   （**不要用主持人個人 LINE**）
6. **BGM** — `<audio preload="none" id="bgm" src="劇本名稱.mp3" loop muted>`
   （**不要加 `autoplay`**：mp3 動輒數 MB，autoplay 會讓手機一進頁就整首下載；
   `bgm-control.js` 會在第一次點擊時開始播放，頁面自己的「點擊解除靜音」照寫即可）
7. **JS 互動** — 背景動畫產生、星星 hover、卡片光效等（可各頁自訂）
8. 結尾依序放：`<script src="../bgm-control.js?v=日期">`、
   `<script src="../reviews.js?v=日期">`（玩家評價按鈕，劇本名以檔名自動對應；
   若檔名與評價表單名不同，加 `data-script="評價用名稱"`）、
   `<script src="../video.js?v=日期">`（YT 介紹影片按鈕，依頁面路徑對應 `scripts.js` 的 `file`）、
   `<script src="../lightbox.js?v=日期">`（點海報／角色圖在原頁跳出全螢幕大圖，可縮放、左右滑換張；
   自動套用在 `img/劇本/` 底下的圖，**圖片不用再包 `<a href="圖檔">`**，不想被放大的圖加 `data-no-zoom`）。
   **共用 JS 一律帶 `?v=` 版本號**（GitHub Pages 快取 10 分鐘）；
   修改任何共用 JS 時，全站進版號。Three.js 自架於 `vendor/three.min.js`，
   fx3d 會自動載入，不依賴外部 CDN。
   **進 `?v=` 版號時必須同步改 `service-worker.js`**：
   `CACHE_VERSION` 進版＋`APP_SHELL` 清單裡對應的 `?v=` URL 改成新版號，
   否則已安裝 PWA 的使用者會一直拿到 SW 快取的舊檔

### 主題色參考

| 類型 | 主色 | 範例劇本 |
|------|------|----------|
| 驚悚/怪談 | 深紅 `#cc2222` | 瘋兔子白又白 |
| 現代推理 | 深藍/紫 | 眠夢不老泉（綠色）|
| 情感/純愛 | 暖粉/橙 | 春昼短 |
| 民國/古風 | 金/暗紅 | 津門遺雲、極目2 |
| 架空神話 | 深藍/金 | 王座 |

---

## 三、需要向使用者收集的資訊

新增劇本前，確認以下資料齊全再動手：

- [ ] 劇本完整中文名稱
- [ ] 人數（幾男幾女，是否可反串）
- [ ] 遊戲時長
- [ ] 難度星數（0–5）
- [ ] 劇本標籤（驚悚/推理/情感/架空…）
- [ ] 發行商、作者
- [ ] 劇情簡介
- [ ] 劇本特色
- [ ] 角色名單（**姓名、年齡、性別、一句性格描述**）
- [ ] 角色頭像圖片（URL 或上傳）
- [ ] 海報圖片（URL 或上傳）
- [ ] BGM 音樂檔（.mp3，放在同一子資料夾）

---

## 四、檔案命名規則

- 劇本 HTML：`N人/劇本中文名稱.html`（用繁體中文，不含標點）
- BGM：`N人/劇本中文名稱.mp3`
- 圖片：放在 repo 的 `img/劇本/<劇本頁檔名>/`，**不再使用 postimg 等外部圖床**
  - 一律轉成 WebP、長邊 1280px、品質約 80（約 50–150KB／張），避免 repo 膨脹
  - 檔名用中文說明用途：主海報、介紹圖、角色名（例：`img/劇本/青樓/莫懷.webp`）
  - 劇本頁內用相對路徑 `../img/劇本/...`；`scripts.js` 的 `poster` 用 `img/劇本/...`
  - 只放宣傳素材（海報、介紹、角色海報），劇本本體與線索卡不可放進 repo
  - **頁面載入速度**（手機用戶多，務必遵守）：
    - 每頁第一張主海報加 `fetchpriority="high"`，其餘 `<img>` 一律加 `loading="lazy" decoding="async"`
    - 角色頭像這類「顯示得小」的圖，頁面上放縮圖、原圖給放大用：
      `<img src="../img/劇本/X/縮圖/角色.webp" data-full="../img/劇本/X/角色.webp" loading="lazy" decoding="async">`
      縮圖放 `img/劇本/<劇本>/縮圖/`，尺寸取「顯示尺寸 × 3」（手機 3 倍螢幕），短邊至少 200px，
      例：`convert 角色.webp -resize 300x -strip -quality 78 縮圖/角色.webp`（約 5–30KB）

---

## 六、上傳劇本介紹影片到 YouTube（頻道 @starfish0522）

上傳工具在使用者電腦本機的另一個專案（不在 GitHub），那邊的 Claude 讀不到這份文件，
所以網站登記**不靠上傳端改 repo**，只靠一件事：**說明欄第一行放劇本頁網址**。
GitHub Action「同步 YouTube 影片」會讀頻道 RSS、依說明欄網址自動填入並上線（最慢 2 小時；
上傳端若有 `gh` 可執行 `gh workflow run sync-youtube.yml -R cj2vum4/starfishlarp` 立刻同步）。

若是在本 repo 的 session 裡用 YouTube API 上傳，則上傳完成就直接登記，不要等使用者另外交代：

1. 說明欄第一行放該劇本頁網址：`https://cj2vum4.github.io/starfishlarp/<scripts.js 的 file>`
   （例：`https://cj2vum4.github.io/starfishlarp/7人/王座.html`）。
   這同時是導流，也是自動同步的對應依據（比標題比對準，短劇本名也不會認錯）
2. 拿到上傳回傳的影片 ID 後執行：
   `node .github/scripts/sync-youtube.mjs --set <劇本名或id> <影片網址或ID>`
   會寫入 `scripts.js` 的 `youtube` 並全站進版號（scripts.js / video.js / service-worker）
3. commit 後推 main，回報使用者「已上傳並登記到網站」與劇本頁網址

Shorts 傳 `https://www.youtube.com/shorts/<ID>` 會自動用直式播放器。
`--set` 會覆寫原本的值；換新版影片時同樣用它。

---

## 五、Git 工作流程：直接推 main

**所有更新一律 commit 後直接 `git push origin main`，不開分支、不開 PR。**

- 站台是 GitHub Pages 直接吃 `main` 根目錄，推上去等於立刻上線，
  所以推之前務必自己先驗過（改到版面就實際跑一次瀏覽器截圖／量測，
  改到 `points.js`、`play-record.js` 這類會動到玩家資料的邏輯要格外小心）
- 例外：Claude Code 網頁版會由平台在開 session 時強制指派
  `claude/xxx` 分支，那種情況先推到指派的分支，
  完成後再 fast-forward 合併回 `main` 並推上去
- 工作完成後把用完的分支刪掉，不要讓分支長期留在 GitHub

### 這個 repo 是 public，分支也是公開的

`.gitignore` 擋掉 `劇本資料/**` 的 pdf/docx/pptx/zip 是因為
**付費劇本內容一旦進 repo 就等於公開散布**。這件事對分支同樣成立——
把這些檔案 commit 到任何分支（哪怕永遠不合併進 main）都一樣是公開的。
絕對不要為了「暫時放一下」而把劇本本體 commit 上去。

---

## 七、角色分配問卷（取代各帳號的 Google 表單）

- 所有回覆寫進同一份「角色問卷總表」（試算表 ID 在 `GoogleAppsScript_角色問卷.gs`），
  **一個劇本一個分頁**，第一次有人填自動建立；欄名＝題目文字，第一欄「時間戳記」，
  格式與 Google 表單匯出相同，舊表單回應可直接貼進同名分頁。
- 後端只有一支 `GoogleAppsScript_角色問卷.gs`，部署後的 `/exec` 網址填在 `survey.js` 的
  `SURVEY_ENDPOINT`。新增問卷**不用改後端、不用重新部署**。
- 新增一份問卷：複製 `問卷/奉天1928.html` 改成 `問卷/<劇本名>.html`，
  改 `window.SURVEY` 的 `script`（分頁名，通常＝`reviewKey`）與 `questions`，
  頁首與配色依劇本主題自己設計。Google 表單公開連結可用 `FB_PUBLIC_LOAD_DATA_` 解析出題目，題目文字照抄原表單。
- 題型：`text` / `textarea` / `radio` / `checkbox`（可加 `other: true`）/ `scale`（`min`/`max`/`minLabel`/`maxLabel`）。
  需要依答案自動推薦角色時加 `assign(answers)`，回傳的欄位（如 `建議角色`）會一起存進總表。
- 問卷頁**不放入口**、不登記 `scripts.js`，用網址或 QR code 傳給玩家；頁面加 `noindex`。
