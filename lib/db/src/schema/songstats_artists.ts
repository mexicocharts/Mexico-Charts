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
  spotifyArtistId:    text("spotify_artist_id").notNull().unique(),
  songstatsArtistId:  text("songstats_artist_id").unique(),
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

export type SongstatsArtist = typeof songstatsArtists.$inferSelect;
export type SongstatsArtistDailySnapshot = typeof songstatsArtistDailySnapshots.$inferSelect;
