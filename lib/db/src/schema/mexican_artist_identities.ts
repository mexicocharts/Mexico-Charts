import { date, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const mexicanArtistIdentityCandidates = pgTable("mexican_artist_identity_candidates", {
  id: serial("id").primaryKey(),
  artistName: text("artist_name").notNull(),
  normalizedName: text("normalized_name").notNull(),
  aliases: jsonb("aliases").$type<string[]>().notNull().default([]),
  evidence: jsonb("evidence").$type<Record<string, unknown>>().notNull().default({}),
  confidence: integer("confidence").notNull(),
  status: text("status").notNull().default("review"),
  discoveryDate: date("discovery_date").notNull().defaultNow(),
  verificationDate: date("verification_date"),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("mexican_identity_normalized_name_unique").on(table.normalizedName),
  index("mexican_identity_status_idx").on(table.status),
]);

export const mexicanIdentityDiscoveryRuns = pgTable("mexican_identity_discovery_runs", {
  runDate: text("run_date").primaryKey(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  summary: jsonb("summary").$type<Record<string, unknown>>().notNull().default({}),
});

export type MexicanArtistIdentityCandidate = typeof mexicanArtistIdentityCandidates.$inferSelect;
