import { bigint, index, integer, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const youtubeChannelDailySnapshots = pgTable("youtube_channel_daily_snapshots", {
  id:             serial("id").primaryKey(),
  artistKey:      text("artist_key").notNull(),
  channelId:      text("channel_id").notNull(),
  snapshotDate:   text("snapshot_date").notNull(),
  sourceType:     text("source_type").notNull().default("official_artist_channel"),
  viewCount:      bigint("view_count", { mode: "number" }),
  subscriberCount: bigint("subscriber_count", { mode: "number" }),
  videoCount:     integer("video_count"),
  dailyViewDelta: bigint("daily_view_delta", { mode: "number" }),
  fetchedAt:      timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt:      timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("youtube_channel_daily_snapshots_artist_date_unique").on(table.artistKey, table.snapshotDate),
  index("youtube_channel_daily_snapshots_channel_date_idx").on(table.channelId, table.snapshotDate),
  index("youtube_channel_daily_snapshots_artist_date_idx").on(table.artistKey, table.snapshotDate),
]);

export type YoutubeChannelDailySnapshot = typeof youtubeChannelDailySnapshots.$inferSelect;
