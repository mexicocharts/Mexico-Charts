import { bigint, index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const dailySnapshotRunLogs = pgTable("daily_snapshot_run_logs", {
  id: serial("id").primaryKey(),
  provider: text("provider").notNull(),
  snapshotDate: text("snapshot_date").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("running"),
  expectedCount: integer("expected_count").notNull().default(0),
  fetchedCount: integer("fetched_count").notNull().default(0),
  savedCount: integer("saved_count").notNull().default(0),
  missingCount: integer("missing_count").notNull().default(0),
  dateRows: integer("date_rows").notNull().default(0),
  totalDailyValue: bigint("total_daily_value", { mode: "number" }).notNull().default(0),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("daily_snapshot_run_logs_provider_date_idx").on(table.provider, table.snapshotDate),
  index("daily_snapshot_run_logs_started_at_idx").on(table.startedAt),
]);

export type DailySnapshotRunLog = typeof dailySnapshotRunLogs.$inferSelect;
