import { Router, type Request, type Response } from "express";
import { db, pool } from "@workspace/db";
import {
  songstatsArtistDailySnapshots,
  songstatsArtists,
} from "@workspace/db/schema";
import { asc, desc, eq, inArray } from "drizzle-orm";
import {
  configuredSongstatsMonthlyArtistLimit,
  getSongstatsMonthlyUsage,
  SONGSTATS_CONTRACT_UNIQUE_ARTIST_LIMIT,
} from "../lib/songstats-billing-guard";
import {
  getSongstatsArtistAudience,
  getSongstatsArtistAudienceDetails,
  getSongstatsArtistCatalog,
  getSongstatsArtistCurrentStats,
  getSongstatsArtistHistoricStats,
  type SongstatsSource,
} from "../lib/songstats-client";
import {
  ensureSongstatsTables,
  listSongstatsCatalogArtists,
  songstatsArtistKeyCandidates,
  syncSongstatsCurrentStats,
} from "../lib/songstats-snapshot-service";
import {
  getSongstatsExtendedCoverage,
  syncSongstatsExtendedData,
  type SongstatsExtendedEndpoint,
} from "../lib/songstats-extended-service";
import { logger } from "../lib/logger";
import {
  buildSongstatsPublicInsight,
  type SongstatsPublicMetricKey,
} from "../lib/songstats-public-service";
import {
  chooseFreshSongstatsMetric,
  newestSongstatsDate,
} from "../lib/songstats-public-freshness";

const router = Router();

const ALLOWED_SOURCES = new Set<SongstatsSource>([
  "all",
  "amazon",
  "apple_music",
  "bandsintown",
  "beatport",
  "deezer",
  "facebook",
  "instagram",
  "itunes",
  "pandora",
  "shazam",
  "songkick",
  "soundcloud",
  "spotify",
  "tiktok",
  "tidal",
  "tracklist",
  "traxsource",
  "twitter",
  "youtube",
]);

const LIVE_ENDPOINTS = new Set([
  "current",
  "historic",
  "audience",
  "audience_details",
  "catalog",
]);

const EXTENDED_ENDPOINTS = new Set<SongstatsExtendedEndpoint>([
  "historic",
  "audience",
  "audience_details",
  "catalog",
]);

function adminKey(): string {
  return process.env["SONGSTATS_ADMIN_KEY"]
    ?? process.env["SPOTIFY_ADMIN_KEY"]
    ?? process.env["YOUTUBE_ADMIN_KEY"]
    ?? "";
}

function requireAdmin(req: Request, res: Response): boolean {
  const expected = adminKey();
  const supplied = req.headers["x-admin-key"];
  if (!expected || supplied !== expected) {
    res.status(403).json({ error: "Forbidden — provide X-Admin-Key header" });
    return false;
  }
  return true;
}

function configuredSyncLimit(): number {
  const parsed = Number(process.env["SONGSTATS_SYNC_MAX_ARTISTS"] ?? "25");
  return Number.isFinite(parsed)
    ? Math.max(
      1,
      Math.min(configuredSongstatsMonthlyArtistLimit(), Math.floor(parsed)),
    )
    : 25;
}

function requestedLimit(raw: unknown): number {
  const parsed = Number(raw ?? configuredSyncLimit());
  if (!Number.isFinite(parsed)) return configuredSyncLimit();
  return Math.max(1, Math.min(configuredSyncLimit(), Math.floor(parsed)));
}

function configuredExtendedSyncLimit(): number {
  const parsed = Number(process.env["SONGSTATS_EXTENDED_SYNC_MAX_ARTISTS"] ?? "5");
  return Number.isFinite(parsed)
    ? Math.max(1, Math.min(25, Math.floor(parsed)))
    : 5;
}

function requestedExtendedLimit(raw: unknown): number {
  const parsed = Number(raw ?? configuredExtendedSyncLimit());
  if (!Number.isFinite(parsed)) return configuredExtendedSyncLimit();
  return Math.max(1, Math.min(configuredExtendedSyncLimit(), Math.floor(parsed)));
}

function sourceFromQuery(raw: unknown): SongstatsSource {
  const source = String(raw ?? "all").trim().toLowerCase() as SongstatsSource;
  if (!ALLOWED_SOURCES.has(source)) {
    throw new Error(`Unsupported Songstats source: ${source}`);
  }
  return source;
}

function stringList(raw: unknown, fallback: string[]): string[] {
  const values = Array.isArray(raw)
    ? raw.map(String)
    : String(raw ?? fallback.join(",")).split(",");
  return [...new Set(values
    .map(value => value.trim().toLowerCase())
    .filter(Boolean))];
}

function extendedEndpoints(raw: unknown): SongstatsExtendedEndpoint[] {
  const endpoints = stringList(raw, [
    "historic",
    "audience",
    "audience_details",
    "catalog",
  ]);
  if (endpoints.length === 0) {
    throw new Error("At least one extended endpoint is required");
  }
  const invalid = endpoints.filter(endpoint => !EXTENDED_ENDPOINTS.has(
    endpoint as SongstatsExtendedEndpoint,
  ));
  if (invalid.length) {
    throw new Error(`Unsupported extended endpoint(s): ${invalid.join(", ")}`);
  }
  return endpoints as SongstatsExtendedEndpoint[];
}

function audienceDetailsSources(raw: unknown): SongstatsSource[] {
  const sources = stringList(raw, ["spotify"]);
  if (sources.length === 0) {
    throw new Error("At least one audience-detail source is required");
  }
  const invalid = sources.filter(source => (
    source === "all" || !ALLOWED_SOURCES.has(source as SongstatsSource)
  ));
  if (invalid.length) {
    throw new Error(`Unsupported audience-detail source(s): ${invalid.join(", ")}`);
  }
  return sources as SongstatsSource[];
}

function countryCodeFromQuery(raw: unknown): string {
  const value = String(raw ?? "MX").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(value)) {
    throw new Error("countryCode must be a two-letter country code");
  }
  return value;
}

function boundedInteger(
  raw: unknown,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = Number(raw ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(parsed)));
}

function dateDaysBefore(endDate: string, days: number): string {
  const date = new Date(`${endDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - Math.max(0, days - 1));
  return date.toISOString().slice(0, 10);
}

function dateFromQuery(raw: unknown, name: string): string | undefined {
  if (raw == null || raw === "") return undefined;
  const value = String(raw);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${name} must use YYYY-MM-DD format`);
  }
  return value;
}

// PUBLIC: only returns normalized, saved display metrics. Raw Songstats payloads
// stay server-side and are never exposed by this route.
router.get("/providers/songstats/artist", async (req, res) => {
  const artistKey = String(req.query["artistKey"] ?? "").trim().toLowerCase();
  if (!artistKey) {
    res.status(400).json({ error: "artistKey is required" });
    return;
  }

  try {
    await ensureSongstatsTables();
    const lookupKeys = songstatsArtistKeyCandidates(artistKey);
    const [artistRows, snapshotRows, extendedRows] = await Promise.all([
      db.select()
        .from(songstatsArtists)
        .where(inArray(songstatsArtists.artistKey, lookupKeys)),
      db.select({
        snapshotDate: songstatsArtistDailySnapshots.snapshotDate,
        spotifyFollowers: songstatsArtistDailySnapshots.spotifyFollowers,
        spotifyMonthlyListeners: songstatsArtistDailySnapshots.spotifyMonthlyListeners,
        spotifyPopularity: songstatsArtistDailySnapshots.spotifyPopularity,
        youtubeSubscribers: songstatsArtistDailySnapshots.youtubeSubscribers,
        youtubeChannelViews: songstatsArtistDailySnapshots.youtubeChannelViews,
        instagramFollowers: songstatsArtistDailySnapshots.instagramFollowers,
        tiktokFollowers: songstatsArtistDailySnapshots.tiktokFollowers,
        facebookFollowers: songstatsArtistDailySnapshots.facebookFollowers,
        twitterFollowers: songstatsArtistDailySnapshots.twitterFollowers,
        soundcloudFollowers: songstatsArtistDailySnapshots.soundcloudFollowers,
        deezerFollowers: songstatsArtistDailySnapshots.deezerFollowers,
        fetchedAt: songstatsArtistDailySnapshots.fetchedAt,
      })
        .from(songstatsArtistDailySnapshots)
        .where(inArray(songstatsArtistDailySnapshots.artistKey, lookupKeys))
        .orderBy(desc(songstatsArtistDailySnapshots.snapshotDate))
        .limit(1),
      pool.query<{
        artist_key: string;
        historic_stats: unknown;
        audience: unknown;
        audience_details: unknown;
        updated_at: Date;
      }>(
        `
          SELECT
            artist_key,
            historic_stats,
            audience,
            audience_details,
            updated_at
          FROM songstats_artist_extended_data
          WHERE artist_key = ANY($1::text[])
          ORDER BY array_position($1::text[], artist_key)
          LIMIT 1
        `,
        [lookupKeys],
      ).catch(error => {
        if ((error as { code?: string }).code === "42P01") {
          return { rows: [] };
        }
        throw error;
      }),
    ]);
    const artist = lookupKeys
      .map(key => artistRows.find(row => row.artistKey === key))
      .find(Boolean);
    const savedSnapshot = snapshotRows[0];
    const extended = extendedRows.rows[0];
    const insight = extended
      ? buildSongstatsPublicInsight({
        historicStats: extended.historic_stats,
        audience: extended.audience,
        audienceDetails: extended.audience_details,
      })
      : null;

    if (!savedSnapshot && !insight) {
      res.status(404).json({ error: "No saved Songstats data for this artist" });
      return;
    }

    const current = insight?.current;
    const snapshotMetric = (
      key: SongstatsPublicMetricKey,
      savedValue: number | null | undefined,
    ) => chooseFreshSongstatsMetric(
      { value: savedValue, date: savedSnapshot?.snapshotDate },
      { value: current?.[key], date: insight?.snapshotDate },
    );
    const snapshotDate = newestSongstatsDate(
      savedSnapshot?.snapshotDate,
      insight?.snapshotDate,
    );

    res.json({
      artistKey: extended?.artist_key ?? artist?.artistKey ?? artistKey,
      name: insight?.name ?? artist?.songstatsName ?? null,
      avatarUrl: insight?.avatarUrl ?? artist?.avatarUrl ?? null,
      snapshot: {
        snapshotDate,
        spotifyFollowers: snapshotMetric(
          "spotifyFollowers",
          savedSnapshot?.spotifyFollowers,
        ),
        spotifyMonthlyListeners: snapshotMetric(
          "spotifyMonthlyListeners",
          savedSnapshot?.spotifyMonthlyListeners,
        ),
        spotifyPopularity: savedSnapshot?.spotifyPopularity ?? null,
        youtubeSubscribers: snapshotMetric(
          "youtubeSubscribers",
          savedSnapshot?.youtubeSubscribers,
        ),
        youtubeChannelViews: snapshotMetric(
          "youtubeChannelViews",
          savedSnapshot?.youtubeChannelViews,
        ),
        instagramFollowers: snapshotMetric(
          "instagramFollowers",
          savedSnapshot?.instagramFollowers,
        ),
        tiktokFollowers: snapshotMetric(
          "tiktokFollowers",
          savedSnapshot?.tiktokFollowers,
        ),
        facebookFollowers: snapshotMetric(
          "facebookFollowers",
          savedSnapshot?.facebookFollowers,
        ),
        twitterFollowers: snapshotMetric(
          "twitterFollowers",
          savedSnapshot?.twitterFollowers,
        ),
        soundcloudFollowers: snapshotMetric(
          "soundcloudFollowers",
          savedSnapshot?.soundcloudFollowers,
        ),
        deezerFollowers: snapshotMetric(
          "deezerFollowers",
          savedSnapshot?.deezerFollowers,
        ),
        fetchedAt: extended?.updated_at?.toISOString()
          ?? savedSnapshot?.fetchedAt?.toISOString()
          ?? null,
      },
      growth: insight?.growth ?? {},
      trends: insight?.trends ?? {},
      topMexicoCities: insight?.topMexicoCities ?? [],
    });
  } catch (error) {
    logger.error({ error }, "[songstats] saved artist lookup failed");
    res.status(500).json({ error: "Unable to read saved Songstats data" });
  }
});

// ADMIN: confirms which verified Spotify artists would be included without
// spending any Songstats requests.
router.get("/admin/songstats/sync-preview", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const limit = requestedLimit(req.query["limit"]);
  const requestedArtistKey = String(req.query["artistKey"] ?? "").trim();
  const [artists, monthlyUsage] = await Promise.all([
    listSongstatsCatalogArtists({
      limit,
      artistKeys: requestedArtistKey ? [requestedArtistKey] : undefined,
    }),
    getSongstatsMonthlyUsage(),
  ]);

  res.json({
    configuredSyncLimit: configuredSyncLimit(),
    contractUniqueArtistLimit: SONGSTATS_CONTRACT_UNIQUE_ARTIST_LIMIT,
    monthlyUsage,
    wouldRequest: artists.length,
    artists,
  });
});

// ADMIN: shows the local monthly unique-artist safety ledger. This endpoint
// never contacts Songstats and therefore cannot add billable artists.
router.get("/admin/songstats/billing-usage", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json(await getSongstatsMonthlyUsage());
});

// ADMIN: calls the Current Stats endpoint and saves one daily snapshot per
// artist. The default and maximum are both 25 until SONGSTATS_SYNC_MAX_ARTISTS
// is deliberately raised for the production key.
router.post("/admin/songstats/sync-current", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const limit = requestedLimit(req.query["limit"]);
  const artistKeys = Array.isArray(req.body?.artistKeys)
    ? (req.body.artistKeys as unknown[]).map(String)
    : undefined;

  if (artistKeys && artistKeys.length > limit) {
    res.status(400).json({ error: `artistKeys cannot contain more than ${limit} entries` });
    return;
  }

  try {
    const summary = await syncSongstatsCurrentStats({ limit, artistKeys });
    res.status(summary.failed > 0 && summary.saved === 0 ? 502 : 200).json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Songstats sync error";
    logger.error({ error: message }, "[songstats] current stats sync failed");
    res.status(500).json({ error: message });
  }
});

// ADMIN: persists a bounded historical window plus the latest audience,
// country-level audience details, and catalog payloads. Raw provider payloads
// remain server-side; this route is deliberately limited to small batches.
router.post("/admin/songstats/sync-extended", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const limit = requestedExtendedLimit(req.query["limit"]);
  const artistKeys = Array.isArray(req.body?.artistKeys)
    ? (req.body.artistKeys as unknown[]).map(String)
    : undefined;

  if (artistKeys && artistKeys.length > limit) {
    res.status(400).json({ error: `artistKeys cannot contain more than ${limit} entries` });
    return;
  }

  try {
    const endpoints = extendedEndpoints(
      req.body?.endpoints ?? req.query["include"],
    );
    const detailsSources = audienceDetailsSources(
      req.body?.audienceDetailsSources ?? req.query["detailsSources"],
    );
    const countryCode = countryCodeFromQuery(
      req.body?.countryCode ?? req.query["countryCode"],
    );
    const historyDays = boundedInteger(
      req.body?.historyDays ?? req.query["historyDays"],
      90,
      30,
      365,
    );
    const endDate = dateFromQuery(
      req.body?.endDate ?? req.query["endDate"],
      "endDate",
    ) ?? new Date().toISOString().slice(0, 10);
    const startDate = dateFromQuery(
      req.body?.startDate ?? req.query["startDate"],
      "startDate",
    ) ?? dateDaysBefore(endDate, historyDays);
    if (startDate > endDate) {
      throw new Error("startDate cannot be after endDate");
    }
    const catalogLimit = boundedInteger(
      req.body?.catalogLimit ?? req.query["catalogLimit"],
      100,
      1,
      100,
    );

    const summary = await syncSongstatsExtendedData({
      limit,
      artistKeys,
      endpoints,
      historyStartDate: startDate,
      historyEndDate: endDate,
      countryCode,
      audienceDetailsSources: detailsSources,
      catalogLimit,
    });
    res.status(summary.failed > 0 && summary.saved === 0 && summary.partial === 0
      ? 502
      : 200).json(summary);
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "Unknown Songstats extended sync error";
    logger.error({ error: message }, "[songstats] extended sync failed");
    res.status(500).json({ error: message });
  }
});

// ADMIN: reports server-side extended-data coverage and physical row size.
// It never contacts Songstats and therefore cannot add billable artists.
router.get("/admin/songstats/extended-coverage", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  res.json(await getSongstatsExtendedCoverage());
});

// ADMIN: inspect any of the five licensed artist endpoints for one already
// verified catalog artist. Raw responses remain behind the admin key.
router.get("/admin/songstats/live/:artistKey", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const artistKey = String(req.params["artistKey"] ?? "").trim().toLowerCase();
  if (!artistKey) {
    res.status(400).json({ error: "artistKey is required" });
    return;
  }

  try {
    const [artist] = await listSongstatsCatalogArtists({
      limit: 1,
      artistKeys: [artistKey],
    });
    if (!artist) {
      res.status(404).json({ error: "No Spotify artist linked for this catalog artist" });
      return;
    }

    const source = sourceFromQuery(req.query["source"]);
    const include = [...new Set(String(req.query["include"] ?? "current")
      .split(",")
      .map(value => value.trim().toLowerCase())
      .filter(Boolean))];
    const invalid = include.filter(endpoint => !LIVE_ENDPOINTS.has(endpoint));
    if (invalid.length) {
      res.status(400).json({ error: `Unsupported endpoint(s): ${invalid.join(", ")}` });
      return;
    }

    const identifier = { spotifyArtistId: artist.spotifyArtistId };
    const startDate = dateFromQuery(req.query["startDate"], "startDate");
    const endDate = dateFromQuery(req.query["endDate"], "endDate");
    const countryCode = String(req.query["countryCode"] ?? "MX");
    const rawCatalogLimit = Number(req.query["catalogLimit"] ?? 20);
    const catalogLimit = Number.isFinite(rawCatalogLimit)
      ? Math.max(1, Math.min(100, Math.floor(rawCatalogLimit)))
      : 20;

    const endpointRequests = include.map(async endpoint => {
      if (endpoint === "current") {
        return [endpoint, await getSongstatsArtistCurrentStats(identifier, source)] as const;
      }
      if (endpoint === "historic") {
        return [endpoint, await getSongstatsArtistHistoricStats(identifier, {
          source,
          startDate,
          endDate,
          withAggregates: true,
        })] as const;
      }
      if (endpoint === "audience") {
        return [endpoint, await getSongstatsArtistAudience(identifier, source)] as const;
      }
      if (endpoint === "audience_details") {
        return [
          endpoint,
          await getSongstatsArtistAudienceDetails(identifier, countryCode, source),
        ] as const;
      }
      return [endpoint, await getSongstatsArtistCatalog(identifier, {
        limit: catalogLimit,
        offset: 0,
        withLinks: true,
      })] as const;
    });
    const settled = await Promise.allSettled(endpointRequests);
    const failedEndpoints: string[] = [];
    const entries = settled.map((result, index) => {
      const endpoint = include[index]!;
      if (result.status === "fulfilled") return result.value;
      failedEndpoints.push(endpoint);
      const error = result.reason instanceof Error
        ? result.reason.message
        : "Unknown Songstats API error";
      return [endpoint, { error }] as const;
    });

    res.status(failedEndpoints.length === include.length ? 502 : 200).json({
      artistKey,
      spotifyArtistId: artist.spotifyArtistId,
      failedEndpoints,
      data: Object.fromEntries(entries),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Songstats API error";
    logger.warn({ artistKey, error: message }, "[songstats] live artist inspection failed");
    res.status(502).json({ error: message });
  }
});

// ADMIN: stored Songstats linkage/snapshot coverage only; makes no API calls.
router.get("/admin/songstats/coverage", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  await ensureSongstatsTables();
  const [linked, snapshots] = await Promise.all([
    db.select().from(songstatsArtists).orderBy(asc(songstatsArtists.artistKey)),
    db.select({
      artistKey: songstatsArtistDailySnapshots.artistKey,
      snapshotDate: songstatsArtistDailySnapshots.snapshotDate,
    }).from(songstatsArtistDailySnapshots)
      .orderBy(desc(songstatsArtistDailySnapshots.snapshotDate)),
  ]);
  const latestByArtist = new Map<string, string>();
  for (const snapshot of snapshots) {
    if (!latestByArtist.has(snapshot.artistKey)) {
      latestByArtist.set(snapshot.artistKey, snapshot.snapshotDate);
    }
  }
  res.json({
    linkedArtists: linked.length,
    artistsWithSnapshots: latestByArtist.size,
    artists: linked.map(artist => ({
      artistKey: artist.artistKey,
      spotifyArtistId: artist.spotifyArtistId,
      songstatsArtistId: artist.songstatsArtistId,
      songstatsName: artist.songstatsName,
      lastSyncedAt: artist.lastSyncedAt,
      latestSnapshotDate: latestByArtist.get(artist.artistKey) ?? null,
    })),
  });
});

export default router;
