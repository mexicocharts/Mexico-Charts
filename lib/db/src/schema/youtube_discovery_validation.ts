import { sql } from "drizzle-orm";
import {
  bigserial,
  bigint,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

/**
 * Formal schema declarations for the protected YouTube validation tables.
 *
 * The validation worker still creates these defensively at runtime, but they
 * must also be declared here so Replit's deployment reconciliation never
 * interprets the protected tables as removable database drift.
 */
export const youtubeDiscoveryValidationSessions = pgTable("youtube_discovery_validation_sessions", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("running"),
  historicalGate: jsonb("historical_gate").notNull(),
  configuration: jsonb("configuration").notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, table => [
  check("youtube_discovery_validation_sessions_status_check", sql`${table.status} IN ('running','complete','stopped')`),
]);

export const youtubeDiscoveryValidationChannels = pgTable("youtube_discovery_validation_channels", {
  sessionId: bigint("session_id", { mode: "number" }).notNull().references(
    () => youtubeDiscoveryValidationSessions.id,
    { onDelete: "restrict" },
  ),
  artistKey: text("artist_key").notNull(),
  artistName: text("artist_name").notNull(),
  channelId: text("channel_id").notNull(),
  channelTitle: text("channel_title"),
  uploadsPlaylistId: text("uploads_playlist_id"),
  relationshipSource: text("relationship_source").notNull(),
  frozenAt: timestamp("frozen_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.sessionId, table.artistKey, table.channelId] }),
]);

export const youtubeDiscoveryValidationEvents = pgTable("youtube_discovery_validation_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  sessionId: bigint("session_id", { mode: "number" }).notNull().references(
    () => youtubeDiscoveryValidationSessions.id,
    { onDelete: "restrict" },
  ),
  source: text("source").notNull(),
  artistKey: text("artist_key").notNull(),
  videoId: text("video_id").notNull(),
  title: text("title"),
  uploaderChannelId: text("uploader_channel_id"),
  uploaderChannelTitle: text("uploader_channel_title"),
  uploaderType: text("uploader_type"),
  associationStatus: text("association_status").notNull(),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  evidence: jsonb("evidence").notNull().default({}),
}, table => [
  unique().on(table.sessionId, table.source, table.artistKey, table.videoId),
  index("youtube_discovery_validation_events_video_idx").on(table.sessionId, table.videoId, table.firstSeenAt),
  check("youtube_discovery_validation_events_source_check", sql`${table.source} IN ('authorized_playlist','authorized_search','licensed_signal','innertube_comparator')`),
  check("youtube_discovery_validation_events_association_status_check", sql`${table.associationStatus} IN ('accepted','protected_review','rejected','comparator')`),
]);

export const youtubeDiscoveryValidationApiUsage = pgTable("youtube_discovery_validation_api_usage", {
  sessionId: bigint("session_id", { mode: "number" }).notNull().references(
    () => youtubeDiscoveryValidationSessions.id,
    { onDelete: "restrict" },
  ),
  usageDate: date("usage_date").notNull(),
  searchLogicalCalls: integer("search_logical_calls").notNull().default(0),
  searchRequestAttempts: integer("search_request_attempts").notNull().default(0),
  channelCalls: integer("channel_calls").notNull().default(0),
  playlistCalls: integer("playlist_calls").notNull().default(0),
  videoCalls: integer("video_calls").notNull().default(0),
  retries: integer("retries").notNull().default(0),
  errors: integer("errors").notNull().default(0),
  lastError: text("last_error"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [
  primaryKey({ columns: [table.sessionId, table.usageDate] }),
]);

export const youtubeDiscoveryValidationDailySnapshots = pgTable("youtube_discovery_validation_daily_snapshots", {
  sessionId: bigint("session_id", { mode: "number" }).notNull().references(
    () => youtubeDiscoveryValidationSessions.id,
    { onDelete: "restrict" },
  ),
  validationDay: date("validation_day").notNull(),
  snapshotAt: timestamp("snapshot_at", { withTimezone: true }).notNull().defaultNow(),
  metrics: jsonb("metrics").notNull(),
}, table => [
  primaryKey({ columns: [table.sessionId, table.validationDay] }),
]);

export const youtubeDiscoveryValidationComparatorArtists = pgTable("youtube_discovery_validation_comparator_artists", {
  sessionId: bigint("session_id", { mode: "number" }).notNull().references(
    () => youtubeDiscoveryValidationSessions.id,
    { onDelete: "restrict" },
  ),
  validationArtistKey: text("validation_artist_key").notNull(),
  discoveryArtistKey: text("discovery_artist_key").notNull(),
  artistName: text("artist_name").notNull(),
  baselineReadyAt: timestamp("baseline_ready_at", { withTimezone: true }),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  attempts: integer("attempts").notNull().default(0),
  successes: integer("successes").notNull().default(0),
  candidateCount: integer("candidate_count").notNull().default(0),
  lastError: text("last_error"),
}, table => [
  primaryKey({ columns: [table.sessionId, table.validationArtistKey] }),
]);

export const youtubeDiscoveryValidationComparatorSightings = pgTable("youtube_discovery_validation_comparator_sightings", {
  sessionId: bigint("session_id", { mode: "number" }).notNull().references(
    () => youtubeDiscoveryValidationSessions.id,
    { onDelete: "restrict" },
  ),
  validationArtistKey: text("validation_artist_key").notNull(),
  discoveryArtistKey: text("discovery_artist_key").notNull(),
  videoId: text("video_id").notNull(),
  title: text("title"),
  firstSeenAt: timestamp("first_seen_at", { withTimezone: true }).notNull().defaultNow(),
  catalogDiscoveredAt: timestamp("catalog_discovered_at", { withTimezone: true }).notNull(),
  evidence: jsonb("evidence").notNull().default({}),
}, table => [
  primaryKey({ columns: [table.sessionId, table.validationArtistKey, table.videoId] }),
]);
