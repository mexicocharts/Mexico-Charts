# Mexico Charts

Mexico Charts is a Replit-first pnpm monorepo for a music data platform covering Mexican music charts, artists, certifications, touring, industry reports, and social export templates.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server.
- `pnpm --filter @workspace/mexico-charts run dev` — run the main web app.
- `pnpm run typecheck` — full typecheck across workspace packages.
- `pnpm run build` — typecheck + build all packages in the Replit/Linux environment.
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec.
- `pnpm --filter @workspace/db run push` — push DB schema changes in development.
- YouTube artist profile channel snapshots run automatically from the API server once per UTC day after `YOUTUBE_CHANNEL_SNAPSHOT_HOUR_UTC` (default `9`). The manual backfill command is `pnpm --filter @workspace/scripts run youtube-channel-daily-snapshots`.
- Spotify/Kworb artist stream snapshots run automatically from the API server once per UTC day after `SPOTIFY_KWORB_SNAPSHOT_HOUR_UTC` (default `10`). The manual backfill command is `pnpm --filter @workspace/scripts run spotify-kworb-daily-snapshots`.

## Required Environment

- `DATABASE_URL` — PostgreSQL connection string.
- `YOUTUBE_API_KEY` — YouTube Data API access for provider/admin routes.
- `YOUTUBE_ADMIN_KEY` — admin key for protected YouTube linking/backfill operations.
- `YOUTUBE_CHANNEL_SNAPSHOT_AUTOMATION` — optional; set to `false` to disable automatic daily official-channel snapshots.
- `YOUTUBE_CHANNEL_SNAPSHOT_HOUR_UTC` — optional; UTC hour for daily channel snapshot automation, default `9`.
- `SPOTIFY_KWORB_SNAPSHOT_AUTOMATION` — optional; set to `false` to disable automatic daily Spotify/Kworb stream snapshots.
- `SPOTIFY_KWORB_SNAPSHOT_HOUR_UTC` — optional; UTC hour for Spotify/Kworb daily stream snapshots, default `10`.
- Spotify credentials used by the Replit Spotify integration/API routes.
- `VITE_SITE_URL` — public site origin used for canonical/Open Graph URLs.
- `VITE_SOCIAL_TEMPLATES_ACCESS_CODE` — private access code for `/social-templates`.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9.
- Main web app: Vite, React 19, Wouter, TanStack Query, Framer Motion, Tailwind CSS.
- API: Express 5.
- DB: PostgreSQL + Drizzle ORM.
- Validation/codegen: Zod, drizzle-zod, Orval.
- Social export: `html-to-image` and template components under `artifacts/mexico-charts/src/social`.

## Where Things Live

- `artifacts/mexico-charts` — main public web app.
- `artifacts/api-server` — Express API server and provider/admin routes.
- `artifacts/mexico-charts-mobile` — mobile app.
- `artifacts/mockup-sandbox` — mockup/prototype sandbox.
- `lib/db` — database schema and Drizzle setup.
- `lib/api-spec` — OpenAPI spec/codegen package.
- `lib/api-client-react` — generated React API client.
- `scripts` — maintenance/import/sync scripts.
- `attached_assets` — uploaded screenshots, source images, reports, and static supporting files.

## Product Notes

- Public surfaces: home, charts, artist roster/detail pages, genres, industry, certifications, touring, static info pages.
- Internal surface: `/social-templates`; keep it noindexed and gated by `VITE_SOCIAL_TEMPLATES_ACCESS_CODE`.
- The social template gate is a frontend privacy gate, not strong server-side authentication.

## Gotchas

- Replit is the source-of-truth runtime because it has Postgres and provider secrets preconfigured.
- Local macOS dev/build can fail because `pnpm-workspace.yaml` excludes macOS native Rollup/esbuild optional packages for the Replit/Linux environment.
- Local Codex can still edit, typecheck, commit, and push. Full runtime QA should happen in Replit unless local platform overrides are adjusted.
- Use pnpm only. The root `preinstall` rejects npm/yarn lockfiles.
- Social templates should not be linked from public navigation or indexed in search.

## Recent Baseline

- `pnpm run typecheck` passes.
- GitHub push works from the local Codex workspace after token auth was configured.
