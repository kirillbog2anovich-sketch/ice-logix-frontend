-- Миграция: справочник для Legit Check (Tier 1, AI auto-check).
--
-- Контекст: документ ARCHITECTURE.md / Devin session 498368cf03d742c8a43030e78f191737.
-- Цель MVP: AI-проверка подлинности (Gemini Vision) на основе:
--   1) reference photos оригиналов (StockX/GOAT/official) по модели,
--   2) auth_markers — на что смотреть, если фото подлинное,
--   3) red_flags — типовые признаки реплики.
--
-- Edge Function `legit-check` (будет в следующем PR) делает:
--   user_photo  ─►  Gemini Vision (детект бренда+модели)
--               ─►  SELECT из legit_check_models WHERE brand_id=X AND slug=Y
--               ─►  Gemini Vision сравнивает user_photo vs reference_photos + проверяет markers
--               ─►  возвращает {score 0-100, issues[], confidence}.
--
-- Цена клиенту: 5 BYN. Себестоимость ~$0.10-0.20 (3-5 vision calls Gemini Flash).

-- ── Бренды ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS legit_check_brands (
  id                SERIAL PRIMARY KEY,
  slug              VARCHAR(64)  NOT NULL UNIQUE,
  name              VARCHAR(128) NOT NULL,
  category          VARCHAR(64)  NOT NULL,                 -- 'sneakers' | 'clothing' | 'bags' | 'mixed'
  reliability_score INTEGER      NOT NULL DEFAULT 75,      -- 0-100, наша оценка AI-надёжности для бренда
  common_red_flags  TEXT[]       NOT NULL DEFAULT '{}',    -- общие для всех моделей бренда
  notes             TEXT,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  legit_check_brands             IS 'Бренды, поддерживаемые в legit-check MVP (топ-5).';
COMMENT ON COLUMN legit_check_brands.slug        IS 'URL-friendly идентификатор: nike, adidas, stone-island, ...';
COMMENT ON COLUMN legit_check_brands.category    IS 'sneakers / clothing / bags / mixed — для общих эвристик.';
COMMENT ON COLUMN legit_check_brands.reliability_score IS 'Насколько AI хорошо ловит подделки этого бренда (0-100).';

-- ── Модели ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS legit_check_models (
  id            SERIAL PRIMARY KEY,
  brand_id      INTEGER       NOT NULL REFERENCES legit_check_brands(id) ON DELETE CASCADE,
  slug          VARCHAR(128)  NOT NULL,                    -- 'air-jordan-1-high-og'
  name          VARCHAR(255)  NOT NULL,                    -- 'Air Jordan 1 High OG'
  category      VARCHAR(64),                                -- более точная подкатегория (опц.)
  sku_pattern   VARCHAR(255),                               -- regex для проверки SKU (опц.)
  auth_markers  TEXT[]        NOT NULL DEFAULT '{}',
  red_flags     TEXT[]        NOT NULL DEFAULT '{}',
  aliases       TEXT[]        NOT NULL DEFAULT '{}',        -- альтернативные имена для матчинга
  notes         TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (brand_id, slug)
);

COMMENT ON TABLE  legit_check_models              IS 'Конкретные модели с anti-fake маркерами.';
COMMENT ON COLUMN legit_check_models.auth_markers IS 'Что должно ПРИСУТСТВОВАТЬ у оригинала (массив пунктов на русском).';
COMMENT ON COLUMN legit_check_models.red_flags    IS 'Признаки реплики (массив пунктов на русском).';
COMMENT ON COLUMN legit_check_models.aliases      IS 'Альтернативные написания (для fuzzy-матчинга в AI prompt).';
COMMENT ON COLUMN legit_check_models.sku_pattern  IS 'POSIX regex для проверки SKU/серийника (опц.).';

CREATE INDEX IF NOT EXISTS idx_legit_check_models_brand_id ON legit_check_models(brand_id);
CREATE INDEX IF NOT EXISTS idx_legit_check_models_slug     ON legit_check_models(slug);

-- ── Reference photos ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS legit_check_reference_photos (
  id          SERIAL PRIMARY KEY,
  model_id    INTEGER      NOT NULL REFERENCES legit_check_models(id) ON DELETE CASCADE,
  photo_url   TEXT         NOT NULL,                       -- public URL (Supabase Storage)
  angle       VARCHAR(32)  NOT NULL,                       -- 'side' | 'top' | 'logo' | 'tag' | 'sole' | 'box' | 'detail'
  focus       VARCHAR(128),                                 -- 'tongue label' / 'compass patch' / 'serial tag'
  source      VARCHAR(64)  NOT NULL,                       -- 'stockx' | 'goat' | 'official' | 'farfetch' | ...
  source_url  TEXT,                                         -- оригинальный URL (для аудита)
  ordering    INTEGER      NOT NULL DEFAULT 0,             -- порядок показа в AI prompt
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  legit_check_reference_photos          IS 'Фото оригиналов, на которые AI ориентируется при проверке.';
COMMENT ON COLUMN legit_check_reference_photos.angle    IS 'Ракурс: side/top/logo/tag/sole/box/detail.';
COMMENT ON COLUMN legit_check_reference_photos.source   IS 'Откуда взято фото — для юридической чистоты.';

CREATE INDEX IF NOT EXISTS idx_legit_check_reference_photos_model_id ON legit_check_reference_photos(model_id);

-- ── RLS: public read, никто не пишет (только service role) ──────────────
ALTER TABLE legit_check_brands             ENABLE ROW LEVEL SECURITY;
ALTER TABLE legit_check_models             ENABLE ROW LEVEL SECURITY;
ALTER TABLE legit_check_reference_photos   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "legit_check_brands_public_read"
  ON legit_check_brands             FOR SELECT USING (true);

CREATE POLICY "legit_check_models_public_read"
  ON legit_check_models             FOR SELECT USING (true);

CREATE POLICY "legit_check_reference_photos_public_read"
  ON legit_check_reference_photos   FOR SELECT USING (true);

-- (INSERT/UPDATE/DELETE доступны только через service_role, который bypasses RLS.)
