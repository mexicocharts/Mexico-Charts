import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";

export const deezerTrackCovers = pgTable("deezer_track_covers", {
  artistKey:  text("artist_key").notNull(),
  songKey:    text("song_key").notNull(),
  artistName: text("artist_name").notNull(),
  songTitle:  text("song_title").notNull(),
  coverUrl:   text("cover_url").notNull(),
  deezerUrl:  text("deezer_url"),
  fetchedAt:  timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:  timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  primaryKey({ columns: [t.artistKey, t.songKey] }),
]);

export type DeezerTrackCover = typeof deezerTrackCovers.$inferSelect;
