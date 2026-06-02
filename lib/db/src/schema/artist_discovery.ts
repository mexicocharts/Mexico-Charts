import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const chartSnapshots = pgTable(
  "chart_snapshots",
  {
    id: serial("id").primaryKey(),
    source: text("source").notNull(),
    chartType: text("chart_type").notNull(),
    country: text("country").notNull().default("MX"),
    chartDate: text("chart_date").notNull(),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    chartUnique: uniqueIndex("chart_snapshots_source_chart_country_date_unique").on(
      table.source,
      table.chartType,
      table.country,
      table.chartDate,
    ),
    dateIdx: index("chart_snapshots_chart_date_idx").on(table.chartDate),
  }),
);

export const chartSnapshotRows = pgTable(
  "chart_snapshot_rows",
  {
    id: serial("id").primaryKey(),
    snapshotId: integer("snapshot_id").notNull().references(() => chartSnapshots.id, { onDelete: "cascade" }),
    rank: integer("rank").notNull(),
    title: text("title").notNull().default(""),
    artistNames: jsonb("artist_names").$type<string[]>().notNull().default([]),
    externalSongId: text("external_song_id"),
    externalArtistIds: jsonb("external_artist_ids").$type<string[]>().notNull().default([]),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    snapshotRankUnique: uniqueIndex("chart_snapshot_rows_snapshot_rank_unique").on(table.snapshotId, table.rank),
    snapshotIdx: index("chart_snapshot_rows_snapshot_idx").on(table.snapshotId),
  }),
);

export const artistCandidates = pgTable(
  "artist_candidates",
  {
    id: serial("id").primaryKey(),
    artistName: text("artist_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    status: text("status").notNull().default("pending"),
    confidenceScore: integer("confidence_score").notNull().default(0),
    firstSeenDate: text("first_seen_date"),
    lastSeenDate: text("last_seen_date"),
    totalAppearances: integer("total_appearances").notNull().default(0),
    sourceCount: integer("source_count").notNull().default(0),
    notes: text("notes"),
    matchedArtistId: text("matched_artist_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    normalizedUnique: uniqueIndex("artist_candidates_normalized_name_unique").on(table.normalizedName),
    statusIdx: index("artist_candidates_status_idx").on(table.status),
    confidenceIdx: index("artist_candidates_confidence_idx").on(table.confidenceScore),
  }),
);

export const artistCandidateEvents = pgTable(
  "artist_candidate_events",
  {
    id: serial("id").primaryKey(),
    candidateId: integer("candidate_id").notNull().references(() => artistCandidates.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
    chartType: text("chart_type").notNull(),
    chartDate: text("chart_date").notNull(),
    rank: integer("rank"),
    songOrVideoTitle: text("song_or_video_title"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    candidateIdx: index("artist_candidate_events_candidate_idx").on(table.candidateId),
    eventUnique: uniqueIndex("artist_candidate_events_candidate_source_chart_date_rank_title_unique").on(
      table.candidateId,
      table.source,
      table.chartType,
      table.chartDate,
      table.rank,
      table.songOrVideoTitle,
    ),
  }),
);

export const artistCandidateSignals = pgTable(
  "artist_candidate_signals",
  {
    id: serial("id").primaryKey(),
    candidateId: integer("candidate_id").notNull().references(() => artistCandidates.id, { onDelete: "cascade" }),
    signalType: text("signal_type").notNull(),
    source: text("source").notNull(),
    value: text("value").notNull(),
    confidenceWeight: integer("confidence_weight").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  table => ({
    candidateIdx: index("artist_candidate_signals_candidate_idx").on(table.candidateId),
    signalUnique: uniqueIndex("artist_candidate_signals_candidate_type_source_value_unique").on(
      table.candidateId,
      table.signalType,
      table.source,
      table.value,
    ),
  }),
);

export type ChartSnapshot = typeof chartSnapshots.$inferSelect;
export type ChartSnapshotRow = typeof chartSnapshotRows.$inferSelect;
export type ArtistCandidate = typeof artistCandidates.$inferSelect;
export type ArtistCandidateEvent = typeof artistCandidateEvents.$inferSelect;
export type ArtistCandidateSignal = typeof artistCandidateSignals.$inferSelect;
