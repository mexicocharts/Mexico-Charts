import { integer, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const musicbrainzArtists = pgTable("musicbrainz_artists", {
  artistKey:       text("artist_key").primaryKey(),
  mbid:            text("mbid").notNull().unique(),
  name:            text("name"),
  sortName:        text("sort_name"),
  disambiguation:  text("disambiguation"),
  type:            text("type"),
  country:         text("country"),
  areaName:        text("area_name"),
  beginDate:       text("begin_date"),
  endDate:         text("end_date"),
  aliases:         jsonb("aliases").$type<string[]>().notNull().default([]),
  tags:            jsonb("tags").$type<string[]>().notNull().default([]),
  relations:       jsonb("relations").$type<Array<{ type: string; url: string }>>().notNull().default([]),
  verified:        text("verified").notNull().default("auto"),
  lastUpdated:     timestamp("last_updated", { withTimezone: true }).notNull().defaultNow(),
  linkedAt:        timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const musicbrainzArtistCandidates = pgTable("musicbrainz_artist_candidates", {
  artistKey:  text("artist_key").primaryKey(),
  artistName: text("artist_name").notNull(),
  candidates: jsonb("candidates").$type<Array<{
    mbid: string;
    name: string;
    score: number;
    type: string | null;
    country: string | null;
    areaName: string | null;
    disambiguation: string | null;
    reasons: string[];
  }>>().notNull().default([]),
  bestScore:  integer("best_score").notNull().default(0),
  status:     text("status").notNull().default("review"),
  searchedAt: timestamp("searched_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MusicbrainzArtist = typeof musicbrainzArtists.$inferSelect;
export type MusicbrainzArtistCandidate = typeof musicbrainzArtistCandidates.$inferSelect;
