import {
  bigint,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const songstatsArtists = pgTable("songstats_artists", {
  artistKey:          text("artist_key").primaryKey(),
  spotifyArtistId:    text("spotify_artist_id").notNull(),
  songstatsArtistId:  text("songstats_artist_id"),
  songstatsName:      text("songstats_name"),
  avatarUrl:          text("avatar_url"),
  siteUrl:            text("site_url"),
  sourceIds:          jsonb("source_ids").$type<string[]>().notNull().default([]),
  lastSyncedAt:       timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
  linkedAt:           timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const songstatsArtistDailySnapshots = pgTable("songstats_artist_daily_snapshots", {
  id:                       serial("id").primaryKey(),
  artistKey:                text("artist_key").notNull(),
  spotifyArtistId:          text("spotify_artist_id").notNull(),
  songstatsArtistId:        text("songstats_artist_id"),
  snapshotDate:             text("snapshot_date").notNull(),
  spotifyFollowers:         bigint("spotify_followers", { mode: "number" }),
  spotifyMonthlyListeners:  bigint("spotify_monthly_listeners", { mode: "number" }),
  spotifyPopularity:        integer("spotify_popularity"),
  youtubeSubscribers:       bigint("youtube_subscribers", { mode: "number" }),
  youtubeChannelViews:      bigint("youtube_channel_views", { mode: "number" }),
  instagramFollowers:       bigint("instagram_followers", { mode: "number" }),
  tiktokFollowers:          bigint("tiktok_followers", { mode: "number" }),
  facebookFollowers:        bigint("facebook_followers", { mode: "number" }),
  twitterFollowers:         bigint("twitter_followers", { mode: "number" }),
  soundcloudFollowers:      bigint("soundcloud_followers", { mode: "number" }),
  deezerFollowers:          bigint("deezer_followers", { mode: "number" }),
  stats:                    jsonb("stats").$type<Record<string, unknown>>().notNull(),
  fetchedAt:                timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt:                timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:                timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("songstats_artist_daily_snapshots_artist_date_unique")
    .on(table.artistKey, table.snapshotDate),
  index("songstats_artist_daily_snapshots_spotify_date_idx")
    .on(table.spotifyArtistId, table.snapshotDate),
  index("songstats_artist_daily_snapshots_songstats_date_idx")
    .on(table.songstatsArtistId, table.snapshotDate),
]);

export const songstatsArtistExtendedData = pgTable("songstats_artist_extended_data", {
  artistKey:                 text("artist_key").primaryKey(),
  spotifyArtistId:           text("spotify_artist_id").notNull(),
  songstatsArtistId:         text("songstats_artist_id"),
  artistInfo:                jsonb("artist_info").$type<Record<string, unknown>>(),
  historyStartDate:          text("history_start_date"),
  historyEndDate:            text("history_end_date"),
  historicStats:             jsonb("historic_stats").$type<Record<string, unknown>>(),
  audience:                  jsonb("audience").$type<Record<string, unknown>>(),
  audienceDetails:           jsonb("audience_details").$type<Record<string, unknown>>(),
  catalog:                   jsonb("catalog").$type<Record<string, unknown>>(),
  syncErrors:                jsonb("sync_errors").$type<Record<string, string>>().notNull().default({}),
  historicFetchedAt:         timestamp("historic_fetched_at", { withTimezone: true }),
  audienceFetchedAt:         timestamp("audience_fetched_at", { withTimezone: true }),
  audienceDetailsFetchedAt:  timestamp("audience_details_fetched_at", { withTimezone: true }),
  catalogFetchedAt:          timestamp("catalog_fetched_at", { withTimezone: true }),
  infoFetchedAt:             timestamp("info_fetched_at", { withTimezone: true }),
  createdAt:                 timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:                 timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("songstats_artist_extended_data_spotify_idx")
    .on(table.spotifyArtistId),
  index("songstats_artist_extended_data_songstats_idx")
    .on(table.songstatsArtistId),
]);

// The autoscale scheduler creates and updates this coordination row at runtime.
// Declaring it here prevents deployment schema reconciliation from treating the
// live scheduler table as orphaned data and proposing a destructive DROP TABLE.
export const songstatsSnapshotSchedulerRuns = pgTable("songstats_snapshot_scheduler_runs", {
  snapshotDate:  text("snapshot_date").primaryKey(),
  attemptCount:  integer("attempt_count").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SongstatsArtist = typeof songstatsArtists.$inferSelect;
export type SongstatsArtistDailySnapshot = typeof songstatsArtistDailySnapshots.$inferSelect;
export type SongstatsArtistExtendedData = typeof songstatsArtistExtendedData.$inferSelect;
export type SongstatsSnapshotSchedulerRun = typeof songstatsSnapshotSchedulerRuns.$inferSelect;
