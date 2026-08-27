import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { publicTouringLab, touringShadowStatus } from "../lib/ticketmaster-touring-shadow";
import { getPublicTouringEstimationReport } from "../lib/ticketmaster-touring-public-estimation";
import { clerkUserId, requireClerkUser } from "../lib/auth";
import { generateAndQueueTouringWeeklySummary } from "../lib/touring-weekly-summary";

const router = Router();
const ADMIN_KEY = () => (process.env["NEWSLETTER_ADMIN_KEY"] || process.env["YOUTUBE_ADMIN_KEY"] || process.env["SPOTIFY_ADMIN_KEY"] || "").trim();
let tablesPromise: Promise<unknown> | null = null;

function authed(req: Parameters<Parameters<typeof router.get>[1]>[0]) {
  const header = Array.isArray(req.headers["x-admin-key"]) ? req.headers["x-admin-key"][0] : req.headers["x-admin-key"];
  return Boolean(ADMIN_KEY() && header?.trim() === ADMIN_KEY());
}

function ensureTables() {
  tablesPromise ??= pool.query(`
    CREATE TABLE IF NOT EXISTS touring_venue_capacities (
      venue_id text PRIMARY KEY, venue_name text NOT NULL, configuration text NOT NULL,
      capacity_low integer NOT NULL CHECK(capacity_low>0), capacity_high integer NOT NULL CHECK(capacity_high>=capacity_low),
      source_url text NOT NULL, source_label text NOT NULL,
      confidence text NOT NULL CHECK(confidence IN ('high','medium','limited')),
      verified_at timestamptz NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS touring_announcement_sources (
      id bigserial PRIMARY KEY, artist_id text NOT NULL, artist_name text NOT NULL,
      source_type text NOT NULL CHECK(source_type IN ('artist','promoter','venue')),
      source_url text NOT NULL UNIQUE, status text NOT NULL DEFAULT 'active',
      last_checked_at timestamptz, last_changed_at timestamptz, last_error text,
      content_hash text, etag text, last_modified text,
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE touring_announcement_sources ADD COLUMN IF NOT EXISTS content_hash text;
    ALTER TABLE touring_announcement_sources ADD COLUMN IF NOT EXISTS etag text;
    ALTER TABLE touring_announcement_sources ADD COLUMN IF NOT EXISTS last_modified text;
    CREATE TABLE IF NOT EXISTS touring_watchlists (
      clerk_user_id text NOT NULL, artist_id text NOT NULL, artist_name text NOT NULL,
      urgent_alerts boolean NOT NULL DEFAULT true, daily_digest boolean NOT NULL DEFAULT true,
      announcement_alerts boolean NOT NULL DEFAULT true, onsale_alerts boolean NOT NULL DEFAULT true,
      change_alerts boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(clerk_user_id,artist_id)
    );
    CREATE TABLE IF NOT EXISTS touring_review_queue (
      id bigserial PRIMARY KEY, review_type text NOT NULL CHECK(review_type IN ('artist_discovery','tour_announcement','event_change')),
      artist_id text, artist_name text NOT NULL, event_id text, title text NOT NULL, source_url text,
      evidence jsonb NOT NULL DEFAULT '{}'::jsonb, status text NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending','approved','rejected')), created_at timestamptz NOT NULL DEFAULT now(),
      reviewed_at timestamptz, UNIQUE(review_type,artist_id,event_id,title)
    );
    CREATE TABLE IF NOT EXISTS touring_weekly_summaries (
      week_start date PRIMARY KEY, generated_at timestamptz NOT NULL DEFAULT now(),
      summary jsonb NOT NULL DEFAULT '{}'::jsonb, delivery_status text NOT NULL DEFAULT 'not_configured',
      delivered_at timestamptz, last_error text
    );
    ALTER TABLE touring_alert_outbox ADD COLUMN IF NOT EXISTS recipient_count integer NOT NULL DEFAULT 0;
    ALTER TABLE touring_alert_outbox ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;
  `);
  return tablesPromise;
}

function appearanceType(name: string, concertCount: number) {
  if (/festival|fest\b|feria|pal(enque|nque)|rodeo|fiestas?/iu.test(name)) return "festival" as const;
  if (/residenc|residencia/iu.test(name)) return "residency" as const;
  if (concertCount <= 1 && !/\btour\b|gira/iu.test(name)) return "standalone" as const;
  return "tour" as const;
}

function featuredScore(tour: { tourName: string; concertCount: number; nextConcertDate: string | null }, changed: boolean) {
  const scale = Math.min(45, Math.round(Math.log2(tour.concertCount + 1) * 11));
  const type = appearanceType(tour.tourName, tour.concertCount);
  const typeWeight = type === "tour" ? 25 : type === "residency" ? 18 : type === "festival" ? 7 : 3;
  const freshness = changed ? 18 : 0;
  const proximity = tour.nextConcertDate ? Math.max(0, 12 - Math.floor((new Date(`${tour.nextConcertDate}T12:00:00Z`).getTime() - Date.now()) / 86_400_000 / 7)) : 0;
  return { type, score: Math.max(0, typeWeight + scale + freshness + proximity) };
}

router.get("/touring/intelligence", async (_req, res) => {
  try {
    await ensureTables();
    const lab = await publicTouringLab();
    const estimation = await getPublicTouringEstimationReport();
    const estimateByEvent = new Map(estimation.events.map((estimate) => [estimate.eventId, estimate]));
    const rows = await pool.query<{
      event_id: string; venue_id: string | null; venue_name: string | null; capacity_low: number | null;
      capacity_high: number | null; configuration: string | null; confidence: string | null; source_url: string | null;
      price_ranges: Array<{ type?: string; currency?: string; min?: number; max?: number }> | null;
    }>(`SELECT DISTINCT ON(e.event_id) e.event_id,e.venue_id,e.venue_name,c.capacity_low,c.capacity_high,
      c.configuration,c.confidence,c.source_url,s.price_ranges FROM touring_tm_events e
      JOIN touring_tm_snapshots s ON s.event_id=e.event_id LEFT JOIN touring_venue_capacities c ON c.venue_id=e.venue_id
      WHERE e.event_kind='concert' AND e.event_date>=current_date ORDER BY e.event_id,s.observed_at DESC`);
    const events = rows.rows.map(row => {
      const price = (row.price_ranges ?? []).find(item => !item.type || /standard|regular/iu.test(item.type));
      const priced = price?.currency === "USD" && Number.isFinite(price.min) && Number.isFinite(price.max);
      const estimate = estimateByEvent.get(row.event_id);
      return {
        eventId: row.event_id,
        venue: { id: row.venue_id, name: row.venue_name },
        capacity: row.capacity_low ? { low: row.capacity_low, high: row.capacity_high, configuration: row.configuration, confidence: row.confidence, sourceUrl: row.source_url } : null,
        standardPrimaryPrice: priced ? { currency: "USD", min: price!.min, max: price!.max } : null,
        estimateStatus: estimate?.status ?? "pending",
        estimatedTicketsSold: estimate?.estimatedTicketsSold ?? null,
        estimatedGrossUsd: estimate?.estimatedGrossUsd ?? null,
        estimatedAverageTicketUsd: estimate?.estimatedAverageTicketUsd ?? null,
        estimatedCapacityUtilization: estimate?.estimatedCapacityUtilization ?? null,
        estimateConfidencePercent: estimate?.confidencePercent ?? null,
        estimateConfidenceLabel: estimate?.confidenceLabel ?? "insufficient",
        estimateEvidenceTimestamp: estimate?.evidenceTimestamp ?? null,
        estimateMethodologyVersion: estimate?.methodologyVersion ?? null,
        estimateLabel: estimate?.estimateLabel ?? null,
      };
    });
    const tours = lab.tours.map(tour => {
      const changed = lab.recentChanges.some(change => change.artistName === tour.artistName);
      const featured = featuredScore(tour, changed);
      return { ...tour, appearanceType: featured.type, featuredScore: featured.score,
        demandScore: Math.min(85, 40 + Math.round(Math.log2(tour.concertCount + 1) * 11)),
        demandConfidence: lab.recentChanges.length ? "medium" : "limited",
        demandLabel: "Directional metadata estimate — not ticket sales",
      };
    }).sort((a, b) => b.featuredScore - a.featuredScore || (a.nextConcertDate ?? "9999").localeCompare(b.nextConcertDate ?? "9999"));
    const comparisons = await pool.query<{
      artist_id: string; artist_name: string; market: string | null; venue_scale: string;
      shows: number; estimated_gross_usd: number | null;
    }>(`SELECT e.artist_id,e.artist_name,COALESCE(NULLIF(e.city,''),'Mercado no publicado') market,
      CASE WHEN c.capacity_high >= 20000 THEN 'arena grande' WHEN c.capacity_high >= 8000 THEN 'arena' WHEN c.capacity_high IS NOT NULL THEN 'teatro/club' ELSE 'sin capacidad verificada' END venue_scale,
      count(*)::int shows,
      CASE WHEN bool_and(c.capacity_low IS NOT NULL AND c.capacity_high IS NOT NULL
        AND EXISTS (SELECT 1 FROM jsonb_array_elements(s.price_ranges) p WHERE (p->>'currency')='USD'
          AND (p->>'min')::numeric IS NOT NULL AND (p->>'max')::numeric IS NOT NULL))
        THEN round(avg(c.capacity_high * ((SELECT max((p->>'max')::numeric) FROM jsonb_array_elements(s.price_ranges) p WHERE (p->>'currency')='USD'))))::numeric
        ELSE NULL END estimated_gross_usd
      FROM touring_tm_events e
      JOIN LATERAL (SELECT price_ranges FROM touring_tm_snapshots WHERE event_id=e.event_id ORDER BY observed_at DESC LIMIT 1) s ON true
      LEFT JOIN touring_venue_capacities c ON c.venue_id=e.venue_id
      WHERE e.event_kind='concert' GROUP BY e.artist_id,e.artist_name,market,venue_scale
      ORDER BY e.artist_name,market LIMIT 500`);
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return res.json({ generatedAt: new Date().toISOString(), tours, events, recentChanges: lab.recentChanges,
      publicEstimation: estimation, comparisons: comparisons.rows,
      rules: { inventory: "not inferred", gross: "Point estimate requires evidence gating; never promoter reported." } });
  } catch (error) {
    logger.warn({ error }, "[touring-intelligence] failed");
    return res.status(503).json({ error: "Touring intelligence temporarily unavailable" });
  }
});

router.get("/touring/events/:eventId/history", async (req, res) => {
  const eventId = String(req.params.eventId ?? "").trim();
  if (!/^[A-Za-z0-9_-]{3,80}$/.test(eventId)) return res.status(400).json({ error: "Invalid event id" });
  const result = await pool.query(`SELECT observed_at,event_status,public_sale_start,public_sale_end,price_ranges
    FROM touring_tm_snapshots WHERE event_id=$1 ORDER BY observed_at ASC LIMIT 500`, [eventId]);
  return res.json({ eventId, observations: result.rows });
});

router.get("/admin/touring/intelligence/health", async (req, res) => {
  if (!authed(req)) return res.status(403).json({ error: "Forbidden" });
  await ensureTables();
  const [shadow, sources, venues, attention, alerts, reviews, summaries] = await Promise.all([
    touringShadowStatus(),
    pool.query(`SELECT count(*)::int total,count(*) FILTER(WHERE status='active')::int active,
      count(*) FILTER(WHERE last_error IS NOT NULL)::int errors,max(last_checked_at) latest_check FROM touring_announcement_sources`),
    pool.query(`SELECT count(*)::int verified_configurations,max(verified_at) latest_verification FROM touring_venue_capacities`),
    pool.query(`SELECT
      count(*) FILTER (WHERE c.venue_id IS NULL)::int missing_capacity,
      count(*) FILTER (WHERE s.price_ranges IS NULL OR NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(s.price_ranges) p WHERE (p->>'currency')='USD'))::int missing_currency,
      count(*) FILTER (WHERE e.tour_name IS NULL OR e.tour_name='')::int missing_tour_grouping,
      count(*) FILTER (WHERE c.confidence IN ('limited') OR c.confidence IS NULL)::int low_confidence
      FROM touring_tm_events e
      LEFT JOIN touring_venue_capacities c ON c.venue_id=e.venue_id
      LEFT JOIN LATERAL (SELECT price_ranges FROM touring_tm_snapshots WHERE event_id=e.event_id ORDER BY observed_at DESC LIMIT 1) s ON true
      WHERE e.event_kind='concert' AND e.event_date>=current_date`),
    pool.query(`SELECT count(*)::int total,
      count(*) FILTER (WHERE status='sent')::int sent,
      count(*) FILTER (WHERE status='pending')::int pending,
      count(*) FILTER (WHERE status='pending' AND attempts>0)::int retry,
      count(*) FILTER (WHERE status='failed')::int failed,
      COALESCE(sum(recipient_count),0)::int recipients FROM touring_alert_outbox`),
    pool.query(`SELECT count(*)::int pending FROM touring_review_queue WHERE status='pending'`),
    pool.query(`SELECT count(*)::int generated, max(generated_at) latest_generated,
      count(*) FILTER (WHERE delivery_status='sent')::int delivered FROM touring_weekly_summaries`),
  ]);
  return res.json({ generatedAt: new Date().toISOString(), shadow, announcementSources: sources.rows[0], venues: venues.rows[0],
    attention: attention.rows[0], alerts: alerts.rows[0], reviewQueue: reviews.rows[0], weeklySummaries: summaries.rows[0],
    delivery: { emailConfigured: Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim()), smsConfigured: false } });
});

router.get("/admin/touring/operations", async (req, res) => {
  if (!authed(req)) return res.status(403).json({ error: "Forbidden" });
  await ensureTables();
  const [attention, reviews, capacities] = await Promise.all([
    pool.query(`SELECT e.event_id,e.artist_id,e.artist_name,e.event_name,e.event_date,e.city,e.venue_name,
      CASE WHEN c.venue_id IS NULL THEN 'missing_capacity'
        WHEN NOT EXISTS (SELECT 1 FROM touring_tm_snapshots s WHERE s.event_id=e.event_id
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(s.price_ranges) p WHERE (p->>'currency')='USD')) THEN 'missing_currency'
        WHEN e.tour_name IS NULL OR e.tour_name='' THEN 'missing_tour_grouping'
        WHEN c.confidence='limited' THEN 'low_confidence' END reason
      FROM touring_tm_events e LEFT JOIN touring_venue_capacities c ON c.venue_id=e.venue_id
      WHERE e.event_kind='concert' AND e.event_date>=current_date
      AND (c.venue_id IS NULL OR c.confidence='limited' OR e.tour_name IS NULL OR e.tour_name=''
        OR NOT EXISTS (SELECT 1 FROM touring_tm_snapshots s WHERE s.event_id=e.event_id
          AND EXISTS (SELECT 1 FROM jsonb_array_elements(s.price_ranges) p WHERE (p->>'currency')='USD')))
      ORDER BY e.event_date,e.artist_name LIMIT 200`),
    pool.query(`SELECT id,review_type,artist_id,artist_name,event_id,title,source_url,evidence,status,created_at
      FROM touring_review_queue WHERE status='pending' ORDER BY created_at DESC LIMIT 200`),
    pool.query(`SELECT venue_id,venue_name,configuration,capacity_low,capacity_high,source_url,source_label,confidence,verified_at
      FROM touring_venue_capacities ORDER BY updated_at DESC LIMIT 200`),
  ]);
  return res.json({ generatedAt: new Date().toISOString(), attention: attention.rows, reviewQueue: reviews.rows,
    verifiedVenues: capacities.rows, sourcePolicy: "Only authorized public sources; no inventory or sell-through claims." });
});

router.get("/admin/touring/alerts", async (req, res) => {
  if (!authed(req)) return res.status(403).json({ error: "Forbidden" });
  await ensureTables();
  const result = await pool.query(`SELECT count(*)::int total,
    count(*) FILTER (WHERE status='sent')::int sent,
    count(*) FILTER (WHERE status='pending')::int pending,
    count(*) FILTER (WHERE status='pending' AND attempts>0)::int retry,
    count(*) FILTER (WHERE status='failed')::int failed,
    max(sent_at) last_sent_at,max(last_attempt_at) last_attempt_at,
    COALESCE(sum(recipient_count),0)::int recipients FROM touring_alert_outbox`);
  return res.json({ ...result.rows[0], emailConfigured: Boolean(process.env.RESEND_API_KEY?.trim() && process.env.RESEND_FROM_EMAIL?.trim()),
    smsConfigured: false, unsubscribe: { supported: true, source: "newsletter_subscribers.status or account preferences" } });
});

router.post("/admin/touring/review-queue/:id", async (req, res) => {
  if (!authed(req)) return res.status(403).json({ error: "Forbidden" });
  await ensureTables();
  const status = String(req.body?.status ?? "");
  if (!["approved","rejected"].includes(status)) return res.status(400).json({ error: "Invalid review status" });
  const result = await pool.query(`UPDATE touring_review_queue SET status=$2,reviewed_at=now() WHERE id=$1 RETURNING id,status`, [req.params.id, status]);
  if (!result.rows.length) return res.status(404).json({ error: "Review item not found" });
  return res.json({ review: result.rows[0] });
});

router.post("/admin/touring/weekly-summary", async (req, res) => {
  if (!authed(req)) return res.status(403).json({ error: "Forbidden" });
  await ensureTables();
  const result = await generateAndQueueTouringWeeklySummary();
  return res.json({ ...result, deliveryConfigured: result.status !== "disabled" });
});

router.get("/account/touring/watchlist", requireClerkUser, async (_req, res) => {
  await ensureTables();
  const result = await pool.query(`SELECT artist_id,artist_name,urgent_alerts,daily_digest,
    announcement_alerts,onsale_alerts,change_alerts,created_at,updated_at FROM touring_watchlists
    WHERE clerk_user_id=$1 ORDER BY created_at DESC`, [clerkUserId(res)]);
  return res.json({ artists: result.rows });
});

router.put("/account/touring/watchlist/:artistId", requireClerkUser, async (req, res) => {
  await ensureTables();
  const artistId = String(req.params.artistId ?? "").trim().toLowerCase().slice(0, 160);
  const artistName = String(req.body?.artistName ?? "").trim().slice(0, 180);
  if (!artistId || !artistName) return res.status(400).json({ error: "Artist is required" });
  const prefs = {
    urgent: req.body?.urgentAlerts !== false, digest: req.body?.dailyDigest !== false,
    announcements: req.body?.announcementAlerts !== false, onsale: req.body?.onsaleAlerts !== false,
    changes: req.body?.changeAlerts !== false,
  };
  const result = await pool.query(`INSERT INTO touring_watchlists(clerk_user_id,artist_id,artist_name,urgent_alerts,daily_digest,announcement_alerts,onsale_alerts,change_alerts)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(clerk_user_id,artist_id) DO UPDATE SET artist_name=excluded.artist_name,
    urgent_alerts=excluded.urgent_alerts,daily_digest=excluded.daily_digest,announcement_alerts=excluded.announcement_alerts,
    onsale_alerts=excluded.onsale_alerts,change_alerts=excluded.change_alerts,updated_at=now() RETURNING *`,
    [clerkUserId(res),artistId,artistName,prefs.urgent,prefs.digest,prefs.announcements,prefs.onsale,prefs.changes]);
  return res.json({ artist: result.rows[0] });
});

router.delete("/account/touring/watchlist/:artistId", requireClerkUser, async (req, res) => {
  await ensureTables();
  await pool.query(`DELETE FROM touring_watchlists WHERE clerk_user_id=$1 AND artist_id=$2`,
    [clerkUserId(res),String(req.params.artistId ?? "").trim().toLowerCase()]);
  return res.status(204).end();
});

router.post("/admin/touring/intelligence/venues", async (req, res) => {
  if (!authed(req)) return res.status(403).json({ error: "Forbidden" });
  await ensureTables();
  const { venueId, venueName, configuration, capacityLow, capacityHigh, sourceUrl, sourceLabel, confidence, verifiedAt } = req.body ?? {};
  const verified = new Date(String(verifiedAt ?? ""));
  if (!venueId || !venueName || !configuration || !/^https:\/\//iu.test(String(sourceUrl)) || !sourceLabel || !["high","medium","limited"].includes(confidence) || !Number.isInteger(capacityLow) || !Number.isInteger(capacityHigh) || capacityLow <= 0 || capacityHigh < capacityLow || Number.isNaN(verified.getTime())) return res.status(400).json({ error: "Invalid verified venue configuration" });
  await pool.query(`INSERT INTO touring_venue_capacities(venue_id,venue_name,configuration,capacity_low,capacity_high,source_url,source_label,confidence,verified_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(venue_id) DO UPDATE SET venue_name=excluded.venue_name,
    configuration=excluded.configuration,capacity_low=excluded.capacity_low,capacity_high=excluded.capacity_high,
    source_url=excluded.source_url,source_label=excluded.source_label,confidence=excluded.confidence,verified_at=excluded.verified_at,updated_at=now()`,
    [venueId,venueName,configuration,capacityLow,capacityHigh,sourceUrl,sourceLabel,confidence,verified]);
  return res.json({ ok: true, venueId });
});

router.get("/admin/touring/intelligence/sources", async (req, res) => {
  if (!authed(req)) return res.status(403).json({ error: "Forbidden" });
  await ensureTables();
  const result = await pool.query(`SELECT id,artist_id,artist_name,source_type,source_url,status,last_checked_at,
    last_changed_at,last_error,created_at,updated_at FROM touring_announcement_sources ORDER BY artist_name,source_type`);
  return res.json({ sources: result.rows });
});

router.post("/admin/touring/intelligence/sources", async (req, res) => {
  if (!authed(req)) return res.status(403).json({ error: "Forbidden" });
  await ensureTables();
  const artistId = String(req.body?.artistId ?? "").trim().toLowerCase().slice(0,160);
  const artistName = String(req.body?.artistName ?? "").trim().slice(0,180);
  const sourceType = String(req.body?.sourceType ?? "").trim();
  const sourceUrl = String(req.body?.sourceUrl ?? "").trim();
  if (!artistId || !artistName || !["artist","promoter","venue"].includes(sourceType) || !/^https:\/\//iu.test(sourceUrl)) return res.status(400).json({ error: "Invalid authorized public source" });
  const result = await pool.query(`INSERT INTO touring_announcement_sources(artist_id,artist_name,source_type,source_url)
    VALUES($1,$2,$3,$4) ON CONFLICT(source_url) DO UPDATE SET artist_id=excluded.artist_id,artist_name=excluded.artist_name,
    source_type=excluded.source_type,status='active',updated_at=now() RETURNING id,artist_id,artist_name,source_type,source_url,status`,
    [artistId,artistName,sourceType,sourceUrl]);
  return res.json({ source: result.rows[0] });
});

export default router;
