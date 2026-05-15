import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

// Wikipedia (Spanish) artist bio — free public API, no key required
// Summary endpoint: https://es.wikipedia.org/api/rest_v1/page/summary/{title}
// Search endpoint:  https://es.wikipedia.org/w/api.php

const WIKI_SUMMARY_BASE = "https://es.wikipedia.org/api/rest_v1/page/summary";
const WIKI_SEARCH_BASE  = "https://es.wikipedia.org/w/api.php";

const BIO_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const WIKI_HEADERS = {
  "User-Agent": "MexicoCharts/1.0 (https://mexicochart.com; contact@mexicochart.com)",
  "Accept": "application/json",
};

interface BioCacheEntry {
  bio: string | null;
  pageTitle: string | null;
  pageUrl: string | null;
  thumbnailUrl: string | null;
  cachedAt: number;
}

const bioCache = new Map<string, BioCacheEntry>();

interface WikiSummaryResponse {
  title?: string;
  extract?: string;
  type?: string;
  content_urls?: { desktop?: { page?: string } };
  thumbnail?: { source?: string };
  description?: string;
}

interface WikiSearchResult {
  title: string;
}

function cleanExtract(text: string): string {
  return text
    .replace(/\s*\(escuchar\)/gi, "")
    .replace(/\[\d+\]/g, "")
    .trim();
}

function truncateBio(extract: string): string {
  const sentences = extract.split(/(?<=[.!?])\s+/);
  const joined    = sentences.slice(0, 3).join(" ");
  const cleaned   = cleanExtract(joined);
  if (cleaned.length > 650) return cleaned.slice(0, 650).replace(/\s+\S*$/, "…");
  return cleaned;
}

// Fetch summary for a given page title — returns null if not a music article
async function fetchSummary(title: string): Promise<WikiSummaryResponse | null> {
  try {
    const encoded = encodeURIComponent(title.replace(/ /g, "_"));
    const resp    = await fetch(`${WIKI_SUMMARY_BASE}/${encoded}`, {
      headers: WIKI_HEADERS,
      signal: AbortSignal.timeout(7_000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as WikiSummaryResponse;
    // Reject disambiguation pages
    if (data.type === "disambiguation") return null;
    return data;
  } catch {
    return null;
  }
}

// Check if a summary is about a music artist (not a boxing category, city, etc.)
function isMusicArtist(data: WikiSummaryResponse): boolean {
  const text  = ((data.extract ?? "") + " " + (data.description ?? "")).toLowerCase();
  const music = ["cantante", "cantan", "música", "músico", "artista", "banda", "grupo musical",
                 "rapero", "reguetonero", "corrido", "compositor", "discográfica", "álbum", "sencillo"];
  return music.some(kw => text.includes(kw));
}

// Candidate page titles to try in order for a given artist name
function candidateTitles(name: string): string[] {
  return [
    `${name} (cantante)`,
    `${name} (músico)`,
    `${name} (banda)`,
    `${name} (grupo musical)`,
    name,
  ];
}

async function searchWiki(query: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      action: "query", list: "search",
      srsearch: query, srlimit: "5",
      format: "json", origin: "*",
    });
    const resp = await fetch(`${WIKI_SEARCH_BASE}?${params}`, {
      headers: WIKI_HEADERS, signal: AbortSignal.timeout(7_000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as { query?: { search?: WikiSearchResult[] } };
    return data.query?.search?.[0]?.title ?? null;
  } catch {
    return null;
  }
}

async function fetchWikiBio(artistName: string): Promise<BioCacheEntry> {
  const empty: BioCacheEntry = {
    bio: null, pageTitle: null, pageUrl: null, thumbnailUrl: null, cachedAt: Date.now(),
  };

  // Strategy 1: try disambiguation-aware candidate titles directly
  for (const title of candidateTitles(artistName)) {
    const data = await fetchSummary(title);
    if (data?.extract && isMusicArtist(data)) {
      return {
        bio:          truncateBio(data.extract),
        pageTitle:    data.title ?? title,
        pageUrl:      data.content_urls?.desktop?.page ?? null,
        thumbnailUrl: data.thumbnail?.source ?? null,
        cachedAt:     Date.now(),
      };
    }
  }

  // Strategy 2: search Wikipedia with music context, then fetch that page
  const searchTitle = await searchWiki(`${artistName} cantante músico`);
  if (searchTitle) {
    const data = await fetchSummary(searchTitle);
    if (data?.extract && isMusicArtist(data)) {
      return {
        bio:          truncateBio(data.extract),
        pageTitle:    data.title ?? searchTitle,
        pageUrl:      data.content_urls?.desktop?.page ?? null,
        thumbnailUrl: data.thumbnail?.source ?? null,
        cachedAt:     Date.now(),
      };
    }
  }

  logger.info({ artistName }, "[wiki] no music article found");
  return empty;
}

// GET /api/providers/wiki/artist?name={name}
router.get("/providers/wiki/artist", async (req, res) => {
  const name = (req.query.name as string | undefined)?.trim();
  if (!name) { res.status(400).json({ error: "name is required" }); return; }

  const cacheKey = name.toLowerCase();
  const cached   = bioCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < BIO_TTL_MS) {
    res.setHeader("X-Cache", "HIT");
    res.json({ provider: "wiki", ...cached });
    return;
  }

  logger.info({ name }, "[wiki] fetching bio");
  const entry = await fetchWikiBio(name);
  bioCache.set(cacheKey, entry);

  res.setHeader("X-Cache", "MISS");
  res.json({ provider: "wiki", ...entry });
});

export default router;
