import { pgTable, text, bigint, timestamp } from "drizzle-orm/pg-core";

export const youtubeVideos = pgTable("youtube_videos", {
  videoId:      text("video_id").primaryKey(),
  songKey:      text("song_key"),
  channelId:    text("channel_id"),
  title:        text("title"),
  thumbnailUrl: text("thumbnail_url"),
  viewCount:    bigint("view_count",    { mode: "number" }),
  likeCount:    bigint("like_count",    { mode: "number" }),
  commentCount: bigint("comment_count", { mode: "number" }),
  duration:     text("duration"),
  publishedAt:  timestamp("published_at", { withTimezone: true }),
  cachedAt:     timestamp("cached_at",    { withTimezone: true }).notNull().defaultNow(),
  linkedAt:     timestamp("linked_at",    { withTimezone: true }).notNull().defaultNow(),
});

export type YoutubeVideo = typeof youtubeVideos.$inferSelect;
