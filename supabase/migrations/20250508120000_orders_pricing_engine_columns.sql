-- Миграция: расширение таблицы orders колонками для нового движка ценообразования
-- Контекст: pricing-engine.js (NBRB API + ShopbyShop тарифы + комиссия + страховка + Legit Check + таможня)
-- Все колонки опциональны (NOT NULL не ставим), чтобы старые записи остались валидными.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS commission_byn      DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customs_duty_byn    DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS insurance_byn       DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS legit_check_byn     DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency_buffer_byn DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_byn           DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS source_country      VARCHAR(2),
  ADD COLUMN IF NOT EXISTS product_currency    VARCHAR(8),
  ADD COLUMN IF NOT EXISTS delivery_days_min   INTEGER,
  ADD COLUMN IF NOT EXISTS delivery_days_max   INTEGER;

-- Индекс на source_country (понадобится для аналитики «по какой стране сколько заказов»)
CREATE INDEX IF NOT EXISTS idx_orders_source_country ON orders(source_country);

-- Комментарии (для удобства sql-консолей и Supabase Studio)
COMMENT ON COLUMN orders.commission_byn      IS 'Комиссия ICE LOGIX в BYN (после применения уровня клиента)';
COMMENT ON COLUMN orders.customs_duty_byn    IS 'Таможенная пошлина 30%, если стоимость > €1000';
COMMENT ON COLUMN orders.insurance_byn       IS 'Страховка 2% от стоимости товара (если выбрана)';
COMMENT ON COLUMN orders.legit_check_byn     IS 'Стоимость Legit Check (15 BYN, если выбран)';
COMMENT ON COLUMN orders.currency_buffer_byn IS 'Буфер на колебания курса (3% от цены товара)';
COMMENT ON COLUMN orders.total_byn           IS 'Итоговая стоимость заказа в BYN (после всех скидок)';
COMMENT ON COLUMN orders.source_country      IS 'Страна-источник: CN/PL/EU/RU (доступные)';
COMMENT ON COLUMN orders.product_currency    IS 'Валюта оригинальной цены товара (CNY/USD/EUR/...)';
COMMENT ON COLUMN orders.delivery_days_min   IS 'Минимальный срок доставки в днях';
COMMENT ON COLUMN orders.delivery_days_max   IS 'Максимальный срок доставки в днях';
