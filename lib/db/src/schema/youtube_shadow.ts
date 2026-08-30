import { sql } from "drizzle-orm";
import { bigint, check, foreignKey, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { youtubeTrackedVideos } from "./youtube_video_tracker";

export const youtubeMusicArtistCandidates = pgTable("youtube_music_artist_candidates", {
  id: serial("id").primaryKey(),
  artistKey: text("artist_key").notNull(),
  artistName: text("artist_name").notNull(),
  browseId: text("browse_id").notNull(),
  canonicalUrl: text("canonical_url").notNull(),
  evidenceSource: text("evidence_source").notNull().default("youtube_music_innertube"),
  confidenceScore: integer("confidence_score").notNull().default(0),
  status: text("status").notNull().default("review"),
  evidence: jsonb("evidence").notNull().default({}),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull().defaultNow(),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("youtube_music_artist_candidates_artist_browse_unique").on(table.artistKey, table.browseId),
  index("youtube_music_artist_candidates_status_idx").on(table.status, table.lastCheckedAt),
  check("youtube_music_artist_candidates_status_check", sql`${table.status} IN ('verified','review','rejected')`),
]);

export const youtubeMusicCatalogCandidates = pgTable("youtube_music_catalog_candidates", {
  id: serial("id").primaryKey(),
  artistKey: text("artist_key").notNull(),
  artistName: text("artist_name").notNull(),
  artistBrowseId: text("artist_browse_id").notNull(),
  videoId: text("video_id").notNull(),
  title: text("title").notNull().default(""),
  canonicalUrl: text("canonical_url").notNull(),
  evidenceSource: text("evidence_source").notNull().default("youtube_music_innertube"),
  evidenceSources: jsonb("evidence_sources").notNull().default([]),
  confidenceScore: integer("confidence_score").notNull().default(0),
  status: text("status").notNull().default("review"),
  samplingStatus: text("sampling_status").notNull().default("shadow"),
  refreshTier: text("refresh_tier").notNull().default("baseline"),
  evidence: jsonb("evidence").notNull().default({}),
  discoveredAt: timestamp("discovered_at", { withTimezone: true }).notNull().defaultNow(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  lastObservedAt: timestamp("last_observed_at", { withTimezone: true }),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("youtube_music_catalog_candidates_artist_video_unique").on(table.artistKey, table.videoId),
  index("youtube_music_catalog_candidates_status_idx").on(table.status, table.samplingStatus, table.refreshTier),
  index("youtube_music_catalog_candidates_video_idx").on(table.videoId),
  check("youtube_music_catalog_candidates_status_check", sql`${table.status} IN ('verified','review','rejected')`),
  check("youtube_music_catalog_candidates_sampling_status_check", sql`${table.samplingStatus} IN ('shadow','paused','disabled')`),
  check("youtube_music_catalog_candidates_refresh_tier_check", sql`${table.refreshTier} IN ('hot','warm','baseline')`),
  foreignKey({
    name: "youtube_music_catalog_candidates_video_id_fkey",
    columns: [table.videoId],
    foreignColumns: [youtubeTrackedVideos.videoId],
  }).onDelete("cascade"),
]);

export const youtubeMusicShadowRuns = pgTable("youtube_music_shadow_runs", {
  id: serial("id").primaryKey(),
  runType: text("run_type").notNull(),
  artistKey: text("artist_key"),
  status: text("status").notNull(),
  summary: jsonb("summary").notNull().default({}),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const youtubeVideoIntradayShadowSnapshots = pgTable("youtube_video_intraday_shadow_snapshots", {
  id: serial("id").primaryKey(),
  videoId: text("video_id").notNull(),
  refreshTier: text("refresh_tier").notNull(),
  bucketStart: timestamp("bucket_start", { withTimezone: true }).notNull(),
  observedAt: timestamp("observed_at", { withTimezone: true }).notNull().defaultNow(),
  viewCount: bigint("view_count", { mode: "number" }),
  likeCount: bigint("like_count", { mode: "number" }),
  commentCount: bigint("comment_count", { mode: "number" }),
  viewDelta: bigint("view_delta", { mode: "number" }),
  secondsSincePrevious: integer("seconds_since_previous"),
  sourceType: text("source_type").notNull().default("youtube_api_shadow"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("youtube_video_intraday_shadow_video_bucket_unique").on(table.videoId, table.bucketStart),
  index("youtube_video_intraday_shadow_observed_idx").on(table.observedAt.desc().nullsFirst()),
  check("youtube_video_intraday_shadow_snapshots_refresh_tier_check", sql`${table.refreshTier} IN ('hot','warm','baseline')`),
  foreignKey({
    name: "youtube_video_intraday_shadow_snapshots_video_id_fkey",
    columns: [table.videoId],
    foreignColumns: [youtubeTrackedVideos.videoId],
  }).onDelete("cascade"),
]);

export const youtubeArtistIntradayShadowCurrent = pgTable("youtube_artist_intraday_shadow_current", {
  artistKey: text("artist_key").primaryKey(),
  trackedVideoCount: integer("tracked_video_count").notNull().default(0),
  videosWithObservations: integer("videos_with_observations").notNull().default(0),
  totalViews: bigint("total_views", { mode: "number" }).notNull().default(0),
  latestObservedAt: timestamp("latest_observed_at", { withTimezone: true }),
  sourceType: text("source_type").notNull().default("youtube_music_shadow"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const youtubeShadowApiUsage = pgTable("youtube_shadow_api_usage", {
  usageDate: text("usage_date").primaryKey(),
  apiCalls: integer("api_calls").notNull().default(0),
  videosRequested: integer("videos_requested").notNull().default(0),
  videosReturned: integer("videos_returned").notNull().default(0),
  batchStatsApiCalls: integer("batch_stats_api_calls").notNull().default(0),
  batchStatsVideosRequested: integer("batch_stats_videos_requested").notNull().default(0),
  batchStatsVideosReturned: integer("batch_stats_videos_returned").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
