import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * Tables that were originally created lazily by API routes or schedulers.
 *
 * They must also live in the formal Drizzle schema. Replit reconciles the
 * development database against this schema during deployment; omitting a live
 * table here makes Replit incorrectly propose dropping it from production.
 */
export const communityContributions = pgTable("community_contributions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  type: text("type").notNull(),
  artistKey: text("artist_key"),
  artistName: text("artist_name").notNull(),
  link: text("link"),
  secondaryLink: text("secondary_link"),
  mexicoConnection: text("mexico_connection"),
  context: text("context"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const artistDataQualityRuns = pgTable("artist_data_quality_runs", {
  runKey: text("run_key").primaryKey(),
  runDate: text("run_date").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  summary: jsonb("summary").$type<Record<string, unknown>>().notNull(),
});

export const songstatsMonthlyArtistUsage = pgTable("songstats_monthly_artist_usage", {
  billingMonth: text("billing_month").notNull(),
  artistIdentity: text("artist_identity").notNull(),
  identifierType: text("identifier_type").notNull(),
  identifierValue: text("identifier_value").notNull(),
  firstEndpoint: text("first_endpoint").notNull(),
  lastEndpoint: text("last_endpoint").notNull(),
  requestCount: bigint("request_count", { mode: "number" }).notNull().default(1),
  firstRequestedAt: timestamp("first_requested_at", { withTimezone: true }).notNull().defaultNow(),
  lastRequestedAt: timestamp("last_requested_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.billingMonth, table.artistIdentity] }),
]);

export const monitoringStreamItems = pgTable("monitoring_stream_items", {
  artistKey: text("artist_key").notNull(),
  itemType: text("item_type").notNull(),
  itemKey: text("item_key").notNull(),
  title: text("title").notNull(),
  spotifyUrl: text("spotify_url"),
  compilation: boolean("compilation").notNull().default(false),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.artistKey, table.itemType, table.itemKey] }),
  check("monitoring_stream_items_item_type_check", sql`${table.itemType} IN ('track', 'album')`),
]);

export const monitoringStreamDailySnapshots = pgTable("monitoring_stream_daily_snapshots", {
  artistKey: text("artist_key").notNull(),
  itemType: text("item_type").notNull(),
  itemKey: text("item_key").notNull(),
  snapshotDate: date("snapshot_date").notNull(),
  totalStreams: bigint("total_streams", { mode: "number" }).notNull(),
  dailyStreams: bigint("daily_streams", { mode: "number" }).notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.artistKey, table.itemType, table.itemKey, table.snapshotDate] }),
  check("monitoring_stream_daily_snapshots_item_type_check", sql`${table.itemType} IN ('track', 'album')`),
  index("monitoring_stream_daily_artist_date_idx").on(table.artistKey, table.snapshotDate.desc(), table.itemType),
  index("monitoring_stream_daily_item_date_idx").on(table.artistKey, table.itemType, table.itemKey, table.snapshotDate.desc()),
]);

export const monitoringStreamDailyArtistSummaries = pgTable("monitoring_stream_daily_artist_summaries", {
  artistKey: text("artist_key").notNull(),
  snapshotDate: date("snapshot_date").notNull(),
  trackCount: integer("track_count").notNull(),
  albumCount: integer("album_count").notNull(),
  trackDailyStreams: bigint("track_daily_streams", { mode: "number" }).notNull(),
  albumDailyStreams: bigint("album_daily_streams", { mode: "number" }).notNull(),
  trackTotalStreams: bigint("track_total_streams", { mode: "number" }).notNull(),
  albumTotalStreams: bigint("album_total_streams", { mode: "number" }).notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.artistKey, table.snapshotDate] }),
]);

export const monitoringStreamArchiveManifests = pgTable("monitoring_stream_archive_manifests", {
  snapshotDate: date("snapshot_date").notNull(),
  objectKey: text("object_key").notNull(),
  schemaVersion: integer("schema_version").notNull(),
  rowCount: integer("row_count").notNull(),
  artistCount: integer("artist_count").notNull(),
  parquetBytes: bigint("parquet_bytes", { mode: "number" }).notNull(),
  sha256: text("sha256").notNull(),
  storageProvider: text("storage_provider").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.snapshotDate, table.objectKey] }),
]);

export type CommunityContribution = typeof communityContributions.$inferSelect;
export type ArtistDataQualityRun = typeof artistDataQualityRuns.$inferSelect;
export type SongstatsMonthlyArtistUsage = typeof songstatsMonthlyArtistUsage.$inferSelect;
export type MonitoringStreamItem = typeof monitoringStreamItems.$inferSelect;
export type MonitoringStreamDailySnapshot = typeof monitoringStreamDailySnapshots.$inferSelect;
export type MonitoringStreamDailyArtistSummary = typeof monitoringStreamDailyArtistSummaries.$inferSelect;
export type MonitoringStreamArchiveManifest = typeof monitoringStreamArchiveManifests.$inferSelect;
