# AGENTS.md — 海星劇本殺

專案的完整開發規範寫在 **[`CLAUDE.md`](./CLAUDE.md)**，
不論你是哪個工具（Codex、Cursor、Claude Code…），動手前請先讀那一份。
本檔只重述最容易踩到的兩條紅線。

## Git 工作流程：直接推 main

**所有更新一律 commit 後直接 `git push origin main`，不開分支、不開 PR。**

- 站台是 GitHub Pages 直接吃 `main` 根目錄，推上去等於立刻上線，
  所以推之前務必自己先驗過（改到版面就實際跑一次瀏覽器截圖／量測，
  改到 `points.js`、`play-record.js` 這類會動到玩家資料的邏輯要格外小心）
- 例外：Claude Code 網頁版會由平台在開 session 時強制指派
  `claude/xxx` 分支，那種情況先推到指派的分支，
  完成後再 fast-forward 合併回 `main` 並推上去
- 工作完成後把用完的分支刪掉，不要讓分支長期留在 GitHub

## 這個 repo 是 public，分支也是公開的

`.gitignore` 擋掉 `劇本資料/**` 的 pdf/docx/pptx/zip 是因為
**付費劇本內容一旦進 repo 就等於公開散布**。這件事對分支同樣成立——
把這些檔案 commit 到任何分支（哪怕永遠不合併進 main）都一樣是公開的。
絕對不要為了「暫時放一下」而把劇本本體 commit 上去。

## 其餘規範

以下細節請直接看 `CLAUDE.md`，不要憑印象猜：

- 劇本資料只有一份來源 `scripts.js`，卡片由 `scripts-data.js` 自動產生
- 每個劇本介紹頁都是獨立設計、CSS 寫在該頁 `<style>` 內，**刻意不共用樣式表**
- 共用 JS／CSS 一律帶 `?v=` 版號；進版號時必須同步改 `service-worker.js`
  的 `CACHE_VERSION` 與 `APP_SHELL` 清單，否則 PWA 使用者會一直吃到舊快取
