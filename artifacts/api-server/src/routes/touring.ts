import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

const TM_KEY = process.env.TICKETMASTER_API_KEY ?? "";
const ADMIN_KEY = () => (
  process.env["NEWSLETTER_ADMIN_KEY"] ||
  process.env["YOUTUBE_ADMIN_KEY"] ||
  process.env["SPOTIFY_ADMIN_KEY"] ||
  ""
).trim();
const TM_BASE = "https://app.ticketmaster.com/discovery/v2";

const ARTISTS = [
  // — original tracked —
  { id: "fuerza-regida",              name: "Fuerza Regida",                attractionId: "K8vZ9179vO0" },
  { id: "banda-ms",                   name: "Banda MS",                     attractionId: "K8vZ917CCl7" },
  { id: "grupo-firme",                name: "Grupo Firme",                  attractionId: "K8vZ917bY9V" },
  { id: "junior-h",                   name: "Junior H",                     attractionId: "K8vZ917_JZV" },
  { id: "peso-pluma",                 name: "Peso Pluma",                   attractionId: "K8vZ917h54V" },
  { id: "eslabon-armado",             name: "Eslabon Armado",               attractionId: "K8vZ917_Wef" },
  { id: "natanael-cano",              name: "Natanael Cano",                attractionId: "K8vZfZ7aEdk" },
  { id: "carin-leon",                 name: "Carín León",                   attractionId: "K8vZ917_m_f" },
  { id: "eden-munoz",                 name: "Edén Muñoz",                   attractionId: "K8vZ917Q93f" },
  { id: "christian-nodal",            name: "Christian Nodal",              attractionId: "K8vZ917p2Pf" },
  { id: "larry-hernandez",            name: "Larry Hernandez",              attractionId: "K8vZ917uQyV" },
  { id: "xavi",                       name: "Xavi",                         attractionId: "K8vZ917_Jlf" },
  { id: "los-dos-carnales",           name: "Los Dos Carnales",             attractionId: "K8vZ917_f-V" },
  // — added from full-DB scan (Mexican artists only) —
  { id: "duelo",                      name: "Grupo Duelo",                  attractionId: "K8vZ917uYv7" },
  { id: "los-tigres-del-norte",       name: "Los Tigres del Norte",         attractionId: "K8vZ9171187" },
  { id: "mana",                       name: "Maná",                         attractionId: "K8vZ9171Kyf" },
  { id: "omar-courtz",                name: "Omar Courtz",                  attractionId: "K8vZ917hq_0" },
  { id: "cristian-castro",            name: "Cristian Castro",              attractionId: "K8vZ9175rm0" },
  { id: "los-tucanes-de-tijuana",     name: "Los Tucanes de Tijuana",       attractionId: "K8vZ9171NCf" },
  { id: "mariachi-vargas-de-tecalitlan", name: "Mariachi Vargas de Tecalitlán", attractionId: "K8vZ9171JGV" },
  { id: "hermanos-espinoza",          name: "Hermanos Espinoza",            attractionId: "K8vZ917rqOV" },
  { id: "ramon-ayala",                name: "Ramón Ayala",                  attractionId: "K8vZ91759_V" },
  { id: "julieta-venegas",            name: "Julieta Venegas",              attractionId: "K8vZ9171gsf" },
  { id: "jesse-joy",                  name: "Jesse & Joy",                  attractionId: "K8vZ917G1wV" },
  { id: "jose-maria-napoleon",        name: "José María Napoleón",          attractionId: "K8vZ917CAS0" },
  { id: "los-angeles-azules",         name: "Los Ángeles Azules",           attractionId: "K8vZ9175pMV" },
  { id: "lucero",                     name: "Lucero",                       attractionId: "K8vZ917GcKf" },
  { id: "caifanes",                   name: "Caifanes",                     attractionId: "K8vZ917112V" },
  { id: "intocable",                  name: "Intocable",                    attractionId: "K8vZ9171WO7" },
  { id: "lalo-mora",                  name: "Lalo Mora",                    attractionId: "K8vZ917GzX0" },
  { id: "natalia-lafourcade",         name: "Natalia Lafourcade",           attractionId: "K8vZ917ueX7" },
  { id: "siddhartha",                 name: "Siddhartha",                   attractionId: "K8vZ917CUD0" },
  { id: "gloria-trevi",               name: "Gloria Trevi",                 attractionId: "K8vZ9175YN7" },
  { id: "kenia-os",                   name: "Kenia Os",                     attractionId: "K8vZ917_WHf" },
  { id: "roz",                        name: "Røz",                          attractionId: "K8vZ917rpkf" },
  { id: "yeri-mua",                   name: "Yeri Mua",                     attractionId: "K8vZ917j2K7" },
  { id: "grupo-bryndis",              name: "Grupo Bryndis",                attractionId: "K8vZ917f3-f" },
  { id: "guardianes-del-amor",        name: "Guardianes del Amor",          attractionId: "K8vZ917KBE7" },
  { id: "industria-del-amor",         name: "Industria del Amor",           attractionId: "K8vZ917Gta7" },
  { id: "christian-chavez",           name: "Christian Chávez",             attractionId: "K8vZ917CnQ0" },
  { id: "haash",                      name: "Ha*Ash",                       attractionId: "K8vZ917CW60" },
  { id: "nsqk",                       name: "NSQK",                         attractionId: "K8vZ917hfL7" },
  { id: "pancho-barraza",             name: "Pancho Barraza",               attractionId: "K8vZ91788DV" },
  { id: "santos-bravos",              name: "Santos Bravos",                attractionId: "K8vZ917LjIf" },
  { id: "alejandro-fernandez",        name: "Alejandro Fernández",          attractionId: "K8vZ9171afV" },
  { id: "banda-machos",               name: "Banda Machos",                 attractionId: "K8vZ9171a40" },
  { id: "el-coyote",                  name: "El Coyote",                    attractionId: "K8vZ9174eGf" },
  { id: "lupillo-rivera",             name: "Lupillo Rivera",               attractionId: "K8vZ9171UtV" },
  { id: "temper-city",                name: "Temper City",                  attractionId: "K8vZ917O7xf" },
  { id: "enjambre",                   name: "Enjambre",                     attractionId: "K8vZ9175RK7" },
  { id: "luis-angel-el-flaco",        name: "Luis Angel \"El Flaco\"",      attractionId: "K8vZ917_6yf" },
  { id: "paty-cantu",                 name: "Paty Cantú",                   attractionId: "K8vZ917CHQf" },
  { id: "alicia-villarreal",          name: "Alicia Villarreal",            attractionId: "K8vZ9175znf" },
  { id: "el-fantasma",                name: "El Fantasma",                  attractionId: "K8vZ9179ZNV" },
  { id: "el-halcon-de-la-sierra",     name: "El Halcón de la Sierra",       attractionId: "K8vZ917hls7" },
  { id: "gerardo-ortiz",              name: "Gerardo Ortiz",                attractionId: "K8vZ917CwK7" },
  { id: "grupo-arriesgado",           name: "Grupo Arriesgado",             attractionId: "K8vZ917QYL7" },
  { id: "lila-downs",                 name: "Lila Downs",                   attractionId: "K8vZ9171sw0" },
  { id: "rogelio-martinez",           name: "Rogelio Martinez",             attractionId: "K8vZ917uwv7" },
  { id: "yuridia",                    name: "Yuridia",                      attractionId: "K8vZ917Gdu7" },
  { id: "amanda-miguel",              name: "Amanda Miguel",                attractionId: "K8vZ9175gZ0" },
  { id: "la-sonora-dinamita",         name: "La Sonora Dinamita",           attractionId: "K8vZ917uPbf" },
  { id: "aida-cuevas",                name: "Aida Cuevas",                  attractionId: "K8vZ9173cmV" },
  { id: "aleks-syntek",               name: "Aleks Syntek",                 attractionId: "K8vZ9175dH7" },
  { id: "banda-cuisillos",            name: "Banda Cuisillos",              attractionId: "K8vZ9175AA7" },
  { id: "banda-el-recodo",            name: "Banda El Recodo",              attractionId: "K8vZ9171NQ0" },
  { id: "banda-maguey",               name: "Banda Maguey",                 attractionId: "K8vZ917usD0" },
  { id: "camila-fernandez",           name: "Camila Fernández",             attractionId: "K8vZ917rp3f" },
  { id: "charles-ans",                name: "Charles Ans",                  attractionId: "K8vZ917QxB7" },
  { id: "codiciado",                  name: "Codiciado",                    attractionId: "K8vZ917j4x0" },
  { id: "el-as-de-la-sierra",         name: "El As de la Sierra",           attractionId: "K8vZ917hlm7" },
  { id: "jorge-medina",               name: "Jorge Medina",                 attractionId: "K8vZ917_9pf" },
  { id: "josi-cuen",                  name: "Josi Cuen",                    attractionId: "K8vZ917qDTV" },
  { id: "julio-preciado",             name: "Julio Preciado",               attractionId: "K8vZ9172cDV" },
  { id: "kane-rodriguez",             name: "Kane Rodriguez",               attractionId: "K8vZ917LkH7" },
  { id: "la-fiera-de-ojinaga",        name: "La Fiera de Ojinaga",          attractionId: "K8vZ917bnoV" },
  { id: "la-la-love-you",             name: "La La Love You",               attractionId: "K8vZ917jCG7" },
  { id: "majo-aguilar",               name: "Majo Aguilar",                 attractionId: "K8vZ917hdIf" },
  { id: "marco-antonio-solis",        name: "Marco Antonio Solís",          attractionId: "K8vZ9171hn0" },
  { id: "mi-banda-el-mexicano",       name: "Mi Banda el Mexicano",         attractionId: "K8vZ917KQU0" },
  { id: "mijares",                    name: "Mijares",                      attractionId: "K8vZ91711K7" },
  { id: "millonario",                 name: "Millonario",                   attractionId: "K8vZ917_k30" },
  { id: "panteon-rococo",             name: "Panteón Rococó",               attractionId: "K8vZ9175I9V" },
  { id: "remmy-valenzuela",           name: "Remmy Valenzuela",             attractionId: "K8vZ917hBNf" },
  { id: "roberto-tapia",              name: "Roberto Tapia",                attractionId: "K8vZ917GHBf" },
  { id: "victor-garcia",              name: "Victor Garcia",                attractionId: "K8vZ917qSJ0" },
  { id: "yami-safdie",                name: "Yami Safdie",                  attractionId: "K8vZ917jR8f" },
  { id: "banda-carnaval",             name: "Banda Carnaval",               attractionId: "K8vZ9178Uef" },
  { id: "banda-los-recoditos",        name: "Banda Los Recoditos",          attractionId: "K8vZ917uBA0" },
  { id: "banda-r-15",                 name: "Banda R-15",                   attractionId: "K8vZ917L_90" },
  { id: "bobby-pulido",               name: "Bobby Pulido",                 attractionId: "K8vZ917G6B0" },
  { id: "carlos-rivera",              name: "Carlos Rivera",                attractionId: "K8vZ9174-97" },
  { id: "chino-pacas",                name: "Chino Pacas",                  attractionId: "K8vZ917jCQV" },
  { id: "clave-especial",             name: "Clave Especial",               attractionId: "K8vZ917qMg7" },
  { id: "cornelio-vega",              name: "Cornelio Vega",                attractionId: "K8vZ9179vqf" },
  { id: "esteban-gabriel",            name: "Esteban Gabriel",              attractionId: "K8vZ917Q5Q0" },
  { id: "espinoza-paz",               name: "Espinoza Paz",                 attractionId: "K8vZ917GEf7" },
  { id: "ezequiel-pena",              name: "Ezequiel Peña",                attractionId: "K8vZ9175k70" },
  { id: "gerardo-coronel",            name: "Gerardo Coronel",              attractionId: "K8vZ917brPV" },
  { id: "grupo-yndio",                name: "Grupo Yndio",                  attractionId: "K8vZ917ujY7" },
  { id: "la-adictiva",                name: "La Adictiva",                  attractionId: "K8vZ917_EX0" },
  { id: "linea-personal",             name: "Linea Personal",               attractionId: "K8vZ917qD3f" },
  { id: "los-fugitivos",              name: "Los Fugitivos",                attractionId: "K8vZ9174cdV" },
  { id: "los-inquietos-del-norte",    name: "Los Inquietos del Norte",      attractionId: "K8vZ917GICf" },
  { id: "los-rehenes",                name: "Los Rehenes",                  attractionId: "K8vZ9178r10" },
  { id: "los-socios-del-ritmo",       name: "Los Socios del Ritmo",         attractionId: "K8vZ9174SZ7" },
  { id: "marca-registrada",           name: "Marca Registrada",             attractionId: "K8vZ917_91V" },
  { id: "maria-jose",                 name: "María José",                   attractionId: "K8vZ917CMWV" },
  { id: "marco-flores-y-la-jerez",    name: "Marco Flores y La Jerez",      attractionId: "Z7r9jZaomB" },
  { id: "matisse",                    name: "Matisse",                      attractionId: "K8vZ917psv7" },
  { id: "moenia",                     name: "Moenia",                       attractionId: "K8vZ9175eSV" },
  { id: "montez-de-durango",          name: "Montez de Durango",            attractionId: "K8vZ9175LXV" },
  { id: "neton-vega",                 name: "Netón Vega",                   attractionId: "K8vZ917q087" },
  { id: "patrulla-81",                name: "Patrulla 81",                  attractionId: "K8vZ917qkH7" },
  { id: "pepe-aguilar",               name: "Pepe Aguilar",                 attractionId: "K8vZ9171hVf" },
  { id: "pesado",                     name: "Pesado",                       attractionId: "K8vZ9175_H0" },
  { id: "regulo-caro",                name: "Régulo Caro",                  attractionId: "K8vZ9172gXf" },
  { id: "sin-bandera",                name: "Sin Bandera",                  attractionId: "K8vZ9175Ml7" },
  { id: "t3r-elemento",               name: "T3R Elemento",                 attractionId: "K8vZ917beL0" },
  { id: "victor-mendivil",            name: "Víctor Mendivil",              attractionId: "K8vZ917rbvf" },
  { id: "virlan-garcia",              name: "Virlán García",                attractionId: "K8vZ917pmCV" },
  { id: "yan-block",                  name: "Yan Block",                    attractionId: "K8vZ917rls0" },
  { id: "yuri",                       name: "Yuri",                         attractionId: "K8vZ917GFv0" },
  { id: "oscar-maydon",               name: "Óscar Maydon",                 attractionId: "K8vZ917hmUf" },
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

function isAdminAuthed(req: { headers: Record<string, string | string[] | undefined>; query: Record<string, unknown> }): boolean {
  const key = ADMIN_KEY();
  if (!key) return false;
  const header = req.headers["x-admin-key"];
  const qkey = req.query["adminKey"];
  return header === key || qkey === key;
}

function requireAdmin(
  req: Parameters<Parameters<typeof router.get>[1]>[0],
  res: Parameters<Parameters<typeof router.get>[1]>[1],
): boolean {
  if (!isAdminAuthed(req as Parameters<typeof isAdminAuthed>[0])) {
    res.status(403).json({ error: "Forbidden — provide X-Admin-Key header" });
    return false;
  }
  return true;
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

router.get("/admin/touring/coverage", async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const rows = ARTISTS.map(artist => {
    const cached = cache.get(artist.id);
    return {
      id: artist.id,
      name: artist.name,
      attractionId: artist.attractionId,
      eventCount: cached?.events.length ?? 0,
      fetchedAt: cached?.fetchedAt ? new Date(cached.fetchedAt).toISOString() : null,
      stale: !cached || !isFresh(cached),
      nextEvent: cached?.events[0] ?? null,
    };
  });
  const checked = rows.filter(row => row.fetchedAt);
  const withShows = rows.filter(row => row.eventCount > 0);
  const withoutShows = rows.filter(row => row.fetchedAt && row.eventCount === 0);
  const stale = rows.filter(row => row.stale);
  const fetchTimes = checked
    .map(row => row.fetchedAt ? new Date(row.fetchedAt) : null)
    .filter((date): date is Date => Boolean(date));
  const newestFetch = fetchTimes.sort((a, b) => b.getTime() - a.getTime())[0] ?? null;
  const oldestFetch = fetchTimes.sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  res.setHeader("Cache-Control", "no-store");
  res.json({
    provider: "ticketmaster",
    configured: Boolean(TM_KEY),
    totalTracked: ARTISTS.length,
    checked: checked.length,
    stale: stale.length,
    withUpcomingShows: withShows.length,
    withoutUpcomingShows: withoutShows.length,
    newestFetchAt: newestFetch?.toISOString() ?? null,
    oldestFetchAt: oldestFetch?.toISOString() ?? null,
    withShowsPreview: withShows.slice(0, 12),
    stalePreview: stale.slice(0, 12),
  });
});

export default router;
