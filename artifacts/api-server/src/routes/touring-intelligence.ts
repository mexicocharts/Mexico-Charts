import { Router } from "express";
import { pool } from "@workspace/db";
import { logger } from "../lib/logger";
import { publicTouringLab, touringShadowStatus } from "../lib/ticketmaster-touring-shadow";

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
      created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  return tablesPromise;
}

router.get("/touring/intelligence", async (_req, res) => {
  try {
    await ensureTables();
    const lab = await publicTouringLab();
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
      const estimable = Boolean(row.capacity_low && row.capacity_high && priced);
      return {
        eventId: row.event_id,
        venue: { id: row.venue_id, name: row.venue_name },
        capacity: row.capacity_low ? { low: row.capacity_low, high: row.capacity_high, configuration: row.configuration, confidence: row.confidence, sourceUrl: row.source_url } : null,
        standardPrimaryPrice: priced ? { currency: "USD", min: price!.min, max: price!.max } : null,
        estimatedGrossUsd: estimable ? { low: Math.round(row.capacity_low! * Number(price!.min)), high: Math.round(row.capacity_high! * Number(price!.max)), confidence: row.confidence === "high" ? "medium" : "limited" } : null,
      };
    });
    const tours = lab.tours.map(tour => ({ ...tour,
      demandScore: Math.min(85, 40 + Math.round(Math.log2(tour.concertCount + 1) * 11)),
      demandConfidence: lab.recentChanges.length ? "medium" : "limited",
      demandLabel: "Directional metadata estimate — not ticket sales",
    }));
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return res.json({ generatedAt: new Date().toISOString(), tours, events, recentChanges: lab.recentChanges,
      rules: { inventory: "not inferred", gross: "requires verified configuration capacity and USD standard-primary prices" } });
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
  const [shadow, sources, venues] = await Promise.all([
    touringShadowStatus(),
    pool.query(`SELECT count(*)::int total,count(*) FILTER(WHERE status='active')::int active,
      count(*) FILTER(WHERE last_error IS NOT NULL)::int errors,max(last_checked_at) latest_check FROM touring_announcement_sources`),
    pool.query(`SELECT count(*)::int verified_configurations,max(verified_at) latest_verification FROM touring_venue_capacities`),
  ]);
  return res.json({ generatedAt: new Date().toISOString(), shadow, announcementSources: sources.rows[0], venues: venues.rows[0] });
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

export default router;
