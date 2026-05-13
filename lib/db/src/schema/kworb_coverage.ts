import { pgTable, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";

export const kworbCoverage = pgTable("kworb_coverage", {
  artistKey:           text("artist_key").primaryKey(),
  artistName:          text("artist_name").notNull(),
  spotifyId:           text("spotify_id"),
  hasSpotify:          boolean("has_spotify").notNull().default(false),
  hasYoutube:          boolean("has_youtube").notNull().default(false),
  hasItunes:           boolean("has_itunes").notNull().default(false),
  tier:                text("tier").notNull().default("B"),
  status:              text("status").notNull().default("pending"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  lastDiscoveredAt:    timestamp("last_discovered_at", { withTimezone: true }),
  lastFetchAt:         timestamp("last_fetch_at", { withTimezone: true }),
  lastFailedAt:        timestamp("last_failed_at", { withTimezone: true }),
  createdAt:           timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type KworbCoverage = typeof kworbCoverage.$inferSelect;
