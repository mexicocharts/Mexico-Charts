---
name: Production secret isolation
description: Replit deployment secrets are separate from shared/development secrets and are not promoted by artifact runtime configuration.
---

Production deployment secrets must be explicitly configured in the deployment’s secret settings; adding a name to an artifact runtime environment block does not safely promote a development secret.

**Why:** A production inspection found a required API key absent in all secret scopes, while the deployment artifact declared only non-secret runtime variables. Replit documentation confirms environment isolation.

**How to apply:** Check secret existence before changing deployment configuration. Never substitute a different credential or copy a secret value into code/config; if the named secret is absent, stop and request secure restoration through the platform’s secret flow.