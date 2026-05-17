-- PR-A.5 follow-up: extend the documented `angle` vocabulary on
-- legit_check_reference_photos to match the values used by the photo seed
-- (migration 120800) and what makes sense for non-sneaker categories.
--
-- Original vocabulary (120000) was sneaker-centric: side/top/logo/tag/sole/box/detail.
-- Seed migration 120800 uses 'front' (main product shot, 50 rows) and 'alt'
-- (alternate angle, 50 rows) — these are more natural for clothing/bags/hats
-- where 'side' / 'sole' don't apply. The column is VARCHAR(32) with no CHECK
-- constraint, so existing data is unaffected; this migration only updates the
-- documentation so the future legit-check Edge Function knows the full set
-- when it filters reference photos by angle.

COMMENT ON COLUMN legit_check_reference_photos.angle IS
  'Ракурс. Recommended values: front | alt | side | top | logo | tag | sole | box | detail. '
  'front = main product shot (clothing/bags/hats default). '
  'alt = secondary angle (back/side/3-4). '
  'side/sole/box = sneaker-specific. '
  'logo/tag/detail = close-up authenticity markers.';
