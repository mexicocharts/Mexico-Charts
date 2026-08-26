---
name: Canonical route and sitemap synchronization
description: The public artist route catalog and sitemap must stay synchronized when adding canonical profiles.
---

Every newly approved canonical artist profile must be added to both the route supplement and the public sitemap before the production route audit can pass.

**Why:** The build validates that every sitemap route has a matching prerendered shell, so a valid profile route can still block release if it is omitted from the sitemap.

**How to apply:** When adding canonical artist identities, update the route source and sitemap together, then run the route audit and prerender build.