import { bigint, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const youtubeKworbDailySnapshots = pgTable("youtube_kworb_daily_snapshots", {
  id:             serial("id").primaryKey(),
  artistKey:      text("artist_key").notNull(),
  snapshotDate:   text("snapshot_date").notNull(),
  sourceType:     text("source_type").notNull().default("kworb_youtube_artist"),
  totalViews:     bigint("total_views", { mode: "number" }),
  dailyViews:     bigint("daily_views", { mode: "number" }),
  videoCount:     integer("video_count"),
  fetchedAt:      timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("youtube_kworb_daily_snapshots_artist_date_unique").on(table.artistKey, table.snapshotDate),
  index("youtube_kworb_daily_snapshots_artist_date_idx").on(table.artistKey, table.snapshotDate),
]);

export type YoutubeKworbDailySnapshot = typeof youtubeKworbDailySnapshots.$inferSelect;
