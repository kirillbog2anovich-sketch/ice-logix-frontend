-- Follow-up к 20260513120100_legit_check_seed_top5.sql (Devin Review #15).
--
-- Yeezy Boost 350 V2 и Yeezy Slide использовали sku_pattern '^[A-Z]{1,3}[0-9]{4}$'
-- (только 4 цифры). Другие Adidas-модели (Samba, Stan Smith и т.д.) используют
-- '^[A-Z]{1,3}[0-9]{4,5}$' — гибче, потому что Adidas style codes варьируются.
--
-- Расширяем Yeezy паттерн до {4,5} цифр для consistency и чтобы не отбрасывать
-- ложно-подозрительные настоящие Yeezy SKU с 5-значными суффиксами.

UPDATE legit_check_models m
SET sku_pattern = '^[A-Z]{1,3}[0-9]{4,5}$'
FROM legit_check_brands b
WHERE m.brand_id = b.id
  AND b.slug = 'adidas'
  AND m.slug IN ('yeezy-boost-350-v2', 'yeezy-slide')
  AND m.sku_pattern = '^[A-Z]{1,3}[0-9]{4}$';
