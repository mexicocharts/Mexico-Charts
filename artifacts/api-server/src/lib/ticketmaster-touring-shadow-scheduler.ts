import { pool } from "@workspace/db";
import { logger } from "./logger";
import { recalculateTicketmasterTouringEstimates } from "./ticketmaster-touring-estimation-lab";

type DbClient = {
  query: <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[]; rowCount?: number | null }>;
  release: () => void;
};

export const TICKETMASTER_TOURING_SHADOW_AUTOMATION =
  "TICKETMASTER_TOURING_SHADOW_AUTOMATION";

export const TICKETMASTER_TOURING_SHADOW_ARTISTS = [
  {
    artistKey: "fuerza-regida",
    artistName: "Fuerza Regida",
    attractionId: "K8vZ9179vO0",
    tourScope: "this-is-our-dream-second-leg-2026",
  },
  {
    artistKey: "carin-leon",
    artistName: "Carín León",
    attractionId: "K8vZ917_m_f",
    tourScope: "remaining-2026-shows",
  },
] as const;

const TICKETMASTER_API_BASE = "https://app.ticketmaster.com/discovery/v2";
const ADVISORY_LOCK_KEY = 1_873_204_911;
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const INVENTORY_CONFIDENCE = "insufficient-inventory-data";
const FUERZA_REGIDA_SECOND_LEG_START_DATE = "2026-10-03";

const ADD_ON_TERMS = [
  "parking",
  "fast lane",
  "fast-lane",
  "fastpass",
  "fast pass",
  "suite",
  "club access",
  "club-access",
  "vip lounge",
  "vip-lounge",
  "lounge access",
  "lounge-access",
  "hospitality",
  "fan experience",
  "fan-experience",
  "upgrade",
  "merchandise",
  "shuttle",
  "tailgate",
  "early entry",
  "early-entry",
  "parking pass",
  "parking-pass",
] as const;

type RawSaleWindow = {
  startDateTime?: string;
  endDateTime?: string;
  startTBD?: boolean;
  startTBA?: boolean;
  endTBD?: boolean;
  endTBA?: boolean;
};

type RawTicketmasterEvent = {
  id?: string;
  name?: string;
  url?: string;
  dates?: {
    start?: {
      localDate?: string;
      localTime?: string;
      dateTBD?: boolean;
      dateTBA?: boolean;
      noSpecificTime?: boolean;
    };
    status?: { code?: string };
  };
  sales?: { public?: RawSaleWindow };
  priceRanges?: Array<{
    min?: number;
    max?: number;
    currency?: string;
  }>;
  seatmap?: { staticUrl?: string };
  ticketLimit?: { info?: string; id?: string };
  promoter?: { id?: string; name?: string };
  classifications?: Array<{
    segment?: { name?: string };
    genre?: { name?: string };
    subGenre?: { name?: string };
  }>;
  _embedded?: {
    venues?: Array<{
      name?: string;
      type?: string;
      timezone?: string;
      city?: { name?: string };
      state?: { name?: string; stateCode?: string };
      country?: { name?: string; countryCode?: string };
      address?: { line1?: string; line2?: string };
      location?: { latitude?: string; longitude?: string };
    }>;
  };
};

type TicketmasterEventPage = {
  _embedded?: { events?: RawTicketmasterEvent[] };
  page?: {
    number?: number;
    totalPages?: number;
    totalElements?: number;
  };
};

export type TicketmasterEventClassification = "concert" | "add_on";

export interface NormalizedTicketmasterEvent {
  eventId: string;
  eventName: string;
  eventUrl: string | null;
  eventClassification: TicketmasterEventClassification;
  isTrackableConcert: boolean;
  eventDate: string;
  eventTime: string | null;
  eventDateTbd: boolean;
  eventDateTba: boolean;
  eventStatus: string | null;
  publicSaleStartAt: string | null;
  publicSaleEndAt: string | null;
  publicSaleStartTbd: boolean;
  publicSaleStartTba: boolean;
  publicSaleEndTbd: boolean;
  publicSaleEndTba: boolean;
  priceMin: number | null;
  priceMax: number | null;
  priceCurrency: string | null;
  seatmapStaticUrl: string | null;
  ticketLimit: string | null;
  promoterId: string | null;
  promoterName: string | null;
  venueName: string | null;
  venueType: string | null;
  venueTimezone: string | null;
  venueCity: string | null;
  venueState: string | null;
  venueCountry: string | null;
  venueAddress: string | null;
  venueLatitude: number | null;
  venueLongitude: number | null;
  sourceMetadata: Record<string, unknown>;
}

export interface TicketmasterTouringShadowRunSummary {
  status: "complete" | "partial" | "failed" | "locked" | "disabled";
  reason: string;
  runId: number | null;
  requestedArtists: number;
  successfulArtists: number;
  failedArtists: number;
  fetchedEvents: number;
  savedEvents: number;
  concertEvents: number;
  addOnEvents: number;
  errors: string[];
  error?: string;
}

export interface TicketmasterTouringShadowStatus {
  provider: "ticketmaster";
  enabled: boolean;
  configured: boolean;
  trackedArtists: Array<{
    artistKey: string;
    artistName: string;
    tourScope: string;
  }>;
  snapshotCount: number;
  concertSnapshotCount: number;
  addOnSnapshotCount: number;
  nextEventDate: string | null;
  daysUntilNextEvent: number | null;
  cadenceHours: 2 | 6 | 24;
  nextRunAt: string | null;
  lastRun: {
    id: number;
    status: string;
    reason: string;
    requestedArtists: number;
    successfulArtists: number;
    failedArtists: number;
    fetchedEvents: number;
    savedEvents: number;
    concertEvents: number;
    addOnEvents: number;
    error: string | null;
    startedAt: string;
    finishedAt: string | null;
  } | null;
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function finiteNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timestampOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function todayIso(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function classifyTicketmasterEvent(
  eventName: string,
  venueName = "",
): TicketmasterEventClassification {
  const searchable = normalizeText(`${eventName} ${venueName}`);
  return ADD_ON_TERMS.some(term => searchable.includes(normalizeText(term)))
    ? "add_on"
    : "concert";
}

export function isWithinTicketmasterTourScope(
  artistKey: string,
  eventName: string,
  eventDate: string,
  now = new Date(),
): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return false;
  if (!eventDate.startsWith("2026-") || eventDate < todayIso(now)) return false;

  if (artistKey === "carin-leon") return true;
  if (artistKey === "fuerza-regida") {
    const name = normalizeText(eventName);
    return eventDate >= FUERZA_REGIDA_SECOND_LEG_START_DATE
      && name.includes("this is our dream tour");
  }
  return false;
}

export function cadenceHoursForDaysUntil(daysUntil: number | null): 2 | 6 | 24 {
  if (daysUntil != null && daysUntil <= 7) return 2;
  if (daysUntil != null && daysUntil <= 30) return 6;
  return 24;
}

export function ticketmasterLockAvailable(locked: boolean | null | undefined): boolean {
  return locked === true;
}

export function ticketmasterRunStatus(
  successfulArtists: number,
  failedArtists: number,
): "complete" | "partial" | "failed" {
  if (failedArtists === 0) return "complete";
  return successfulArtists > 0 ? "partial" : "failed";
}

export function shouldRecalculateTouringEstimates(
  status: TicketmasterTouringShadowRunSummary["status"],
): boolean {
  return status === "complete";
}

export function daysUntilEvent(
  eventDate: string | null,
  now = new Date(),
): number | null {
  if (!eventDate || !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) return null;
  const today = Date.parse(`${todayIso(now)}T00:00:00.000Z`);
  const target = Date.parse(`${eventDate}T00:00:00.000Z`);
  if (!Number.isFinite(today) || !Number.isFinite(target)) return null;
  return Math.ceil((target - today) / 86_400_000);
}

export function inventorySafetyFields() {
  return {
    ticketsSold: null,
    remainingInventory: null,
    sellThroughPercent: null,
    capacity: null,
    grossAmount: null,
    inventoryDataConfidence: INVENTORY_CONFIDENCE,
  } as const;
}

export function normalizeTicketmasterEvent(
  raw: RawTicketmasterEvent,
): NormalizedTicketmasterEvent | null {
  const eventId = raw.id?.trim();
  const eventName = raw.name?.trim();
  const eventDate = raw.dates?.start?.localDate?.trim();
  if (!eventId || !eventName || !eventDate) return null;

  const venue = raw._embedded?.venues?.[0];
  const venueName = venue?.name?.trim() || null;
  const eventClassification = classifyTicketmasterEvent(eventName, venueName ?? "");
  const priceRange = raw.priceRanges?.[0];
  const classifications = raw.classifications ?? [];

  return {
    eventId,
    eventName,
    eventUrl: raw.url?.trim() || null,
    eventClassification,
    isTrackableConcert: eventClassification === "concert",
    eventDate,
    eventTime: raw.dates?.start?.localTime?.trim() || null,
    eventDateTbd: raw.dates?.start?.dateTBD === true,
    eventDateTba: raw.dates?.start?.dateTBA === true,
    eventStatus: raw.dates?.status?.code ?? null,
    publicSaleStartAt: timestampOrNull(raw.sales?.public?.startDateTime),
    publicSaleEndAt: timestampOrNull(raw.sales?.public?.endDateTime),
    publicSaleStartTbd: raw.sales?.public?.startTBD === true,
    publicSaleStartTba: raw.sales?.public?.startTBA === true,
    publicSaleEndTbd: raw.sales?.public?.endTBD === true,
    publicSaleEndTba: raw.sales?.public?.endTBA === true,
    priceMin: finiteNumber(priceRange?.min),
    priceMax: finiteNumber(priceRange?.max),
    priceCurrency: priceRange?.currency ?? null,
    seatmapStaticUrl: raw.seatmap?.staticUrl ?? null,
    ticketLimit: raw.ticketLimit?.info ?? raw.ticketLimit?.id ?? null,
    promoterId: raw.promoter?.id ?? null,
    promoterName: raw.promoter?.name ?? null,
    venueName,
    venueType: venue?.type ?? null,
    venueTimezone: venue?.timezone ?? null,
    venueCity: venue?.city?.name ?? null,
    venueState: venue?.state?.name ?? venue?.state?.stateCode ?? null,
    venueCountry: venue?.country?.name ?? venue?.country?.countryCode ?? null,
    venueAddress: [venue?.address?.line1, venue?.address?.line2]
      .filter(Boolean)
      .join(", ") || null,
    venueLatitude: finiteNumber(venue?.location?.latitude),
    venueLongitude: finiteNumber(venue?.location?.longitude),
    sourceMetadata: {
      source: "ticketmaster_discovery_api",
      classifications: classifications.map(classification => ({
        segment: classification.segment?.name ?? null,
        genre: classification.genre?.name ?? null,
        subGenre: classification.subGenre?.name ?? null,
      })),
    },
  };
}

export async function ensureTicketmasterTouringShadowTables(client: DbClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ticketmaster_touring_shadow_runs (
      id bigserial PRIMARY KEY,
      status text NOT NULL CHECK (status IN ('running','complete','partial','failed')),
      reason text NOT NULL,
      requested_artists integer NOT NULL DEFAULT 0,
      successful_artists integer NOT NULL DEFAULT 0,
      failed_artists integer NOT NULL DEFAULT 0,
      fetched_events integer NOT NULL DEFAULT 0,
      saved_events integer NOT NULL DEFAULT 0,
      concert_events integer NOT NULL DEFAULT 0,
      addon_events integer NOT NULL DEFAULT 0,
      error text,
      started_at timestamptz NOT NULL DEFAULT now(),
      finished_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS ticketmaster_touring_shadow_event_snapshots (
      id bigserial PRIMARY KEY,
      run_id bigint NOT NULL REFERENCES ticketmaster_touring_shadow_runs(id) ON DELETE RESTRICT,
      artist_key text NOT NULL,
      artist_name text NOT NULL,
      tour_scope text NOT NULL,
      event_id text NOT NULL,
      event_name text NOT NULL,
      event_url text,
      event_classification text NOT NULL CHECK (event_classification IN ('concert','add_on')),
      is_trackable_concert boolean NOT NULL,
      event_date text NOT NULL,
      event_time text,
      event_date_tbd boolean NOT NULL DEFAULT false,
      event_date_tba boolean NOT NULL DEFAULT false,
      event_status text,
      public_sale_start_at timestamptz,
      public_sale_end_at timestamptz,
      public_sale_start_tbd boolean NOT NULL DEFAULT false,
      public_sale_start_tba boolean NOT NULL DEFAULT false,
      public_sale_end_tbd boolean NOT NULL DEFAULT false,
      public_sale_end_tba boolean NOT NULL DEFAULT false,
      price_min numeric,
      price_max numeric,
      price_currency text,
      seatmap_static_url text,
      ticket_limit text,
      promoter_id text,
      promoter_name text,
      venue_name text,
      venue_type text,
      venue_timezone text,
      venue_city text,
      venue_state text,
      venue_country text,
      venue_address text,
      venue_latitude numeric,
      venue_longitude numeric,
      tickets_sold bigint,
      remaining_inventory bigint,
      sell_through_percent numeric,
      capacity bigint,
      gross_amount numeric,
      inventory_data_confidence text NOT NULL DEFAULT 'insufficient-inventory-data'
        CHECK (
          inventory_data_confidence = 'insufficient-inventory-data'
          AND tickets_sold IS NULL
          AND remaining_inventory IS NULL
          AND sell_through_percent IS NULL
          AND capacity IS NULL
          AND gross_amount IS NULL
        ),
      source_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      observed_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (run_id, event_id)
    );
  `);
  await client.query(`
    ALTER TABLE ticketmaster_touring_shadow_event_snapshots
    ADD COLUMN IF NOT EXISTS event_url text;
  `);
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ticketmaster_touring_shadow_inventory_safety_check'
      ) THEN
        ALTER TABLE ticketmaster_touring_shadow_event_snapshots
        ADD CONSTRAINT ticketmaster_touring_shadow_inventory_safety_check
        CHECK (
          inventory_data_confidence = 'insufficient-inventory-data'
          AND tickets_sold IS NULL
          AND remaining_inventory IS NULL
          AND sell_through_percent IS NULL
          AND capacity IS NULL
          AND gross_amount IS NULL
        );
      END IF;
    END $$;
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS ticketmaster_touring_shadow_runs_started_idx
    ON ticketmaster_touring_shadow_runs (started_at DESC);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS ticketmaster_touring_shadow_events_event_idx
    ON ticketmaster_touring_shadow_event_snapshots (event_id, observed_at DESC);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS ticketmaster_touring_shadow_events_date_idx
    ON ticketmaster_touring_shadow_event_snapshots (event_date, event_classification);
  `);
}

async function fetchArtistEvents(attractionId: string): Promise<RawTicketmasterEvent[]> {
  const apiKey = process.env["TICKETMASTER_API_KEY"]?.trim();
  if (!apiKey) throw new Error("Missing TICKETMASTER_API_KEY.");

  const events: RawTicketmasterEvent[] = [];
  let page = 0;
  let totalPages = 1;
  do {
    const url = new URL(`${TICKETMASTER_API_BASE}/events.json`);
    url.searchParams.set("apikey", apiKey);
    url.searchParams.set("attractionId", attractionId);
    url.searchParams.set("size", "100");
    url.searchParams.set("page", String(page));
    url.searchParams.set("sort", "date,asc");
    url.searchParams.set("startDateTime", `${todayIso()}T00:00:00Z`);

    const response = await fetch(url);
    if (!response.ok) {
      const body = (await response.text()).slice(0, 240);
      throw new Error(`Ticketmaster Discovery API ${response.status} on page ${page}: ${body}`);
    }
    const data = await response.json() as TicketmasterEventPage;
    events.push(...(data._embedded?.events ?? []));
    totalPages = Math.max(1, Number(data.page?.totalPages ?? 1));
    page += 1;
  } while (page < totalPages);
  return events;
}

async function insertSnapshot(
  client: DbClient,
  runId: number,
  artist: (typeof TICKETMASTER_TOURING_SHADOW_ARTISTS)[number],
  event: NormalizedTicketmasterEvent,
) {
  const inventory = inventorySafetyFields();
  await client.query(
    `
      INSERT INTO ticketmaster_touring_shadow_event_snapshots (
        run_id, artist_key, artist_name, tour_scope, event_id, event_name, event_url,
        event_classification, is_trackable_concert, event_date, event_time,
        event_date_tbd, event_date_tba, event_status, public_sale_start_at,
        public_sale_end_at, public_sale_start_tbd, public_sale_start_tba,
        public_sale_end_tbd, public_sale_end_tba, price_min, price_max,
        price_currency, seatmap_static_url, ticket_limit, promoter_id,
        promoter_name, venue_name, venue_type, venue_timezone, venue_city,
        venue_state, venue_country, venue_address, venue_latitude,
        venue_longitude, tickets_sold, remaining_inventory,
        sell_through_percent, capacity, gross_amount, inventory_data_confidence,
        source_metadata
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,
        $20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34,$35,$36,
        $37,$38,$39,$40,$41,$42,$43
      )
    `,
    [
      runId,
      artist.artistKey,
      artist.artistName,
      artist.tourScope,
      event.eventId,
      event.eventName,
      event.eventUrl,
      event.eventClassification,
      event.isTrackableConcert,
      event.eventDate,
      event.eventTime,
      event.eventDateTbd,
      event.eventDateTba,
      event.eventStatus,
      event.publicSaleStartAt,
      event.publicSaleEndAt,
      event.publicSaleStartTbd,
      event.publicSaleStartTba,
      event.publicSaleEndTbd,
      event.publicSaleEndTba,
      event.priceMin,
      event.priceMax,
      event.priceCurrency,
      event.seatmapStaticUrl,
      event.ticketLimit,
      event.promoterId,
      event.promoterName,
      event.venueName,
      event.venueType,
      event.venueTimezone,
      event.venueCity,
      event.venueState,
      event.venueCountry,
      event.venueAddress,
      event.venueLatitude,
      event.venueLongitude,
      inventory.ticketsSold,
      inventory.remainingInventory,
      inventory.sellThroughPercent,
      inventory.capacity,
      inventory.grossAmount,
      inventory.inventoryDataConfidence,
      JSON.stringify(event.sourceMetadata),
    ],
  );
}

async function finishRun(
  client: DbClient,
  runId: number,
  summary: TicketmasterTouringShadowRunSummary,
) {
  await client.query(
    `
      UPDATE ticketmaster_touring_shadow_runs
      SET status=$2, requested_artists=$3, successful_artists=$4,
          failed_artists=$5, fetched_events=$6, saved_events=$7,
          concert_events=$8, addon_events=$9, error=$10, finished_at=now()
      WHERE id=$1
    `,
    [
      runId,
      summary.status,
      summary.requestedArtists,
      summary.successfulArtists,
      summary.failedArtists,
      summary.fetchedEvents,
      summary.savedEvents,
      summary.concertEvents,
      summary.addOnEvents,
      summary.errors.length ? summary.errors.join(" | ") : summary.error ?? null,
    ],
  );
}

export async function runTicketmasterTouringShadow(
  reason: string,
  force = false,
): Promise<TicketmasterTouringShadowRunSummary> {
  const summary: TicketmasterTouringShadowRunSummary = {
    status: "complete",
    reason,
    runId: null,
    requestedArtists: TICKETMASTER_TOURING_SHADOW_ARTISTS.length,
    successfulArtists: 0,
    failedArtists: 0,
    fetchedEvents: 0,
    savedEvents: 0,
    concertEvents: 0,
    addOnEvents: 0,
    errors: [],
  };

  if (!force && process.env[TICKETMASTER_TOURING_SHADOW_AUTOMATION] === "false") {
    return { ...summary, status: "disabled" };
  }

  const client = await pool.connect() as unknown as DbClient;
  let lockHeld = false;
  try {
    const lock = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [ADVISORY_LOCK_KEY],
    );
    if (!ticketmasterLockAvailable(lock.rows[0]?.locked)) {
      return { ...summary, status: "locked" };
    }
    lockHeld = true;

    await ensureTicketmasterTouringShadowTables(client);
    const run = await client.query<{ id: string | number }>(
      `
        INSERT INTO ticketmaster_touring_shadow_runs
          (status, reason, requested_artists)
        VALUES ('running',$1,$2)
        RETURNING id
      `,
      [reason, summary.requestedArtists],
    );
    summary.runId = Number(run.rows[0]?.id);
    if (!Number.isFinite(summary.runId)) {
      throw new Error("Ticketmaster touring shadow run could not be created.");
    }

    if (!process.env["TICKETMASTER_API_KEY"]?.trim()) {
      summary.status = "failed";
      summary.error = "Missing TICKETMASTER_API_KEY.";
      await finishRun(client, summary.runId, summary);
      return summary;
    }

    for (const artist of TICKETMASTER_TOURING_SHADOW_ARTISTS) {
      try {
        const rawEvents = await fetchArtistEvents(artist.attractionId);
        const seen = new Set<string>();
        const normalized = rawEvents
          .map(normalizeTicketmasterEvent)
          .filter((event): event is NormalizedTicketmasterEvent => event != null)
          .filter(event => isWithinTicketmasterTourScope(
            artist.artistKey,
            event.eventName,
            event.eventDate,
          ))
          .filter(event => {
            if (seen.has(event.eventId)) return false;
            seen.add(event.eventId);
            return true;
          });

        summary.successfulArtists += 1;
        for (const event of normalized) {
          summary.fetchedEvents += 1;
          await insertSnapshot(client, summary.runId, artist, event);
          summary.savedEvents += 1;
          if (event.eventClassification === "concert") summary.concertEvents += 1;
          else summary.addOnEvents += 1;
        }
      } catch (error) {
        summary.failedArtists += 1;
        summary.errors.push(
          `${artist.artistName}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    summary.status = ticketmasterRunStatus(
      summary.successfulArtists,
      summary.failedArtists,
    );
    await finishRun(client, summary.runId, summary);
    if (shouldRecalculateTouringEstimates(summary.status)) {
      try {
        await recalculateTicketmasterTouringEstimates(summary.runId, reason);
      } catch (error) {
        logger.error(
          { error, shadowRunId: summary.runId },
          "[ticketmaster-estimation] automatic recalculation failed",
        );
      }
    }
    return summary;
  } catch (error) {
    summary.status = "failed";
    summary.error = error instanceof Error ? error.message : String(error);
    if (summary.runId) {
      await finishRun(client, summary.runId, summary).catch(() => {});
    }
    logger.error({ error, reason }, "[ticketmaster-shadow] run failed");
    return summary;
  } finally {
    if (lockHeld) {
      await client.query("SELECT pg_advisory_unlock($1)", [ADVISORY_LOCK_KEY]).catch(() => {});
    }
    client.release();
  }
}

export async function getTicketmasterTouringShadowStatus(
  now = new Date(),
): Promise<TicketmasterTouringShadowStatus> {
  const client = await pool.connect() as unknown as DbClient;
  try {
    await ensureTicketmasterTouringShadowTables(client);
    const counts = await client.query<{
        snapshot_count: number;
        concert_snapshot_count: number;
        addon_snapshot_count: number;
      }>(`
        SELECT
          count(*)::int snapshot_count,
          count(*) FILTER (WHERE event_classification='concert')::int concert_snapshot_count,
          count(*) FILTER (WHERE event_classification='add_on')::int addon_snapshot_count
        FROM ticketmaster_touring_shadow_event_snapshots
      `);
    const nextEvent = await client.query<{ event_date: string | null }>(`
        SELECT min(event_date) event_date
        FROM (
          SELECT DISTINCT ON (event_id)
            event_id, event_date, event_classification
          FROM ticketmaster_touring_shadow_event_snapshots
          ORDER BY event_id, observed_at DESC, id DESC
        ) latest
        WHERE event_classification='concert' AND event_date >= $1
      `, [todayIso(now)]);
    const latestRun = await client.query<{
        id: number;
        status: string;
        reason: string;
        requested_artists: number;
        successful_artists: number;
        failed_artists: number;
        fetched_events: number;
        saved_events: number;
        concert_events: number;
        addon_events: number;
        error: string | null;
        started_at: string;
        finished_at: string | null;
      }>(`
        SELECT id, status, reason, requested_artists, successful_artists,
          failed_artists, fetched_events, saved_events, concert_events,
          addon_events, error, started_at::text, finished_at::text
        FROM ticketmaster_touring_shadow_runs
        ORDER BY started_at DESC
        LIMIT 1
      `);

    const nextEventDate = nextEvent.rows[0]?.event_date ?? null;
    const daysUntilNextEvent = daysUntilEvent(nextEventDate, now);
    const cadenceHours = cadenceHoursForDaysUntil(daysUntilNextEvent);
    const last = latestRun.rows[0];
    const lastFinishedAt = last?.finished_at ? new Date(last.finished_at) : null;
    const nextRunAt = lastFinishedAt
      ? new Date(lastFinishedAt.getTime() + cadenceHours * 3_600_000).toISOString()
      : now.toISOString();

    return {
      provider: "ticketmaster",
      enabled: process.env[TICKETMASTER_TOURING_SHADOW_AUTOMATION] !== "false",
      configured: Boolean(process.env["TICKETMASTER_API_KEY"]?.trim()),
      trackedArtists: TICKETMASTER_TOURING_SHADOW_ARTISTS.map(artist => ({
        artistKey: artist.artistKey,
        artistName: artist.artistName,
        tourScope: artist.tourScope,
      })),
      snapshotCount: Number(counts.rows[0]?.snapshot_count ?? 0),
      concertSnapshotCount: Number(counts.rows[0]?.concert_snapshot_count ?? 0),
      addOnSnapshotCount: Number(counts.rows[0]?.addon_snapshot_count ?? 0),
      nextEventDate,
      daysUntilNextEvent,
      cadenceHours,
      nextRunAt,
      lastRun: last
        ? {
          id: Number(last.id),
          status: last.status,
          reason: last.reason,
          requestedArtists: Number(last.requested_artists),
          successfulArtists: Number(last.successful_artists),
          failedArtists: Number(last.failed_artists),
          fetchedEvents: Number(last.fetched_events),
          savedEvents: Number(last.saved_events),
          concertEvents: Number(last.concert_events),
          addOnEvents: Number(last.addon_events),
          error: last.error,
          startedAt: new Date(last.started_at).toISOString(),
          finishedAt: last.finished_at ? new Date(last.finished_at).toISOString() : null,
        }
        : null,
    };
  } finally {
    client.release();
  }
}

async function shouldRunScheduled(now = new Date()): Promise<boolean> {
  const status = await getTicketmasterTouringShadowStatus(now);
  return status.enabled && (!status.nextRunAt || now >= new Date(status.nextRunAt));
}

let schedulerStarted = false;

export function startTicketmasterTouringShadowScheduler() {
  if (schedulerStarted) return;
  schedulerStarted = true;
  if (process.env[TICKETMASTER_TOURING_SHADOW_AUTOMATION] === "false") {
    logger.info(
      `[ticketmaster-shadow] disabled by ${TICKETMASTER_TOURING_SHADOW_AUTOMATION}=false`,
    );
    return;
  }

  const check = async (reason: string) => {
    try {
      if (!(await shouldRunScheduled())) return;
      const summary = await runTicketmasterTouringShadow(reason);
      logger.info(
        {
          status: summary.status,
          runId: summary.runId,
          savedEvents: summary.savedEvents,
          failedArtists: summary.failedArtists,
        },
        "[ticketmaster-shadow] scheduled run finished",
      );
    } catch (error) {
      logger.error({ error }, "[ticketmaster-shadow] scheduler check failed");
    }
  };

  setTimeout(() => void check("startup"), 30_000).unref();
  setInterval(() => void check("five-minute-check"), CHECK_INTERVAL_MS).unref();
  logger.info(
    { checkIntervalMinutes: 5, trackedArtists: TICKETMASTER_TOURING_SHADOW_ARTISTS.length },
    "[ticketmaster-shadow] private automation enabled",
  );
}