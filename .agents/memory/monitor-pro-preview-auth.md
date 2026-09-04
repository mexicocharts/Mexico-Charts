---
name: Monitor Pro preview authentication
description: Authentication constraint affecting Monitor Pro previews on Replit development domains.
---

The external Clerk live tenant only accepts browser origins under its configured production domain. A Monitor Pro preview on a Replit development domain can render the signed-out application shell, but Clerk will reject sign-in from that origin unless the tenant explicitly allows it or the preview uses a matching development/test Clerk environment.

**Why:** A real managed-artifact preview returned the frontend and isolated API successfully, but Clerk rejected the Replit origin with an HTTP 400 domain mismatch.

**How to apply:** Before claiming a Monitor Pro development preview is founder-authenticated, verify Clerk loads without an origin warning and complete an authenticated request through the isolated API. Never bypass the Clerk gate to work around this restriction.