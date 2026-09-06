import { evaluateMonitoringReadiness, type MonitoringReadinessResult } from "./monitoring-readiness-policy";

export interface ReadinessRow {
  artist_key: string;
  artist_name: string | null;
  historic_stats: unknown;
  audience: unknown;
  audience_details: unknown;
  catalog: unknown;
  snapshot_date: string | null;
  spotify_followers: string | number | null;
  spotify_monthly_listeners: string | number | null;
  youtube_subscribers: string | number | null;
  youtube_channel_views: string | number | null;
  instagram_followers: string | number | null;
  tiktok_followers: string | number | null;
  facebook_followers: string | number | null;
  twitter_followers: string | number | null;
  soundcloud_followers: string | number | null;
  deezer_followers: string | number | null;
  stream_snapshot_date: string | null;
  track_count: number | null;
  album_count: number | null;
  track_daily_streams: string | number | null;
  track_total_streams: string | number | null;
  album_total_streams: string | number | null;
  compact_history?: { licensed_endpoint: boolean; growth_metric_keys: string[]; trend_metric_keys: string[]; available_metric_keys?: string[]; metric_latest_dates?: Record<string, string> };
}

function numeric(value: string | number | null): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function evaluateMonitoringReadinessRow(row: ReadinessRow, now?: Date): MonitoringReadinessResult {
  return evaluateMonitoringReadiness({
    historicStats: row.historic_stats,
    audience: row.audience,
    audienceDetails: row.audience_details,
    catalog: row.catalog,
    currentSnapshotDate: row.snapshot_date,
    currentMetrics: {
      spotifyFollowers: numeric(row.spotify_followers),
      spotifyMonthlyListeners: numeric(row.spotify_monthly_listeners),
      youtubeSubscribers: numeric(row.youtube_subscribers),
      youtubeChannelViews: numeric(row.youtube_channel_views),
      instagramFollowers: numeric(row.instagram_followers),
      tiktokFollowers: numeric(row.tiktok_followers),
      facebookFollowers: numeric(row.facebook_followers),
      twitterFollowers: numeric(row.twitter_followers),
      soundcloudFollowers: numeric(row.soundcloud_followers),
      deezerFollowers: numeric(row.deezer_followers),
    },
    streamSnapshotDate: row.stream_snapshot_date,
    trackCount: row.track_count ?? 0,
    albumCount: row.album_count ?? 0,
    trackDailyStreams: numeric(row.track_daily_streams),
    trackTotalStreams: numeric(row.track_total_streams),
    albumTotalStreams: numeric(row.album_total_streams),
    verifiedCompactHistory: row.compact_history ? {
      licensedEndpoint: row.compact_history.licensed_endpoint,
      growthMetricKeys: row.compact_history.growth_metric_keys,
      trendMetricKeys: row.compact_history.trend_metric_keys,
    } : undefined,
    now,
  });
}

