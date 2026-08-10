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
- Songstats artist-level current metrics can be tested with `POST /api/admin/songstats/sync-current?limit=25`. Daily snapshots are opt-in through `SONGSTATS_SNAPSHOT_AUTOMATION=true`.
- Songstats extended artist data is synced with `POST /api/admin/songstats/sync-extended`. It stores a bounded historical window plus audience, country/source audience details, and catalog payloads. The safe defaults are 90 history days, Mexico (`MX`), Spotify audience details, and 100 catalog tracks.
- Extended syncs are resumable: artists that already have every requested endpoint for the requested historical window are skipped. Inspect progress without contacting Songstats at `GET /api/admin/songstats/extended-coverage`.

### Artist monitoring subscriptions

- `/monitoreo` sells one monthly artist-monitoring report for `$6 USD` per artist. The report is delivered to the email used during checkout.
- When `STRIPE_SECRET_KEY` is configured, `POST /api/monitoring/checkout` creates a real recurring Stripe Checkout subscription. Without the key, the page clearly switches to an email-request flow and does not imitate a successful payment.
- Stripe Checkout and subscription metadata include `artist_key`, `artist_name`, and `product=artist_monitoring`. Use those fields in Stripe when reconciling subscribers and preparing each monthly report.
- Version 1 is intentionally a curated email-report service. It does not promise a customer dashboard, real-time alerts, or unrestricted access to raw provider data.
- Cancellation requests are handled through the current Mexico Charts contact email before the next renewal. Keep the public terms and fulfillment process aligned if cancellation or delivery becomes automated later.
- Never expose the Stripe secret, provider credentials, raw provider responses, or internal admin endpoints to the browser.

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
- `SONGSTATS_API_KEY` — server-only Songstats Enterprise API key. Never expose this as a `VITE_` variable.
- `SONGSTATS_ADMIN_KEY` — optional admin key for Songstats routes; falls back to the existing Spotify or YouTube admin key.
- `SONGSTATS_SYNC_MAX_ARTISTS` — maximum unique artists one sync can request; keep at `25` for the free test key and raise deliberately for production.
- `SONGSTATS_EXTENDED_SYNC_MAX_ARTISTS` — maximum artists accepted by one extended-data request, default `5` and hard-capped at `25`.
- `SONGSTATS_EXTENDED_SYNC_CONCURRENCY` — concurrent extended artist workers, default `2` and hard-capped at `5`.
- `SONGSTATS_SNAPSHOT_AUTOMATION` — optional; must be exactly `true` to enable daily Songstats snapshots.
- `SONGSTATS_SNAPSHOT_HOUR_UTC` — optional UTC hour for the daily Songstats snapshot, default `11`.
- `STRIPE_SECRET_KEY` — server-only Stripe secret used to create recurring artist-monitoring Checkout sessions. Never expose this as a `VITE_` variable.
- `PUBLIC_SITE_URL` — public HTTPS origin used by Stripe success and cancellation redirects; defaults to `https://mexicochart.com`.

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
- Songstats raw API payloads are stored server-side and are available only through protected admin inspection. Public provider routes return normalized display metrics, not the raw response.
- Keep extended Songstats backfills bounded and resumable. Do not use `source=all` for audience-details requests; request explicit sources such as Spotify instead.
- Use pnpm only. The root `preinstall` rejects npm/yarn lockfiles.
- Social templates should not be linked from public navigation or indexed in search.

## Recent Baseline

- `pnpm run typecheck` passes.
- GitHub push works from the local Codex workspace after token auth was configured.
