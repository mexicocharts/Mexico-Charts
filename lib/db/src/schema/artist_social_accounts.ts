import { index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const artistSocialAccountCandidates = pgTable("artist_social_account_candidates", {
  id: serial("id").primaryKey(),
  artistKey: text("artist_key").notNull(),
  platform: text("platform").notNull(),
  canonicalUrl: text("canonical_url").notNull(),
  evidenceSources: jsonb("evidence_sources").$type<string[]>().notNull().default([]),
  confidence: integer("confidence").notNull(),
  status: text("status").notNull().default("review"),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("artist_social_candidates_artist_platform_url_unique").on(table.artistKey, table.platform, table.canonicalUrl),
  index("artist_social_candidates_status_idx").on(table.status),
  index("artist_social_candidates_artist_idx").on(table.artistKey),
]);

// Declared so schema reconciliation preserves the scheduler's idempotency log.
export const artistSocialDiscoveryRuns = pgTable("artist_social_discovery_runs", {
  runDate: text("run_date").primaryKey(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  summary: jsonb("summary").$type<Record<string, unknown>>().notNull().default({}),
});

export type ArtistSocialAccountCandidate = typeof artistSocialAccountCandidates.$inferSelect;
