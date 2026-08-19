import { sql } from "drizzle-orm";
import { check, date, index, integer, jsonb, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

export const mexicanArtistIdentityCandidates = pgTable("mexican_artist_identity_candidates", {
  id: serial("id").primaryKey(),
  artistName: text("artist_name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
  evidence: jsonb("evidence").$type<Record<string, unknown> | unknown[]>().notNull().default([]),
  confidence: integer("confidence").notNull(),
  status: text("status").notNull().default("review"),
  discoveryDate: date("discovery_date").notNull().default(sql`CURRENT_DATE`),
  verificationDate: date("verification_date"),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  unique("mexican_artist_identity_candidates_normalized_name_key").on(table.normalizedName),
  check("mexican_artist_identity_candidates_status_check", sql`${table.status} IN ('verified', 'review', 'rejected')`),
  index("mexican_identity_status_idx").on(table.status),
]);

export const mexicanIdentityDiscoveryRuns = pgTable("mexican_identity_discovery_runs", {
  runDate: text("run_date").primaryKey(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  summary: jsonb("summary").$type<Record<string, unknown>>().notNull().default({}),
});

export type MexicanArtistIdentityCandidate = typeof mexicanArtistIdentityCandidates.$inferSelect;
