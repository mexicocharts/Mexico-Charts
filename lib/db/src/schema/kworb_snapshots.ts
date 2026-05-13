import { pgTable, text, timestamp, jsonb, primaryKey } from "drizzle-orm/pg-core";

export const kworbSnapshots = pgTable("kworb_snapshots", {
  artistKey:  text("artist_key").notNull(),
  metricType: text("metric_type").notNull(),
  value:      jsonb("value").$type<Record<string, unknown>>().notNull(),
  fetchedAt:  timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt:  timestamp("expires_at", { withTimezone: true }).notNull(),
}, (t) => [
  primaryKey({ columns: [t.artistKey, t.metricType] }),
]);

export type KworbSnapshot = typeof kworbSnapshots.$inferSelect;
