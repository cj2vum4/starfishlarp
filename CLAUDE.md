# 海星劇本殺 - 新增劇本標準流程

## 一、在 index.html 新增卡片

### 1. HTML 卡片（放在 `scripts-grid` 區塊內）

```html
<div class="script-card" data-theme="THEME" data-players="N" data-types="標籤1,標籤2" data-difficulty="D">
    <img src="https://i.postimg.cc/..." alt="劇本名稱" class="script-image">
    <h3 class="script-title">劇本名稱</h3>
    <div class="script-info">
        <span class="info-badge">👥 X男Y女</span>
        <span class="info-badge">⏰ N小時</span>
        <span class="info-badge">⭐ D星</span>
    </div>
    <div class="script-types">
        <span class="type-tag">標籤1</span>
        <span class="type-tag">標籤2</span>
    </div>
    <button class="detail-btn" onclick="goToScript('id')">查看詳細介紹</button>
</div>
```

**規則：**
- `data-theme`：`horror` / `mystery` / `love` / `history` / `ancient` / `desert` / `mytho` / `modern`
- `data-difficulty` 與 ⭐ 星數必須一致（0–5）
- `<img>` 一律使用 `class="script-image"`，**不加 inline style**
- 海報圖片上傳到 postimg.cc 後再填 src；若尚未取得，先留 `src=""`

### 2. JS 資料（放在 `scripts` 陣列內）

```js
{
    id: 'shortid',
    name: '劇本名稱',
    players: N,
    types: ['標籤1', '標籤2'],
    difficulty: D,
    theme: 'THEME',
    time: 4.5,
    file: 'N人/劇本名稱.html'
},
```

### 3. 新劇本上架 banner（若要放在 new-scripts-grid）

```html
<a class="new-script-card" onclick="goToScript('shortid')">
    <img class="new-script-poster" src="https://i.postimg.cc/..." alt="劇本名稱">
    <div class="new-script-info">
        <div class="new-script-name">EMOJI 劇本名稱</div>
        <div class="new-script-tags">
            <span class="new-script-tag">標籤1</span>
            <span class="new-script-tag">標籤2</span>
            <span class="new-script-tag">X男Y女</span>
            <span class="new-script-tag">N小時</span>
        </div>
    </div>
</a>
```

---

## 二、建立劇本 HTML 頁面（N人/劇本名稱.html）

### 必備內容（參考 `6人/眠夢不老泉.html`）

1. **背景動畫** — 粒子/漣漪/浮動元素（主題色配合劇本風格）
2. **返回按鈕** — `<a href="../index.html" class="back-btn">← 返回劇本總覽</a>`
3. **海報區** — `poster-slider` + `poster-image`（auto-rotate 若多張），海報待上傳時用 placeholder div
4. **主要內容 2 欄 grid**：
   - **遊戲資訊卡**：劇本名稱、遊戲時間、遊戲人數、推理程度（★星數）、劇本標籤
   - **角色陣容卡**：每個角色需含 avatar 圖（或 emoji 佔位）、姓名、年齡、性別、一句描述
   - **故事背景卡**（`grid-column: span 2`）
   - **劇本特色卡**（`grid-column: span 2`）
5. **CTA 按鈕** — `立即預約遊戲`
6. **BGM** — `<audio id="bgm" src="劇本名稱.mp3" autoplay loop muted>`
7. **JS 互動** — 海報輪播、星星 hover、卡片光效、視差滾動、CTA 波紋
8. **`<script src="../bgm-control.js"></script>`** — 放在 `</body>` 前

### 主題色對應

| 類型 | 主色 | 範例劇本 |
|------|------|----------|
| 驚悚/怪談 | 深紅 `#cc2222` | 瘋兔子白又白 |
| 現代推理 | 深藍/紫 | 眠夢不老泉（綠色）|
| 情感/純愛 | 暖粉/橙 | — |
| 古風/宮廷 | 金/暗紅 | 龍宴 |
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
