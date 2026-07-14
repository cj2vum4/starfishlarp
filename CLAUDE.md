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
    "poster": "https://i.postimg.cc/...",  // 海報直連，未取得先留 ""
    "reviewKey": "劇本名稱"          // 榮譽牆/問卷 CSV「劇本」欄對應鍵；通常＝name
}
```

**規則：**
- `theme`：`horror` / `mystery` / `love` / `history` / `ancient` / `desert` / `mytho` / `modern` / `happy` / `shrine` / `space`
- `difficulty` 與 ⭐ 星數必須一致（0–5）
- `reviewKey`：若劇本在評價表單裡用的名字與 `name` 不同（例如別名、去掉前綴），填表單實際用的字串；否則＝`name`
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
5. **CTA 按鈕** — `立即預約…`
6. **BGM** — `<audio id="bgm" src="劇本名稱.mp3" autoplay loop muted>`
7. **JS 互動** — 背景動畫產生、星星 hover、卡片光效等（可各頁自訂）
8. 結尾依序放：`<script src="../bgm-control.js?v=日期">`、
   `<script src="../reviews.js?v=日期">`（玩家評價按鈕，劇本名以檔名自動對應；
   若檔名與評價表單名不同，加 `data-script="評價用名稱"`）。
   **共用 JS 一律帶 `?v=` 版本號**（GitHub Pages 快取 10 分鐘）；
   修改任何共用 JS 時，全站進版號。Three.js 自架於 `vendor/three.min.js`，
   fx3d 會自動載入，不依賴外部 CDN

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
- 圖片：上傳 postimg.cc，使用直連 URL
