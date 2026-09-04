---
name: Monitor Pro test-key preview build
description: Secure environment mapping and build behavior for the isolated Monitor Pro preview.
---

The private Monitor Pro preview must use its own development/test Clerk key pair and founder allowlist, mapped only inside the dedicated launcher: the publishable key is available to the frontend build, while the secret key and internal user IDs remain API-process-only. The mounted preview base path is valid for serving the app but causes the general Mexico Charts performance audit to look for assets under a duplicated base-path directory, so the isolated preview should run the approved Vite bundle build without that unrelated audit.

**Why:** The preview has a separate Clerk environment and is mounted below a path prefix; using shared live credentials breaks sign-in, while the full application build audit rejects the otherwise successful mounted bundle.

**How to apply:** Keep the mapping scoped to the dedicated preview launcher, rebuild with the existing preview base path, and restart only the Monitor Pro private preview workflow. Do not alter shared Clerk variables, production configuration, or the normal API.