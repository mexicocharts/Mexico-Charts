import { pgTable, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";

export const youtubeChannelCandidates = pgTable("youtube_channel_candidates", {
  artistKey:       text("artist_key").primaryKey(),
  artistName:      text("artist_name").notNull(),
  status:          text("status").notNull(),
  bestChannelId:   text("best_channel_id"),
  bestTitle:       text("best_title"),
  bestScore:       integer("best_score"),
  subscriberCount: text("subscriber_count"),
  reasons:         jsonb("reasons").$type<string[]>(),
  error:           text("error"),
  reviewedAt:      timestamp("reviewed_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:       timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type YoutubeChannelCandidate = typeof youtubeChannelCandidates.$inferSelect;
