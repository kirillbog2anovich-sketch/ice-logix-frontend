-- Follow-up к 20260513120300_legit_check_carhartt_sku_fix.sql (Devin Review #15).
--
-- Предыдущая миграция расширила sku_pattern + auth_markers Carhartt WIP до "I0 или K0".
-- Но red_flags остались со старой формулировкой 'Артикул не I0XXXXX' (только у detroit-jacket).
--
-- Это создаёт противоречивые сигналы для AI: оригинальная куртка с артикулом K01234X
--   - проходит sku_pattern ('^[IK]0[0-9]{5}$') ✓
--   - проходит auth_marker ('формат I0XXXXX или K0XXXXX') ✓
--   - но триггерит red_flag ('Артикул не I0XXXXX') ✗ — потому что K0XXXXX буквально "не I0XXXXX"
--
-- Фикс: заменяем 'Артикул не I0XXXXX' на 'Артикул не I0XXXXX и не K0XXXXX' во всех red_flags Carhartt WIP.

UPDATE legit_check_models m
SET red_flags = ARRAY(
  SELECT REPLACE(rf, 'Артикул не I0XXXXX', 'Артикул не I0XXXXX и не K0XXXXX')
  FROM unnest(m.red_flags) AS rf
)
FROM legit_check_brands b
WHERE m.brand_id = b.id
  AND b.slug = 'carhartt-wip'
  AND EXISTS (SELECT 1 FROM unnest(m.red_flags) AS rf WHERE rf LIKE '%не I0XXXXX%' AND rf NOT LIKE '%не I0XXXXX и не K0XXXXX%');
