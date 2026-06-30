# 海星劇本殺 - 新增劇本標準流程

> 架構重點：**劇本資料只有一份來源 `scripts.js`**（`window.SCRIPTS` 陣列）。
> `index.html`（卡片）與 `榮譽牆.html`（評價）都讀它，卡片由 `scripts-data.js`
> 的 `renderCards()` 自動產生，**不要再手寫卡片 HTML**。
> 劇本介紹頁共用 `script-page.css`，只需用 CSS 變數換色。

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

## 二、建立劇本 HTML 頁面（N人/劇本名稱.html）

### 建議做法：套用共用版型 `script-page.css`（**新頁面一律用這個**）

最新的標準頁（`6人/春昼短.html`、`8人以上/津門遺雲.html`、
`7人/極目2九爺我想給您養老.html`）都共用 `script-page.css`，頁面只放
主題色變數與背景動畫，結構/卡片樣式全部繼承。新頁面照這個範本：

```html
<head>
    ...
    <link rel="stylesheet" href="../script-page.css">
    <style>
        /* 只覆寫主題色 + 放該頁專屬背景動畫 */
        :root {
            --page-bg: linear-gradient(...);
            --fg: #...; --fg-dim: rgba(...);
            --accent: #...; --accent-2: #...; --accent-glow: rgba(...);
            --card-bg: rgba(...); --card-border: rgba(...);
            --tag-from: #...; --tag-to: #...;
            --btn-from: #...; --btn-to: #...;
        }
        /* #petals / #embers / 星空 … 等背景動畫 keyframes */
    </style>
</head>
```

**頁面結構（class 名沿用共用 CSS）：**
1. 背景動畫容器 `<div id="...">` ＋ 對應產生 JS
2. 返回按鈕 `<a href="../index.html" class="back-btn">← 返回劇本總覽</a>`
3. 海報 `.poster-section`（`.poster-image` 或 `.poster-placeholder`）
4. `.main-content`（2 欄 grid）：遊戲資訊卡 / 角色介紹卡（`.characters-grid`）/
   故事背景卡（`.card.description`）/ 劇本介紹卡（`.card.description`）
5. CTA `.cta-section > .cta-button`
6. BGM `<audio id="bgm" src="劇本名稱.mp3" autoplay loop muted>`
7. 結尾依序：`bgm-control.js`、`reviews.js`（玩家評價按鈕，劇本名以檔名自動
   對應；若檔名與評價表單名不同，加 `data-script="評價用名稱"`）

> 較舊的劇本頁仍是各自獨立 inline CSS，沿用即可、不用強制改套版型。

### 主題色對應（設定 `--accent` / `--accent-2` 等變數）

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
