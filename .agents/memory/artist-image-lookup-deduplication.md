---
name: Artist image lookup deduplication
description: Constraint of the shared artist-image endpoint when aliases or case variants are requested together.
---

The artist-image endpoint can null results when multiple requested names resolve to the same image URL. Image lookup callers should deduplicate names case-insensitively and prefer one canonical Mexican-entry key before requesting images.

**Why:** Canonical aliases such as `LATIN MAFIA` and `Latin Mafia` can resolve to the same real image, but requesting both causes the endpoint's duplicate-URL guard to blank both results.

**How to apply:** Build image request names from the normalized MX attribution/canonical artist key, deduplicate them before calling the shared image hook, keep source-row artwork fallback separate, and route browser-facing CDN URLs through the existing same-origin image proxy.

**Delivery constraint:** External artwork CDN URLs may resolve from the API server but fail in the browser preview; same-origin proxying keeps valid artwork visible and lets client-side error recovery work reliably.