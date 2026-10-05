# 集點系統測試

推 `main` 等於立刻上線，所以改動 `points.js`、`play-record.js`、`reviews.js`
或 `GoogleAppsScript_玩本記錄.gs` 之後，推之前先跑這裡。

```bash
bash tests/run.sh
```

## 兩套測試

| 檔案 | 測什麼 | 需要什麼 |
|---|---|---|
| `gas.test.js` | Apps Script 的計分與試算表邏輯 | 只要 Node，零相依 |
| `browser.test.js` | 榮譽牆、玩本記錄表單、劇本頁評價彈窗 | playwright |

單獨跑：

```bash
node tests/gas.test.js
node tests/browser.test.js
```

前端測試需要 playwright，沒安裝會自動跳過而不是失敗：

```bash
npm install --no-save playwright && npx playwright install chromium
```

## 不會碰到正式資料

兩套都在隔離環境跑：

- `gas.test.js` 用 `gas-mock.js` 模擬 `SpreadsheetApp`，資料全在記憶體裡，
  不會連到真的 Google 試算表。
- `browser.test.js` 起一個本機靜態伺服器，並攔截**所有**外部請求——
  試算表 CSV、Apps Script 端點、CDN、圖床一律換成假資料。

## 加測試時注意

**計分斷言要跟「雙倍日」脫鉤。** 預設值是「平日」，測試資料的日期只要
落在平日就會全部加倍，斷言會莫名其妙全垮。`freshEnv()` 預設把雙倍日清空；
要測雙倍日本身就直接呼叫 `isDoubleDay_()`，或傳 `{ doubleDay: '平日' }`。

**`gas-mock.js` 只能載入一次。** `.gs` 的頂層 `const` 重複宣告會拋錯，
所以各組測試之間用 `freshEnv()` 重建資料，不要重新 require。

**頂層 `const` 不會掛到 `globalThis`。** `runInThisContext` 把頂層 `const`
放進全域語彙環境，只有 `function` 宣告會變成 `globalThis` 的屬性。
取 `REQUIRED_HEADERS` 這類常數要用裸參照，取函式則 `global.xxx_()` 也可以。

**便利貼有無限浮動動畫**，Playwright 會判定元素不穩定而點不下去。
測到評價彈窗時先 `emulateMedia({ reducedMotion: 'reduce' })`。
