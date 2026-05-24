type Row = Record<string, string>;

interface TmEvent {
  date: string;
  city: string;
  state: string;
  country: string;
  venue: string;
}

interface ArtistTours {
  id: string;
  name: string;
  events: TmEvent[];
}

interface TouringResponse {
  artists: ArtistTours[];
}

interface MomentumArtist {
  name: string;
  rank: number;
  listeners: number;
  growth: number;
  socialReach: number;
  touringDates: number;
  score: number;
  components: {
    rank: number;
    growth: number;
    audience: number;
    social: number;
    touring: number;
  };
  reasons: string[];
}

const MASTER_SHEET_ID = "1lnqsIqI3mi3eC7iD6H7QThS-tzZ4thyyHcYNfX3Vdts";
const gvizCSV = (sheet: string) =>
  `https://docs.google.com/spreadsheets/d/${MASTER_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${sheet}`;

const sources = {
  artistsDaily: gvizCSV("artists_daily_mx"),
  artistMetadata:
    "https://docs.google.com/spreadsheets/d/18urSUcuMeQxpKvS0gwg5Irz3TSC9zpHJ/gviz/tq?tqx=out:csv&sheet=artist_metadata_active",
  touring: process.env.TOURING_API_URL ?? "https://mexicochart.com/api/touring/concerts",
};

const args = new Set(process.argv.slice(2));

function parseCSV(input: string): Row[] {
  const rows: string[][] = [];
  let current = "";
  let record: string[] = [];
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      record.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      record.push(current);
      if (record.some((value) => value.trim() !== "")) rows.push(record);
      record = [];
      current = "";
    } else {
      current += char;
    }
  }

  record.push(current);
  if (record.some((value) => value.trim() !== "")) rows.push(record);

  const headers = rows
    .shift()
    ?.map((header) => header.trim().replace(/^\uFEFF/, "")) ?? [];

  return rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, (row[index] ?? "").trim()])),
  );
}

async function fetchRows(label: string, url: string): Promise<Row[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${label} fetch failed: HTTP ${response.status}`);
  return parseCSV(await response.text());
}

async function fetchTouring(): Promise<ArtistTours[]> {
  const response = await fetch(sources.touring);
  if (!response.ok) return [];
  const data = (await response.json()) as TouringResponse;
  return data.artists ?? [];
}

function normalizeName(name: string | undefined): string {
  return (name ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isEligible(row: Row): boolean {
  const include = (row.include_on_site ?? "").toLowerCase().trim();
  if (include === "true") return true;
  if (include === "false") return false;

  const status = (row.status ?? row.eligibility_status ?? "").toLowerCase().trim();
  return status === "" || (!status.includes("exclud") && !status.includes("review"));
}

function numberFrom(raw: string | undefined): number {
  if (!raw) return 0;
  const value = raw.trim().toUpperCase();
  if (value.endsWith("B")) return Number.parseFloat(value) * 1_000_000_000;
  if (value.endsWith("M")) return Number.parseFloat(value) * 1_000_000;
  if (value.endsWith("K")) return Number.parseFloat(value) * 1_000;
  return Number.parseFloat(value.replace(/[^0-9.-]/g, "")) || 0;
}

function compact(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(Math.round(value));
}

function pluralDates(count: number): string {
  return count === 1 ? "1 fecha activa" : `${count} fechas activas`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scale(value: number, max: number, points: number): number {
  if (max <= 0) return 0;
  return clamp((value / max) * points, 0, points);
}

function buildMetadataMap(rows: Row[]): Map<string, Row> {
  const map = new Map<string, Row>();
  for (const row of rows) {
    const name = row.artist_name || row.artist_key;
    if (!name) continue;
    map.set(normalizeName(row.artist_key || name), row);
    map.set(normalizeName(name), row);
  }
  return map;
}

function buildTouringMap(artists: ArtistTours[]): Map<string, ArtistTours> {
  const map = new Map<string, ArtistTours>();
  for (const artist of artists) {
    map.set(normalizeName(artist.name), artist);
  }
  return map;
}

function chartArtistName(row: Row): string {
  return row.artist || row.artist_name || "";
}

function calculateMomentum(data: {
  artistsDaily: Row[];
  metadata: Row[];
  touring: ArtistTours[];
}): MomentumArtist[] {
  const metadata = buildMetadataMap(data.metadata);
  const touring = buildTouringMap(data.touring);
  const eligibleArtists = data.artistsDaily.filter(isEligible);

  const maxListeners = Math.max(
    ...eligibleArtists.map((row) => {
      const meta = metadata.get(normalizeName(chartArtistName(row)));
      return numberFrom(row.monthly_listeners) || numberFrom(meta?.spotify_monthly_listeners);
    }),
  );

  const maxSocial = Math.max(
    ...eligibleArtists.map((row) => {
      const meta = metadata.get(normalizeName(chartArtistName(row)));
      return (
        numberFrom(meta?.tiktok_followers) +
        numberFrom(meta?.instagram_followers) +
        numberFrom(meta?.youtube_subscribers)
      );
    }),
  );

  const maxTouring = Math.max(...data.touring.map((artist) => artist.events.length), 1);

  return eligibleArtists
    .map((row) => {
      const name = chartArtistName(row);
      const key = normalizeName(name);
      const meta = metadata.get(key);
      const tour = touring.get(key);
      const rank = Number.parseInt(row.mexico_charts_rank ?? "", 10) || 999;
      const listeners = numberFrom(row.monthly_listeners) || numberFrom(meta?.spotify_monthly_listeners);
      const growth = numberFrom(row.listeners_change_pct);
      const socialReach =
        numberFrom(meta?.tiktok_followers) +
        numberFrom(meta?.instagram_followers) +
        numberFrom(meta?.youtube_subscribers);
      const touringDates = tour?.events.length ?? 0;

      const rankScore = rank <= 100 ? ((101 - rank) / 100) * 35 : 0;
      const growthScore = clamp(growth, 0, 50) * 0.6;
      const audienceScore = scale(listeners, maxListeners, 20);
      const socialScore = scale(socialReach, maxSocial, 10);
      const touringScore = scale(touringDates, maxTouring, 5);
      const score = Math.round(rankScore + growthScore + audienceScore + socialScore + touringScore);

      const reasons = [
        `#${rank} en artistas diarios`,
        listeners > 0 ? `${compact(listeners)} oyentes mensuales` : "",
        growth > 0 ? `+${growth.toFixed(0)}% en oyentes` : "",
        touringDates > 0 ? pluralDates(touringDates) : "",
        socialReach > 0 ? `${compact(socialReach)} de alcance social medido` : "",
      ].filter(Boolean);

      return {
        name,
        rank,
        listeners,
        growth,
        socialReach,
        touringDates,
        score,
        components: {
          rank: Math.round(rankScore),
          growth: Math.round(growthScore),
          audience: Math.round(audienceScore),
          social: Math.round(socialScore),
          touring: Math.round(touringScore),
        },
        reasons,
      };
    })
    .filter((artist) => artist.name && artist.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 15);
}

function buildScript(artists: MomentumArtist[]): string {
  const [leader, second, third] = artists;
  const lines = [
    "Bienvenidos a Mexico Charts.",
    "",
    "Soy Adrian, y este es el Artist Momentum Watch.",
    "",
  ];

  if (!leader) {
    lines.push(
      "Por ahora no hay suficientes datos para calcular momentum de artistas.",
      "Seguiremos actualizando este reporte cuando entren nuevos datos.",
    );
    return lines.join("\n");
  }

  lines.push(
    `El artista con mayor momentum en este corte es ${leader.name}, con un score de ${leader.score} sobre 100.`,
    `La señal principal: ${leader.reasons.slice(0, 3).join(", ")}.`,
  );

  if (second) {
    lines.push(
      `En segundo lugar aparece ${second.name}, con score de ${second.score}, impulsado por ${second.reasons.slice(0, 2).join(" y ")}.`,
    );
  }

  if (third) {
    lines.push(
      `Y cerrando el top tres esta ${third.name}, que mantiene una señal fuerte dentro del ecosistema de Mexico Charts.`,
    );
  }

  const touringPick = artists.find((artist) => artist.touringDates > 0);
  if (touringPick) {
    lines.push(
      `El dato extra: ${touringPick.name} tambien tiene ${pluralDates(touringPick.touringDates)}, conectando charts con actividad en vivo.`,
    );
  }

  lines.push(
    "",
    "Esto fue Artist Momentum Watch de Mexico Charts. Nos vemos en la proxima actualizacion.",
  );

  return lines.join("\n");
}

function printTable(artists: MomentumArtist[]) {
  console.table(
    artists.slice(0, 10).map((artist) => ({
      rank: artist.rank,
      artist: artist.name,
      score: artist.score,
      growth: `${artist.growth.toFixed(0)}%`,
      listeners: compact(artist.listeners),
      touring: artist.touringDates,
      components: `rank ${artist.components.rank}, growth ${artist.components.growth}, audience ${artist.components.audience}, social ${artist.components.social}, touring ${artist.components.touring}`,
    })),
  );
}

function buildTavusPayload(script: string) {
  return {
    replica_id: process.env.TAVUS_REPLICA_ID ?? "r72f7f7f7c8b",
    video_name: `Mexico Charts - Artist Momentum Watch - ${new Date().toISOString().slice(0, 10)}`,
    script,
    fast: true,
    transparent_background: true,
  };
}

async function main() {
  const [artistsDaily, metadata, touring] = await Promise.all([
    fetchRows("artists_daily_mx", sources.artistsDaily),
    fetchRows("artist_metadata_active", sources.artistMetadata),
    fetchTouring(),
  ]);

  const momentum = calculateMomentum({ artistsDaily, metadata, touring });
  const script = buildScript(momentum);

  if (args.has("--json")) {
    console.log(JSON.stringify(momentum, null, 2));
    return;
  }

  if (args.has("--tavus-payload")) {
    console.log(JSON.stringify(buildTavusPayload(script), null, 2));
    return;
  }

  printTable(momentum);
  console.log("\n" + script);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

export {};
