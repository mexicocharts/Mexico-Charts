export const YOUTUBE_LATEST_OBSERVATION_TABLE = "youtube_video_intraday_latest_observations";

type PgClient = {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
};

export async function ensureYoutubeLatestObservationTable(client: PgClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS youtube_video_intraday_latest_observations (
      video_id text PRIMARY KEY REFERENCES youtube_tracked_videos(video_id) ON DELETE cascade,
      latest_observed_at timestamptz NOT NULL
    )
  `);
}

// This statement must run in the same transaction as the historical snapshot
// write. PostgreSQL's now() is transaction-stable, so the compact timestamp is
// exactly the timestamp stored on the genuine snapshot insert/update.
export const YOUTUBE_LATEST_OBSERVATION_UPSERT_SQL = `
  INSERT INTO youtube_video_intraday_latest_observations (video_id, latest_observed_at)
  SELECT DISTINCT video_id, now()
  FROM jsonb_to_recordset($1::jsonb) AS input(video_id text)
  ON CONFLICT (video_id) DO UPDATE SET
    latest_observed_at = GREATEST(
      youtube_video_intraday_latest_observations.latest_observed_at,
      excluded.latest_observed_at
    )
`;

export type YoutubeObservationPoint = {
  videoId: string;
  observedAt: Date;
};

export type YoutubeCoverageCandidate = {
  artistKey: string;
  videoId: string;
};

export type YoutubeCoverageState = {
  catalogArtists: number;
  observedArtists: number;
  freshArtists: number;
  catalogVideos: number;
  observedVideos: number;
  freshVideos: number;
  latestObservedAt: string | null;
};

export function mergeYoutubeLatestObservations(
  current: ReadonlyMap<string, Date>,
  incoming: readonly YoutubeObservationPoint[],
): Map<string, Date> {
  const merged = new Map(current);
  for (const point of incoming) {
    const previous = merged.get(point.videoId);
    if (!previous || point.observedAt.getTime() > previous.getTime()) {
      merged.set(point.videoId, point.observedAt);
    }
  }
  return merged;
}

export function latestYoutubeObservationsFromHistory(
  observations: readonly YoutubeObservationPoint[],
): Map<string, Date> {
  return mergeYoutubeLatestObservations(new Map(), observations);
}

export function youtubeCoverageFromLatestObservations(
  candidates: readonly YoutubeCoverageCandidate[],
  latest: ReadonlyMap<string, Date>,
  now: Date,
  freshnessMs = 6 * 60 * 60 * 1000,
): YoutubeCoverageState {
  const uniquePairs = new Map<string, YoutubeCoverageCandidate>();
  for (const candidate of candidates) {
    uniquePairs.set(`${candidate.artistKey}\u0000${candidate.videoId}`, candidate);
  }
  const rows = [...uniquePairs.values()];
  const catalogArtists = new Set(rows.map(row => row.artistKey));
  const catalogVideos = new Set(rows.map(row => row.videoId));
  const observedArtists = new Set<string>();
  const observedVideos = new Set<string>();
  const freshArtists = new Set<string>();
  const freshVideos = new Set<string>();
  let latestObservedAt: Date | null = null;

  for (const row of rows) {
    const observedAt = latest.get(row.videoId);
    if (!observedAt) continue;
    observedArtists.add(row.artistKey);
    observedVideos.add(row.videoId);
    if (!latestObservedAt || observedAt.getTime() > latestObservedAt.getTime()) latestObservedAt = observedAt;
    if (now.getTime() - observedAt.getTime() <= freshnessMs) {
      freshArtists.add(row.artistKey);
      freshVideos.add(row.videoId);
    }
  }

  return {
    catalogArtists: catalogArtists.size,
    observedArtists: observedArtists.size,
    freshArtists: freshArtists.size,
    catalogVideos: catalogVideos.size,
    observedVideos: observedVideos.size,
    freshVideos: freshVideos.size,
    latestObservedAt: latestObservedAt?.toISOString() ?? null,
  };
}
