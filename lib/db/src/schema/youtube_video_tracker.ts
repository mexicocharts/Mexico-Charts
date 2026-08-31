import { sql } from "drizzle-orm";
import { bigint, boolean, foreignKey, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const youtubeTrackedVideos = pgTable("youtube_tracked_videos", {
  videoId: text("video_id").primaryKey(),
  channelId: text("channel_id"),
  title: text("title").notNull().default(""),
  thumbnailUrl: text("thumbnail_url"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  duration: text("duration"),
  viewCount: bigint("view_count", { mode: "number" }),
  likeCount: bigint("like_count", { mode: "number" }),
  commentCount: bigint("comment_count", { mode: "number" }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  lastSnapshotAt: timestamp("last_snapshot_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("youtube_tracked_videos_channel_idx").on(table.channelId),
  index("youtube_tracked_videos_updated_idx").on(table.updatedAt),
]);

export const youtubeArtistVideoLinks = pgTable("youtube_artist_video_links", {
  id: serial("id").primaryKey(),
  artistKey: text("artist_key").notNull(),
  artistName: text("artist_name").notNull().default(""),
  videoId: text("video_id").notNull(),
  sourceType: text("source_type").notNull().default("youtube_uploads"),
  confidenceScore: integer("confidence_score").notNull().default(80),
  priority: integer("priority").notNull().default(50),
  active: boolean("active").notNull().default(true),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("youtube_artist_video_links_artist_video_unique").on(table.artistKey, table.videoId),
  index("youtube_artist_video_links_artist_idx").on(table.artistKey),
  index("youtube_artist_video_links_video_idx").on(table.videoId),
  index("youtube_artist_video_links_active_priority_idx").on(table.active, table.priority),
  index("youtube_artist_video_links_coverage_identity_idx")
    .on(sql`regexp_replace(translate(lower(${table.artistKey}), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]', '', 'g')`)
    .where(sql`${table.active} = true AND ${table.confidenceScore} >= 80`),
  foreignKey({
    name: "youtube_artist_video_links_video_id_fkey",
    columns: [table.videoId],
    foreignColumns: [youtubeTrackedVideos.videoId],
  }).onDelete("cascade"),
]);

export const youtubeVideoDailySnapshots = pgTable("youtube_video_daily_snapshots", {
  id: serial("id").primaryKey(),
  videoId: text("video_id").notNull(),
  snapshotDate: text("snapshot_date").notNull(),
  viewCount: bigint("view_count", { mode: "number" }),
  likeCount: bigint("like_count", { mode: "number" }),
  commentCount: bigint("comment_count", { mode: "number" }),
  dailyViewDelta: bigint("daily_view_delta", { mode: "number" }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("youtube_video_daily_snapshots_video_date_unique").on(table.videoId, table.snapshotDate),
  index("youtube_video_daily_snapshots_date_idx").on(table.snapshotDate),
  index("youtube_video_daily_snapshots_video_date_idx").on(table.videoId, table.snapshotDate),
  foreignKey({
    name: "youtube_video_daily_snapshots_video_id_fkey",
    columns: [table.videoId],
    foreignColumns: [youtubeTrackedVideos.videoId],
  }).onDelete("cascade"),
]);

export const youtubeArtistVideoDailyRollups = pgTable("youtube_artist_video_daily_rollups", {
  id: serial("id").primaryKey(),
  artistKey: text("artist_key").notNull(),
  snapshotDate: text("snapshot_date").notNull(),
  trackedVideoCount: integer("tracked_video_count").notNull().default(0),
  videosWithSnapshotCount: integer("videos_with_snapshot_count").notNull().default(0),
  videosWithDeltaCount: integer("videos_with_delta_count").notNull().default(0),
  frozenVideoCount: integer("frozen_video_count").notNull().default(0),
  totalTrackedViews: bigint("total_tracked_views", { mode: "number" }).notNull().default(0),
  dailyViewDelta: bigint("daily_view_delta", { mode: "number" }).notNull().default(0),
  coverageScore: integer("coverage_score").notNull().default(0),
  sourceType: text("source_type").notNull().default("youtube_video_tracker"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("youtube_artist_video_daily_rollups_artist_date_unique").on(table.artistKey, table.snapshotDate),
  index("youtube_artist_video_daily_rollups_date_idx").on(table.snapshotDate),
  index("youtube_artist_video_daily_rollups_artist_date_idx").on(table.artistKey, table.snapshotDate),
]);

export type YoutubeTrackedVideo = typeof youtubeTrackedVideos.$inferSelect;
export type YoutubeArtistVideoLink = typeof youtubeArtistVideoLinks.$inferSelect;
export type YoutubeVideoDailySnapshot = typeof youtubeVideoDailySnapshots.$inferSelect;
export type YoutubeArtistVideoDailyRollup = typeof youtubeArtistVideoDailyRollups.$inferSelect;
