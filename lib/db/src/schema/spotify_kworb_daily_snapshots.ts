import { bigint, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const spotifyKworbDailySnapshots = pgTable("spotify_kworb_daily_snapshots", {
  id:                 serial("id").primaryKey(),
  artistKey:          text("artist_key").notNull(),
  spotifyArtistId:    text("spotify_artist_id"),
  snapshotDate:       text("snapshot_date").notNull(),
  sourceType:         text("source_type").notNull().default("kworb_spotify_artist"),
  totalStreams:       bigint("total_streams", { mode: "number" }),
  dailyStreams:       bigint("daily_streams", { mode: "number" }),
  trackCount:         integer("track_count"),
  fetchedAt:          timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("spotify_kworb_daily_snapshots_artist_date_unique").on(table.artistKey, table.snapshotDate),
  index("spotify_kworb_daily_snapshots_spotify_date_idx").on(table.spotifyArtistId, table.snapshotDate),
  index("spotify_kworb_daily_snapshots_artist_date_idx").on(table.artistKey, table.snapshotDate),
]);

export type SpotifyKworbDailySnapshot = typeof spotifyKworbDailySnapshots.$inferSelect;
