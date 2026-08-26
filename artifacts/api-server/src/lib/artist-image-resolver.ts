import { artistImages, db, spotifyArtists } from "@workspace/db";
import { logger } from "./logger";

export type ArtistImageSource = "stored" | "spotify" | "deezer" | "itunes" | "none";
export type ArtistImageStatus =
  | "valid"
  | "missing"
  | "unreachable"
  | "invalid-content-type"
  | "invalid-dimensions"
  | "placeholder"
  | "mismatched";

export type ArtistImageResolution = {
  artistName: string;
  imageUrl: string | null;
  source: ArtistImageSource;
  status: ArtistImageStatus;
  reason: string | null;
  providerName: string | null;
  diagnostics: Array<{ source: ArtistImageSource; status: ArtistImageStatus; reason: string | null }>;
};

type Candidate = {
  url: string;
  source: Exclude<ArtistImageSource, "stored" | "none">;
  providerName: string | null;
};

type ImageValidation = {
  status: Exclude<ArtistImageStatus, "missing" | "mismatched">;
  reason: string | null;
  width: number | null;
  height: number | null;
};

const MISS_TTL = 15 * 60 * 1000;
const VALIDATION_TTL = 24 * 60 * 60 * 1000;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MIN_IMAGE_DIMENSION = 100;

const memoryCache = new Map<string, ArtistImageResolution>();
const missCache = new Map<string, number>();
const validationCache = new Map<string, { checkedAt: number; result: ImageValidation }>();
const pending = new Map<string, Promise<ArtistImageResolution>>();

const VERIFIED_DEEZER_ARTIST_IDS: Record<string, string> = {
  "peso pluma": "80365122",
};

const METADATA_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/18urSUcuMeQxpKvS0gwg5Irz3TSC9zpHJ/gviz/tq?tqx=out:csv&sheet=artist_metadata_active";

function normalizeName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\by\b/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeArtistImageKey(value: string): string {
  return normalizeName(value);
}

function cleanNameForSearch(name: string): string {
  return name.replace(/"+/g, "").replace(/[$#@!]/g, "").replace(/\s+/g, " ").trim();
}

function artistMatchScore(expected: string, found: string): number {
  const expectedNorm = normalizeName(cleanNameForSearch(expected));
  const foundNorm = normalizeName(found);
  if (!expectedNorm || !foundNorm) return 0;
  if (expectedNorm === foundNorm) return 100;
  if (foundNorm.includes(expectedNorm) || expectedNorm.includes(foundNorm)) return 88;
  const expectedTokens = expectedNorm.split(" ").filter((token) => token.length > 1);
  const matchedTokens = expectedTokens.filter((token) => foundNorm.includes(token)).length;
  return expectedTokens.length ? Math.round((matchedTokens / expectedTokens.length) * 70) : 0;
}

export function isArtistImageCandidateUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    const path = url.pathname.toLowerCase();
    return (url.protocol === "http:" || url.protocol === "https:")
      && !path.includes("/artist//")
      && !path.includes("/noimage/")
      && !path.includes("d41d8cd98f00b204e9800998ecf8427e")
      && !/(?:^|[/_-])(placeholder|default|unknown|no[_-]?image)(?:[/_.-]|$)/i.test(path);
  } catch {
    return false;
  }
}

function readPngDimensions(bytes: Uint8Array): [number, number] | null {
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) return null;
  return [
    new DataView(bytes.buffer, bytes.byteOffset).getUint32(16),
    new DataView(bytes.buffer, bytes.byteOffset).getUint32(20),
  ];
}

function readWebpDimensions(bytes: Uint8Array): [number, number] | null {
  if (bytes.length < 30 || String.fromCharCode(...bytes.slice(0, 4)) !== "RIFF" || String.fromCharCode(...bytes.slice(8, 12)) !== "WEBP") return null;
  if (String.fromCharCode(...bytes.slice(12, 16)) === "VP8X") {
    const width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
    const height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    return [width, height];
  }
  return null;
}

function readJpegDimensions(bytes: Uint8Array): [number, number] | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > bytes.length) return null;
    const segmentLength = (bytes[offset] << 8) + bytes[offset + 1];
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    const isStartOfFrame = marker >= 0xc0 && marker <= 0xc3
      || marker >= 0xc5 && marker <= 0xc7
      || marker >= 0xc9 && marker <= 0xcb
      || marker >= 0xcd && marker <= 0xcf;
    if (isStartOfFrame && segmentLength >= 7) {
      return [
        (bytes[offset + 5] << 8) + bytes[offset + 6],
        (bytes[offset + 3] << 8) + bytes[offset + 4],
      ];
    }
    offset += segmentLength;
  }
  return null;
}

function readDimensions(bytes: Uint8Array): [number, number] | null {
  return readPngDimensions(bytes) ?? readJpegDimensions(bytes) ?? readWebpDimensions(bytes);
}

function classifyUrlFailure(url: string): ImageValidation {
  return {
    status: "placeholder",
    reason: `Rejected placeholder or empty artist image URL: ${url}`,
    width: null,
    height: null,
  };
}

async function validateImageUrl(url: string): Promise<ImageValidation> {
  const cached = validationCache.get(url);
  if (cached && Date.now() - cached.checkedAt < VALIDATION_TTL) return cached.result;

  if (!isArtistImageCandidateUrl(url)) {
    const result = classifyUrlFailure(url);
    validationCache.set(url, { checkedAt: Date.now(), result });
    return result;
  }

  let result: ImageValidation;
  try {
    const response = await fetch(url, {
      headers: { Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" },
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      result = { status: "unreachable", reason: `Image request returned HTTP ${response.status}`, width: null, height: null };
    } else {
      const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
      const contentLength = Number(response.headers.get("content-length") ?? 0);
      if (!contentType.startsWith("image/")) {
        result = { status: "invalid-content-type", reason: `Expected an image but received ${contentType || "unknown content type"}`, width: null, height: null };
      } else if (contentLength > MAX_IMAGE_BYTES) {
        result = { status: "invalid-dimensions", reason: `Image exceeds ${MAX_IMAGE_BYTES} byte safety limit`, width: null, height: null };
      } else {
        const bytes = new Uint8Array(await response.arrayBuffer());
        const dimensions = readDimensions(bytes);
        if (!dimensions || dimensions[0] < MIN_IMAGE_DIMENSION || dimensions[1] < MIN_IMAGE_DIMENSION) {
          result = { status: "invalid-dimensions", reason: "Image has no readable dimensions or is too small", width: dimensions?.[0] ?? null, height: dimensions?.[1] ?? null };
        } else {
          result = { status: "valid", reason: null, width: dimensions[0], height: dimensions[1] };
        }
      }
    }
  } catch (error) {
    result = { status: "unreachable", reason: error instanceof Error ? error.message : "Image request failed", width: null, height: null };
  }
  validationCache.set(url, { checkedAt: Date.now(), result });
  return result;
}

async function deezerCandidate(name: string): Promise<Candidate | { mismatch: string } | null> {
  const queries = [name, cleanNameForSearch(name)];
  const words = cleanNameForSearch(name).split(" ");
  if (words.length > 2) queries.push(words.slice(0, 2).join(" "));

  let mismatch: string | null = null;
  for (const query of Array.from(new Set(queries)).filter(Boolean)) {
    try {
      const response = await fetch(`https://api.deezer.com/search/artist?q=${encodeURIComponent(query)}&limit=5`, {
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) continue;
      const payload = await response.json() as {
        data?: Array<{ name?: string; picture_xl?: string; picture_medium?: string }>;
      };
      const ranked = (payload.data ?? [])
        .filter((item): item is { name: string; picture_xl?: string; picture_medium?: string } => Boolean(item.name))
        .map((item) => ({ item, score: artistMatchScore(name, item.name) }))
        .sort((a, b) => b.score - a.score);
      const best = ranked[0];
      if (!best) continue;
      const imageUrl = best.item.picture_xl || best.item.picture_medium;
      if (best.score >= 82 && imageUrl && isArtistImageCandidateUrl(imageUrl)) {
        return { url: imageUrl, source: "deezer", providerName: best.item.name };
      }
      if (best.score < 82) mismatch = `Deezer returned "${best.item.name}" for "${name}"`;
    } catch {
      // Try the next query/provider; the unresolved reason is reported if all providers fail.
    }
  }
  return mismatch ? { mismatch } : null;
}

async function itunesCandidate(name: string): Promise<Candidate | { mismatch: string } | null> {
  try {
    const response = await fetch(
      `https://itunes.apple.com/search?term=${encodeURIComponent(name)}&entity=musicArtist&country=MX&limit=10`,
      { signal: AbortSignal.timeout(8_000) },
    );
    if (!response.ok) return null;
    const payload = await response.json() as {
      results?: Array<{ artistName?: string; artworkUrl100?: string; wrapperType?: string }>;
    };
    const ranked = (payload.results ?? [])
      .filter((item) => item.artistName)
      .map((item) => ({ item, score: artistMatchScore(name, item.artistName!) }))
      .sort((a, b) => b.score - a.score);
    const best = ranked[0];
    if (!best || best.score < 90) {
      return best ? { mismatch: `iTunes returned "${best.item.artistName}" for "${name}"` } : null;
    }
    // Only accept artwork attached to an artist result; never promote album or track art.
    if (best.item.wrapperType === "artist" && best.item.artworkUrl100 && isArtistImageCandidateUrl(best.item.artworkUrl100)) {
      return { url: best.item.artworkUrl100.replace("100x100", "600x600"), source: "itunes", providerName: best.item.artistName! };
    }
  } catch {
    // A later provider or the cached miss handles transient provider failures.
  }
  return null;
}

async function loadStoredImages() {
  try {
    const [stored, spotify] = await Promise.all([
      db.select().from(artistImages),
      db.select().from(spotifyArtists),
    ]);
    return {
      stored: new Map(stored.map((row) => [normalizeName(row.artistKey), row.imageUrl])),
      spotify: new Map(spotify.filter((row) => row.verified).map((row) => [normalizeName(row.artistKey), row.spotifyImageUrl])),
    };
  } catch (error) {
    logger.warn({ err: error }, "[artist-images] database seed failed");
    return { stored: new Map<string, string>(), spotify: new Map<string, string | null>() };
  }
}

function persistImage(key: string, imageUrl: string): void {
  void db.insert(artistImages)
    .values({ artistKey: key, imageUrl })
    .onConflictDoUpdate({ target: artistImages.artistKey, set: { imageUrl } })
    .catch((error) => logger.warn({ err: error, artistKey: key }, "[artist-images] persist failed"));
}

async function resolveOne(name: string, sources: Awaited<ReturnType<typeof loadStoredImages>>): Promise<ArtistImageResolution> {
  const key = normalizeName(name);
  const cached = memoryCache.get(key);
  if (cached) return { ...cached, artistName: name };
  const missAt = missCache.get(key);
  if (missAt && Date.now() - missAt < MISS_TTL) {
    return { artistName: name, imageUrl: null, source: "none", status: "missing", reason: "No validated artist portrait was found", providerName: null, diagnostics: [{ source: "none", status: "missing", reason: "No validated artist portrait was found" }] };
  }

  const candidates: Array<{ url: string; source: ArtistImageSource; providerName: string | null }> = [];
  const diagnostics: ArtistImageResolution["diagnostics"] = [];
  const stored = sources.stored.get(key);
  if (stored) candidates.push({ url: stored, source: "stored", providerName: null });
  const spotify = sources.spotify.get(key);
  if (spotify) candidates.push({ url: spotify, source: "spotify", providerName: null });

  const failures: string[] = [];
  for (const candidate of candidates) {
    const validation = await validateImageUrl(candidate.url);
    if (validation.status === "valid") {
      diagnostics.push({ source: candidate.source, status: "valid", reason: null });
      const result: ArtistImageResolution = { artistName: name, imageUrl: candidate.url, source: candidate.source, status: "valid", reason: null, providerName: candidate.providerName, diagnostics };
      memoryCache.set(key, result);
      persistImage(key, candidate.url);
      return result;
    }
    diagnostics.push({ source: candidate.source, status: validation.status, reason: validation.reason });
    failures.push(`${candidate.source}: ${validation.reason ?? validation.status}`);
  }

  for (const provider of [deezerCandidate, itunesCandidate]) {
    const candidate = await provider(name);
    if (!candidate) continue;
    if ("mismatch" in candidate) {
      diagnostics.push({ source: provider === deezerCandidate ? "deezer" : "itunes", status: "mismatched", reason: candidate.mismatch });
      failures.push(candidate.mismatch);
      continue;
    }
    const validation = await validateImageUrl(candidate.url);
    if (validation.status === "valid") {
      diagnostics.push({ source: candidate.source, status: "valid", reason: null });
      const result: ArtistImageResolution = { artistName: name, imageUrl: candidate.url, source: candidate.source, status: "valid", reason: null, providerName: candidate.providerName, diagnostics };
      memoryCache.set(key, result);
      persistImage(key, candidate.url);
      return result;
    }
    diagnostics.push({ source: candidate.source, status: validation.status, reason: validation.reason });
    failures.push(`${candidate.source}: ${validation.reason ?? validation.status}`);
  }

  missCache.set(key, Date.now());
  const status: ArtistImageStatus = failures.some((failure) => /mismatch/i.test(failure)) ? "mismatched" : "missing";
  if (!diagnostics.length) diagnostics.push({ source: "none", status: "missing", reason: "No image candidates were returned by the configured providers" });
  return {
    artistName: name,
    imageUrl: null,
    source: "none",
    status,
    reason: failures[0] ?? "No image candidates were returned by the configured providers",
    providerName: null,
    diagnostics,
  };
}

export async function resolveArtistImages(names: readonly string[]): Promise<ArtistImageResolution[]> {
  const unique = Array.from(new Map(names.map((name) => [normalizeName(name), name.trim()])).values()).filter(Boolean);
  const sources = await loadStoredImages();
  const results: ArtistImageResolution[] = [];
  for (let index = 0; index < unique.length; index += 10) {
    const batch = unique.slice(index, index + 10);
    results.push(...await Promise.all(batch.map((name) => {
      const key = normalizeName(name);
      const existing = pending.get(key);
      if (existing) return existing.then((result) => ({ ...result, artistName: name }));
      const task = resolveOne(name, sources).finally(() => pending.delete(key));
      pending.set(key, task);
      return task;
    })));
  }
  return results;
}

export async function auditArtistImageCoverage(names: readonly string[]): Promise<{
  generatedAt: string;
  total: number;
  byStatus: Record<ArtistImageStatus, number>;
  diagnosticsByStatus: Record<ArtistImageStatus, number>;
  bySource: Record<ArtistImageSource, number>;
  unresolved: Array<{ artistName: string; status: ArtistImageStatus; reason: string | null }>;
}> {
  const resolutions = await resolveArtistImages(names);
  const byStatus = Object.fromEntries(
    (["valid", "missing", "unreachable", "invalid-content-type", "invalid-dimensions", "placeholder", "mismatched"] as ArtistImageStatus[])
      .map((status) => [status, resolutions.filter((item) => item.status === status).length]),
  ) as Record<ArtistImageStatus, number>;
  const bySource = Object.fromEntries(
    (["stored", "spotify", "deezer", "itunes", "none"] as ArtistImageSource[])
      .map((source) => [source, resolutions.filter((item) => item.source === source).length]),
  ) as Record<ArtistImageSource, number>;
  const diagnosticStatuses: ArtistImageStatus[] = ["valid", "missing", "unreachable", "invalid-content-type", "invalid-dimensions", "placeholder", "mismatched"];
  const diagnosticsByStatus = Object.fromEntries(
    diagnosticStatuses.map((status) => [
      status,
      resolutions.reduce((count, resolution) => count + resolution.diagnostics.filter((diagnostic) => diagnostic.status === status).length, 0),
    ]),
  ) as Record<ArtistImageStatus, number>;
  return {
    generatedAt: new Date().toISOString(),
    total: resolutions.length,
    byStatus,
    diagnosticsByStatus,
    bySource,
    unresolved: resolutions
      .filter((item) => item.status !== "valid")
      .map((item) => ({ artistName: item.artistName, status: item.status, reason: item.reason }))
      .sort((a, b) => a.artistName.localeCompare(b.artistName, "es")),
  };
}

export function clearArtistImageCache(): void {
  memoryCache.clear();
  missCache.clear();
  validationCache.clear();
}

export function artistImageCacheStats() {
  return { valid: memoryCache.size, recentMisses: missCache.size, validatedUrls: validationCache.size };
}

export function validateArtistImagePayload(contentType: string, data: Uint8Array): ImageValidation {
  if (!contentType.toLowerCase().startsWith("image/")) {
    return { status: "invalid-content-type", reason: `Expected an image but received ${contentType || "unknown content type"}`, width: null, height: null };
  }
  if (data.byteLength > MAX_IMAGE_BYTES) {
    return { status: "invalid-dimensions", reason: `Image exceeds ${MAX_IMAGE_BYTES} byte safety limit`, width: null, height: null };
  }
  const dimensions = readDimensions(data);
  if (!dimensions || dimensions[0] < MIN_IMAGE_DIMENSION || dimensions[1] < MIN_IMAGE_DIMENSION) {
    return { status: "invalid-dimensions", reason: "Image has no readable dimensions or is too small", width: dimensions?.[0] ?? null, height: dimensions?.[1] ?? null };
  }
  return { status: "valid", reason: null, width: dimensions[0], height: dimensions[1] };
}

export function parseArtistNamesFromCsv(csv: string): string[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (char === '"' && csv[index + 1] === '"' && quoted) {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  const headers = rows[0]?.map((header) => normalizeName(header)) ?? [];
  const nameIndex = headers.indexOf("artist name");
  return Array.from(new Set(rows.slice(1).map((values) => values[nameIndex]?.trim()).filter(Boolean))) as string[];
}

export { METADATA_SHEET_URL };