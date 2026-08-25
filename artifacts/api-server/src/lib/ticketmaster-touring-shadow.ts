import { pool } from "@workspace/db";
import { logger } from "./logger";

const API = "https://app.ticketmaster.com/discovery/v2/events.json";
const LOCK_KEY = 741_926_305;
const CHECK_MS = 15 * 60 * 1000;
const TOURS = [
  { artistId: "fuerza-regida", artistName: "Fuerza Regida", attractionId: "K8vZ9179vO0", tourName: "This Is Our Dream Tour 2026 — second leg", notBefore: "2026-10-03", pattern: /Fuerza Regida.*This Is Our Dream Tour 2026/iu },
  { artistId: "carin-leon", artistName: "Carín León", attractionId: "K8vZ917_m_f", tourName: "2026 remaining shows", notBefore: "2026-09-04", pattern: /Car[ií]n Le[oó]n|Carin Leon/iu },
  { artistId: "natanael-cano", artistName: "Natanael Cano", attractionId: "K8vZfZ7aEdk", tourName: "Vol. 1 Tour", notBefore: "2026-09-18", pattern: /Natanael Cano.*Vol\.?\s*1 Tour/iu },
  { artistId: "yuridia", artistName: "Yuridia", attractionId: "K8vZ917Gdu7", tourName: "Las Cartas Sobre La Mesa Tour", notBefore: "2026-09-03", pattern: /Yuridia|Las Cartas Sobre La Mesa/iu },
  { artistId: "eslabon-armado", artistName: "Eslabon Armado", attractionId: "K8vZ917_Wef", tourName: "Amor Nocturno Tour", notBefore: "2026-08-25", pattern: /Eslab[oó]n Armado|Amor Nocturno/iu },
  { artistId: "banda-ms", artistName: "Banda MS", attractionId: "K8vZ917CCl7", tourName: "Somos MS Tour", notBefore: "2026-08-25", pattern: /Banda MS|Somos MS/iu },
  { artistId: "los-tigres-del-norte", artistName: "Los Tigres del Norte", attractionId: "K8vZ9171187", tourName: "Los Tigres del Mundo / La Lotería", notBefore: "2026-08-25", pattern: /Los Tigres del Norte|Los Tigres Del Mundo|La Loter[ií]a/iu },
  { artistId: "xavi", artistName: "Xavi", attractionId: "K8vZ917_Jlf", tourName: "Priority announcement watch", notBefore: "2026-08-25", pattern: /^Xavi\b|\bXavi$/iu },
  { artistId: "jorge-medina", artistName: "Jorge Medina", attractionId: "K8vZ917_9pf", tourName: "Juntos", notBefore: "2026-08-25", pattern: /Jorge Medina|Josi Cuen|Juntos/iu },
  { artistId: "josi-cuen", artistName: "Josi Cuen", attractionId: "K8vZ917qDTV", tourName: "Juntos", notBefore: "2026-08-25", pattern: /Jorge Medina|Josi Cuen|Juntos/iu },
] as const;

interface TmEvent {
  id: string; name?: string; url?: string; locale?: string; source?: { name?: string };
  dates?: { start?: { localDate?: string; localTime?: string; dateTime?: string }; status?: { code?: string }; timezone?: string };
  sales?: { public?: { startDateTime?: string; endDateTime?: string }; presales?: unknown[] };
  priceRanges?: unknown[]; seatmap?: { staticUrl?: string }; ticketLimit?: { info?: string };
  promoter?: { id?: string; name?: string };
  _embedded?: { venues?: { id?: string; name?: string; city?: { name?: string }; state?: { stateCode?: string; name?: string }; country?: { countryCode?: string }; postalCode?: string }[] };
}

export interface TouringShadowSummary {
  status: "complete" | "partial" | "failed" | "locked" | "not_due" | "disabled";
  startedAt: string; finishedAt?: string; fetchedArtists: number; failedArtists: number;
  eventsObserved: number; snapshotsSaved: number; errors: string[];
}

let started = false;
let running = false;
let processLastResult: TouringShadowSummary | null = null;
const enabled = () => process.env["TOURING_SHADOW_AUTOMATION_DISABLED"] !== "true";
const kind = (name: string) => /suite reservation|parking|fast lane|club access|lounge|not a concert ticket/iu.test(name) ? "auxiliary" : "concert";
const cadenceHours = (days: number | null, saleHours: number | null) =>
  saleHours != null && saleHours <= 2 ? 0.25
    : saleHours != null && saleHours <= 24 ? 1
      : days != null && days <= 7 ? 1
        : 6;
const bucket = (hours: number) => new Date(Math.floor(Date.now() / (hours * 3_600_000)) * hours * 3_600_000);

export async function ensureTouringShadowTables() {
  await pool.query(`CREATE TABLE IF NOT EXISTS touring_tm_events (
    event_id text PRIMARY KEY, artist_id text NOT NULL, artist_name text NOT NULL, attraction_id text NOT NULL,
    tour_name text NOT NULL, event_name text NOT NULL, event_kind text NOT NULL CHECK(event_kind IN ('concert','auxiliary')),
    event_date date, local_time text, event_datetime timestamptz, timezone text, venue_id text, venue_name text,
    city text, state text, country text, postal_code text, ticket_url text,
    first_seen_at timestamptz NOT NULL DEFAULT now(), last_seen_at timestamptz NOT NULL DEFAULT now())`);
  await pool.query(`CREATE TABLE IF NOT EXISTS touring_tm_snapshots (
    id bigserial PRIMARY KEY, event_id text NOT NULL REFERENCES touring_tm_events(event_id) ON DELETE cascade,
    bucket_start timestamptz NOT NULL, observed_at timestamptz NOT NULL DEFAULT now(), source text NOT NULL DEFAULT 'ticketmaster_discovery_v2',
    event_status text, ticketing_source text, locale text, public_sale_start timestamptz, public_sale_end timestamptz,
    presales jsonb NOT NULL DEFAULT '[]'::jsonb, price_ranges jsonb NOT NULL DEFAULT '[]'::jsonb,
    seat_map_url text, ticket_limit text, promoter_id text, promoter_name text,
    available_inventory integer, allocated_inventory integer, estimated_tickets_sold integer,
    estimated_sell_through numeric(7,4), estimated_gross numeric(16,2),
    estimate_confidence text NOT NULL DEFAULT 'insufficient_inventory_data',
    estimate_note text NOT NULL DEFAULT 'Discovery metadata is not a ticket-count inventory feed.', UNIQUE(event_id,bucket_start))`);
  await pool.query(`CREATE TABLE IF NOT EXISTS touring_tm_shadow_runs (
    id bigserial PRIMARY KEY, status text NOT NULL, fetched_artists integer NOT NULL DEFAULT 0,
    failed_artists integer NOT NULL DEFAULT 0, events_observed integer NOT NULL DEFAULT 0,
    snapshots_saved integer NOT NULL DEFAULT 0, errors jsonb NOT NULL DEFAULT '[]'::jsonb,
    started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz)`);
  await pool.query("CREATE INDEX IF NOT EXISTS touring_tm_snapshots_event_time_idx ON touring_tm_snapshots(event_id,observed_at DESC)");
  await pool.query("CREATE INDEX IF NOT EXISTS touring_tm_events_date_idx ON touring_tm_events(event_date)");
}

async function state() {
  await ensureTouringShadowTables();
  const result = await pool.query<{ last_at: Date | null; days: number | null; sale_hours: number | null }>(`SELECT
    (SELECT max(finished_at) FROM touring_tm_shadow_runs WHERE status IN ('complete','partial')) last_at,
    (SELECT min(event_date-current_date)::int FROM touring_tm_events WHERE event_date>=current_date AND event_kind='concert') days,
    (SELECT min(extract(epoch FROM (public_sale_start-now()))/3600)
      FROM touring_tm_snapshots WHERE public_sale_start>=now()) sale_hours`);
  return result.rows[0] ?? { last_at: null, days: null, sale_hours: null };
}

async function fetchTour(tour: typeof TOURS[number], key: string) {
  const url = new URL(API);
  for (const [name, value] of Object.entries({ apikey: key, attractionId: tour.attractionId, size: "200", sort: "date,asc", startDateTime: `${tour.notBefore}T00:00:00Z` })) url.searchParams.set(name, value);
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Discovery HTTP ${response.status}`);
  const json = await response.json() as { _embedded?: { events?: TmEvent[] } };
  return (json._embedded?.events ?? []).filter(event => tour.pattern.test(event.name ?? ""));
}

async function save(tour: typeof TOURS[number], event: TmEvent, at: Date) {
  const venue = event._embedded?.venues?.[0] ?? {};
  const name = event.name ?? "";
  await pool.query(`INSERT INTO touring_tm_events(event_id,artist_id,artist_name,attraction_id,tour_name,event_name,event_kind,event_date,local_time,event_datetime,timezone,venue_id,venue_name,city,state,country,postal_code,ticket_url)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    ON CONFLICT(event_id) DO UPDATE SET event_name=excluded.event_name,event_kind=excluded.event_kind,event_date=excluded.event_date,
    local_time=excluded.local_time,event_datetime=excluded.event_datetime,timezone=excluded.timezone,venue_id=excluded.venue_id,
    venue_name=excluded.venue_name,city=excluded.city,state=excluded.state,country=excluded.country,postal_code=excluded.postal_code,
    ticket_url=excluded.ticket_url,last_seen_at=now()`, [event.id,tour.artistId,tour.artistName,tour.attractionId,tour.tourName,name,kind(name),event.dates?.start?.localDate??null,event.dates?.start?.localTime??null,event.dates?.start?.dateTime??null,event.dates?.timezone??null,venue.id??null,venue.name??null,venue.city?.name??null,venue.state?.stateCode??venue.state?.name??null,venue.country?.countryCode??null,venue.postalCode??null,event.url??null]);
  const inserted = await pool.query(`INSERT INTO touring_tm_snapshots(event_id,bucket_start,event_status,ticketing_source,locale,public_sale_start,public_sale_end,presales,price_ranges,seat_map_url,ticket_limit,promoter_id,promoter_name)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$13) ON CONFLICT(event_id,bucket_start) DO NOTHING RETURNING id`, [event.id,at,event.dates?.status?.code??null,event.source?.name??null,event.locale??null,event.sales?.public?.startDateTime??null,event.sales?.public?.endDateTime??null,JSON.stringify(event.sales?.presales??[]),JSON.stringify(event.priceRanges??[]),event.seatmap?.staticUrl??null,event.ticketLimit?.info??null,event.promoter?.id??null,event.promoter?.name??null]);
  return inserted.rows.length;
}

export async function runTouringShadow(options: { force?: boolean } = {}): Promise<TouringShadowSummary> {
  const startedAt = new Date().toISOString();
  const base = { startedAt, fetchedArtists: 0, failedArtists: 0, eventsObserved: 0, snapshotsSaved: 0, errors: [] as string[] };
  if (!enabled() && !options.force) return { status: "disabled", ...base };
  const key = process.env["TICKETMASTER_API_KEY"]?.trim();
  if (!key) return { status: "failed", ...base, errors: ["TICKETMASTER_API_KEY is not configured"] };
  const current = await state();
  const cadence = cadenceHours(current.days, current.sale_hours);
  if (!options.force && current.last_at && Date.now()-new Date(current.last_at).getTime() < cadence*3_600_000) return { status: "not_due", ...base };
  const client = await pool.connect();
  let locked = false;
  let runId: string | null = null;
  try {
    const lock = await client.query<{ locked: boolean }>("SELECT pg_try_advisory_lock($1) locked", [LOCK_KEY]);
    locked = lock.rows[0]?.locked === true;
    if (!locked) return { status: "locked", ...base };
    running = true;
    const row = await pool.query<{ id: string }>("INSERT INTO touring_tm_shadow_runs(status) VALUES('running') RETURNING id");
    runId = row.rows[0]?.id ?? null;
    const errors: string[] = [];
    let fetchedArtists=0, failedArtists=0, eventsObserved=0, snapshotsSaved=0;
    const at = bucket(cadence);
    for (const tour of TOURS) try {
      const events = await fetchTour(tour,key); fetchedArtists++; eventsObserved += events.length;
      for (const event of events) snapshotsSaved += await save(tour,event,at);
    } catch (error) { failedArtists++; errors.push(`${tour.artistName}: ${error instanceof Error ? error.message : String(error)}`); }
    const status = failedArtists===0 ? "complete" : fetchedArtists>0 ? "partial" : "failed";
    const summary: TouringShadowSummary = { status,startedAt,finishedAt:new Date().toISOString(),fetchedArtists,failedArtists,eventsObserved,snapshotsSaved,errors };
    await pool.query("UPDATE touring_tm_shadow_runs SET status=$2,fetched_artists=$3,failed_artists=$4,events_observed=$5,snapshots_saved=$6,errors=$7::jsonb,finished_at=now() WHERE id=$1", [runId,status,fetchedArtists,failedArtists,eventsObserved,snapshotsSaved,JSON.stringify(errors)]);
    processLastResult=summary; return summary;
  } catch (error) {
    const message=error instanceof Error?error.message:String(error);
    if(runId) await pool.query("UPDATE touring_tm_shadow_runs SET status='failed',errors=$2::jsonb,finished_at=now() WHERE id=$1",[runId,JSON.stringify([message])]).catch(()=>undefined);
    const summary: TouringShadowSummary={status:"failed",...base,finishedAt:new Date().toISOString(),errors:[message]}; processLastResult=summary; return summary;
  } finally { running=false; if(locked) await client.query("SELECT pg_advisory_unlock($1)",[LOCK_KEY]).catch(()=>undefined); client.release(); }
}

export async function touringShadowStatus() {
  await ensureTouringShadowTables();
  const [counts,runs]=await Promise.all([
    pool.query(`SELECT (SELECT count(*)::int FROM touring_tm_events) events,(SELECT count(*)::int FROM touring_tm_events WHERE event_kind='concert') concert_events,(SELECT count(*)::int FROM touring_tm_snapshots) snapshots,(SELECT max(observed_at) FROM touring_tm_snapshots) latest_observation`),
    pool.query("SELECT * FROM touring_tm_shadow_runs ORDER BY started_at DESC LIMIT 10")]);
  return {enabled:enabled(),configured:Boolean(process.env["TICKETMASTER_API_KEY"]),running,trackedTours:TOURS.map(({pattern,...tour})=>tour),counts:counts.rows[0],latestRuns:runs.rows,processLastResult};
}

type LabSnapshot = {
  event_id: string; artist_id: string; artist_name: string; tour_name: string; event_name: string;
  event_date: string | Date | null; venue_name: string | null; city: string | null; state: string | null;
  first_seen_at: Date; last_seen_at: Date; observed_at: Date; event_status: string | null;
  public_sale_start: Date | null; price_ranges: unknown; previous_status: string | null;
  previous_public_sale_start: Date | null; previous_price_ranges: unknown;
};

export async function publicTouringLab() {
  await ensureTouringShadowTables();
  const result = await pool.query<LabSnapshot>(`WITH observations AS (
    SELECT e.event_id,e.artist_id,e.artist_name,e.tour_name,e.event_name,e.event_date,e.venue_name,e.city,e.state,
      e.first_seen_at,e.last_seen_at,s.observed_at,s.event_status,s.public_sale_start,s.price_ranges,
      lag(s.event_status) OVER (PARTITION BY s.event_id ORDER BY s.observed_at) previous_status,
      lag(s.public_sale_start) OVER (PARTITION BY s.event_id ORDER BY s.observed_at) previous_public_sale_start,
      lag(s.price_ranges) OVER (PARTITION BY s.event_id ORDER BY s.observed_at) previous_price_ranges,
      row_number() OVER (PARTITION BY s.event_id ORDER BY s.observed_at DESC) latest
    FROM touring_tm_events e JOIN touring_tm_snapshots s ON s.event_id=e.event_id
    WHERE e.event_kind='concert'
  ) SELECT * FROM observations WHERE latest=1 ORDER BY event_date,event_id`);
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const groups = new Map<string, LabSnapshot[]>();
  for (const row of result.rows) groups.set(row.artist_id, [...(groups.get(row.artist_id) ?? []), row]);
  const isoDate = (value: string | Date | null) => value instanceof Date ? value.toISOString().slice(0, 10) : value ? String(value).slice(0, 10) : null;
  const changedFields = (row: LabSnapshot) => [
    row.previous_status !== null && row.previous_status !== row.event_status ? "eventStatus" : null,
    row.previous_public_sale_start !== null && String(row.previous_public_sale_start) !== String(row.public_sale_start) ? "publicSaleStart" : null,
    row.previous_price_ranges !== null && JSON.stringify(row.previous_price_ranges) !== JSON.stringify(row.price_ranges) ? "priceRanges" : null,
  ].filter((field): field is string => Boolean(field));
  const recentChanges = result.rows.flatMap(row => {
    const fields = changedFields(row);
    return fields.length ? [{ eventId: row.event_id, artistName: row.artist_name, eventName: row.event_name, observedAt: row.observed_at, changedFields: fields }] : [];
  }).sort((a,b) => b.observedAt.getTime()-a.observedAt.getTime()).slice(0,12);
  const tours = [...groups.entries()].map(([artistId, rows]) => {
    const dates = rows.map(row => isoDate(row.event_date)).filter((date): date is string => Boolean(date)).sort();
    const future = dates.filter(date => date >= today);
    const past = dates.filter(date => date < today);
    return {
      artistId, artistName: rows[0]?.artist_name ?? artistId, tourName: rows[0]?.tour_name ?? "",
      status: future.length ? (past.length ? "active" : "upcoming") : (past.length ? "completed" : "unknown"),
      concertCount: rows.length, firstConcertDate: dates[0] ?? null, lastConcertDate: dates.at(-1) ?? null,
      nextConcertDate: future[0] ?? null, lastObservedAt: rows.reduce((latest,row) => row.observed_at > latest ? row.observed_at : latest, rows[0]!.observed_at),
      demandScore: null, demandConfidence: "unavailable" as const,
      demandLabel: "Datos autorizados insuficientes para calcular demanda",
    };
  });
  return {
    available: tours.length > 0,
    label: "Touring Lab — experimental",
    generatedAt: now,
    source: "Ticketmaster Discovery API",
    sourceNote: "Metadatos públicos; no es un feed de inventario ni ventas.",
    demandScore: null,
    demandConfidence: "unavailable",
    methodology: "Los cambios observados describen metadatos públicos. No se infieren boletos vendidos, inventario, sell-through ni gross.",
    tours,
    recentChanges,
  };
}

async function check(){try{const result=await runTouringShadow();if(!["not_due","locked"].includes(result.status))logger.info({result},"[touring-shadow] check finished");}catch(error){logger.error({error},"[touring-shadow] scheduler failed");}}
export function startTouringShadowScheduler(){if(started||!enabled())return;if(!process.env["TICKETMASTER_API_KEY"]){logger.warn("[touring-shadow] missing TICKETMASTER_API_KEY");return;}started=true;logger.info("[touring-shadow] scheduler started");setTimeout(()=>void check(),15_000);const timer=setInterval(()=>void check(),CHECK_MS);timer.unref();}
