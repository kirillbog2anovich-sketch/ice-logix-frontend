-- Follow-up к 20260513120000_legit_check_references.sql (Devin Review #15).
--
-- Legit Check бизнес-модель расширилась с плоской цены 15 BYN до 3-уровневой:
--   Tier 1 (AI auto-check, MVP)         — 5 BYN
--   Tier 2 (human expert review)        — 15-25 BYN
--   Tier 3 (Entrupy/LegitGrails proxy)  — 80-150 BYN
--
-- Старый комментарий у orders.legit_check_byn («15 BYN, если выбран») теперь
-- вводит в заблуждение. Обновляем чтобы соответствовать актуальной модели.

COMMENT ON COLUMN orders.legit_check_byn IS
  'Стоимость Legit Check в BYN: Tier 1 (AI) = 5, Tier 2 (эксперт) = 15-25, Tier 3 (Entrupy) = 80-150.';
