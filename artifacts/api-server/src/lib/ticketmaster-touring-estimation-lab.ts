import { pool } from "@workspace/db";
import { logger } from "./logger";

type DbClient = {
  query: <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[]; rowCount?: number | null }>;
  release: () => void;
};

export const ESTIMATION_MODEL_VERSION = "ticketmaster-estimation-v0.1";
export const ESTIMATION_METHODOLOGY_VERSION = "ticketmaster-estimation-methodology-v0.1";
export const ESTIMATION_DISCLAIMER =
  "Current tickets moved are model forecasts, not measured Ticketmaster inventory.";

type Snapshot = {
  id: number;
  run_id: number;
  artist_key: string;
  artist_name: string;
  event_id: string;
  event_name: string;
  event_url: string | null;
  event_date: string;
  event_time: string | null;
  event_status: string | null;
  public_sale_start_at: string | null;
  price_min: number | string | null;
  price_max: number | string | null;
  price_currency: string | null;
  venue_name: string | null;
  venue_type: string | null;
  venue_city: string | null;
  venue_country: string | null;
  venue_timezone: string | null;
  observed_at: string;
};

type CapacityProfile = {
  venueKey: string;
  venueName: string;
  normalizedVenue: string;
  venueType: string;
  capacityLow: number;
  capacityCentral: number;
  capacityHigh: number;
  citationKeys: string[];
  notes: string;
};

type Prior = {
  prior_key: string;
  artist_key: string;
  venue_type: string;
  tickets_total: number;
  gross_usd_total: number;
  show_count: number;
  citation_keys: string[];
};

export type EstimateRange = { low: number; central: number; high: number };

export type ConsolidatedEvent = {
  key: string;
  representative: Snapshot;
  snapshots: Snapshot[];
  sourceEventIds: string[];
  sourceSnapshotIds: number[];
  sourceRunIds: number[];
  normalizedVenue: string;
};

const todayIso = (now = new Date()) => now.toISOString().slice(0, 10);
const asNumber = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

export function normalizeEstimationVenue(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function range(low: number, central: number, high: number): EstimateRange {
  return {
    low: Math.max(0, Math.round(Math.min(low, central, high))),
    central: Math.max(0, Math.round(central)),
    high: Math.max(0, Math.round(Math.max(low, central, high))),
  };
}

export function consolidateEstimationEvents(snapshots: Snapshot[]): ConsolidatedEvent[] {
  const groups = new Map<string, Snapshot[]>();
  for (const snapshot of snapshots) {
    const normalizedVenue = normalizeEstimationVenue(snapshot.venue_name);
    const key = `${snapshot.artist_key}|${snapshot.event_date}|${normalizedVenue || "unknown-venue"}`;
    const group = groups.get(key) ?? [];
    group.push(snapshot);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, group]) => {
    const ordered = [...group].sort((a, b) =>
      new Date(b.observed_at).getTime() - new Date(a.observed_at).getTime() || b.id - a.id);
    return {
      key,
      representative: ordered[0],
      snapshots: ordered,
      sourceEventIds: [...new Set(group.map(snapshot => snapshot.event_id))].sort(),
      sourceSnapshotIds: [...new Set(group.map(snapshot => Number(snapshot.id)))].sort((a, b) => a - b),
      sourceRunIds: [...new Set(group.map(snapshot => Number(snapshot.run_id)))].sort((a, b) => a - b),
      normalizedVenue: normalizeEstimationVenue(ordered[0].venue_name) || "unknown-venue",
    };
  }).sort((a, b) =>
    a.representative.artist_name.localeCompare(b.representative.artist_name) ||
    a.representative.event_date.localeCompare(b.representative.event_date) ||
    a.normalizedVenue.localeCompare(b.normalizedVenue));
}

const CITATIONS = [
  ["ticketmaster-discovery-api", "Ticketmaster Discovery API v2", "Ticketmaster Developer Portal", "https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/", "Authorized event, dates, sale, price, venue, promoter, seat-map, and classification fields only."],
  ["sphere-venue", "Sphere venue information", "Sphere", "https://www.thespherevegas.com/venue", "17,600 seats and up to 20,000 guests."],
  ["bmo-venue", "BMO Stadium venue information", "BMO Stadium", "https://bmostadium.com/about/", "Up to 24,000 for concerts."],
  ["save-mart-venue", "Save Mart Center venue information", "Save Mart Center", "https://www.savemartcenter.com/arena-information/", "Approximately 8,000 half-house, 15,500 end-stage, and 18,000 center-stage."],
  ["pechanga-venue", "Pechanga Arena venue information", "Pechanga Arena San Diego", "https://www.pechangaarenasd.com/arena-info", "8,900–14,800 for arena concerts; official general capacity 14,000."],
  ["desert-diamond-venue", "Desert Diamond Arena venue information", "Desert Diamond Arena", "https://www.desertdiamondarena.com/arena-info", "Approximately 19,000 for concerts and up to 20,000."],
  ["toyota-arena-venue", "Toyota Arena venue information", "Toyota Arena", "https://www.toyota-arena.com/arena-info", "Over 11,000."],
  ["golden1-venue", "Golden 1 Center venue information", "Golden 1 Center", "https://www.golden1center.com/arena-info", "Highest concert configuration 17,902."],
  ["ball-venue", "Ball Arena venue information", "Ball Arena", "https://www.ballarena.com/arena-information/", "Up to 20,000 for concerts."],
  ["climate-pledge-venue", "Climate Pledge Arena venue information", "Climate Pledge Arena", "https://climatepledgearena.com/arena-information/", "Up to 17,200 for concerts."],
  ["credit-union-1-venue", "Credit Union 1 Amphitheatre venue information", "Credit Union 1 Amphitheatre", "https://www.creditunion1arena.com/venue-info", "Up to 28,000."],
  ["truliant-venue", "Truliant Amphitheater venue information", "Truliant Amphitheater", "https://www.truliantamphitheatre.com/venue-info", "Up to 18,000."],
  ["coca-cola-birmingham-venue", "Coca-Cola Amphitheater Birmingham venue information", "Coca-Cola Amphitheater", "https://www.cocacolabirmingham.com/venue-info", "9,300."],
  ["first-financial-venue", "First Financial Credit Union Amphitheater venue information", "First Financial Credit Union Amphitheater", "https://www.firstfinancialcuamp.com/venue-info", "15,000."],
  ["toyota-amphitheatre-venue", "Toyota Amphitheatre venue information", "Toyota Amphitheatre", "https://www.livenation.com/venue/KovZpZAEkFlA/toyota-amphitheatre-events", "18,500."],
  ["dignity-health-venue", "Dignity Health Arena venue information", "Dignity Health Arena", "https://www.dignityhealtharena.com/venue-info", "Roughly 6,400 half-house to 10,225 end/center stage."],
  ["maverik-venue", "Maverik Center venue information", "Maverik Center", "https://www.maverikcenter.com/venue-info/", "Up to 12,000."],
  ["red-rocks-venue", "Red Rocks venue information", "Red Rocks Amphitheatre", "https://www.redrocksonline.com/plan-your-visit/venue-information/", "9,525."],
  ["artist-priors-2024", "Reported 2024 artist box-office totals", "Billboard reported totals", "https://www.billboard.com/pro/touring-data-2024-year-end-boxscore/", "Calibration evidence only: Carín León approximately $36.3M / 259,000 tickets / 25 US shows; Fuerza Regida approximately $67.4M / 501,000 tickets / 39 US shows."],
  ["fuerza-bmo-2023", "Fuerza Regida BMO Stadium 2023 result", "Billboard Boxscore", "https://www.billboard.com/pro/fuerza-regida-this-is-our-dream-tour-boxscore/", "Calibration evidence only: 22,392 tickets and $3,681,730."],
  ["fuerza-stadium-2026", "Fuerza Regida first 2026 stadium leg", "Reported box-office results", "https://www.billboard.com/pro/fuerza-regida-stadium-tour-boxscore-2026/", "Calibration evidence only: 330,228 tickets and $47,198,246 across eight sold-out shows; Dodger Stadium 49,784 tickets and $9,237,664."],
  ["conservative-fallback", "Conservative fallback profile", "Mexico Charts methodology", null, "Broad unrecognized-venue range; not a measured venue capacity."],
] as const;

const VENUES: Array<[string, string, string, string, number, number, number, string[], string]> = [
  ["sphere", "Sphere", "sphere", "arena-residency", 17600, 18800, 20000, ["sphere-venue"], "17,600 seats to 20,000 guests; residency linkage is applied separately."],
  ["bmo-stadium", "BMO Stadium", "bmo stadium", "stadium", 18000, 22000, 24000, ["bmo-venue"], "Concert configuration varies with staging."],
  ["save-mart-center", "Save Mart Center", "save mart center", "arena", 8000, 15500, 18000, ["save-mart-venue"], "Half-house, end-stage, and center-stage configurations."],
  ["pechanga-arena", "Pechanga Arena San Diego", "pechanga arena san diego", "arena", 8900, 14000, 14800, ["pechanga-venue"], "Arena concert range."],
  ["desert-diamond-arena", "Desert Diamond Arena", "desert diamond arena", "arena", 19000, 19500, 20000, ["desert-diamond-venue"], "Concert configuration range."],
  ["toyota-arena", "Toyota Arena", "toyota arena", "arena", 9000, 11000, 12000, ["toyota-arena-venue"], "Over 11,000 headline capacity; lower bound is conservative."],
  ["golden-1-center", "Golden 1 Center", "golden 1 center", "arena", 14000, 17000, 17902, ["golden1-venue"], "Highest concert configuration is the high bound."],
  ["ball-arena", "Ball Arena", "ball arena", "arena", 15000, 18000, 20000, ["ball-venue"], "Concert configuration range."],
  ["climate-pledge-arena", "Climate Pledge Arena", "climate pledge arena", "arena", 13000, 16000, 17200, ["climate-pledge-venue"], "Concert configuration range."],
  ["credit-union-1-amphitheatre", "Credit Union 1 Amphitheatre", "credit union 1 amphitheatre", "amphitheater", 18000, 24000, 28000, ["credit-union-1-venue"], "Lawn capacity and staging create broad uncertainty."],
  ["truliant-amphitheater", "Truliant Amphitheater", "truliant amphitheater", "amphitheater", 11000, 15000, 18000, ["truliant-venue"], "Lawn capacity and staging create broad uncertainty."],
  ["coca-cola-amphitheater-birmingham", "Coca-Cola Amphitheater Birmingham", "coca cola amphitheater", "amphitheater", 6000, 8000, 9300, ["coca-cola-birmingham-venue"], "Lawn capacity and staging create broad uncertainty."],
  ["first-financial-amphitheater", "First Financial Credit Union Amphitheater Albuquerque", "first financial credit union amphitheater", "amphitheater", 9000, 12000, 15000, ["first-financial-venue"], "Lawn capacity and staging create broad uncertainty."],
  ["toyota-amphitheatre", "Toyota Amphitheatre Wheatland", "toyota amphitheatre", "amphitheater", 11000, 16000, 18500, ["toyota-amphitheatre-venue"], "Lawn capacity and staging create broad uncertainty."],
  ["dignity-health-arena", "Dignity Health Arena Bakersfield", "dignity health arena", "arena", 6400, 8500, 10225, ["dignity-health-venue"], "Half-house to end/center-stage range."],
  ["maverik-center", "Maverik Center", "maverik center", "arena", 8000, 10000, 12000, ["maverik-venue"], "Configuration range."],
  ["red-rocks", "Red Rocks Amphitheatre", "red rocks amphitheatre", "amphitheater", 7000, 8500, 9525, ["red-rocks-venue"], "Fixed venue with staging and holds uncertainty."],
  ["sap-center-fallback", "SAP Center at San Jose", "sap center at san jose", "arena-fallback", 7000, 10000, 15000, ["conservative-fallback"], "Conservative fallback until a cited configuration profile is added."],
  ["delta-center-fallback", "Delta Center", "delta center", "arena-fallback", 8000, 13000, 18000, ["conservative-fallback"], "Conservative fallback until a cited configuration profile is added."],
  ["moda-center-fallback", "Moda Center", "moda center", "arena-fallback", 7000, 12000, 16000, ["conservative-fallback"], "Conservative fallback until a cited configuration profile is added."],
  ["lakewood-fallback", "Lakewood Amphitheatre", "lakewood amphitheatre", "amphitheater-fallback", 10000, 16000, 20000, ["conservative-fallback"], "Conservative fallback until a cited configuration profile is added."],
  ["unknown-fallback", "Unknown venue", "unknown venue", "unknown-fallback", 5000, 10000, 20000, ["conservative-fallback"], "Broad fallback; venue identity or configuration is not documented."],
];

export async function ensureTicketmasterTouringEstimationTables(client: DbClient) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ticketmaster_touring_estimation_citations (
      citation_key text PRIMARY KEY, title text NOT NULL, publisher text NOT NULL,
      url text, evidence text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS ticketmaster_touring_estimation_venue_registry (
      venue_key text PRIMARY KEY, venue_name text NOT NULL, normalized_venue text NOT NULL UNIQUE,
      venue_type text NOT NULL, capacity_low integer NOT NULL, capacity_central integer NOT NULL,
      capacity_high integer NOT NULL, citation_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
      notes text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (capacity_low >= 0 AND capacity_low <= capacity_central AND capacity_central <= capacity_high)
    );
    CREATE TABLE IF NOT EXISTS ticketmaster_touring_estimation_calibration_priors (
      prior_key text PRIMARY KEY, artist_key text NOT NULL, geography text NOT NULL,
      venue_type text NOT NULL, show_count integer NOT NULL, tickets_total integer NOT NULL,
      gross_usd_total numeric NOT NULL, citation_keys jsonb NOT NULL DEFAULT '[]'::jsonb,
      notes text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS ticketmaster_touring_estimation_runs (
      id bigserial PRIMARY KEY, model_version text NOT NULL, trigger_reason text NOT NULL,
      status text NOT NULL CHECK (status IN ('running','complete','failed')),
      shadow_run_id bigint NOT NULL REFERENCES ticketmaster_touring_shadow_runs(id) ON DELETE RESTRICT,
      source_snapshot_count integer NOT NULL DEFAULT 0, estimated_event_count integer NOT NULL DEFAULT 0,
      report_warning text NOT NULL, methodology_version text NOT NULL,
      calculated_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS ticketmaster_touring_estimation_event_estimates (
      id bigserial PRIMARY KEY, estimation_run_id bigint NOT NULL REFERENCES ticketmaster_touring_estimation_runs(id) ON DELETE RESTRICT,
      snapshot_id bigint NOT NULL REFERENCES ticketmaster_touring_shadow_event_snapshots(id) ON DELETE RESTRICT,
      artist_key text NOT NULL, artist_name text NOT NULL, event_date text NOT NULL,
      normalized_venue text NOT NULL, venue_name text NOT NULL, venue_city text, venue_type text NOT NULL,
      source_event_ids jsonb NOT NULL DEFAULT '[]'::jsonb, source_snapshot_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
      source_run_ids jsonb NOT NULL DEFAULT '[]'::jsonb, residency_group text,
      sellable_capacity_low integer NOT NULL, sellable_capacity_central integer NOT NULL, sellable_capacity_high integer NOT NULL,
      tickets_moved_low integer NOT NULL, tickets_moved_central integer NOT NULL, tickets_moved_high integer NOT NULL,
      current_sell_through_low numeric NOT NULL, current_sell_through_central numeric NOT NULL, current_sell_through_high numeric NOT NULL,
      final_attendance_low integer NOT NULL, final_attendance_central integer NOT NULL, final_attendance_high integer NOT NULL,
      average_paid_price_usd_low numeric NOT NULL, average_paid_price_usd_central numeric NOT NULL, average_paid_price_usd_high numeric NOT NULL,
      final_gross_usd_low numeric NOT NULL, final_gross_usd_central numeric NOT NULL, final_gross_usd_high numeric NOT NULL,
      confidence_score numeric NOT NULL, confidence_label text NOT NULL, model_version text NOT NULL,
      calculated_at timestamptz NOT NULL DEFAULT now(), data_freshness text NOT NULL,
      assumptions jsonb NOT NULL DEFAULT '[]'::jsonb, warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
      source_citations jsonb NOT NULL DEFAULT '[]'::jsonb, provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (estimation_run_id, artist_key, event_date, normalized_venue),
      CHECK (sellable_capacity_low >= 0 AND sellable_capacity_low <= sellable_capacity_central AND sellable_capacity_central <= sellable_capacity_high),
      CHECK (tickets_moved_low >= 0 AND tickets_moved_low <= tickets_moved_central AND tickets_moved_central <= tickets_moved_high),
      CHECK (final_attendance_low >= 0 AND final_attendance_low <= final_attendance_central AND final_attendance_central <= final_attendance_high),
      CHECK (current_sell_through_low >= 0 AND current_sell_through_low <= current_sell_through_central AND current_sell_through_central <= current_sell_through_high),
      CHECK (average_paid_price_usd_low >= 0 AND average_paid_price_usd_low <= average_paid_price_usd_central AND average_paid_price_usd_central <= average_paid_price_usd_high),
      CHECK (final_gross_usd_low >= 0 AND final_gross_usd_low <= final_gross_usd_central AND final_gross_usd_central <= final_gross_usd_high)
    );
    CREATE INDEX IF NOT EXISTS ticketmaster_estimation_latest_run_idx
      ON ticketmaster_touring_estimation_runs (calculated_at DESC);
    CREATE INDEX IF NOT EXISTS ticketmaster_estimation_event_lookup_idx
      ON ticketmaster_touring_estimation_event_estimates (artist_key, event_date);
  `);
  for (const [citationKey, title, publisher, url, evidence] of CITATIONS) {
    await client.query(
      `INSERT INTO ticketmaster_touring_estimation_citations (citation_key,title,publisher,url,evidence)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (citation_key) DO UPDATE SET title=excluded.title,publisher=excluded.publisher,url=excluded.url,evidence=excluded.evidence`,
      [citationKey, title, publisher, url, evidence],
    );
  }
  for (const venue of VENUES) {
    await client.query(
      `INSERT INTO ticketmaster_touring_estimation_venue_registry
       (venue_key,venue_name,normalized_venue,venue_type,capacity_low,capacity_central,capacity_high,citation_keys,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (venue_key) DO UPDATE SET venue_name=excluded.venue_name,normalized_venue=excluded.normalized_venue,
       venue_type=excluded.venue_type,capacity_low=excluded.capacity_low,capacity_central=excluded.capacity_central,
       capacity_high=excluded.capacity_high,citation_keys=excluded.citation_keys,notes=excluded.notes,updated_at=now()`,
      [venue[0], venue[1], venue[2], venue[3], venue[4], venue[5], venue[6], JSON.stringify(venue[7]), venue[8]],
    );
  }
  const priors = [
    ["carin-leon-2024-us", "carin-leon", "US", "all", 25, 259000, 36300000, ["artist-priors-2024"], "US calibration only; reported total, not event inventory."],
    ["fuerza-regida-2024-us", "fuerza-regida", "US", "all", 39, 501000, 67400000, ["artist-priors-2024"], "US calibration only; reported total, not event inventory."],
    ["fuerza-regida-2023-bmo-us", "fuerza-regida", "US", "stadium", 1, 22392, 3681730, ["fuerza-bmo-2023"], "US stadium calibration only."],
    ["fuerza-regida-2026-stadium-us", "fuerza-regida", "US", "stadium", 8, 330228, 47198246, ["fuerza-stadium-2026"], "US stadium calibration only; eight-show leg."],
  ];
  for (const prior of priors) {
    await client.query(
      `INSERT INTO ticketmaster_touring_estimation_calibration_priors
       (prior_key,artist_key,geography,venue_type,show_count,tickets_total,gross_usd_total,citation_keys,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (prior_key) DO UPDATE SET tickets_total=excluded.tickets_total,gross_usd_total=excluded.gross_usd_total,
       citation_keys=excluded.citation_keys,notes=excluded.notes,updated_at=now()`,
      prior.map(value => typeof value === "object" ? JSON.stringify(value) : value),
    );
  }
}

function findCapacity(profiles: CapacityProfile[], venueName: string | null): CapacityProfile {
  const normalized = normalizeEstimationVenue(venueName);
  return profiles.find(profile =>
    normalized === profile.normalizedVenue ||
    normalized.includes(profile.normalizedVenue) ||
    profile.normalizedVenue.includes(normalized) && normalized.length > 4,
  ) ?? profiles.find(profile => profile.venueKey === "unknown-fallback")!;
}

function freshness(observedAt: string, now: Date): string {
  const ageHours = Math.max(0, (now.getTime() - new Date(observedAt).getTime()) / 3_600_000);
  return ageHours <= 48 ? "fresh" : ageHours <= 168 ? "aging" : "stale";
}

function confidenceLabel(score: number): string {
  return score >= 75 ? "high" : score >= 50 ? "medium" : "low";
}

export function calculateEstimate(
  event: ConsolidatedEvent,
  profile: CapacityProfile,
  prior: Prior,
  now = new Date(),
) {
  const snapshot = event.representative;
  const daysUntil = Math.max(0, Math.ceil((Date.parse(`${snapshot.event_date}T00:00:00Z`) - Date.parse(`${todayIso(now)}T00:00:00Z`)) / 86_400_000));
  const venueType = profile.venueType;
  const priorTickets = prior.tickets_total / Math.max(1, prior.show_count);
  const priorPrice = prior.gross_usd_total / Math.max(1, prior.tickets_total);
  const hasPrice = snapshot.price_currency?.toUpperCase() === "USD" &&
    asNumber(snapshot.price_min) != null && asNumber(snapshot.price_max) != null;
  const minPrice = hasPrice ? asNumber(snapshot.price_min)! : priorPrice * 0.65;
  const maxPrice = hasPrice ? asNumber(snapshot.price_max)! : priorPrice * 1.35;
  const centralPrice = hasPrice ? (minPrice + maxPrice) / 2 : priorPrice;
  const configurationFactor = venueType.includes("fallback") ? 0.62 : venueType === "amphitheater" ? 0.72 : 0.82;
  const demandCentral = Math.min(profile.capacityCentral * configurationFactor, priorTickets * (venueType === "stadium" ? 1.2 : 1));
  const isResidency = snapshot.artist_key === "carin-leon" && profile.venueKey === "sphere";
  const residencyFactor = isResidency ? 0.88 : 1;
  const status = (snapshot.event_status ?? "").toLowerCase();
  const canceled = ["cancelled", "canceled", "postponed"].some(word => status.includes(word));
  const finalCentral = canceled ? 0 : demandCentral * residencyFactor;
  const final = range(finalCentral * 0.58, finalCentral, Math.min(profile.capacityHigh, finalCentral * (venueType.includes("fallback") ? 1.35 : 1.18)));
  const sellable = range(profile.capacityLow * (venueType === "amphitheater" ? 0.65 : 0.75), profile.capacityCentral * configurationFactor, profile.capacityHigh * (venueType === "amphitheater" ? 0.92 : 0.95));
  const pace = daysUntil <= 7 ? 0.9 : daysUntil <= 30 ? 0.68 : 0.38;
  const moved = canceled ? range(0, 0, 0) : range(final.low * pace * 0.72, final.central * pace, final.high * Math.min(0.95, pace + 0.18));
  const sellThrough = {
    low: Number(Math.min(1, moved.low / Math.max(1, sellable.high)).toFixed(4)),
    central: Number(Math.min(1, moved.central / Math.max(1, sellable.central)).toFixed(4)),
    high: Number(Math.min(1, moved.high / Math.max(1, sellable.low)).toFixed(4)),
  };
  let score = 62;
  const warnings: string[] = [
    ESTIMATION_DISCLAIMER,
    "Configuration, holds, later seat releases, comps, refunds, resale, and split-ticketing are not observed by Discovery.",
  ];
  if (!hasPrice) {
    score -= 12;
    warnings.push("Ticketmaster price range is missing or non-USD; artist US calibration price is widened by 35%.");
  }
  if (profile.citationKeys.includes("conservative-fallback")) {
    score -= 16;
    warnings.push("Venue configuration uses a broad conservative fallback pending a cited profile.");
  }
  if (venueType === "amphitheater") {
    score -= 8;
    warnings.push("Lawn capacity, weather, staging, festivals/GA, and premium/dynamic pricing create amphitheater uncertainty.");
  }
  if (isResidency) {
    score -= 6;
    warnings.push("Sphere dates are a linked residency demand run; demand is not treated as independent across dates.");
  }
  if (event.sourceEventIds.length > 1) {
    score -= 5;
    warnings.push("Duplicate provider records were consolidated; all source IDs remain in provenance.");
  }
  if (canceled) {
    score -= 15;
    warnings.push("Event is canceled or postponed in the latest Discovery status; forecast is zero until a new eligible observation appears.");
  }
  if (freshness(snapshot.observed_at, now) !== "fresh") score -= 8;
  const assumptions = [
    `US-only calibration prior: ${prior.prior_key}; Mexican and European results are not mixed into the price prior.`,
    `Sellable capacity uses the cited venue range with a ${Math.round(configurationFactor * 100)}% central configuration factor.`,
    `Current tickets moved use an on-sale timing proxy from days to event (${daysUntil} days), not measured sales.`,
    "Final attendance is constrained by sellable capacity and artist-level US historical ticket priors.",
    "Price range uses the Discovery USD range when present; otherwise the artist US prior is widened.",
  ];
  const citations = [...new Set(["ticketmaster-discovery-api", ...profile.citationKeys, ...prior.citation_keys])];
  return {
    sellableCapacity: sellable,
    ticketsMoved: moved,
    currentSellThrough: sellThrough,
    finalAttendance: final,
    averagePaidPriceUsd: range(minPrice, centralPrice, maxPrice),
    finalGrossUsd: range(final.low * minPrice, final.central * centralPrice, final.high * maxPrice),
    confidenceScore: Math.max(0, Math.min(100, score)),
    confidenceLabel: confidenceLabel(score),
    dataFreshness: freshness(snapshot.observed_at, now),
    residencyGroup: isResidency ? "carin-leon:sphere-residency:2026-09" : null,
    assumptions,
    warnings,
    citations,
    daysUntil,
    canceled,
  };
}

async function loadProfiles(client: DbClient): Promise<CapacityProfile[]> {
  const result = await client.query<CapacityProfile>(`SELECT venue_key "venueKey",venue_name "venueName",normalized_venue "normalizedVenue",
    venue_type "venueType",capacity_low "capacityLow",capacity_central "capacityCentral",capacity_high "capacityHigh",
    citation_keys "citationKeys",notes FROM ticketmaster_touring_estimation_venue_registry`);
  return result.rows;
}

async function loadPriors(client: DbClient): Promise<Prior[]> {
  const result = await client.query<Prior>(`SELECT prior_key,artist_key,venue_type,tickets_total,gross_usd_total,show_count,citation_keys FROM ticketmaster_touring_estimation_calibration_priors`);
  return result.rows;
}

export async function loadCompleteShadowRunSnapshots(
  client: Pick<DbClient, "query">,
  shadowRunId: number,
  now = new Date(),
): Promise<Snapshot[]> {
  const run = await client.query<{ id: number }>(
    `SELECT id FROM ticketmaster_touring_shadow_runs
     WHERE id=$1 AND status='complete'`,
    [shadowRunId],
  );
  if (!run.rows[0]) {
    throw new Error(`Ticketmaster shadow run ${shadowRunId} is not complete.`);
  }
  const snapshots = await client.query<Snapshot>(`
    SELECT id,run_id,artist_key,artist_name,event_id,event_name,event_url,event_date,event_time,event_status,
      public_sale_start_at::text,price_min,price_max,price_currency,venue_name,venue_type,venue_city,
      venue_country,venue_timezone,observed_at::text
    FROM ticketmaster_touring_shadow_event_snapshots
    WHERE run_id=$1
      AND artist_key IN ('carin-leon','fuerza-regida')
      AND event_classification='concert' AND is_trackable_concert=true
      AND event_date >= $2
    ORDER BY artist_key,event_id,observed_at DESC,id DESC
  `, [shadowRunId, todayIso(now)]);
  return snapshots.rows;
}

export function selectPrior(priors: Prior[], artistKey: string, venueType: string): Prior {
  return priors.find(prior =>
    prior.artist_key === artistKey && prior.venue_type === venueType,
  ) ?? priors.find(prior =>
    prior.artist_key === artistKey && prior.venue_type === "all",
  ) ?? priors.find(prior => prior.venue_type === "all") ?? priors[0];
}

export async function recalculateTicketmasterTouringEstimates(
  shadowRunId: number,
  reason: string,
  now = new Date(),
) {
  const client = await pool.connect() as unknown as DbClient;
  let estimationRunId: number | null = null;
  try {
    await ensureTicketmasterTouringEstimationTables(client);
    const snapshots = await loadCompleteShadowRunSnapshots(client, shadowRunId, now);
    const profiles = await loadProfiles(client);
    const priors = await loadPriors(client);
    const events = consolidateEstimationEvents(snapshots);
    const run = await client.query<{ id: number }>(
      `INSERT INTO ticketmaster_touring_estimation_runs
       (model_version,trigger_reason,status,shadow_run_id,source_snapshot_count,estimated_event_count,report_warning,methodology_version)
       VALUES ($1,$2,'running',$3,$4,$5,$6,$7) RETURNING id`,
      [ESTIMATION_MODEL_VERSION, reason, shadowRunId, snapshots.length, events.length, ESTIMATION_DISCLAIMER, ESTIMATION_METHODOLOGY_VERSION],
    );
    estimationRunId = Number(run.rows[0].id);
    for (const event of events) {
      const profile = findCapacity(profiles, event.representative.venue_name);
      const prior = selectPrior(priors, event.representative.artist_key, profile.venueType);
      const calculated = calculateEstimate(event, profile, prior, now);
      await client.query(
        `INSERT INTO ticketmaster_touring_estimation_event_estimates
        (estimation_run_id,snapshot_id,artist_key,artist_name,event_date,normalized_venue,venue_name,venue_city,venue_type,
         source_event_ids,source_snapshot_ids,source_run_ids,residency_group,
         sellable_capacity_low,sellable_capacity_central,sellable_capacity_high,
         tickets_moved_low,tickets_moved_central,tickets_moved_high,
         current_sell_through_low,current_sell_through_central,current_sell_through_high,
         final_attendance_low,final_attendance_central,final_attendance_high,
         average_paid_price_usd_low,average_paid_price_usd_central,average_paid_price_usd_high,
         final_gross_usd_low,final_gross_usd_central,final_gross_usd_high,
         confidence_score,confidence_label,model_version,calculated_at,data_freshness,assumptions,warnings,source_citations,provenance)
        VALUES (${Array.from({ length: 40 }, (_, index) => `$${index + 1}`).join(",")})`,
        [
          estimationRunId,event.representative.id,event.representative.artist_key,event.representative.artist_name,
          event.representative.event_date,event.normalizedVenue,event.representative.venue_name ?? "Unknown venue",
          event.representative.venue_city,event.representative.venue_type ?? profile.venueType,
          JSON.stringify(event.sourceEventIds),JSON.stringify(event.sourceSnapshotIds),JSON.stringify(event.sourceRunIds),calculated.residencyGroup,
          calculated.sellableCapacity.low,calculated.sellableCapacity.central,calculated.sellableCapacity.high,
          calculated.ticketsMoved.low,calculated.ticketsMoved.central,calculated.ticketsMoved.high,
          calculated.currentSellThrough.low,calculated.currentSellThrough.central,calculated.currentSellThrough.high,
          calculated.finalAttendance.low,calculated.finalAttendance.central,calculated.finalAttendance.high,
          calculated.averagePaidPriceUsd.low,calculated.averagePaidPriceUsd.central,calculated.averagePaidPriceUsd.high,
          calculated.finalGrossUsd.low,calculated.finalGrossUsd.central,calculated.finalGrossUsd.high,
          calculated.confidenceScore,calculated.confidenceLabel,ESTIMATION_MODEL_VERSION,now.toISOString(),calculated.dataFreshness,
          JSON.stringify(calculated.assumptions),JSON.stringify(calculated.warnings),JSON.stringify(calculated.citations),
          JSON.stringify({ source: "ticketmaster_discovery_api", shadowSnapshotIds: event.sourceSnapshotIds, shadowRunIds: event.sourceRunIds, sourceEventIds: event.sourceEventIds, venueProfile: profile.venueKey, calibrationPrior: prior.prior_key }),
        ],
      );
    }
    await client.query(`UPDATE ticketmaster_touring_estimation_runs SET status='complete' WHERE id=$1`, [estimationRunId]);
    return { status: "complete" as const, estimationRunId, sourceSnapshotCount: snapshots.length, estimatedEventCount: events.length };
  } catch (error) {
    if (estimationRunId) await client.query(`UPDATE ticketmaster_touring_estimation_runs SET status='failed' WHERE id=$1`, [estimationRunId]).catch(() => {});
    logger.error({ error, shadowRunId, reason }, "[ticketmaster-estimation] recalculation failed");
    throw error;
  } finally {
    client.release();
  }
}

export async function forceRecalculateTicketmasterTouringEstimates(reason = "admin-force-recalculate") {
  const client = await pool.connect() as unknown as DbClient;
  try {
    const result = await client.query<{ id: number }>(
      `SELECT id FROM ticketmaster_touring_shadow_runs
       WHERE status='complete' ORDER BY started_at DESC LIMIT 1`,
    );
    const shadowRunId = Number(result.rows[0]?.id);
    if (!Number.isFinite(shadowRunId)) {
      throw new Error("No complete Ticketmaster shadow run is available.");
    }
    return await recalculateTicketmasterTouringEstimates(shadowRunId, reason);
  } finally {
    client.release();
  }
}

export async function getTicketmasterTouringEstimationReport() {
  const client = await pool.connect() as unknown as DbClient;
  try {
    await ensureTicketmasterTouringEstimationTables(client);
    const run = await client.query<Record<string, unknown>>(`SELECT id,model_version,trigger_reason,status,shadow_run_id,
      source_snapshot_count,estimated_event_count,report_warning,methodology_version,calculated_at::text
      FROM ticketmaster_touring_estimation_runs WHERE status='complete' ORDER BY calculated_at DESC LIMIT 1`);
    if (!run.rows[0]) return { disclaimer: ESTIMATION_DISCLAIMER, modelVersion: ESTIMATION_MODEL_VERSION, eventCount: 0, events: [], latestRun: null };
    const latest = run.rows[0];
    const events = await client.query<Record<string, unknown>>(`SELECT artist_name artist,artist_key,event_date date,venue_name venue,
      venue_city city,normalized_venue,source_event_ids,source_snapshot_ids,residency_group,
      sellable_capacity_low,sellable_capacity_central,sellable_capacity_high,
      tickets_moved_low,tickets_moved_central,tickets_moved_high,
      current_sell_through_low,current_sell_through_central,current_sell_through_high,
      final_attendance_low,final_attendance_central,final_attendance_high,
      average_paid_price_usd_low,average_paid_price_usd_central,average_paid_price_usd_high,
      final_gross_usd_low,final_gross_usd_central,final_gross_usd_high,
      confidence_score,confidence_label,model_version,calculated_at::text,data_freshness,assumptions,warnings,source_citations,provenance
      FROM ticketmaster_touring_estimation_event_estimates WHERE estimation_run_id=$1
      ORDER BY artist_name,event_date,venue_name`, [latest.id]);
    const summary = events.rows.reduce<{
      eventCount: number;
      centralAttendance: number;
      centralGrossUsd: number;
    }>((acc, event) => {
      acc.eventCount += 1;
      acc.centralAttendance += Number(event.final_attendance_central ?? 0);
      acc.centralGrossUsd += Number(event.final_gross_usd_central ?? 0);
      return acc;
    }, { eventCount: 0, centralAttendance: 0, centralGrossUsd: 0 });
    return { disclaimer: ESTIMATION_DISCLAIMER, modelVersion: latest.model_version, methodologyVersion: latest.methodology_version,
      calculatedAt: latest.calculated_at, latestRun: latest, summary, events: events.rows };
  } finally {
    client.release();
  }
}

export const TICKETMASTER_TOURING_ESTIMATION_METHODOLOGY = {
  disclaimer: ESTIMATION_DISCLAIMER,
  modelVersion: ESTIMATION_MODEL_VERSION,
  formulas: {
    sellableCapacity: "venue capacity range × configuration factor; amphitheaters use a wider lawn/staging adjustment.",
    finalAttendance: "min(sellable capacity, artist US tickets-per-show prior × venue-type factor × residency linkage) with 58% low and widened high bounds.",
    ticketsMoved: "final attendance × days-to-event pace proxy; 0.38 beyond 30 days, 0.68 at 8–30 days, 0.90 within 7 days, widened low/high.",
    currentSellThrough: "tickets moved ÷ sellable capacity, using conservative denominator pairing for low/high bounds.",
    averagePaidPrice: "Discovery USD price range when present; otherwise artist US gross/tickets prior widened to 65%–135%.",
    finalGross: "final attendance × average paid USD ticket price.",
  },
  priors: "Only cited US artist box-office priors are used; Mexican and European results are excluded from price calibration.",
  penalties: ["unknown configuration", "amphitheater lawn/staging", "stadium staging", "festival/GA", "premium/dynamic pricing", "resale", "holds", "later seat releases", "refunds", "comps", "split ticketing", "duplicate provider records", "canceled/postponed status", "stale observations"],
  residency: "Carín León Sphere dates share a linked residency group and receive a demand-sharing factor rather than independent full-demand treatment.",
  limitations: ["Discovery does not publish measured tickets sold or live inventory in these observations.", "Estimates are forecasts for planning, not authoritative box-office results.", "A report row is deduplicated by artist, local event date, and normalized venue while preserving every source event ID."],
  sourceCitations: CITATIONS.map(([key, title, publisher, url, evidence]) => ({ key, title, publisher, url, evidence })),
};