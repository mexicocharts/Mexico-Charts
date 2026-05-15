import { Router } from "express";
import OpenAI from "openai";
import { logger } from "../lib/logger";

const router = Router();

// Wikipedia (Spanish) artist bio enriched with AI rewriting
// Wikipedia: free public API, no key required
// Bio enhancement: OpenAI via Replit AI Integrations

const WIKI_SUMMARY_BASE = "https://es.wikipedia.org/api/rest_v1/page/summary";
const WIKI_SEARCH_BASE  = "https://es.wikipedia.org/w/api.php";

const BIO_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const WIKI_HEADERS = {
  "User-Agent": "MexicoCharts/1.0 (https://mexicochart.com; contact@mexicochart.com)",
  "Accept": "application/json",
};

const openai = new OpenAI({
  baseURL: process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"],
  apiKey:  process.env["AI_INTEGRATIONS_OPENAI_API_KEY"],
});

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
    .replace(/\(en inglés: [^)]+\)/g, "")
    .trim();
}

async function fetchSummary(title: string): Promise<WikiSummaryResponse | null> {
  try {
    const encoded = encodeURIComponent(title.replace(/ /g, "_"));
    const resp    = await fetch(`${WIKI_SUMMARY_BASE}/${encoded}`, {
      headers: WIKI_HEADERS,
      signal: AbortSignal.timeout(7_000),
    });
    if (!resp.ok) return null;
    const data = await resp.json() as WikiSummaryResponse;
    if (data.type === "disambiguation") return null;
    return data;
  } catch {
    return null;
  }
}

function isMusicArtist(data: WikiSummaryResponse): boolean {
  const text = ((data.extract ?? "") + " " + (data.description ?? "")).toLowerCase();
  return ["cantante", "cantan", "música", "músico", "artista", "banda", "grupo musical",
          "rapero", "reguetonero", "corrido", "compositor", "discográfica", "álbum", "sencillo"]
    .some(kw => text.includes(kw));
}

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

// Truncate a Wikipedia extract to a manageable length for the AI prompt
function trimExtract(text: string, maxChars = 1200): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastPeriod = cut.lastIndexOf(".");
  return lastPeriod > 600 ? cut.slice(0, lastPeriod + 1) : cut + "…";
}

// Use AI to write an engaging music industry bio from Wikipedia facts
async function enhanceBioWithAI(rawExtract: string, artistName: string): Promise<string | null> {
  const sourceText = trimExtract(rawExtract);
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      max_completion_tokens: 8192,
      messages: [
        {
          role: "system",
          content:
            "Eres editor senior de Mexico Charts, la publicación de referencia de la industria musical mexicana. " +
            "Tu tarea: escribir una bio de artista de 2-3 oraciones en español, al estilo de Billboard Latinoamérica o Pitchfork en español. " +
            "El estilo es directo, impactante y con autoridad editorial. Habla de hechos concretos: origen, género, logros, impacto. " +
            "No uses frases vacías. No empieces con el nombre completo del artista. Evita 'es conocido por', 'ha logrado', 'ha ganado'. " +
            "Sin emojis. Sin comillas. Sin mencionar Wikipedia. Solo devuelve el texto final.\n\n" +
            "Ejemplos del estilo correcto:\n" +
            "- 'Originario de Guadalajara, Peso Pluma redefinió la música mexicana global con su fusión de corridos tumbados y trap, " +
            "convirtiéndose en el primer artista mexicano en encabezar el Billboard Global 200.'\n" +
            "- 'Desde San Bernardino, Fuerza Regida llevó los corridos tumbados al mainstream internacional con un sonido crudo y directo " +
            "que llenó foros y arenas a ambos lados de la frontera.'\n" +
            "- 'Junior H construyó su propio universo dentro del regional mexicano: productor, multiinstrumentista y pionero de un sonido " +
            "que mezcla corridos tumbados con introspección y estética trap.'",
        },
        {
          role: "user",
          content: `Artista: ${artistName}\n\nDatos de Wikipedia:\n${sourceText}`,
        },
      ],
    });
    const content = response.choices[0]?.message?.content?.trim();
    logger.info({ artistName, finish: response.choices[0]?.finish_reason, chars: content?.length }, "[wiki] AI bio generated");
    return content || null;
  } catch (err) {
    logger.warn({ err: (err as Error).message, artistName }, "[wiki] AI call failed");
    return null;
  }
}

// Plain 3-sentence truncation as last-resort fallback
function plainFallback(rawExtract: string): string {
  const sentences = rawExtract.split(/(?<=[.!?])\s+/);
  const joined    = sentences.slice(0, 3).join(" ");
  return cleanExtract(joined.length > 600 ? joined.slice(0, 600).replace(/\s+\S*$/, "…") : joined);
}

async function fetchWikiBio(artistName: string): Promise<BioCacheEntry> {
  const empty: BioCacheEntry = {
    bio: null, pageTitle: null, pageUrl: null, thumbnailUrl: null, cachedAt: Date.now(),
  };

  let wikiData: WikiSummaryResponse | null = null;

  // Strategy 1: try disambiguation-aware candidate titles directly
  for (const title of candidateTitles(artistName)) {
    const data = await fetchSummary(title);
    if (data?.extract && isMusicArtist(data)) {
      wikiData = data;
      break;
    }
  }

  // Strategy 2: search with music context
  if (!wikiData) {
    const searchTitle = await searchWiki(`${artistName} cantante músico`);
    if (searchTitle) {
      const data = await fetchSummary(searchTitle);
      if (data?.extract && isMusicArtist(data)) wikiData = data;
    }
  }

  if (!wikiData?.extract) {
    logger.info({ artistName }, "[wiki] no music article found");
    return empty;
  }

  // Enhance the bio with AI; fall back to plain truncation if AI fails
  const rawExtract = cleanExtract(wikiData.extract);
  const aiBio      = await enhanceBioWithAI(rawExtract, artistName);
  const bio        = aiBio ?? plainFallback(rawExtract);

  return {
    bio,
    pageTitle:    wikiData.title ?? null,
    pageUrl:      wikiData.content_urls?.desktop?.page ?? null,
    thumbnailUrl: wikiData.thumbnail?.source ?? null,
    cachedAt:     Date.now(),
  };
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
