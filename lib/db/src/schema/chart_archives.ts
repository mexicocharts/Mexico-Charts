import { index, integer, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const officialChartSnapshots = pgTable("official_chart_snapshots", {
  chartKey: text("chart_key").notNull(),
  chartDate: text("chart_date").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  rowCount: integer("row_count").notNull(),
  payload: jsonb("payload").notNull(),
}, (table) => [
  primaryKey({ columns: [table.chartKey, table.chartDate] }),
  index("official_chart_snapshots_date_idx").on(table.chartDate),
]);

export const proprietaryChartSnapshots = pgTable("proprietary_chart_snapshots", {
  chartKey: text("chart_key").notNull(),
  chartDate: text("chart_date").notNull(),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  methodologyVersion: text("methodology_version").notNull().default("source-sheet-v1"),
  rowCount: integer("row_count").notNull(),
  payload: jsonb("payload").notNull(),
}, (table) => [
  primaryKey({ columns: [table.chartKey, table.chartDate] }),
  index("proprietary_chart_snapshots_date_idx").on(table.chartDate),
]);

export type OfficialChartSnapshot = typeof officialChartSnapshots.$inferSelect;
export type ProprietaryChartSnapshot = typeof proprietaryChartSnapshots.$inferSelect;
