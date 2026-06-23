-- ══════════════════════════════════════════════════════
-- 初次建立（新專案執行這段）
-- Dashboard → SQL Editor → New Query → 貼上 → Run
-- ══════════════════════════════════════════════════════

-- 主資料表
CREATE TABLE IF NOT EXISTS cards (
    id          BIGSERIAL PRIMARY KEY,
    script      TEXT        NOT NULL DEFAULT '',   -- 劇本識別碼，例如 'fengtuz' / 'tiancai'
    filename    TEXT        NOT NULL,
    folder      TEXT        NOT NULL DEFAULT '',
    page_num    INT         NOT NULL DEFAULT 0,
    text        TEXT        NOT NULL DEFAULT '',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS cards_script_idx   ON cards (script);
CREATE INDEX IF NOT EXISTS cards_filename_idx ON cards (filename);
CREATE INDEX IF NOT EXISTS cards_folder_idx   ON cards (folder);
CREATE INDEX IF NOT EXISTS cards_text_fts
    ON cards USING GIN (to_tsvector('simple', text));

-- 開放匿名讀取（GitHub Pages 靜態網站需要）
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read-only"
    ON cards FOR SELECT
    USING (true);

-- ══════════════════════════════════════════════════════
-- 若資料表已存在（舊專案 Migration）執行這段
-- ══════════════════════════════════════════════════════
-- ALTER TABLE cards ADD COLUMN IF NOT EXISTS script TEXT NOT NULL DEFAULT '';
-- CREATE INDEX IF NOT EXISTS cards_script_idx ON cards (script);
-- 舊資料若屬於天才在左，執行：
-- UPDATE cards SET script = 'tiancai' WHERE script = '';

-- ══════════════════════════════════════════════════════
-- 清除特定劇本資料（重新匯入時用）
-- ══════════════════════════════════════════════════════
-- DELETE FROM cards WHERE script = 'fengtuz';
-- DELETE FROM cards WHERE script = 'tiancai';
