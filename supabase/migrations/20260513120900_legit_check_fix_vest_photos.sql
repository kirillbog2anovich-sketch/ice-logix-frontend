-- Follow-up to 20260513120800: fix `carhartt-wip / og-active-vest` photos.
--
-- Devin Review #15 (batch 6) flagged that the original scrape returned Active
-- Jacket images (SKU I032232) for the Vest entry (SKU prefix I035) because the
-- Bing query was too generic. Re-scraped with a sleeveless/gilet query, uploaded
-- correct vest images (.jpg) to Supabase Storage, and updating the prod rows
-- here to point at the new URLs. On a fresh DB, migration 120800 already seeds
-- the correct URLs and this UPDATE matches 0 rows (safe no-op).

UPDATE legit_check_reference_photos p
SET photo_url = 'https://vrvwdagjpttvfvjanbwq.supabase.co/storage/v1/object/public/legit-references/carhartt-wip/og-active-vest/1.jpg',
    source_url = 'https://cdn.media.amplience.net/i/carhartt_wip/I035349_89_XX-OF-01?%24OF%24=&fmt=auto&w=3840&qlt=default'
FROM legit_check_models m
JOIN legit_check_brands b ON m.brand_id = b.id
WHERE p.model_id = m.id
  AND b.slug = 'carhartt-wip'
  AND m.slug = 'og-active-vest'
  AND p.ordering = 1
  AND p.photo_url LIKE '%og-active-vest/1.webp';

UPDATE legit_check_reference_photos p
SET photo_url = 'https://vrvwdagjpttvfvjanbwq.supabase.co/storage/v1/object/public/legit-references/carhartt-wip/og-active-vest/2.jpg',
    source_url = 'https://static.ftshp.digital/img/p/1/6/2/2/5/2/7/1622527.jpg'
FROM legit_check_models m
JOIN legit_check_brands b ON m.brand_id = b.id
WHERE p.model_id = m.id
  AND b.slug = 'carhartt-wip'
  AND m.slug = 'og-active-vest'
  AND p.ordering = 2
  AND p.photo_url LIKE '%og-active-vest/2.webp';
