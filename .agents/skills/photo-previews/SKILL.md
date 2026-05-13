---
name: photo-previews
description: Memory-safe handling of photo previews via blob URLs in index.html. Use when the task involves uploading, previewing, or removing photos in calculator / new-order / search-by-image flows.
triggers:
  - photo
  - blob
  - createObjectURL
  - revokeObjectURL
  - preview
  - upload image
  - calcPhoto
  - orderPhoto
  - textPhoto
---

# Skill: photo preview memory hygiene

The frontend has four photo upload zones (calculator-photo, calculator-text-photo, new-order-photo, new-order-text-photo). Each generates `URL.createObjectURL(File)` URLs for previews. Without explicit `URL.revokeObjectURL`, the browser retains file data indefinitely → memory leak → laggy navigation after a long session.

PR #10 introduced helpers at the top of the `<script>` block in `index.html`:

```js
const _photoBlobUrls = new Map();   // key -> url
function trackBlobUrl(key, file) {
  const old = _photoBlobUrls.get(key);
  if (old) URL.revokeObjectURL(old);
  const url = URL.createObjectURL(file);
  _photoBlobUrls.set(key, url);
  return url;
}
function clearBlobUrls(prefix) {
  for (const [key, url] of _photoBlobUrls.entries()) {
    if (!prefix || key.startsWith(prefix)) {
      URL.revokeObjectURL(url);
      _photoBlobUrls.delete(key);
    }
  }
}
```

## Key conventions

- **Never call `URL.createObjectURL` directly for previews** — always go through `trackBlobUrl(key, file)`.
- **Key naming**: use namespaced keys so `clearBlobUrls(prefix)` can wipe related URLs in one shot.
  - `calc:photo:<i>` for calculator photo gallery
  - `calc:textphoto` for calculator text-mode single photo
  - `order:photo:<i>` for new-order photo gallery
  - `order:textphoto` for new-order text-mode single photo
- **Tab switch**: `switchTab` calls `clearBlobUrls('calc:')` / `clearBlobUrls('order:')` when leaving the respective screen. If you add a new photo zone in a new screen, mirror this pattern.

## When adding a new photo preview

1. Inside the render function, call `trackBlobUrl('<namespace>:<key>', file)` to get the preview URL.
2. Use the returned URL inside `<img src="...">`.
3. If the new screen has its own tab, add a `clearBlobUrls('<namespace>:')` call in the `switchTab` cleanup path.
4. Do NOT call `URL.revokeObjectURL` manually — `trackBlobUrl` handles it on re-track, and `clearBlobUrls` handles it on tab change.

## Validation

Open the deployed Vercel preview in Chrome → DevTools → Memory → take a heap snapshot. Upload + remove 10 photos in calculator → switch tab → take a second snapshot. The second should NOT show 10 retained `Blob` objects.

## Don't

- Don't introduce a parallel tracker — extend `_photoBlobUrls` with new keys.
- Don't leak keys (e.g. forget to assign `i` when iterating). The helper deduplicates by key, but the user can upload N photos in a row without ever clearing — that's why each photo gets its own indexed key.
- Don't reuse keys across unrelated screens (e.g. don't use `order:photo:0` for a calculator photo) — `clearBlobUrls` keys off the prefix.
