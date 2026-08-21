import { sql } from "drizzle-orm";
import {
  boolean,
  bigint,
  bigserial,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { ticketmasterTouringShadowEventSnapshots, ticketmasterTouringShadowRuns } from "./ticketmaster_touring_shadow";

export const ticketmasterTouringEstimationSources = pgTable("ticketmaster_touring_estimation_sources", {
  sourceKey: text("source_key").primaryKey(),
  sourceType: text("source_type").notNull(),
  title: text("title").notNull(),
  purchasedDate: text("purchased_date").notNull(),
  headlineReportCount: integer("headline_report_count").notNull(),
  overallShowCount: integer("overall_show_count").notNull(),
  rawRowsStored: boolean("raw_rows_stored").notNull().default(false),
  notes: text("notes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  check("ticketmaster_estimation_sources_raw_rows_check", sql`${table.rawRowsStored} = false`),
]);

export const ticketmasterTouringEstimationCitations = pgTable("ticketmaster_touring_estimation_citations", {
  citationKey: text("citation_key").primaryKey(),
  title: text("title").notNull(),
  publisher: text("publisher").notNull(),
  url: text("url"),
  evidence: text("evidence").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ticketmasterTouringEstimationVenueRegistry = pgTable("ticketmaster_touring_estimation_venue_registry", {
  venueKey: text("venue_key").primaryKey(),
  venueName: text("venue_name").notNull(),
  normalizedVenue: text("normalized_venue").notNull(),
  venueType: text("venue_type").notNull(),
  capacityLow: integer("capacity_low").notNull(),
  capacityCentral: integer("capacity_central").notNull(),
  capacityHigh: integer("capacity_high").notNull(),
  citationKeys: jsonb("citation_keys").$type<string[]>().notNull().default([]),
  notes: text("notes").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("ticketmaster_estimation_venue_normalized_unique").on(table.normalizedVenue),
]);

export const ticketmasterTouringEstimationCalibrationPriors = pgTable("ticketmaster_touring_estimation_calibration_priors", {
  priorKey: text("prior_key").primaryKey(),
  artistKey: text("artist_key").notNull(),
  geography: text("geography").notNull(),
  venueType: text("venue_type").notNull(),
  reportCount: integer("report_count"),
  showCount: integer("show_count").notNull(),
  ticketsTotal: integer("tickets_total").notNull(),
  grossUsdTotal: numeric("gross_usd_total").notNull(),
  weightedAtpUsd: numeric("weighted_atp_usd"),
  medianAttendance: numeric("median_attendance"),
  attendanceIqrLow: numeric("attendance_iqr_low"),
  attendanceIqrHigh: numeric("attendance_iqr_high"),
  medianAtpUsd: numeric("median_atp_usd"),
  atpIqrLow: numeric("atp_iqr_low"),
  atpIqrHigh: numeric("atp_iqr_high"),
  citationKeys: jsonb("citation_keys").$type<string[]>().notNull().default([]),
  notes: text("notes").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index("ticketmaster_estimation_priors_artist_idx").on(table.artistKey, table.geography, table.venueType),
]);

export const ticketmasterTouringEstimationVenueComparables = pgTable("ticketmaster_touring_estimation_venue_comparables", {
  comparableKey: text("comparable_key").primaryKey(),
  artistKey: text("artist_key").notNull(),
  venueKey: text("venue_key").notNull(),
  normalizedVenue: text("normalized_venue").notNull(),
  capacityAnchor: integer("capacity_anchor").notNull(),
  historicalAtpUsd: numeric("historical_atp_usd").notNull(),
  sampleShowCount: integer("sample_show_count").notNull().default(1),
  citationKeys: jsonb("citation_keys").$type<string[]>().notNull().default([]),
  notes: text("notes").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("ticketmaster_estimation_comparable_artist_venue_unique").on(
    table.artistKey,
    table.normalizedVenue,
  ),
  check("ticketmaster_estimation_comparable_range_check", sql`
    ${table.capacityAnchor} >= 0 AND ${table.historicalAtpUsd} >= 0
    AND ${table.sampleShowCount} > 0
  `),
]);

export const ticketmasterTouringEstimationRuns = pgTable("ticketmaster_touring_estimation_runs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  modelVersion: text("model_version").notNull(),
  triggerReason: text("trigger_reason").notNull(),
  status: text("status").notNull(),
  shadowRunId: bigint("shadow_run_id", { mode: "number" })
    .notNull()
    .references(() => ticketmasterTouringShadowRuns.id, { onDelete: "restrict" }),
  sourceSnapshotCount: integer("source_snapshot_count").notNull().default(0),
  estimatedEventCount: integer("estimated_event_count").notNull().default(0),
  reportWarning: text("report_warning").notNull(),
  methodologyVersion: text("methodology_version").notNull(),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  index("ticketmaster_estimation_runs_calculated_idx").on(table.calculatedAt.desc().nullsFirst()),
]);

export const ticketmasterTouringEstimationEventEstimates = pgTable("ticketmaster_touring_estimation_event_estimates", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  estimationRunId: bigint("estimation_run_id", { mode: "number" })
    .notNull()
    .references(() => ticketmasterTouringEstimationRuns.id, { onDelete: "restrict" }),
  snapshotId: bigint("snapshot_id", { mode: "number" })
    .notNull()
    .references(() => ticketmasterTouringShadowEventSnapshots.id, { onDelete: "restrict" }),
  artistKey: text("artist_key").notNull(),
  artistName: text("artist_name").notNull(),
  eventDate: text("event_date").notNull(),
  normalizedVenue: text("normalized_venue").notNull(),
  venueName: text("venue_name").notNull(),
  venueCity: text("venue_city"),
  venueType: text("venue_type").notNull(),
  sourceEventIds: jsonb("source_event_ids").$type<string[]>().notNull().default([]),
  sourceSnapshotIds: jsonb("source_snapshot_ids").$type<number[]>().notNull().default([]),
  sourceRunIds: jsonb("source_run_ids").$type<number[]>().notNull().default([]),
  residencyGroup: text("residency_group"),
  sellableCapacityLow: integer("sellable_capacity_low").notNull(),
  sellableCapacityCentral: integer("sellable_capacity_central").notNull(),
  sellableCapacityHigh: integer("sellable_capacity_high").notNull(),
  ticketsMovedLow: integer("tickets_moved_low").notNull(),
  ticketsMovedCentral: integer("tickets_moved_central").notNull(),
  ticketsMovedHigh: integer("tickets_moved_high").notNull(),
  currentSellThroughLow: numeric("current_sell_through_low").notNull(),
  currentSellThroughCentral: numeric("current_sell_through_central").notNull(),
  currentSellThroughHigh: numeric("current_sell_through_high").notNull(),
  finalAttendanceLow: integer("final_attendance_low").notNull(),
  finalAttendanceCentral: integer("final_attendance_central").notNull(),
  finalAttendanceHigh: integer("final_attendance_high").notNull(),
  averagePaidPriceUsdLow: numeric("average_paid_price_usd_low").notNull(),
  averagePaidPriceUsdCentral: numeric("average_paid_price_usd_central").notNull(),
  averagePaidPriceUsdHigh: numeric("average_paid_price_usd_high").notNull(),
  finalGrossUsdLow: numeric("final_gross_usd_low").notNull(),
  finalGrossUsdCentral: numeric("final_gross_usd_central").notNull(),
  finalGrossUsdHigh: numeric("final_gross_usd_high").notNull(),
  confidenceScore: numeric("confidence_score").notNull(),
  confidenceLabel: text("confidence_label").notNull(),
  modelVersion: text("model_version").notNull(),
  calculatedAt: timestamp("calculated_at", { withTimezone: true }).notNull().defaultNow(),
  dataFreshness: text("data_freshness").notNull(),
  assumptions: jsonb("assumptions").$type<string[]>().notNull().default([]),
  warnings: jsonb("warnings").$type<string[]>().notNull().default([]),
  sourceCitations: jsonb("source_citations").$type<string[]>().notNull().default([]),
  provenance: jsonb("provenance").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  uniqueIndex("ticketmaster_estimation_run_event_unique").on(
    table.estimationRunId,
    table.artistKey,
    table.eventDate,
    table.normalizedVenue,
  ),
  index("ticketmaster_estimation_events_artist_date_idx").on(table.artistKey, table.eventDate),
  check(
    "ticketmaster_estimation_event_range_check",
    checkRanges(
      table.sellableCapacityLow,
      table.sellableCapacityCentral,
      table.sellableCapacityHigh,
      table.ticketsMovedLow,
      table.ticketsMovedCentral,
      table.ticketsMovedHigh,
      table.finalAttendanceLow,
      table.finalAttendanceCentral,
      table.finalAttendanceHigh,
    ),
  ),
]);

function checkRanges(
  capacityLow: unknown,
  capacityCentral: unknown,
  capacityHigh: unknown,
  movedLow: unknown,
  movedCentral: unknown,
  movedHigh: unknown,
  attendanceLow: unknown,
  attendanceCentral: unknown,
  attendanceHigh: unknown,
) {
  return sql`
    ${capacityLow} >= 0 AND ${capacityLow} <= ${capacityCentral} AND ${capacityCentral} <= ${capacityHigh}
    AND ${movedLow} >= 0 AND ${movedLow} <= ${movedCentral} AND ${movedCentral} <= ${movedHigh}
    AND ${attendanceLow} >= 0 AND ${attendanceLow} <= ${attendanceCentral} AND ${attendanceCentral} <= ${attendanceHigh}
  `;
}

export type TicketmasterTouringEstimationRun = typeof ticketmasterTouringEstimationRuns.$inferSelect;
export type TicketmasterTouringEstimationEventEstimate =
  typeof ticketmasterTouringEstimationEventEstimates.$inferSelect;