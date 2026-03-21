-- ─── Set venue for Calgary March 2026 event ──────────────────────────────────
-- Copies venue name, address, and image from the venues table (House 831 record).

UPDATE events e
SET
  venue           = v.name,
  address         = v.address,
  venue_image_url = COALESCE(v.image_url, '/house-831.webp')
FROM venues v
WHERE v.name    = 'House 831'
  AND e.slug    = 'calgary-march-2026';
