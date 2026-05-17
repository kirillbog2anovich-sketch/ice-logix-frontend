-- Follow-up к 20260513120600_legit_check_yeezy_sku_fix.sql (Devin Review #15).
--
-- Предыдущая миграция расширила sku_pattern до '^[A-Z]{1,3}[0-9]{4,5}$'
-- только для yeezy-boost-350-v2 и yeezy-slide. Но в seed (20260513120100)
-- ВСЕ 4 модели Yeezy получили старый паттерн '^[A-Z]{1,3}[0-9]{4}$':
--   - yeezy-boost-350-v2  ✓ исправлено в 120600
--   - yeezy-boost-700     ✗ пропущено
--   - yeezy-slide         ✓ исправлено в 120600
--   - yeezy-foam-runner   ✗ пропущено
--
-- Добивает оставшиеся две модели до consistency.

UPDATE legit_check_models m
SET sku_pattern = '^[A-Z]{1,3}[0-9]{4,5}$'
FROM legit_check_brands b
WHERE m.brand_id = b.id
  AND b.slug = 'adidas'
  AND m.slug IN ('yeezy-boost-700', 'yeezy-foam-runner')
  AND m.sku_pattern = '^[A-Z]{1,3}[0-9]{4}$';
