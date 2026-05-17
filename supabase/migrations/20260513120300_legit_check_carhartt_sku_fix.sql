-- Follow-up к 20260513120100_legit_check_seed_top5.sql (Devin Review #15).
--
-- Carhartt WIP использует ДВА легитимных префикса артикулов: I0 и K0.
-- common_red_flags бренда явно пишет: "артикул не начинается с I0 или K0 — это red flag".
--
-- Однако model.sku_pattern для всех 10 моделей принимал только '^I0[0-9]{5}$',
-- из-за чего AI-pipeline помечал бы оригинальные K0-артикулы как сомнительные.
--
-- Фикс: расширяем regex до '^[IK]0[0-9]{5}$' и правим auth_marker с упоминанием формата.

-- ── Обновляем sku_pattern для всех моделей Carhartt WIP ──
UPDATE legit_check_models m
SET sku_pattern = '^[IK]0[0-9]{5}$'
FROM legit_check_brands b
WHERE m.brand_id = b.id
  AND b.slug = 'carhartt-wip'
  AND m.sku_pattern = '^I0[0-9]{5}$';

-- ── Обновляем текст auth_marker с упоминанием формата артикула ──
-- Заменяем "I0XXXXX" → "I0XXXXX или K0XXXXX" в каждом массиве.
UPDATE legit_check_models m
SET auth_markers = ARRAY(
  SELECT REPLACE(REPLACE(am, 'формат I0XXXXX (например I036259)', 'формат I0XXXXX или K0XXXXX (например I036259, K01234X)'),
                 'Артикул I0XXXXX', 'Артикул I0XXXXX или K0XXXXX')
  FROM unnest(m.auth_markers) AS am
)
FROM legit_check_brands b
WHERE m.brand_id = b.id
  AND b.slug = 'carhartt-wip';
