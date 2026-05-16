# Mexico Charts

Mexico Charts is a pnpm monorepo for a Mexican music data platform covering charts, artists, certifications, touring, industry reports, and social export tools.

## Main Packages

- `artifacts/mexico-charts` — public React/Vite web app.
- `artifacts/api-server` — Express API server.
- `artifacts/mexico-charts-mobile` — mobile app.
- `lib/db` — Drizzle/PostgreSQL schema.
- `lib/api-spec` and `lib/api-client-react` — API contract and generated client.

## Common Commands

```bash
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/mexico-charts run dev
pnpm --filter @workspace/api-server run dev
```

## Notes

This project is Replit-first. Replit provides the PostgreSQL database and provider secrets used by the API/data workflows. See `replit.md` for the operating notes, environment variables, and local development gotchas.
