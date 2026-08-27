import { pool } from "@workspace/db";
import { logger } from "./logger";

export const PUBLIC_ESTIMATION_METHODOLOGY_VERSION = "mexico-charts-estimate-v1.0";
export const PUBLIC_ESTIMATION_LABEL = "Mexico Charts Estimate — not promoter reported";
export const NATANAEL_FIX_RATE = 16.9460;
export const NATANAEL_FIX_DATE = "2026-08-25";

type QueryClient = {
  query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) =>
    Promise<{ rows: T[]; rowCount?: number | null }>;
  release: () => void;
};

type OfferObservation = {
  category: "standard" | "promotion" | "vip_package" | "platinum" | "resale" | "locked_offer" | "fee" | "other";
  label?: string;
  minMxn?: number | null;
  maxMxn?: number | null;
  currency?: string | null;
  primaryGrossEligible?: boolean;
  observation?: string;
};

type EvidenceRecord = {
  event_id: string;
  artist_id: string;
  artist_name: string;
  tour_name: string;
  event_date: string;
  venue_name: string;
  venue_city: string | null;
  configured_capacity: number | null;
  capacity_source: string | null;
  standard_price_min: number | string | null;
  standard_price_max: number | string | null;
  standard_price_currency: string | null;
  fx_rate_mxn_per_usd: number | string | null;
  fx_rate_date: string | null;
  offer_breakdown: OfferObservation[];
  demand_signal: string | null;
  comparable_key: string | null;
  source_quality: Record<string, unknown>;
  evidence_timestamp: string;
  updated_by: string;
  override_tickets_sold: number | null;
  override_gross_usd: number | string | null;
  override_average_ticket_usd: number | string | null;
  override_confidence_percent: number | string | null;
  notes: string | null;
};

type SnapshotRecord = {
  event_id: string;
  artist_id: string;
  artist_name: string;
  tour_name: string;
  event_name: string;
  event_date: string | null;
  venue_name: string | null;
  venue_city: string | null;
  venue_id: string | null;
  event_kind: string;
  event_status: string | null;
  public_sale_start: string | null;
  price_ranges: unknown;
  seat_map_url: string | null;
  ticket_limit: string | null;
  observed_at: string;
  capacity_low: number | null;
  capacity_high: number | null;
  capacity_configuration: string | null;
  capacity_confidence: string | null;
  capacity_source_url: string | null;
};

export type PublicEstimateStatus = "estimated" | "pending";

export type PublicEstimate = {
  eventId: string;
  artistId: string;
  artistName: string;
  tourName: string;
  eventName: string;
  date: string;
  venue: string;
  city: string | null;
  status: PublicEstimateStatus;
  estimatedTicketsSold: number | null;
  estimatedGrossUsd: number | null;
  estimatedAverageTicketUsd: number | null;
  estimatedCapacityUtilization: number | null;
  confidencePercent: number | null;
  confidenceLabel: string;
  evidenceTimestamp: string | null;
  methodologyVersion: string;
  estimateLabel: string;
  lastUpdated: string;
};

export type PublicTourEstimate = {
  artistId: string;
  artistName: string;
  tourName: string;
  eventCount: number;
  estimatedTicketsSold: number | null;
  estimatedGrossUsd: number | null;
  estimatedAverageTicketUsd: number | null;
  estimatedCapacityUtilization: number | null;
  confidencePercent: number | null;
  confidenceLabel: string;
  estimatedEventCount: number;
  pendingEventCount: number;
  lastUpdated: string;
};

const NATANAEL_SEEDS: EvidenceRecord[] = [
  {
    event_id: "140064E7A6C847E4",
    artist_id: "natanael-cano",
    artist_name: "Natanael Cano",
    tour_name: "Vol. 1 Tour",
    event_date: "2026-09-18",
    venue_name: "Estadio GNP",
    venue_city: "Ciudad de México",
    configured_capacity: 62061,
    capacity_source: "Researched event-specific configured places",
    standard_price_min: 1599.50,
    standard_price_max: 1599.50,
    standard_price_currency: "MXN",
    fx_rate_mxn_per_usd: NATANAEL_FIX_RATE,
    fx_rate_date: NATANAEL_FIX_DATE,
    offer_breakdown: [
      { category: "standard", label: "General B", minMxn: 1599.50, maxMxn: 1599.50, currency: "MXN", primaryGrossEligible: true, observation: "1,356 regular plus 4 accessible facet observations." },
      { category: "vip_package", label: "Early Entry General B", minMxn: 6030, maxMxn: 6030, currency: "MXN", primaryGrossEligible: false },
      { category: "vip_package", label: "Premium General A", minMxn: 7414, maxMxn: 7414, currency: "MXN", primaryGrossEligible: false },
      { category: "other", label: "Displayed price range", minMxn: 967, maxMxn: 9958.50, currency: "MXN", primaryGrossEligible: false, observation: "Range is not used as a standard price or inventory count." },
      { category: "other", label: "Availability", observation: "Poca disponibilidad", primaryGrossEligible: false },
    ],
    demand_signal: "Standard-primary facet observation and public availability text; Discovery counts are not exact inventory.",
    comparable_key: null,
    source_quality: { capacity: "event-specific", standardPrice: "primary-facet", demand: "researched-public-observation", rawInventory: false },
    evidence_timestamp: "2026-08-25T00:00:00.000Z",
    updated_by: "approved-research-seed",
    override_tickets_sold: 58840,
    override_gross_usd: 7118000,
    override_average_ticket_usd: 120.98,
    override_confidence_percent: 76,
    notes: `Preliminary approved output. MXN conversions use Banco de México FIX ${NATANAEL_FIX_RATE.toFixed(4)} on ${NATANAEL_FIX_DATE}.`,
  },
  {
    event_id: "140064E7A9094A5C",
    artist_id: "natanael-cano",
    artist_name: "Natanael Cano",
    tour_name: "Vol. 1 Tour",
    event_date: "2026-09-19",
    venue_name: "Estadio GNP",
    venue_city: "Ciudad de México",
    configured_capacity: 62061,
    capacity_source: "Researched event-specific configured places",
    standard_price_min: 967.25,
    standard_price_max: 967.25,
    standard_price_currency: "MXN",
    fx_rate_mxn_per_usd: NATANAEL_FIX_RATE,
    fx_rate_date: NATANAEL_FIX_DATE,
    offer_breakdown: [
      { category: "standard", label: "Upper reserved", minMxn: 967.25, maxMxn: 967.25, currency: "MXN", primaryGrossEligible: true },
      { category: "promotion", label: "General B 2-for-1", minMxn: 799.75, maxMxn: 799.75, currency: "MXN", primaryGrossEligible: false, observation: "Promotion kept outside primary standard gross." },
      { category: "other", label: "Displayed price range", minMxn: 483, maxMxn: 7414, currency: "MXN", primaryGrossEligible: false, observation: "Volatile UI range, not exact inventory." },
      { category: "other", label: "Availability observations", observation: "Approximately 3,004–3,348 UI results; not exact inventory.", primaryGrossEligible: false },
    ],
    demand_signal: "Volatile public UI availability observations; result counts are explicitly non-inventory signals.",
    comparable_key: null,
    source_quality: { capacity: "event-specific", standardPrice: "primary-reserved", demand: "researched-public-observation", rawInventory: false },
    evidence_timestamp: "2026-08-25T00:00:00.000Z",
    updated_by: "approved-research-seed",
    override_tickets_sold: 56300,
    override_gross_usd: 4817000,
    override_average_ticket_usd: 85.56,
    override_confidence_percent: 61,
    notes: `Preliminary approved output. MXN conversions use Banco de México FIX ${NATANAEL_FIX_RATE.toFixed(4)} on ${NATANAEL_FIX_DATE}.`,
  },
  {
    event_id: "3D0064E988A81234",
    artist_id: "natanael-cano",
    artist_name: "Natanael Cano",
    tour_name: "Vol. 1 Tour",
    event_date: "2026-09-25",
    venue_name: "Coliseo GNP",
    venue_city: "Ciudad de México",
    configured_capacity: 21614,
    capacity_source: "Researched event-specific configured places",
    standard_price_min: 1711.25,
    standard_price_max: 2053.45,
    standard_price_currency: "MXN",
    fx_rate_mxn_per_usd: NATANAEL_FIX_RATE,
    fx_rate_date: NATANAEL_FIX_DATE,
    offer_breakdown: [
      { category: "standard", label: "General B / G-11 through G-14", minMxn: 1711.25, maxMxn: 1711.25, currency: "MXN", primaryGrossEligible: true },
      { category: "standard", label: "G-19 / G-20", minMxn: 2053.45, maxMxn: 2053.45, currency: "MXN", primaryGrossEligible: true },
      { category: "vip_package", label: "General A", minMxn: 3087.50, maxMxn: 3087.50, currency: "MXN", primaryGrossEligible: false },
      { category: "other", label: "Displayed price range", minMxn: 1711, maxMxn: 7675, currency: "MXN", primaryGrossEligible: false, observation: "Range is not used as a standard price or inventory count." },
      { category: "other", label: "Availability", observation: "23-result observation; not exact inventory.", primaryGrossEligible: false },
    ],
    demand_signal: "Public 23-result observation; treated as an availability signal, never as exact inventory.",
    comparable_key: null,
    source_quality: { capacity: "event-specific", standardPrice: "primary-facet", demand: "researched-public-observation", rawInventory: false },
    evidence_timestamp: "2026-08-25T00:00:00.000Z",
    updated_by: "approved-research-seed",
    override_tickets_sold: 20500,
    override_gross_usd: 2843000,
    override_average_ticket_usd: 138.68,
    override_confidence_percent: 67,
    notes: `Preliminary approved output. MXN conversions use Banco de México FIX ${NATANAEL_FIX_RATE.toFixed(4)} on ${NATANAEL_FIX_DATE}.`,
  },
];

const asNumber = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const confidenceLabel = (value: number | null) =>
  value == null ? "insufficient" : value >= 75 ? "high" : value >= 60 ? "medium" : "limited";

const normalizeDate = (value: unknown) => String(value ?? "").slice(0, 10);

function safeJson<T>(value: unknown, fallback: T): T {
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return (value ?? fallback) as T;
}

function categoryFor(label: string): OfferObservation["category"] {
  const value = label.toLowerCase();
  if (/vip|package|early entry|premium/iu.test(value)) return "vip_package";
  if (/platinum/iu.test(value)) return "platinum";
  if (/resale|reventa/iu.test(value)) return "resale";
  if (/locked|bloquead/iu.test(value)) return "locked_offer";
  if (/fee|cargo|processing/iu.test(value)) return "fee";
  if (/2\s*for\s*1|2x1|promo|promotion|descuento/iu.test(value)) return "promotion";
  return "standard";
}

function primarySnapshotPrice(snapshot: SnapshotRecord) {
  const ranges = safeJson<Array<{ type?: string | null; currency?: string | null; min?: number | null; max?: number | null }>>(snapshot.price_ranges, []);
  const valid = ranges
    .map((item) => ({
      ...item,
      category: categoryFor(String(item.type ?? "")),
      min: asNumber(item.min),
      max: asNumber(item.max),
    }))
    .filter((item) => item.min != null && item.max != null && item.currency && item.category === "standard");
  return valid[0] ?? null;
}

function mergeEvidence(snapshot: SnapshotRecord, evidence: EvidenceRecord | undefined) {
  const price = primarySnapshotPrice(snapshot);
  return {
    capacity: evidence?.configured_capacity ?? (
      snapshot.capacity_low != null && snapshot.capacity_high != null
        ? Math.round((snapshot.capacity_low + snapshot.capacity_high) / 2)
        : null
    ),
    capacitySource: evidence?.capacity_source ?? snapshot.capacity_source_url,
    priceMin: asNumber(evidence?.standard_price_min) ?? price?.min ?? null,
    priceMax: asNumber(evidence?.standard_price_max) ?? price?.max ?? null,
    currency: evidence?.standard_price_currency ?? price?.currency ?? null,
    fxRate: asNumber(evidence?.fx_rate_mxn_per_usd),
    demandSignal: evidence?.demand_signal ?? (
      snapshot.public_sale_start || snapshot.seat_map_url || snapshot.ticket_limit ? "Public sale or availability metadata signal; not inventory." : null
    ),
  };
}

export function evidenceGate(snapshot: SnapshotRecord, evidence?: EvidenceRecord) {
  const merged = mergeEvidence(snapshot, evidence);
  const missing: string[] = [];
  if (!snapshot.event_id || !snapshot.event_date || !snapshot.venue_name) missing.push("event identity/date/venue");
  if (merged.capacity == null || merged.capacity <= 0) missing.push("configured capacity");
  if (merged.priceMin == null || merged.priceMax == null || !merged.currency) missing.push("primary standard price signal");
  if (!merged.demandSignal && !evidence?.comparable_key) missing.push("demand/availability signal or calibrated comparable");
  if (String(merged.currency).toUpperCase() === "MXN" && merged.fxRate == null) missing.push("MXN/USD conversion rate");
  return { eligible: missing.length === 0, missing, merged };
}

function publicEstimateFromRow(row: Record<string, unknown>): PublicEstimate {
  const score = asNumber(row.confidence_percent);
  return {
    eventId: String(row.event_id),
    artistId: String(row.artist_id),
    artistName: String(row.artist_name),
    tourName: String(row.tour_name),
    eventName: String(row.event_name),
    date: normalizeDate(row.event_date),
    venue: String(row.venue_name),
    city: row.venue_city == null ? null : String(row.venue_city),
    status: row.status as PublicEstimateStatus,
    estimatedTicketsSold: asNumber(row.estimated_tickets_sold),
    estimatedGrossUsd: asNumber(row.estimated_gross_usd),
    estimatedAverageTicketUsd: asNumber(row.estimated_average_ticket_usd),
    estimatedCapacityUtilization: asNumber(row.estimated_capacity_utilization),
    confidencePercent: score,
    confidenceLabel: String(row.confidence_label ?? confidenceLabel(score)),
    evidenceTimestamp: row.evidence_timestamp ? new Date(String(row.evidence_timestamp)).toISOString() : null,
    methodologyVersion: String(row.methodology_version),
    estimateLabel: PUBLIC_ESTIMATION_LABEL,
    lastUpdated: new Date(String(row.calculated_at)).toISOString(),
  };
}

async function ensurePublicTables(client: QueryClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS touring_public_estimation_runs (
      id bigserial PRIMARY KEY,
      shadow_run_id bigint,
      trigger_reason text NOT NULL,
      status text NOT NULL CHECK (status IN ('running','complete','failed')),
      methodology_version text NOT NULL,
      source_snapshot_count integer NOT NULL DEFAULT 0,
      estimated_event_count integer NOT NULL DEFAULT 0,
      pending_event_count integer NOT NULL DEFAULT 0,
      calculated_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS touring_public_estimation_evidence (
      event_id text PRIMARY KEY,
      artist_id text NOT NULL,
      artist_name text NOT NULL,
      tour_name text NOT NULL,
      event_date date NOT NULL,
      venue_name text NOT NULL,
      venue_city text,
      configured_capacity integer,
      capacity_source text,
      standard_price_min numeric,
      standard_price_max numeric,
      standard_price_currency text,
      fx_rate_mxn_per_usd numeric,
      fx_rate_date date,
      offer_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
      demand_signal text,
      comparable_key text,
      source_quality jsonb NOT NULL DEFAULT '{}'::jsonb,
      evidence_timestamp timestamptz NOT NULL DEFAULT now(),
      updated_by text NOT NULL DEFAULT 'system',
      override_tickets_sold integer,
      override_gross_usd numeric,
      override_average_ticket_usd numeric,
      override_confidence_percent numeric,
      notes text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (configured_capacity IS NULL OR configured_capacity > 0),
      CHECK (override_tickets_sold IS NULL OR override_tickets_sold >= 0),
      CHECK (override_confidence_percent IS NULL OR (override_confidence_percent >= 0 AND override_confidence_percent <= 100))
    );
    CREATE TABLE IF NOT EXISTS touring_public_estimation_evidence_audit (
      id bigserial PRIMARY KEY,
      event_id text NOT NULL,
      action text NOT NULL,
      changed_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
      changed_by text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS touring_public_event_estimates (
      id bigserial PRIMARY KEY,
      estimation_run_id bigint NOT NULL REFERENCES touring_public_estimation_runs(id) ON DELETE RESTRICT,
      event_id text NOT NULL,
      artist_id text NOT NULL,
      artist_name text NOT NULL,
      tour_name text NOT NULL,
      event_name text NOT NULL,
      event_date date NOT NULL,
      venue_name text NOT NULL,
      venue_city text,
      status text NOT NULL CHECK (status IN ('estimated','pending')),
      estimated_tickets_sold integer,
      estimated_gross_usd numeric,
      estimated_average_ticket_usd numeric,
      estimated_capacity_utilization numeric,
      confidence_percent numeric,
      confidence_label text NOT NULL,
      evidence_timestamp timestamptz,
      methodology_version text NOT NULL,
      pending_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
      internal_uncertainty jsonb NOT NULL DEFAULT '{}'::jsonb,
      source_quality_inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
      offer_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
      source_event_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
      source_snapshot_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
      calculation_fingerprint text NOT NULL,
      calculated_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(estimation_run_id,event_id),
      CHECK (estimated_tickets_sold IS NULL OR estimated_tickets_sold >= 0),
      CHECK (estimated_gross_usd IS NULL OR estimated_gross_usd >= 0),
      CHECK (estimated_average_ticket_usd IS NULL OR estimated_average_ticket_usd >= 0),
      CHECK (estimated_capacity_utilization IS NULL OR (estimated_capacity_utilization >= 0 AND estimated_capacity_utilization <= 1)),
      CHECK (confidence_percent IS NULL OR (confidence_percent >= 0 AND confidence_percent <= 100))
    );
    CREATE TABLE IF NOT EXISTS touring_public_estimation_alerts (
      id bigserial PRIMARY KEY,
      event_id text NOT NULL,
      artist_id text NOT NULL,
      artist_name text NOT NULL,
      alert_type text NOT NULL,
      fingerprint text NOT NULL,
      previous_tickets_sold integer,
      current_tickets_sold integer,
      previous_gross_usd numeric,
      current_gross_usd numeric,
      message text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE(event_id,alert_type,fingerprint)
    );
    CREATE INDEX IF NOT EXISTS touring_public_event_estimates_lookup_idx
      ON touring_public_event_estimates(event_id,calculated_at DESC);
    CREATE INDEX IF NOT EXISTS touring_public_estimation_audit_event_idx
      ON touring_public_estimation_evidence_audit(event_id,created_at DESC);
    CREATE INDEX IF NOT EXISTS touring_public_estimation_alerts_created_idx
      ON touring_public_estimation_alerts(created_at DESC);
  `);
  for (const seed of NATANAEL_SEEDS) {
    await client.query(
      `INSERT INTO touring_public_estimation_evidence
        (event_id,artist_id,artist_name,tour_name,event_date,venue_name,venue_city,configured_capacity,capacity_source,
         standard_price_min,standard_price_max,standard_price_currency,fx_rate_mxn_per_usd,fx_rate_date,offer_breakdown,
         demand_signal,comparable_key,source_quality,evidence_timestamp,updated_by,override_tickets_sold,
         override_gross_usd,override_average_ticket_usd,override_confidence_percent,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18::jsonb,$19,$20,$21,$22,$23,$24,$25)
       ON CONFLICT(event_id) DO UPDATE SET
         artist_id=excluded.artist_id,artist_name=excluded.artist_name,tour_name=excluded.tour_name,event_date=excluded.event_date,
         venue_name=excluded.venue_name,venue_city=excluded.venue_city,configured_capacity=excluded.configured_capacity,
         capacity_source=excluded.capacity_source,standard_price_min=excluded.standard_price_min,standard_price_max=excluded.standard_price_max,
         standard_price_currency=excluded.standard_price_currency,fx_rate_mxn_per_usd=excluded.fx_rate_mxn_per_usd,fx_rate_date=excluded.fx_rate_date,
         offer_breakdown=excluded.offer_breakdown,demand_signal=excluded.demand_signal,comparable_key=excluded.comparable_key,
         source_quality=excluded.source_quality,evidence_timestamp=excluded.evidence_timestamp,override_tickets_sold=excluded.override_tickets_sold,
         override_gross_usd=excluded.override_gross_usd,override_average_ticket_usd=excluded.override_average_ticket_usd,
         override_confidence_percent=excluded.override_confidence_percent,notes=excluded.notes,updated_at=now()
      `,
      [
        seed.event_id, seed.artist_id, seed.artist_name, seed.tour_name, seed.event_date, seed.venue_name, seed.venue_city,
        seed.configured_capacity, seed.capacity_source, seed.standard_price_min, seed.standard_price_max, seed.standard_price_currency,
        seed.fx_rate_mxn_per_usd, seed.fx_rate_date, JSON.stringify(seed.offer_breakdown), seed.demand_signal, seed.comparable_key,
        JSON.stringify(seed.source_quality), seed.evidence_timestamp, seed.updated_by, seed.override_tickets_sold, seed.override_gross_usd,
        seed.override_average_ticket_usd, seed.override_confidence_percent, seed.notes,
      ],
    );
  }
}

async function latestSnapshots(client: QueryClient): Promise<SnapshotRecord[]> {
  const result = await client.query<SnapshotRecord>(`
    SELECT e.event_id,e.artist_id,e.artist_name,e.tour_name,e.event_name,e.event_date::text,e.venue_name,e.city venue_city,
      e.venue_id,e.event_kind,s.event_status,s.public_sale_start::text,s.price_ranges,s.seat_map_url,s.ticket_limit,
      s.observed_at::text,c.capacity_low,c.capacity_high,c.configuration capacity_configuration,c.confidence capacity_confidence,c.source_url capacity_source_url
    FROM touring_tm_events e
    JOIN LATERAL (
      SELECT event_status,public_sale_start,price_ranges,seat_map_url,ticket_limit,observed_at
      FROM touring_tm_snapshots WHERE event_id=e.event_id ORDER BY observed_at DESC,id DESC LIMIT 1
    ) s ON true
    LEFT JOIN touring_venue_capacities c ON c.venue_id=e.venue_id
    WHERE e.event_kind='concert' AND e.event_date IS NOT NULL
    ORDER BY e.event_date,e.artist_name,e.event_id
  `);
  return result.rows;
}

async function loadEvidence(client: QueryClient): Promise<Map<string, EvidenceRecord>> {
  const result = await client.query<EvidenceRecord>(`SELECT * FROM touring_public_estimation_evidence`);
  return new Map(result.rows.map((row) => [
    row.event_id,
    { ...row, offer_breakdown: safeJson<OfferObservation[]>(row.offer_breakdown, []), source_quality: safeJson<Record<string, unknown>>(row.source_quality, {}) },
  ]));
}

function seedSnapshot(seed: EvidenceRecord): SnapshotRecord {
  return {
    event_id: seed.event_id,
    artist_id: seed.artist_id,
    artist_name: seed.artist_name,
    tour_name: seed.tour_name,
    event_name: `${seed.artist_name} · ${seed.tour_name}`,
    event_date: seed.event_date,
    venue_name: seed.venue_name,
    venue_city: seed.venue_city,
    venue_id: null,
    event_kind: "concert",
    event_status: null,
    public_sale_start: null,
    price_ranges: [],
    seat_map_url: null,
    ticket_limit: null,
    observed_at: seed.evidence_timestamp,
    capacity_low: seed.configured_capacity,
    capacity_high: seed.configured_capacity,
    capacity_configuration: "Event-specific configured places",
    capacity_confidence: "high",
    capacity_source_url: null,
  };
}

function calculationFingerprint(snapshot: SnapshotRecord, evidence: EvidenceRecord | undefined) {
  return JSON.stringify({
    event: snapshot.event_id, date: snapshot.event_date, venue: snapshot.venue_name,
    status: snapshot.event_status, observed: snapshot.observed_at, priceRanges: snapshot.price_ranges,
    evidence: evidence ?? null,
  });
}

function calculate(snapshot: SnapshotRecord, evidence: EvidenceRecord | undefined) {
  const gate = evidenceGate(snapshot, evidence);
  if (!gate.eligible) {
    return {
      status: "pending" as const, tickets: null, gross: null, average: null, utilization: null, confidence: null,
      reasons: gate.missing, uncertainty: { status: "not-calculated", reason: "Evidence gate not satisfied." },
      quality: evidence?.source_quality ?? {}, offers: evidence?.offer_breakdown ?? [], evidenceTimestamp: evidence?.evidence_timestamp ?? null,
    };
  }

  const capacity = gate.merged.capacity!;
  const currency = String(gate.merged.currency).toUpperCase();
  const fx = currency === "MXN" ? gate.merged.fxRate! : 1;
  const standardMinUsd = gate.merged.priceMin! / fx;
  const standardMaxUsd = gate.merged.priceMax! / fx;
  const snapshotStatus = String(snapshot.event_status ?? "").toLowerCase();
  if (/cancel|postpon/iu.test(snapshotStatus)) {
    return {
      status: "estimated" as const, tickets: 0, gross: 0, average: 0, utilization: 0, confidence: Math.max(0, asNumber(evidence?.override_confidence_percent) ?? 40),
      reasons: [], uncertainty: { low: 0, central: 0, high: 0, note: "Canceled or postponed event is displayed at zero pending a new eligible observation." },
      quality: evidence?.source_quality ?? {}, offers: evidence?.offer_breakdown ?? [], evidenceTimestamp: evidence?.evidence_timestamp ?? snapshot.observed_at,
    };
  }

  const overrideTickets = evidence?.override_tickets_sold;
  const overrideGross = asNumber(evidence?.override_gross_usd);
  const overrideAverage = asNumber(evidence?.override_average_ticket_usd);
  if (overrideTickets != null && overrideGross != null && overrideAverage != null) {
    return {
      status: "estimated" as const, tickets: overrideTickets, gross: overrideGross, average: overrideAverage,
      utilization: Math.min(1, overrideTickets / capacity),
      confidence: asNumber(evidence?.override_confidence_percent) ?? 50,
      reasons: [], uncertainty: { low: Math.round(overrideTickets * 0.92), central: overrideTickets, high: Math.round(overrideTickets * 1.04), source: "manual-approved-point-estimate" },
      quality: evidence?.source_quality ?? {}, offers: evidence?.offer_breakdown ?? [], evidenceTimestamp: evidence?.evidence_timestamp ?? snapshot.observed_at,
    };
  }

  const availabilityFactor = evidence?.comparable_key ? 0.66 : 0.58;
  const tickets = Math.min(capacity, Math.round(capacity * availabilityFactor));
  const average = Number(((standardMinUsd + standardMaxUsd) / 2 * 0.70).toFixed(2));
  const gross = Math.round(tickets * average);
  const confidence = Math.min(74, 48 + (evidence?.comparable_key ? 16 : 10) + (evidence?.source_quality ? 3 : 0));
  return {
    status: "estimated" as const, tickets, gross, average, utilization: Number((tickets / capacity).toFixed(4)), confidence,
    reasons: [], uncertainty: {
      low: Math.round(tickets * 0.82), central: tickets, high: Math.min(capacity, Math.round(tickets * 1.08)),
      grossLow: Math.round(gross * 0.78), grossCentral: gross, grossHigh: Math.round(gross * 1.18),
      source: evidence?.comparable_key ? "calibrated-comparable" : "public-availability-signal",
    },
    quality: evidence?.source_quality ?? { capacity: gate.merged.capacitySource, price: currency, demand: "public-availability-signal" },
    offers: evidence?.offer_breakdown ?? [],
    evidenceTimestamp: evidence?.evidence_timestamp ?? snapshot.observed_at,
  };
}

async function createMaterialAlert(client: QueryClient, current: SnapshotRecord, calculated: ReturnType<typeof calculate>, runId: number) {
  if (calculated.status !== "estimated" || calculated.tickets == null || calculated.gross == null) return;
  const previous = await client.query<{ tickets: number | null; gross: number | null }>(`
    SELECT estimated_tickets_sold tickets,estimated_gross_usd gross FROM touring_public_event_estimates
    WHERE event_id=$1 AND estimation_run_id<>$2 AND status='estimated'
    ORDER BY calculated_at DESC LIMIT 1
  `, [current.event_id, runId]);
  const prior = previous.rows[0];
  if (!prior || prior.tickets == null || prior.gross == null) return;
  const ticketMaterial = Math.abs(calculated.tickets - Number(prior.tickets)) >= 1000 ||
    Math.abs(calculated.tickets - Number(prior.tickets)) / Math.max(1, Number(prior.tickets)) >= 0.05;
  const grossMaterial = Math.abs(calculated.gross - Number(prior.gross)) >= 25_000 ||
    Math.abs(calculated.gross - Number(prior.gross)) / Math.max(1, Number(prior.gross)) >= 0.05;
  if (!ticketMaterial && !grossMaterial) return;
  const types = [ticketMaterial ? "tickets_sold" : null, grossMaterial ? "gross_usd" : null].filter(Boolean).join("+");
  const fingerprint = `${runId}:${calculated.tickets}:${calculated.gross}`;
  await client.query(
    `INSERT INTO touring_public_estimation_alerts
      (event_id,artist_id,artist_name,alert_type,fingerprint,previous_tickets_sold,current_tickets_sold,previous_gross_usd,current_gross_usd,message)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT(event_id,alert_type,fingerprint) DO NOTHING`,
    [current.event_id, current.artist_id, current.artist_name, types, fingerprint, prior.tickets, calculated.tickets, prior.gross, calculated.gross,
      `Material Mexico Charts Estimate change for ${current.artist_name} · ${current.event_name}; not promoter reported.`],
  );
}

export async function recalculatePublicTouringEstimates(shadowRunId: string | number, reason = "canonical-snapshot") {
  const client = await pool.connect() as unknown as QueryClient;
  let runId: number | null = null;
  try {
    await ensurePublicTables(client);
    const shadow = await client.query<{ id: string }>(
      `SELECT id FROM touring_tm_shadow_runs WHERE id=$1 AND status='complete'`, [shadowRunId],
    );
    if (!shadow.rows[0]) throw new Error(`Canonical touring run ${shadowRunId} is not complete.`);
    const snapshots = await latestSnapshots(client);
    const evidence = await loadEvidence(client);
    const byId = new Map(snapshots.map((snapshot) => [snapshot.event_id, snapshot]));
    for (const seed of NATANAEL_SEEDS) if (!byId.has(seed.event_id)) byId.set(seed.event_id, seedSnapshot(seed));
    const all = [...byId.values()];
    const inserted = await client.query<{ id: number }>(
      `INSERT INTO touring_public_estimation_runs(trigger_reason,status,methodology_version,shadow_run_id,source_snapshot_count)
       VALUES($1,'running',$2,$3,$4) RETURNING id`,
      [reason, PUBLIC_ESTIMATION_METHODOLOGY_VERSION, shadowRunId, snapshots.length],
    );
    runId = Number(inserted.rows[0].id);
    let estimated = 0;
    let pending = 0;
    for (const snapshot of all) {
      const record = evidence.get(snapshot.event_id);
      const calculated = calculate(snapshot, record);
      if (calculated.status === "estimated") estimated++; else pending++;
      await client.query(
        `INSERT INTO touring_public_event_estimates
          (estimation_run_id,event_id,artist_id,artist_name,tour_name,event_name,event_date,venue_name,venue_city,status,
           estimated_tickets_sold,estimated_gross_usd,estimated_average_ticket_usd,estimated_capacity_utilization,confidence_percent,
           confidence_label,evidence_timestamp,methodology_version,pending_reasons,internal_uncertainty,source_quality_inputs,
           offer_breakdown,source_event_ids,source_snapshot_ids,calculation_fingerprint)
         VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20::jsonb,$21::jsonb,$22::jsonb,$23::jsonb,$24::jsonb,$25)`,
        [
          runId, snapshot.event_id, snapshot.artist_id, snapshot.artist_name, snapshot.tour_name, snapshot.event_name,
          snapshot.event_date, snapshot.venue_name ?? "Unknown venue", snapshot.venue_city, calculated.status,
          calculated.tickets, calculated.gross, calculated.average, calculated.utilization, calculated.confidence,
          confidenceLabel(calculated.confidence), calculated.evidenceTimestamp, PUBLIC_ESTIMATION_METHODOLOGY_VERSION,
          JSON.stringify(calculated.reasons), JSON.stringify(calculated.uncertainty), JSON.stringify(calculated.quality),
          JSON.stringify(calculated.offers), JSON.stringify([snapshot.event_id]), JSON.stringify([]), calculationFingerprint(snapshot, record),
        ],
      );
      await createMaterialAlert(client, snapshot, calculated, runId);
    }
    await client.query(
      `UPDATE touring_public_estimation_runs SET status='complete',estimated_event_count=$2,pending_event_count=$3,calculated_at=now() WHERE id=$1`,
      [runId, estimated, pending],
    );
    return { status: "complete" as const, estimationRunId: runId, sourceSnapshotCount: snapshots.length, estimatedEventCount: estimated, pendingEventCount: pending };
  } catch (error) {
    if (runId) await client.query(`UPDATE touring_public_estimation_runs SET status='failed' WHERE id=$1`, [runId]).catch(() => {});
    logger.error({ error, shadowRunId, reason }, "[touring-public-estimation] recalculation failed");
    throw error;
  } finally {
    client.release();
  }
}

async function latestCompleteReport(client: QueryClient) {
  const run = await client.query<Record<string, unknown>>(`
    SELECT id,methodology_version,calculated_at::text,source_snapshot_count,estimated_event_count,pending_event_count
    FROM touring_public_estimation_runs WHERE status='complete' ORDER BY calculated_at DESC,id DESC LIMIT 1
  `);
  if (!run.rows[0]) return null;
  const events = await client.query<Record<string, unknown>>(`
    SELECT DISTINCT ON(event_id) event_id,artist_id,artist_name,tour_name,event_name,event_date::text,venue_name,venue_city,status,
      estimated_tickets_sold,estimated_gross_usd,estimated_average_ticket_usd,estimated_capacity_utilization,confidence_percent,
      confidence_label,evidence_timestamp::text,methodology_version,calculated_at::text
    FROM touring_public_event_estimates WHERE estimation_run_id=$1
    ORDER BY event_id,id DESC
  `, [run.rows[0].id]);
  return { run: run.rows[0], events: events.rows.map(publicEstimateFromRow) };
}

function aggregateTours(events: PublicEstimate[]): PublicTourEstimate[] {
  const grouped = new Map<string, PublicEstimate[]>();
  for (const event of events) {
    const key = `${event.artistId}|${event.tourName}`;
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }
  return [...grouped.values()].map((rows) => {
    const estimatedRows = rows.filter((row) => row.status === "estimated" && row.estimatedTicketsSold != null && row.estimatedGrossUsd != null);
    const tickets = estimatedRows.reduce((sum, row) => sum + (row.estimatedTicketsSold ?? 0), 0);
    const gross = estimatedRows.reduce((sum, row) => sum + (row.estimatedGrossUsd ?? 0), 0);
    const capacityWeighted = estimatedRows.reduce((sum, row) => sum + (row.estimatedCapacityUtilization ?? 0) * (row.estimatedTicketsSold ?? 0), 0);
    const confidenceWeighted = estimatedRows.reduce((sum, row) => sum + (row.confidencePercent ?? 0) * (row.estimatedTicketsSold ?? 0), 0);
    const confidence = tickets > 0 ? Math.round(confidenceWeighted / tickets) : null;
    return {
      artistId: rows[0].artistId, artistName: rows[0].artistName, tourName: rows[0].tourName, eventCount: rows.length,
      estimatedTicketsSold: estimatedRows.length ? tickets : null,
      estimatedGrossUsd: estimatedRows.length ? gross : null,
      estimatedAverageTicketUsd: tickets ? Number((gross / tickets).toFixed(2)) : null,
      estimatedCapacityUtilization: tickets ? Number((capacityWeighted / tickets).toFixed(4)) : null,
      confidencePercent: confidence,
      confidenceLabel: confidenceLabel(confidence),
      estimatedEventCount: estimatedRows.length,
      pendingEventCount: rows.length - estimatedRows.length,
      lastUpdated: rows.reduce((latest, row) => row.lastUpdated > latest ? row.lastUpdated : latest, rows[0].lastUpdated),
    };
  }).sort((a, b) => b.estimatedGrossUsd !== null ? (a.estimatedGrossUsd === null ? -1 : b.estimatedGrossUsd! - a.estimatedGrossUsd!) : 0);
}

export async function getPublicTouringEstimationReport() {
  const client = await pool.connect() as unknown as QueryClient;
  try {
    await ensurePublicTables(client);
    let report = await latestCompleteReport(client);
    if (!report) {
      const shadow = await client.query<{ id: string }>(`SELECT id FROM touring_tm_shadow_runs WHERE status='complete' ORDER BY finished_at DESC,id DESC LIMIT 1`);
      if (shadow.rows[0]) {
        await client.release();
        await recalculatePublicTouringEstimates(shadow.rows[0].id, "public-report-bootstrap");
        return getPublicTouringEstimationReport();
      }
    }
    report ??= { run: null, events: [] };
    return {
      available: report.events.length > 0,
      label: PUBLIC_ESTIMATION_LABEL,
      methodologyVersion: String(report.run?.methodology_version ?? PUBLIC_ESTIMATION_METHODOLOGY_VERSION),
      calculatedAt: report.run?.calculated_at ?? null,
      fxReference: { currency: "MXN/USD", rate: NATANAEL_FIX_RATE, date: NATANAEL_FIX_DATE, publisher: "Banco de México FIX" },
      sourceNote: "Point estimates use public evidence and conservative modeling. They are not promoter-reported sales, inventory, attendance, sell-through, or gross.",
      events: report.events,
      tours: aggregateTours(report.events),
    };
  } finally {
    if (client) client.release();
  }
}

export async function getAdminTouringEstimationReport() {
  const client = await pool.connect() as unknown as QueryClient;
  try {
    await ensurePublicTables(client);
    const run = await client.query<Record<string, unknown>>(`
      SELECT id,trigger_reason,status,shadow_run_id,source_snapshot_count,estimated_event_count,pending_event_count,
        methodology_version,calculated_at::text FROM touring_public_estimation_runs ORDER BY calculated_at DESC,id DESC LIMIT 1
    `);
    const events = run.rows[0] ? await client.query<Record<string, unknown>>(`
      SELECT e.*,v.demand_signal,v.comparable_key,v.configured_capacity,v.capacity_source,v.offer_breakdown evidence_offer_breakdown,
        v.source_quality evidence_source_quality,v.updated_by evidence_updated_by,v.updated_at::text evidence_updated_at
      FROM touring_public_event_estimates e LEFT JOIN touring_public_estimation_evidence v ON v.event_id=e.event_id
      WHERE e.estimation_run_id=$1 ORDER BY e.artist_name,e.event_date,e.event_id
    `, [run.rows[0].id]) : { rows: [] };
    const pending = events.rows.filter((row) => row.status === "pending").map((row) => ({
      eventId: row.event_id, artistName: row.artist_name, eventName: row.event_name, date: row.event_date,
      venue: row.venue_name, missingInputs: safeJson<string[]>(row.pending_reasons, []),
    }));
    return {
      label: PUBLIC_ESTIMATION_LABEL, methodologyVersion: String(run.rows[0]?.methodology_version ?? PUBLIC_ESTIMATION_METHODOLOGY_VERSION),
      latestRun: run.rows[0] ?? null, events: events.rows, pending,
      fxReference: { currency: "MXN/USD", rate: NATANAEL_FIX_RATE, date: NATANAEL_FIX_DATE, publisher: "Banco de México FIX" },
    };
  } finally {
    client.release();
  }
}

export async function getPublicEstimateHistory(eventId: string) {
  const client = await pool.connect() as unknown as QueryClient;
  try {
    await ensurePublicTables(client);
    const result = await client.query<Record<string, unknown>>(`
      SELECT estimation_run_id,status,estimated_tickets_sold,estimated_gross_usd,estimated_average_ticket_usd,
        estimated_capacity_utilization,confidence_percent,confidence_label,evidence_timestamp::text,methodology_version,
        pending_reasons,calculated_at::text
      FROM touring_public_event_estimates WHERE event_id=$1 ORDER BY calculated_at ASC,id ASC LIMIT 500
    `, [eventId]);
    return { eventId, history: result.rows };
  } finally {
    client.release();
  }
}

export async function getPublicEstimateAlerts() {
  const client = await pool.connect() as unknown as QueryClient;
  try {
    await ensurePublicTables(client);
    const result = await client.query<Record<string, unknown>>(`SELECT * FROM touring_public_estimation_alerts ORDER BY created_at DESC LIMIT 200`);
    return { alerts: result.rows };
  } finally {
    client.release();
  }
}

export async function upsertPublicEstimationEvidence(input: {
  eventId: string; artistId: string; artistName: string; tourName: string; eventDate: string; venueName: string; venueCity?: string | null;
  configuredCapacity?: number | null; capacitySource?: string | null; standardPriceMin?: number | null; standardPriceMax?: number | null;
  standardPriceCurrency?: string | null; fxRateMxnPerUsd?: number | null; fxRateDate?: string | null; offerBreakdown?: OfferObservation[];
  demandSignal?: string | null; comparableKey?: string | null; sourceQuality?: Record<string, unknown>; evidenceTimestamp?: string;
  updatedBy: string; overrideTicketsSold?: number | null; overrideGrossUsd?: number | null; overrideAverageTicketUsd?: number | null;
  overrideConfidencePercent?: number | null; notes?: string | null;
}) {
  const client = await pool.connect() as unknown as QueryClient;
  try {
    await ensurePublicTables(client);
    const before = await client.query<Record<string, unknown>>(`SELECT * FROM touring_public_estimation_evidence WHERE event_id=$1`, [input.eventId]);
    await client.query(
      `INSERT INTO touring_public_estimation_evidence
        (event_id,artist_id,artist_name,tour_name,event_date,venue_name,venue_city,configured_capacity,capacity_source,
         standard_price_min,standard_price_max,standard_price_currency,fx_rate_mxn_per_usd,fx_rate_date,offer_breakdown,
         demand_signal,comparable_key,source_quality,evidence_timestamp,updated_by,override_tickets_sold,
         override_gross_usd,override_average_ticket_usd,override_confidence_percent,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16,$17,$18::jsonb,$19,$20,$21,$22,$23,$24,$25)
       ON CONFLICT(event_id) DO UPDATE SET artist_id=excluded.artist_id,artist_name=excluded.artist_name,tour_name=excluded.tour_name,
         event_date=excluded.event_date,venue_name=excluded.venue_name,venue_city=excluded.venue_city,configured_capacity=excluded.configured_capacity,
         capacity_source=excluded.capacity_source,standard_price_min=excluded.standard_price_min,standard_price_max=excluded.standard_price_max,
         standard_price_currency=excluded.standard_price_currency,fx_rate_mxn_per_usd=excluded.fx_rate_mxn_per_usd,fx_rate_date=excluded.fx_rate_date,
         offer_breakdown=excluded.offer_breakdown,demand_signal=excluded.demand_signal,comparable_key=excluded.comparable_key,
         source_quality=excluded.source_quality,evidence_timestamp=excluded.evidence_timestamp,updated_by=excluded.updated_by,
         override_tickets_sold=excluded.override_tickets_sold,override_gross_usd=excluded.override_gross_usd,
         override_average_ticket_usd=excluded.override_average_ticket_usd,override_confidence_percent=excluded.override_confidence_percent,
         notes=excluded.notes,updated_at=now()`,
      [
        input.eventId, input.artistId, input.artistName, input.tourName, input.eventDate, input.venueName, input.venueCity ?? null,
        input.configuredCapacity ?? null, input.capacitySource ?? null, input.standardPriceMin ?? null, input.standardPriceMax ?? null,
        input.standardPriceCurrency ?? null, input.fxRateMxnPerUsd ?? null, input.fxRateDate ?? null, JSON.stringify(input.offerBreakdown ?? []),
        input.demandSignal ?? null, input.comparableKey ?? null, JSON.stringify(input.sourceQuality ?? {}), input.evidenceTimestamp ?? new Date().toISOString(),
        input.updatedBy, input.overrideTicketsSold ?? null, input.overrideGrossUsd ?? null, input.overrideAverageTicketUsd ?? null,
        input.overrideConfidencePercent ?? null, input.notes ?? null,
      ],
    );
    const changedFields = Object.fromEntries(Object.entries(input).filter(([key]) => key !== "updatedBy").map(([key, value]) => [key, value]));
    await client.query(
      `INSERT INTO touring_public_estimation_evidence_audit(event_id,action,changed_fields,changed_by) VALUES($1,$2,$3::jsonb,$4)`,
      [input.eventId, before.rows[0] ? "update" : "create", JSON.stringify(changedFields), input.updatedBy],
    );
    return { ok: true, eventId: input.eventId, audit: { action: before.rows[0] ? "update" : "create", changedFields } };
  } finally {
    client.release();
  }
}

export async function getPublicEstimationEvidenceAudit(eventId: string) {
  const client = await pool.connect() as unknown as QueryClient;
  try {
    await ensurePublicTables(client);
    const result = await client.query<Record<string, unknown>>(
      `SELECT id,event_id,action,changed_fields,changed_by,created_at::text FROM touring_public_estimation_evidence_audit WHERE event_id=$1 ORDER BY created_at DESC LIMIT 100`,
      [eventId],
    );
    return { eventId, audit: result.rows };
  } finally {
    client.release();
  }
}