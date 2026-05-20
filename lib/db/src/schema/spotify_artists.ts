import { boolean, integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const spotifyArtists = pgTable("spotify_artists", {
  artistKey:          text("artist_key").primaryKey(),
  spotifyArtistId:    text("spotify_artist_id").notNull().unique(),
  spotifyName:        text("spotify_name"),
  spotifyFollowers:   integer("spotify_followers"),
  spotifyPopularity:  integer("spotify_popularity"),
  spotifyUrl:         text("spotify_url"),
  spotifyImageUrl:    text("spotify_image_url"),
  spotifyUri:         text("spotify_uri"),
  spotifyGenres:      jsonb("spotify_genres").$type<string[]>().notNull().default([]),
  spotifyApiCapability: text("spotify_api_capability").notNull().default("identity_profile"),
  notes:              text("notes"),
  verified:           boolean("verified").notNull().default(true),
  verifiedAt:         timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
  spotifyLastUpdated: timestamp("spotify_last_updated", { withTimezone: true }).notNull().defaultNow(),
  linkedAt:           timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const spotifyArtistCandidates = pgTable("spotify_artist_candidates", {
  artistKey:      text("artist_key").primaryKey(),
  artistName:     text("artist_name").notNull(),
  candidates:     jsonb("candidates").$type<Array<{
    spotifyArtistId: string;
    spotifyName: string;
    score: number;
    followers: number | null;
    popularity: number | null;
    spotifyUrl: string | null;
    imageUrl: string | null;
    genres: string[];
    reasons: string[];
  }>>().notNull().default([]),
  bestScore:      integer("best_score").notNull().default(0),
  status:         text("status").notNull().default("review"),
  searchedAt:     timestamp("searched_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SpotifyArtist = typeof spotifyArtists.$inferSelect;
export type SpotifyArtistCandidate = typeof spotifyArtistCandidates.$inferSelect;
