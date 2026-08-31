import {
  bigint,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const songstatsArtists = pgTable("songstats_artists", {
  artistKey:          text("artist_key").primaryKey(),
  spotifyArtistId:    text("spotify_artist_id").notNull(),
  songstatsArtistId:  text("songstats_artist_id"),
  songstatsName:      text("songstats_name"),
  avatarUrl:          text("avatar_url"),
  siteUrl:            text("site_url"),
  sourceIds:          jsonb("source_ids").$type<string[]>().notNull().default([]),
  lastSyncedAt:       timestamp("last_synced_at", { withTimezone: true }).notNull().defaultNow(),
  linkedAt:           timestamp("linked_at", { withTimezone: true }).notNull().defaultNow(),
});

export const songstatsArtistDailySnapshots = pgTable("songstats_artist_daily_snapshots", {
  id:                       serial("id").primaryKey(),
  artistKey:                text("artist_key").notNull(),
  spotifyArtistId:          text("spotify_artist_id").notNull(),
  songstatsArtistId:        text("songstats_artist_id"),
  snapshotDate:             text("snapshot_date").notNull(),
  spotifyFollowers:         bigint("spotify_followers", { mode: "number" }),
  spotifyMonthlyListeners:  bigint("spotify_monthly_listeners", { mode: "number" }),
  spotifyPopularity:        integer("spotify_popularity"),
  youtubeSubscribers:       bigint("youtube_subscribers", { mode: "number" }),
  youtubeChannelViews:      bigint("youtube_channel_views", { mode: "number" }),
  instagramFollowers:       bigint("instagram_followers", { mode: "number" }),
  tiktokFollowers:          bigint("tiktok_followers", { mode: "number" }),
  facebookFollowers:        bigint("facebook_followers", { mode: "number" }),
  twitterFollowers:         bigint("twitter_followers", { mode: "number" }),
  soundcloudFollowers:      bigint("soundcloud_followers", { mode: "number" }),
  deezerFollowers:          bigint("deezer_followers", { mode: "number" }),
  stats:                    jsonb("stats").$type<Record<string, unknown>>().notNull(),
  fetchedAt:                timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt:                timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:                timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("songstats_artist_daily_snapshots_artist_date_unique")
    .on(table.artistKey, table.snapshotDate),
  index("songstats_artist_daily_snapshots_spotify_date_idx")
    .on(table.spotifyArtistId, table.snapshotDate),
  index("songstats_artist_daily_snapshots_songstats_date_idx")
    .on(table.songstatsArtistId, table.snapshotDate),
]);

export const songstatsArtistExtendedData = pgTable("songstats_artist_extended_data", {
  artistKey:                 text("artist_key").primaryKey(),
  spotifyArtistId:           text("spotify_artist_id").notNull(),
  songstatsArtistId:         text("songstats_artist_id"),
  artistInfo:                jsonb("artist_info").$type<Record<string, unknown>>(),
  historyStartDate:          text("history_start_date"),
  historyEndDate:            text("history_end_date"),
  historicStats:             jsonb("historic_stats").$type<Record<string, unknown>>(),
  audience:                  jsonb("audience").$type<Record<string, unknown>>(),
  audienceDetails:           jsonb("audience_details").$type<Record<string, unknown>>(),
  catalog:                   jsonb("catalog").$type<Record<string, unknown>>(),
  syncErrors:                jsonb("sync_errors").$type<Record<string, string>>().notNull().default({}),
  historicFetchedAt:         timestamp("historic_fetched_at", { withTimezone: true }),
  audienceFetchedAt:         timestamp("audience_fetched_at", { withTimezone: true }),
  audienceDetailsFetchedAt:  timestamp("audience_details_fetched_at", { withTimezone: true }),
  catalogFetchedAt:          timestamp("catalog_fetched_at", { withTimezone: true }),
  infoFetchedAt:             timestamp("info_fetched_at", { withTimezone: true }),
  createdAt:                 timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:                 timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("songstats_artist_extended_data_spotify_idx")
    .on(table.spotifyArtistId),
  index("songstats_artist_extended_data_songstats_idx")
    .on(table.songstatsArtistId),
]);

// The autoscale scheduler creates and updates this coordination row at runtime.
// Declaring it here prevents deployment schema reconciliation from treating the
// live scheduler table as orphaned data and proposing a destructive DROP TABLE.
export const songstatsSnapshotSchedulerRuns = pgTable("songstats_snapshot_scheduler_runs", {
  snapshotDate:  text("snapshot_date").primaryKey(),
  attemptCount:  integer("attempt_count").notNull().default(0),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  updatedAt:     timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const songstatsHistoryImportRuns = pgTable("songstats_history_import_runs", {
  runId:                    text("run_id").primaryKey(),
  mode:                     text("mode").notNull(),
  status:                   text("status").notNull(),
  requestedStartDate:       date("requested_start_date").notNull(),
  requestedEndDate:         date("requested_end_date").notNull(),
  rosterSize:               integer("roster_size").notNull(),
  plannedRequestCount:      integer("planned_request_count").notNull(),
  completedRequestCount:    integer("completed_request_count").notNull().default(0),
  failedRequestCount:       integer("failed_request_count").notNull().default(0),
  observationCount:         integer("observation_count").notNull().default(0),
  options:                  jsonb("options").$type<Record<string, unknown>>().notNull().default({}),
  summary:                  jsonb("summary").$type<Record<string, unknown>>().notNull().default({}),
  startedAt:                timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt:              timestamp("completed_at", { withTimezone: true }),
  updatedAt:                timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("songstats_history_import_runs_status_started_idx")
    .on(table.status, table.startedAt),
]);

export const songstatsHistoryMetricDefinitions = pgTable("songstats_history_metric_definitions", {
  id:                 serial("id").primaryKey(),
  source:             text("source").notNull(),
  providerField:      text("provider_field").notNull(),
  metricKey:          text("metric_key").notNull(),
  label:              text("label").notNull(),
  unit:               text("unit").notNull(),
  behavior:           text("behavior").notNull(),
  commercialEndpoint: text("commercial_endpoint").notNull(),
  definitionVersion:  integer("definition_version").notNull(),
  ingestionStatus:    text("ingestion_status").notNull(),
  createdAt:          timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("songstats_history_metric_source_field_version_unique")
    .on(table.source, table.providerField, table.definitionVersion),
  uniqueIndex("songstats_history_metric_key_version_unique")
    .on(table.metricKey, table.definitionVersion),
]);

export const songstatsHistoryProviderIdentities = pgTable("songstats_history_provider_identities", {
  id:                       serial("id").primaryKey(),
  artistKey:                text("artist_key").notNull(),
  spotifyArtistId:          text("spotify_artist_id").notNull(),
  songstatsArtistId:        text("songstats_artist_id"),
  validationStatus:         text("validation_status").notNull(),
  identityEvidence:         jsonb("identity_evidence").$type<Record<string, unknown>>().notNull().default({}),
  validationRuleVersion:    integer("validation_rule_version").notNull().default(1),
  verifiedAt:               timestamp("verified_at", { withTimezone: true }),
  createdAt:                timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt:                timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("songstats_history_identity_artist_unique").on(table.artistKey),
  index("songstats_history_identity_songstats_idx").on(table.songstatsArtistId),
]);

export const songstatsHistoryImportChunks = pgTable("songstats_history_import_chunks", {
  id:                       serial("id").primaryKey(),
  runId:                    text("run_id").notNull().references(() => songstatsHistoryImportRuns.runId),
  artistKey:                text("artist_key").notNull(),
  providerIdentityId:       integer("provider_identity_id").notNull().references(() => songstatsHistoryProviderIdentities.id),
  requestIdentityType:      text("request_identity_type").notNull(),
  requestIdentityValue:     text("request_identity_value").notNull(),
  windowStartDate:          date("window_start_date").notNull(),
  windowEndDate:            date("window_end_date").notNull(),
  status:                   text("status").notNull(),
  attemptCount:             integer("attempt_count").notNull().default(0),
  responseHash:             text("response_hash"),
  parserVersion:            integer("parser_version").notNull(),
  schemaVersion:            integer("schema_version").notNull(),
  acquisitionMetadata:      jsonb("acquisition_metadata").$type<Record<string, unknown>>().notNull().default({}),
  fetchedAt:                timestamp("fetched_at", { withTimezone: true }),
  observationCount:         integer("observation_count").notNull().default(0),
  duplicateCount:           integer("duplicate_count").notNull().default(0),
  errorCode:                text("error_code"),
  errorMessage:             text("error_message"),
  startedAt:                timestamp("started_at", { withTimezone: true }),
  completedAt:              timestamp("completed_at", { withTimezone: true }),
  updatedAt:                timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("songstats_history_chunks_artist_window_unique")
    .on(table.artistKey, table.windowStartDate, table.windowEndDate),
  index("songstats_history_chunks_run_status_idx")
    .on(table.runId, table.status),
]);

export const songstatsHistoricalObservations = pgTable("songstats_historical_observations", {
  id:                       serial("id").primaryKey(),
  artistKey:                text("artist_key").notNull(),
  providerIdentityId:       integer("provider_identity_id").notNull().references(() => songstatsHistoryProviderIdentities.id),
  metricDefinitionId:       integer("metric_definition_id").notNull().references(() => songstatsHistoryMetricDefinitions.id),
  providerObservationDate:  date("provider_observation_date").notNull(),
  value:                    numeric("value", { precision: 30, scale: 6 }).notNull(),
  granularity:              text("granularity").notNull().default("daily"),
  acquisitionMode:          text("acquisition_mode").notNull().default("songstats_historical"),
  fetchedAt:                timestamp("fetched_at", { withTimezone: true }).notNull(),
  importedAt:               timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  importChunkId:            integer("import_chunk_id").notNull().references(() => songstatsHistoryImportChunks.id),
}, (table) => [
  uniqueIndex("songstats_history_observation_provenance_unique").on(
    table.artistKey,
    table.metricDefinitionId,
    table.providerObservationDate,
    table.acquisitionMode,
  ),
  index("songstats_history_observation_chunk_idx").on(table.importChunkId),
]);

export type SongstatsArtist = typeof songstatsArtists.$inferSelect;
export type SongstatsArtistDailySnapshot = typeof songstatsArtistDailySnapshots.$inferSelect;
export type SongstatsArtistExtendedData = typeof songstatsArtistExtendedData.$inferSelect;
export type SongstatsSnapshotSchedulerRun = typeof songstatsSnapshotSchedulerRuns.$inferSelect;
export type SongstatsHistoryImportRun = typeof songstatsHistoryImportRuns.$inferSelect;
export type SongstatsHistoryMetricDefinition = typeof songstatsHistoryMetricDefinitions.$inferSelect;
export type SongstatsHistoryProviderIdentity = typeof songstatsHistoryProviderIdentities.$inferSelect;
export type SongstatsHistoryImportChunk = typeof songstatsHistoryImportChunks.$inferSelect;
export type SongstatsHistoricalObservation = typeof songstatsHistoricalObservations.$inferSelect;
