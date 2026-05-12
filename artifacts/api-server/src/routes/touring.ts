import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

const TM_KEY = process.env.TICKETMASTER_API_KEY ?? "";
const TM_BASE = "https://app.ticketmaster.com/discovery/v2";

const ARTISTS = [
  { id: "fuerza-regida",   name: "Fuerza Regida",   attractionId: "K8vZ9179vO0" },
  { id: "banda-ms",        name: "Banda MS",         attractionId: "K8vZ917CCl7" },
  { id: "grupo-firme",     name: "Grupo Firme",      attractionId: "K8vZ917bY9V" },
  { id: "junior-h",        name: "Junior H",         attractionId: "K8vZ917_JZV" },
  { id: "peso-pluma",      name: "Peso Pluma",       attractionId: "K8vZ917h54V" },
  { id: "eslabon-armado",  name: "Eslabon Armado",   attractionId: "K8vZ917_Wef" },
  { id: "natanael-cano",   name: "Natanael Cano",    attractionId: "K8vZfZ7aEdk" },
];

interface TmEvent {
  name: string;
  date: string;
  time: string | null;
  venue: string;
  city: string;
  state: string;
  country: string;
  url: string;
  img: string | null;
  eventId: string;
}

interface ArtistTours {
  id: string;
  name: string;
  events: TmEvent[];
  fetchedAt: number;
}

const cache = new Map<string, ArtistTours>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

function isFresh(entry: ArtistTours) {
  return Date.now() - entry.fetchedAt < CACHE_TTL;
}

function bestImage(images: { ratio?: string; url: string; width?: number }[]): string | null {
  const landscape = images
    .filter(i => i.ratio === "16_9" && (i.width ?? 0) >= 640)
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return landscape[0]?.url ?? images[0]?.url ?? null;
}

async function fetchArtistEvents(attractionId: string): Promise<TmEvent[]> {
  const url =
    `${TM_BASE}/events.json?apikey=${TM_KEY}` +
    `&attractionId=${attractionId}&size=20&sort=date,asc` +
    `&startDateTime=${new Date().toISOString().split("T")[0]}T00:00:00Z`;

  const res = await fetch(url);
  if (!res.ok) {
    logger.warn({ status: res.status, attractionId }, "[touring] TM API error");
    return [];
  }

  const data = (await res.json()) as {
    _embedded?: {
      events?: {
        id: string;
        name: string;
        url: string;
        images?: { ratio?: string; url: string; width?: number }[];
        dates?: { start?: { localDate?: string; localTime?: string } };
        _embedded?: {
          venues?: {
            name?: string;
            city?: { name?: string };
            state?: { stateCode?: string };
            country?: { countryCode?: string };
          }[];
        };
      }[];
    };
  };

  const events = data._embedded?.events ?? [];
  return events.map(e => {
    const venue = e._embedded?.venues?.[0];
    return {
      eventId: e.id,
      name: e.name,
      date: e.dates?.start?.localDate ?? "",
      time: e.dates?.start?.localTime ?? null,
      venue: venue?.name ?? "",
      city: venue?.city?.name ?? "",
      state: venue?.state?.stateCode ?? "",
      country: venue?.country?.countryCode ?? "",
      url: e.url ?? "",
      img: bestImage(e.images ?? []),
    };
  });
}

router.get("/touring/concerts", async (req, res) => {
  if (!TM_KEY) {
    return res.status(503).json({ error: "TICKETMASTER_API_KEY not configured" });
  }

  const stale = ARTISTS.filter(a => {
    const cached = cache.get(a.id);
    return !cached || !isFresh(cached);
  });

  if (stale.length > 0) {
    await Promise.allSettled(
      stale.map(async artist => {
        try {
          const events = await fetchArtistEvents(artist.attractionId);
          cache.set(artist.id, { ...artist, events, fetchedAt: Date.now() });
          logger.info({ artist: artist.id, count: events.length }, "[touring] fetched");
        } catch (err) {
          logger.warn({ err, artist: artist.id }, "[touring] fetch failed");
          if (!cache.has(artist.id)) {
            cache.set(artist.id, { ...artist, events: [], fetchedAt: Date.now() });
          }
        }
      })
    );
  }

  const result = ARTISTS.map(a => cache.get(a.id) ?? { ...a, events: [], fetchedAt: 0 });
  return res.json({ artists: result, cachedAt: Date.now() });
});

router.get("/touring/concerts/:artistId", async (req, res) => {
  if (!TM_KEY) {
    return res.status(503).json({ error: "TICKETMASTER_API_KEY not configured" });
  }

  const { artistId } = req.params;
  const artist = ARTISTS.find(a => a.id === artistId);
  if (!artist) return res.status(404).json({ error: "Artist not found" });

  const cached = cache.get(artistId);
  if (cached && isFresh(cached)) {
    return res.json(cached);
  }

  try {
    const events = await fetchArtistEvents(artist.attractionId);
    const entry: ArtistTours = { ...artist, events, fetchedAt: Date.now() };
    cache.set(artistId, entry);
    return res.json(entry);
  } catch (err) {
    logger.warn({ err, artistId }, "[touring] fetch failed");
    return res.status(502).json({ error: "Failed to fetch from Ticketmaster" });
  }
});

export default router;
