import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg") as {
  Pool: new (config: { connectionString: string }) => {
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
    end: () => Promise<void>;
  };
};

type Row = Record<string, string>;

interface SheetData {
  headers: string[];
  rows: Row[];
}

interface ChartsHubResponse {
  lastUpdated?: string;
  sheets?: Record<string, SheetData>;
}

interface SheetConfig {
  source: string;
  chartType: string;
  artistField: string;
  titleFields: string[];
  rankFields: string[];
  externalSongFields?: string[];
  externalArtistFields?: string[];
}

interface CandidateRecord {
  id: number;
}

const DEFAULT_BASE_URL = "https://mexicochart.com";
const METADATA_CSV_URL =
  "https://docs.google.com/spreadsheets/d/18urSUcuMeQxpKvS0gwg5Irz3TSC9zpHJ/gviz/tq?tqx=out:csv&sheet=artist_metadata_active";

const SHEET_CONFIG: Record<string, SheetConfig> = {
  YT_Artists_Weekly: {
    source: "YouTube",
    chartType: "artists_weekly",
    artistField: "Artist Name",
    titleFields: ["Artist Name"],
    rankFields: ["Rank", "rank"],
  },
  YT_Songs_Weekly: {
    source: "YouTube",
    chartType: "songs_weekly",
    artistField: "Artist Names",
    titleFields: ["Song Title", "Title", "title"],
    rankFields: ["Rank", "rank"],
    externalSongFields: ["Video ID", "video_id", "External ID"],
  },
  YT_Videos_Daily: {
    source: "YouTube",
    chartType: "videos_daily",
    artistField: "Artist Names",
    titleFields: ["Video Title", "Title", "title"],
    rankFields: ["Rank", "rank"],
    externalSongFields: ["Video ID", "video_id", "External ID"],
  },
  YT_Shorts_Daily: {
    source: "YouTube",
    chartType: "shorts_daily",
    artistField: "Artist Names",
    titleFields: ["Video Title", "Title", "title"],
    rankFields: ["Rank", "rank"],
    externalSongFields: ["Video ID", "video_id", "External ID"],
  },
  Spotify_Artists_Daily: {
    source: "Spotify",
    chartType: "artists_daily",
    artistField: "Artist",
    titleFields: ["Artist"],
    rankFields: ["Rank", "rank"],
    externalArtistFields: ["Artist ID", "artist_id", "Spotify Artist ID"],
  },
  Spotify_Artists_Weekly: {
    source: "Spotify",
    chartType: "artists_weekly",
    artistField: "Artist",
    titleFields: ["Artist"],
    rankFields: ["Rank", "rank"],
    externalArtistFields: ["Artist ID", "artist_id", "Spotify Artist ID"],
  },
  Spotify_Regional_Daily: {
    source: "Spotify",
    chartType: "regional_daily",
    artistField: "artist_names",
    titleFields: ["track_name", "Track Name", "Song Title", "Title"],
    rankFields: ["rank", "Rank"],
    externalSongFields: ["track_id", "Track ID", "spotify_track_id"],
    externalArtistFields: ["artist_ids", "Artist IDs", "spotify_artist_ids"],
  },
  Spotify_Regional_Weekly: {
    source: "Spotify",
    chartType: "regional_weekly",
    artistField: "artist_names",
    titleFields: ["track_name", "Track Name", "Song Title", "Title"],
    rankFields: ["rank", "Rank"],
    externalSongFields: ["track_id", "Track ID", "spotify_track_id"],
    externalArtistFields: ["artist_ids", "Artist IDs", "spotify_artist_ids"],
  },
  Spotify_Viral_Daily: {
    source: "Spotify",
    chartType: "viral_daily",
    artistField: "artist_names",
    titleFields: ["track_name", "Track Name", "Song Title", "Title"],
    rankFields: ["rank", "Rank"],
    externalSongFields: ["track_id", "Track ID", "spotify_track_id"],
    externalArtistFields: ["artist_ids", "Artist IDs", "spotify_artist_ids"],
  },
  Apple_Songs: {
    source: "Apple Music",
    chartType: "songs",
    artistField: "Artist",
    titleFields: ["Song", "Title", "Name"],
    rankFields: ["Rank", "rank"],
  },
  Apple_Albums: {
    source: "Apple Music",
    chartType: "albums",
    artistField: "Artist",
    titleFields: ["Album", "Title", "Name"],
    rankFields: ["Rank", "rank"],
  },
  Deezer_Top_Mexico: {
    source: "Deezer",
    chartType: "top_mexico",
    artistField: "Artist",
    titleFields: ["Title", "Track", "Song"],
    rankFields: ["Rank", "rank"],
  },
};

const PRESERVED_STATUSES = new Set([
  "approved",
  "rejected",
  "linked_existing_artist",
  "not_mexican",
]);

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    args.set(key, value);
  }

  return {
    baseUrl: args.get("baseUrl") ?? DEFAULT_BASE_URL,
    country: args.get("country") ?? "MX",
    chartDate: args.get("date") ?? new Date().toISOString().slice(0, 10),
    write: args.get("write") === "true",
    maxRowsPerSheet: Number(args.get("maxRowsPerSheet") ?? 0),
  };
}

function normalizeName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function compactName(value: string | null | undefined): string {
  return normalizeName(value).replace(/[^a-z0-9]/g, "");
}

function splitCredit(credit: string): string[] {
  return credit
    .split(/,|&|\/|\s+feat\.?\s+|\s+ft\.?\s+|\s+x\s+|\s+and\s+|\s+y\s+|\s+junto\s+a\s+/gi)
    .map(s => s.trim())
    .filter(s => s.length > 1);
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        i += 1;
      } else if (char === "\"") quoted = false;
      else field += char;
      continue;
    }
    if (char === "\"") quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
  }
  row.push(field);
  rows.push(row);
  return rows.filter(r => r.some(cell => cell.trim()));
}

function rowValue(row: Row, fields: string[]): string {
  for (const field of fields) {
    const value = row[field];
    if (value?.trim()) return value.trim();
  }
  return "";
}

function parseRank(value: string): number | null {
  const parsed = Number(value.replace(/[^\d]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function splitExternalIds(value: string): string[] {
  return value
    .split(/,|\||;/)
    .map(item => item.trim())
    .filter(Boolean);
}

async function fetchJson<T>(url: string): Promise<T> {
  const resp = await fetch(url, { signal: AbortSignal.timeout(25000) });
  if (!resp.ok) throw new Error(`${url}: HTTP ${resp.status}`);
  return resp.json() as Promise<T>;
}

async function fetchKnownArtistNames(baseUrl: string): Promise<Set<string>> {
  const known = new Set<string>();

  try {
    const metadata = await fetchJson<{ artists?: Array<Record<string, unknown>> }>(`${baseUrl.replace(/\/$/, "")}/api/artists/metadata`);
    for (const artist of metadata.artists ?? []) {
      for (const key of ["artist_key", "artistKey", "artist_name", "artistName", "name"]) {
        const value = artist[key];
        if (typeof value === "string" && value.trim()) known.add(compactName(value));
      }
    }
  } catch (err) {
    console.warn(`[artist-discovery] Could not fetch API metadata, falling back to sheet: ${String(err)}`);
  }

  if (known.size) return known;

  const resp = await fetch(METADATA_CSV_URL, { signal: AbortSignal.timeout(25000) });
  if (!resp.ok) throw new Error(`${METADATA_CSV_URL}: HTTP ${resp.status}`);
  const rows = parseCsv(await resp.text());
  const [headers = [], ...body] = rows;
  const keyIndexes = headers
    .map((header, index) => ({ header: header.trim().toLowerCase(), index }))
    .filter(({ header }) => ["artist_key", "artist_name", "name"].includes(header));

  for (const row of body) {
    for (const { index } of keyIndexes) {
      const value = row[index];
      if (value?.trim()) known.add(compactName(value));
    }
  }

  return known;
}

async function upsertSnapshot(
  pool: InstanceType<typeof Pool>,
  config: SheetConfig,
  country: string,
  chartDate: string,
): Promise<number> {
  const result = await pool.query<{ id: number }>(
    `
      INSERT INTO chart_snapshots (source, chart_type, country, chart_date)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (source, chart_type, country, chart_date)
      DO UPDATE SET imported_at = now()
      RETURNING id;
    `,
    [config.source, config.chartType, country, chartDate],
  );

  return result.rows[0].id;
}

async function upsertSnapshotRow(
  pool: InstanceType<typeof Pool>,
  snapshotId: number,
  rank: number,
  title: string,
  artistNames: string[],
  externalSongId: string | null,
  externalArtistIds: string[],
  metadata: Record<string, unknown>,
) {
  await pool.query(
    `
      INSERT INTO chart_snapshot_rows (
        snapshot_id,
        rank,
        title,
        artist_names,
        external_song_id,
        external_artist_ids,
        metadata_json
      )
      VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, $7::jsonb)
      ON CONFLICT (snapshot_id, rank)
      DO UPDATE SET
        title = EXCLUDED.title,
        artist_names = EXCLUDED.artist_names,
        external_song_id = EXCLUDED.external_song_id,
        external_artist_ids = EXCLUDED.external_artist_ids,
        metadata_json = EXCLUDED.metadata_json;
    `,
    [
      snapshotId,
      rank,
      title,
      JSON.stringify(artistNames),
      externalSongId,
      JSON.stringify(externalArtistIds),
      JSON.stringify(metadata),
    ],
  );
}

async function upsertCandidate(pool: InstanceType<typeof Pool>, artistName: string): Promise<number> {
  const normalizedName = normalizeName(artistName);
  const result = await pool.query<CandidateRecord>(
    `
      INSERT INTO artist_candidates (artist_name, normalized_name)
      VALUES ($1, $2)
      ON CONFLICT (normalized_name)
      DO UPDATE SET
        artist_name = CASE
          WHEN length(artist_candidates.artist_name) < length(EXCLUDED.artist_name)
          THEN EXCLUDED.artist_name
          ELSE artist_candidates.artist_name
        END,
        updated_at = now()
      RETURNING id;
    `,
    [artistName, normalizedName],
  );

  return result.rows[0].id;
}

async function insertCandidateEvent(
  pool: InstanceType<typeof Pool>,
  candidateId: number,
  config: SheetConfig,
  chartDate: string,
  rank: number,
  title: string,
  metadata: Record<string, unknown>,
) {
  await pool.query(
    `
      INSERT INTO artist_candidate_events (
        candidate_id,
        source,
        chart_type,
        chart_date,
        rank,
        song_or_video_title,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT (candidate_id, source, chart_type, chart_date, rank, song_or_video_title)
      DO NOTHING;
    `,
    [candidateId, config.source, config.chartType, chartDate, rank, title, JSON.stringify(metadata)],
  );
}

async function upsertChartPresenceSignal(
  pool: InstanceType<typeof Pool>,
  candidateId: number,
  config: SheetConfig,
) {
  await pool.query(
    `
      INSERT INTO artist_candidate_signals (
        candidate_id,
        signal_type,
        source,
        value,
        confidence_weight
      )
      VALUES ($1, 'chart_presence', $2, $3, 8)
      ON CONFLICT (candidate_id, signal_type, source, value)
      DO UPDATE SET confidence_weight = EXCLUDED.confidence_weight;
    `,
    [candidateId, config.source, config.chartType],
  );
}

async function recalculateCandidate(pool: InstanceType<typeof Pool>, candidateId: number) {
  const result = await pool.query<{
    total_appearances: string;
    source_count: string;
    first_seen_date: string | null;
    last_seen_date: string | null;
    signal_weight: string;
  }>(
    `
      WITH event_stats AS (
        SELECT
          candidate_id,
          COUNT(id)::integer AS total_appearances,
          COUNT(DISTINCT source)::integer AS source_count,
          MIN(chart_date) AS first_seen_date,
          MAX(chart_date) AS last_seen_date
        FROM artist_candidate_events
        WHERE candidate_id = $1
        GROUP BY candidate_id
      ),
      signal_stats AS (
        SELECT
          candidate_id,
          COALESCE(SUM(confidence_weight), 0)::integer AS signal_weight
        FROM artist_candidate_signals
        WHERE candidate_id = $1
        GROUP BY candidate_id
      )
      SELECT
        COALESCE(e.total_appearances, 0)::text AS total_appearances,
        COALESCE(e.source_count, 0)::text AS source_count,
        e.first_seen_date,
        e.last_seen_date,
        COALESCE(s.signal_weight, 0)::text AS signal_weight
      FROM artist_candidates c
      LEFT JOIN event_stats e ON e.candidate_id = c.id
      LEFT JOIN signal_stats s ON s.candidate_id = c.id
      WHERE c.id = $1;
    `,
    [candidateId],
  );

  const stats = result.rows[0];
  if (!stats) return;

  const totalAppearances = Number(stats.total_appearances);
  const sourceCount = Number(stats.source_count);
  const signalWeight = Number(stats.signal_weight);
  const confidenceScore = Math.min(100, signalWeight + Math.min(totalAppearances, 20) * 2 + sourceCount * 10);

  const status = confidenceScore >= 55
    ? "likely_mexican"
    : confidenceScore >= 25
      ? "needs_review"
      : "pending";

  await pool.query(
    `
      UPDATE artist_candidates
      SET
        first_seen_date = $2,
        last_seen_date = $3,
        total_appearances = $4,
        source_count = $5,
        confidence_score = $6,
        status = CASE
          WHEN status = ANY($8::text[]) THEN status
          ELSE $7
        END,
        updated_at = now()
      WHERE id = $1;
    `,
    [
      candidateId,
      stats.first_seen_date,
      stats.last_seen_date,
      totalAppearances,
      sourceCount,
      confidenceScore,
      status,
      [...PRESERVED_STATUSES],
    ],
  );
}

async function main() {
  const options = parseArgs();
  const databaseUrl = process.env["DATABASE_URL"];
  if (options.write && !databaseUrl) throw new Error("Missing DATABASE_URL.");

  const [chartsHub, knownArtistNames] = await Promise.all([
    fetchJson<ChartsHubResponse>(`${options.baseUrl.replace(/\/$/, "")}/api/charts/hub`),
    fetchKnownArtistNames(options.baseUrl),
  ]);

  const pool = databaseUrl ? new Pool({ connectionString: databaseUrl }) : null;
  const touchedCandidateIds = new Set<number>();
  let snapshotCount = 0;
  let rowCount = 0;
  let unknownArtistHits = 0;
  let skippedKnownArtists = 0;

  try {
    for (const [sheetName, sheet] of Object.entries(chartsHub.sheets ?? {})) {
      const config = SHEET_CONFIG[sheetName];
      if (!config || !sheet.rows.length) continue;

      const rows = options.maxRowsPerSheet > 0 ? sheet.rows.slice(0, options.maxRowsPerSheet) : sheet.rows;
      let snapshotId = 0;
      if (options.write && pool) {
        snapshotId = await upsertSnapshot(pool, config, options.country, options.chartDate);
      }
      snapshotCount += 1;

      for (let index = 0; index < rows.length; index += 1) {
        const row = rows[index];
        const rank = parseRank(rowValue(row, config.rankFields)) ?? index + 1;
        const title = rowValue(row, config.titleFields);
        const credit = row[config.artistField] ?? "";
        const artistNames = splitCredit(credit);
        const externalSongId = rowValue(row, config.externalSongFields ?? []) || null;
        const externalArtistIds = splitExternalIds(rowValue(row, config.externalArtistFields ?? []));

        if (!artistNames.length) continue;
        rowCount += 1;

        if (options.write && pool) {
          await upsertSnapshotRow(pool, snapshotId, rank, title, artistNames, externalSongId, externalArtistIds, {
            sheetName,
            row,
          });
        }

        for (const artistName of artistNames) {
          if (knownArtistNames.has(compactName(artistName))) {
            skippedKnownArtists += 1;
            continue;
          }

          unknownArtistHits += 1;
          if (!options.write || !pool) continue;

          const candidateId = await upsertCandidate(pool, artistName);
          touchedCandidateIds.add(candidateId);
          await insertCandidateEvent(pool, candidateId, config, options.chartDate, rank, title || artistName, {
            sheetName,
            artistCredit: credit,
            row,
          });
          await upsertChartPresenceSignal(pool, candidateId, config);
        }
      }
    }

    if (options.write && pool) {
      for (const candidateId of touchedCandidateIds) {
        await recalculateCandidate(pool, candidateId);
      }
    }

    console.log([
      `Artist discovery import ${options.write ? "wrote" : "dry-run"} chartsHub snapshots`,
      `date=${options.chartDate}`,
      `snapshots=${snapshotCount}`,
      `rows=${rowCount}`,
      `unknown_artist_hits=${unknownArtistHits}`,
      `candidate_updates=${touchedCandidateIds.size}`,
      `known_artist_hits=${skippedKnownArtists}`,
    ].join(" "));
  } finally {
    await pool?.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
