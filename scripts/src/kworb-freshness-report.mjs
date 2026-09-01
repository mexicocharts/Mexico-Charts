import { createRequire } from "node:module";
import { resolveDatabaseUrl } from "@workspace/db/database-url";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg");

const pool = new Pool({ connectionString: resolveDatabaseUrl() });

async function query(sql, params = []) {
  return (await pool.query(sql, params)).rows;
}

async function main() {
  const snapshotSummary = await query(`
    select
      metric_type,
      count(*)::int as snapshots,
      count(distinct artist_key)::int as artists,
      min(fetched_at) as oldest,
      max(fetched_at) as newest,
      count(*) filter (where expires_at <= now())::int as expired,
      count(*) filter (where fetched_at >= now() - interval '24 hours')::int as fetched_24h,
      count(distinct artist_key) filter (where fetched_at >= now() - interval '24 hours')::int as artists_24h
    from kworb_snapshots
    group by metric_type
    order by metric_type
  `);

  const coverage = await query(`
    select
      count(*)::int as total,
      count(*) filter (where has_spotify)::int as has_spotify,
      count(*) filter (where has_youtube)::int as has_youtube,
      count(*) filter (where has_itunes)::int as has_itunes,
      count(*) filter (where last_fetch_at >= now() - interval '24 hours')::int as fetched_24h,
      max(last_fetch_at) as newest_fetch,
      min(last_fetch_at) as oldest_fetch
    from kworb_coverage
  `);

  const stale = await query(`
    select
      count(*) filter (where has_spotify and (last_fetch_at is null or last_fetch_at < now() - interval '24 hours'))::int as spotify,
      count(*) filter (where has_itunes and (last_fetch_at is null or last_fetch_at < now() - interval '24 hours'))::int as itunes,
      count(*) filter (where has_youtube and (last_fetch_at is null or last_fetch_at < now() - interval '24 hours'))::int as youtube
    from kworb_coverage
  `);

  const youtubeBridge = await query(`
    select
      count(*) filter (where not has_youtube)::int as missing_youtube,
      count(*) filter (where not has_youtube and has_spotify)::int as missing_youtube_has_spotify,
      count(*) filter (
        where not has_youtube
          and spotify_id is not null
          and spotify_id <> ''
      )::int as missing_youtube_has_spotify_id
    from kworb_coverage
  `);

  const jobs = await query(`
    select
      metric_type,
      status,
      count(*)::int as n,
      min(due_at) as oldest_due,
      max(due_at) as newest_due
    from kworb_jobs
    group by metric_type, status
    order by metric_type, status
  `);

  const overduePending = await query(`
    select
      metric_type,
      count(*)::int as n,
      min(due_at) as oldest_due
    from kworb_jobs
    where status = 'pending' and due_at <= now()
    group by metric_type
    order by metric_type
  `);

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    snapshotSummary,
    coverage: coverage[0],
    stale: stale[0],
    youtubeBridge: youtubeBridge[0],
    jobs,
    overduePending,
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
