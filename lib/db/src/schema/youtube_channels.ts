import { pgTable, text, bigint, integer, timestamp } from "drizzle-orm/pg-core";

export const youtubeChannels = pgTable("youtube_channels", {
  artistKey:       text("artist_key").primaryKey(),
  channelId:       text("channel_id").notNull().unique(),
  title:           text("title"),
  thumbnailUrl:    text("thumbnail_url"),
  subscriberCount: bigint("subscriber_count", { mode: "number" }),
  viewCount:       bigint("view_count",        { mode: "number" }),
  videoCount:      integer("video_count"),
  customUrl:       text("custom_url"),
  publishedAt:     timestamp("published_at",  { withTimezone: true }),
  cachedAt:        timestamp("cached_at",     { withTimezone: true }).notNull().defaultNow(),
  linkedAt:        timestamp("linked_at",     { withTimezone: true }).notNull().defaultNow(),
});

export type YoutubeChannel = typeof youtubeChannels.$inferSelect;
