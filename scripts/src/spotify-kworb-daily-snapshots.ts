import { createRequire } from "node:module";
import { resolveDatabaseUrl } from "@workspace/db/database-url";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg") as {
  Pool: new (config: { connectionString: string }) => {
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
    end: () => Promise<void>;
  };
};

type PoolLike = InstanceType<typeof Pool>;

interface ArtistRow {
  artist_key: string;
  artist_name: string;
  spotify_artist_id: string | null;
}

interface SpotifySnapshotStats {
  totalStreams: number;
  dailyStreams: number;
  trackCount: number;
}

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    args.set(key, value);
  }

  return {
    snapshotDate: args.get("date") ?? new Date().toISOString().slice(0, 10),
    limit: Math.max(1, Math.min(Number(args.get("limit") ?? 500), 1000)),
    offset: Math.max(0, Number(args.get("offset") ?? 0)),
    write: args.get("write") === "true",
  };
}

function parseCommaNum(value: string | undefined): number {
  if (!value) return 0;
  return parseInt(value.replace(/,/g, "").trim(), 10) || 0;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "").trim();
}

function parseTableRows(html: string): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs)) {
    const cells: string[] = [];
    for (const cellMatch of rowMatch[1].matchAll(/<td[^>]*>(.*?)<\/td>/gs)) {
      cells.push(stripTags(cellMatch[1]));
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function parseSpotifyKworbPage(html: string): SpotifySnapshotStats | null {
  const rows = parseTableRows(html);
  let totalStreams = 0;
  let dailyStreams = 0;
  let trackCount = 0;

  for (const cells of rows) {
    const first = cells[0] ?? "";
    if (first === "Streams" && cells[1]) totalStreams = parseCommaNum(cells[1]);
    else if (first === "Daily" && cells[1]) dailyStreams = parseCommaNum(cells[1]);
    else if (first === "Tracks" && cells[1]) trackCount = parseCommaNum(cells[1]);
  }

  return totalStreams ? { totalStreams, dailyStreams, trackCount } : null;
}

async function ensureTables(pool: PoolLike) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS spotify_kworb_daily_snapshots (
      id serial PRIMARY KEY,
      artist_key text NOT NULL,
      spotify_artist_id text,
      snapshot_date text NOT NULL,
      source_type text NOT NULL DEFAULT 'kworb_spotify_artist',
      total_streams bigint,
      daily_streams bigint,
      track_count integer,
      fetched_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS spotify_kworb_daily_snapshots_artist_date_unique
    ON spotify_kworb_daily_snapshots (artist_key, snapshot_date);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS spotify_kworb_daily_snapshots_spotify_date_idx
    ON spotify_kworb_daily_snapshots (spotify_artist_id, snapshot_date);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS spotify_kworb_daily_snapshots_artist_date_idx
    ON spotify_kworb_daily_snapshots (artist_key, snapshot_date);
  `);
}

async function fetchKworbSpotify(spotifyArtistId: string): Promise<SpotifySnapshotStats | null> {
  const response = await fetch(`https://kworb.net/spotify/artist/${spotifyArtistId}_songs.html`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; MexicoChartsBot/1.0)",
      "Accept": "text/html",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return null;
  return parseSpotifyKworbPage(await response.text());
}

async function saveSnapshot(
  pool: PoolLike,
  artist: ArtistRow,
  kworb: SpotifySnapshotStats,
  snapshotDate: string,
) {
  await pool.query(
    `
      INSERT INTO spotify_kworb_daily_snapshots (
        artist_key, spotify_artist_id, snapshot_date, source_type,
        total_streams, daily_streams, track_count, fetched_at, updated_at
      )
      VALUES ($1,$2,$3,'kworb_spotify_artist',$4,$5,$6,now(),now())
      ON CONFLICT (artist_key, snapshot_date) DO UPDATE SET
        spotify_artist_id = excluded.spotify_artist_id,
        total_streams = excluded.total_streams,
        daily_streams = excluded.daily_streams,
        track_count = excluded.track_count,
        fetched_at = excluded.fetched_at,
        updated_at = now()
    `,
    [
      artist.artist_key,
      artist.spotify_artist_id,
      snapshotDate,
      kworb.totalStreams,
      kworb.dailyStreams,
      kworb.trackCount,
    ],
  );
}

async function main() {
  const { snapshotDate, limit, offset, write } = parseArgs();
  const databaseUrl = resolveDatabaseUrl();

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await ensureTables(pool);
    const artistRows = await pool.query<ArtistRow>(
      `
        SELECT
          c.artist_key,
          c.artist_name,
          COALESCE(c.spotify_id, s.spotify_artist_id) AS spotify_artist_id
        FROM kworb_coverage c
        LEFT JOIN spotify_artists s ON s.artist_key = c.artist_key
        WHERE COALESCE(c.spotify_id, s.spotify_artist_id) IS NOT NULL
          AND COALESCE(c.has_spotify, false) = true
        ORDER BY c.tier, c.artist_key
        OFFSET $1
        LIMIT $2
      `,
      [offset, limit],
    );

    let fetched = 0;
    let saved = 0;
    let missing = 0;
    console.log(`${write ? "Writing" : "Dry run"} Spotify Kworb snapshots: date=${snapshotDate} artists=${artistRows.rows.length} offset=${offset}`);

    for (const artist of artistRows.rows) {
      if (!artist.spotify_artist_id) continue;
      const kworb = await fetchKworbSpotify(artist.spotify_artist_id);
      if (!kworb) {
        missing += 1;
        console.log(`MISSING,${artist.artist_key},${artist.artist_name},${artist.spotify_artist_id}`);
        continue;
      }

      fetched += 1;
      if (write) {
        await saveSnapshot(pool, artist, kworb, snapshotDate);
        saved += 1;
        console.log(`SAVE,${artist.artist_key},daily=${kworb.dailyStreams},total=${kworb.totalStreams}`);
      } else {
        console.log(`SNAPSHOT,${artist.artist_key},daily=${kworb.dailyStreams},total=${kworb.totalStreams}`);
      }
    }

    const snapshotCount = await pool.query<{ count: number }>(
      "SELECT count(*)::int AS count FROM spotify_kworb_daily_snapshots WHERE snapshot_date = $1",
      [snapshotDate],
    );
    console.log(`Done. fetched=${fetched} saved=${saved} missing=${missing} date_rows=${snapshotCount.rows[0]?.count ?? 0}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
