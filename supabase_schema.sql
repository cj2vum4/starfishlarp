-- 在 Supabase SQL Editor 執行此檔案
-- Dashboard → SQL Editor → New Query → 貼上 → Run

-- 主資料表
CREATE TABLE IF NOT EXISTS cards (
    id          BIGSERIAL PRIMARY KEY,
    filename    TEXT        NOT NULL,
    folder      TEXT        NOT NULL DEFAULT '',
    page_num    INT         NOT NULL DEFAULT 0,
    text        TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 全文搜尋索引（支援中文）
CREATE INDEX IF NOT EXISTS cards_text_fts
    ON cards USING GIN (to_tsvector('simple', text));

-- filename 索引（按檔名查詢）
CREATE INDEX IF NOT EXISTS cards_filename_idx ON cards (filename);

-- folder 索引（按資料夾/角色查詢）
CREATE INDEX IF NOT EXISTS cards_folder_idx ON cards (folder);

-- 開放匿名讀取（GitHub Pages 靜態網站需要）
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read-only"
    ON cards FOR SELECT
    USING (true);

-- 若之後需要重新匯入，清除舊資料：
-- TRUNCATE TABLE cards RESTART IDENTITY;
