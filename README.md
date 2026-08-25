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

## Touring launch checklist

- Configure the server-only `TICKETMASTER_API_KEY` secret.
- Keep `TOURING_SHADOW_AUTOMATION_DISABLED=false` to collect authorized Discovery snapshots.
- Confirm `/api/touring/concerts`, `/api/touring/lab`, and `/api/admin/touring/shadow` after deployment.
- Touring Lab intentionally leaves Demand Score, inventory, tickets sold, sell-through, and gross unavailable until authorized inputs support them.
- Ticketmaster static seat maps are layout references, not live availability. Standard primary, resale, VIP, and locked offers must remain separate.
