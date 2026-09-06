export type MonitoringKworbCatalogItem = {
  type: "track" | "album";
  key: string;
  title: string;
  spotifyUrl: string | null;
  artworkUrl: string | null;
  compilation: boolean;
  totalStreams: number | null;
  dailyStreams: number | null;
};

export type MonitoringKworbCatalog = {
  fetchedAt: string;
  source: "kworb_live_complete_catalog";
  items: MonitoringKworbCatalogItem[];
};

const CACHE_MS = 6 * 60 * 60 * 1_000;
const OEMBED_TRACK_LIMIT = 36;
const OEMBED_CONCURRENCY = 24;
const cache = new Map<
  string,
  { expiresAt: number; value: MonitoringKworbCatalog }
>();

function decodeHtml(value: string) {
  return value
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|nbsp|lt|gt);/gi, (entity, name: string) => {
      const named: Record<string, string> = { amp: "&", quot: '"', apos: "'", nbsp: " ", lt: "<", gt: ">" };
      if (!name.startsWith("#")) return named[name.toLowerCase()] ?? entity;
      const hex = name.slice(0, 2).toLowerCase() === "#x";
      const point = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point) : entity;
    })
    .trim();
}

function numberValue(value: string, signed = false): number | null {
  const text = decodeHtml(value);
  if (!(signed ? /^-?(?:\d+|\d{1,3}(?:,\d{3})+)$/ : /^(?:\d+|\d{1,3}(?:,\d{3})+)$/).test(text)) return null;
  const parsed = Number(text.replaceAll(",", ""));
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function attribute(markup: string, name: string): string | null {
  const match = markup.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'<>]+))`, "i"));
  return match ? decodeHtml(match[1] ?? match[2] ?? match[3] ?? "") : null;
}

function fallbackKey(title: string) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function parseMonitoringKworbCatalog(
  html: string,
  type: "track" | "album",
): MonitoringKworbCatalogItem[] {
  const rows: MonitoringKworbCatalogItem[] = [];
  // Bound each match to a physical row before reading any cells. A missing
  // count must never make the title/ID consume the following row's metrics.
  const pattern = /<tr\b[^>]*>((?:(?!<\/?tr\b)[\s\S])*)<\/tr\s*>/gi;
  for (const match of html.matchAll(pattern)) {
    const cells = [...match[1]!.matchAll(/<td\b([^>]*)>((?:(?!<\/?td\b)[\s\S])*)<\/td\s*>/gi)];
    if (cells.length !== 3 || !attribute(cells[0]![1]!, "class")?.split(/\s+/).includes("text")) continue;
    const cell = cells[0]![2]!;
    const resource = type === "track" ? "track" : "album";
    const spotifyUrl = [...cell.matchAll(/<a\b([^>]*)>/gi)]
      .map((link) => attribute(link[1]!, "href"))
      .find((url) => url != null && new RegExp(`^https://open\\.spotify\\.com/${resource}/[A-Za-z0-9]+(?:[?#]|$)`).test(url)) ?? null;
    const markedTitle = decodeHtml(cell);
    const title = markedTitle.replace(/^\*\s*/, "").replace(/^\^\s*/, "");
    if (!title) continue;
    const spotifyId = spotifyUrl?.match(
      new RegExp(`/${resource}/([A-Za-z0-9]+)`),
    )?.[1];
    rows.push({
      type,
      key: spotifyId ?? fallbackKey(title),
      title,
      spotifyUrl,
      artworkUrl: null,
      compilation: type === "album" && markedTitle.startsWith("^"),
      totalStreams: numberValue(cells[1]![2]!),
      dailyStreams: numberValue(cells[2]![2]!, true),
    });
  }
  return rows;
}

export function summarizeMonitoringKworbCatalog(items: MonitoringKworbCatalogItem[]) {
  const tracks = items.filter((item) => item.type === "track");
  const albums = items.filter((item) => item.type === "album");
  const sum = (group: MonitoringKworbCatalogItem[], field: "totalStreams" | "dailyStreams") => {
    let total = 0;
    for (const item of group) {
      const value = item[field];
      if (value == null || !Number.isSafeInteger(value)) return null;
      total += value;
      if (!Number.isSafeInteger(total)) return null;
    }
    return total;
  };
  return {
    trackCount: tracks.length, albumCount: albums.length,
    trackDailyStreams: sum(tracks, "dailyStreams"), albumDailyStreams: sum(albums, "dailyStreams"),
    trackTotalStreams: sum(tracks, "totalStreams"), albumTotalStreams: sum(albums, "totalStreams"),
  };
}

type SpotifyImageItem = {
  id?: string;
  album?: { images?: Array<{ url?: string }> };
  images?: Array<{ url?: string }>;
};

async function spotifyApplicationToken(): Promise<string | null> {
  const clientId = process.env["SPOTIFY_CLIENT_ID"]?.trim();
  const clientSecret = process.env["SPOTIFY_CLIENT_SECRET"]?.trim();
  if (!clientId || !clientSecret) return null;
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    signal: AbortSignal.timeout(4_000),
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { access_token?: string };
  return payload.access_token?.trim() || null;
}

function chunks<T>(values: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size),
  );
}

async function enrichSpotifyArtwork(items: MonitoringKworbCatalogItem[]) {
  const token = await spotifyApplicationToken().catch(() => null);
  const artwork = new Map<string, string>();
  const load = async (
    type: "tracks" | "albums",
    ids: string[],
    size: number,
  ) => {
    await Promise.all(
      chunks(ids, size).map(async (batch) => {
        const response = await fetch(
          `https://api.spotify.com/v1/${type}?ids=${encodeURIComponent(batch.join(","))}`,
          {
            headers: { authorization: `Bearer ${token}` },
            signal: AbortSignal.timeout(5_000),
          },
        );
        if (!response.ok) return;
        const payload = (await response.json()) as {
          tracks?: SpotifyImageItem[];
          albums?: SpotifyImageItem[];
        };
        for (const item of payload[type] ?? []) {
          const url =
            type === "tracks"
              ? item.album?.images?.[0]?.url
              : item.images?.[0]?.url;
          if (item.id && url)
            artwork.set(
              `${type === "tracks" ? "track" : "album"}:${item.id}`,
              url,
            );
        }
      }),
    );
  };
  const trackIds = items
    .filter((item) => item.type === "track" && /^[A-Za-z0-9]+$/.test(item.key))
    .map((item) => item.key);
  const albumIds = items
    .filter((item) => item.type === "album" && /^[A-Za-z0-9]+$/.test(item.key))
    .map((item) => item.key);
  if (token)
    await Promise.all([
      load("tracks", trackIds, 50),
      load("albums", albumIds, 20),
    ]);
  const apiEnriched = items.map((item) => ({
    ...item,
    artworkUrl: artwork.get(`${item.type}:${item.key}`) ?? null,
  }));
  const oembedCandidates = [
    ...apiEnriched.filter(
      (item) => item.type === "album" && !item.artworkUrl,
    ),
    ...apiEnriched
      .filter((item) => item.type === "track" && !item.artworkUrl)
      .slice(0, OEMBED_TRACK_LIMIT),
  ];
  for (const batch of chunks(oembedCandidates, OEMBED_CONCURRENCY)) {
    await Promise.all(
      batch.map(async (item) => {
        if (!item.spotifyUrl) return;
        try {
          const url = new URL(item.spotifyUrl);
          if (
            url.protocol !== "https:" ||
            url.hostname !== "open.spotify.com" ||
            !/^\/(?:track|album)\/[A-Za-z0-9]+$/.test(url.pathname)
          )
            return;
          const response = await fetch(
            `https://open.spotify.com/oembed?url=${encodeURIComponent(url.href)}`,
            { signal: AbortSignal.timeout(3_000) },
          );
          if (!response.ok) return;
          const payload = (await response.json()) as {
            thumbnail_url?: string;
          };
          const thumbnail = payload.thumbnail_url?.trim();
          if (thumbnail && /^https:\/\//i.test(thumbnail))
            artwork.set(`${item.type}:${item.key}`, thumbnail);
        } catch {
          // Artwork is optional enrichment; the real stream row remains usable.
        }
      }),
    );
  }
  return apiEnriched.map((item) => ({
    ...item,
    artworkUrl:
      item.artworkUrl ?? artwork.get(`${item.type}:${item.key}`) ?? null,
  }));
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
  if (!response.ok)
    throw new Error(`Kworb ${suffix} request failed: HTTP ${response.status}`);
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
  const parsedItems = [
    ...parseMonitoringKworbCatalog(songs, "track"),
    ...parseMonitoringKworbCatalog(albums, "album"),
  ];
  if (
    !parsedItems.some((item) => item.type === "track") ||
    !parsedItems.some((item) => item.type === "album")
  ) {
    throw new Error(
      "Kworb complete catalog response did not contain both tracks and albums",
    );
  }
  const items = await enrichSpotifyArtwork(parsedItems);
  const value: MonitoringKworbCatalog = {
    fetchedAt: new Date().toISOString(),
    source: "kworb_live_complete_catalog",
    items,
  };
  cache.set(spotifyArtistId, { expiresAt: Date.now() + CACHE_MS, value });
  return value;
}
