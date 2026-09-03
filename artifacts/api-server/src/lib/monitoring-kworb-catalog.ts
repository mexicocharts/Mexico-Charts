export type MonitoringKworbCatalogItem = {
  type: "track" | "album";
  key: string;
  title: string;
  spotifyUrl: string | null;
  compilation: boolean;
  totalStreams: number;
  dailyStreams: number;
};

export type MonitoringKworbCatalog = {
  fetchedAt: string;
  source: "kworb_live_complete_catalog";
  items: MonitoringKworbCatalogItem[];
};

const CACHE_MS = 6 * 60 * 60 * 1_000;
const cache = new Map<string, { expiresAt: number; value: MonitoringKworbCatalog }>();

function decodeHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function numberValue(value: string) {
  const parsed = Number(value.replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function fallbackKey(title: string) {
  return title.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function parseMonitoringKworbCatalog(
  html: string,
  type: "track" | "album",
): MonitoringKworbCatalogItem[] {
  const rows: MonitoringKworbCatalogItem[] = [];
  const pattern = /<tr[^>]*><td class="text"><div>([\s\S]*?)<\/div><\/td><td>([\d,]+)<\/td><td>([\d,]+)<\/td><\/tr>/g;
  for (const match of html.matchAll(pattern)) {
    const cell = match[1] ?? "";
    const spotifyUrl = cell.match(/href="([^"]+)"/)?.[1] ?? null;
    const markedTitle = decodeHtml(cell);
    const title = markedTitle.replace(/^\*\s*/, "").replace(/^\^\s*/, "");
    if (!title) continue;
    const resource = type === "track" ? "track" : "album";
    const spotifyId = spotifyUrl?.match(new RegExp(`/${resource}/([A-Za-z0-9]+)`))?.[1];
    rows.push({
      type,
      key: spotifyId ?? fallbackKey(title),
      title,
      spotifyUrl,
      compilation: type === "album" && markedTitle.startsWith("^"),
      totalStreams: numberValue(match[2] ?? "0"),
      dailyStreams: numberValue(match[3] ?? "0"),
    });
  }
  return rows;
}

async function fetchPage(spotifyArtistId: string, suffix: "songs" | "albums") {
  const response = await fetch(
    `https://kworb.net/spotify/artist/${spotifyArtistId}_${suffix}.html`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; MexicoChartsMonitor/1.0)",
        Accept: "text/html",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(8_000),
    },
  );
  if (!response.ok) throw new Error(`Kworb ${suffix} request failed: HTTP ${response.status}`);
  return response.text();
}

export async function loadCompleteMonitoringKworbCatalog(
  spotifyArtistId: string,
): Promise<MonitoringKworbCatalog> {
  const cached = cache.get(spotifyArtistId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const [songs, albums] = await Promise.all([
    fetchPage(spotifyArtistId, "songs"),
    fetchPage(spotifyArtistId, "albums"),
  ]);
  const items = [
    ...parseMonitoringKworbCatalog(songs, "track"),
    ...parseMonitoringKworbCatalog(albums, "album"),
  ];
  if (!items.some(item => item.type === "track") || !items.some(item => item.type === "album")) {
    throw new Error("Kworb complete catalog response did not contain both tracks and albums");
  }
  const value: MonitoringKworbCatalog = {
    fetchedAt: new Date().toISOString(),
    source: "kworb_live_complete_catalog",
    items,
  };
  cache.set(spotifyArtistId, { expiresAt: Date.now() + CACHE_MS, value });
  return value;
}
