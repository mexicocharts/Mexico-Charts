import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const kworbJobs = pgTable("kworb_jobs", {
  id:          serial("id").primaryKey(),
  artistKey:   text("artist_key").notNull(),
  metricType:  text("metric_type").notNull(),
  priority:    integer("priority").notNull().default(50),
  dueAt:       timestamp("due_at", { withTimezone: true }).notNull().defaultNow(),
  attempts:    integer("attempts").notNull().default(0),
  status:      text("status").notNull().default("pending"),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt:   timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type KworbJob = typeof kworbJobs.$inferSelect;
