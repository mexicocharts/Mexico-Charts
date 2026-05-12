import { useQuery } from "@tanstack/react-query";

// ── Raw row from /api/artists/metadata ──────────────────────────────────────

interface RawRow {
  artist_key?: string;
  artist_name?: string;
  source_country?: string;
  genre?: string;
  subgenre?: string;
  label?: string;
  spotify_monthly_listeners?: string;
  spotify_followers?: string;
  spotify_total_streams?: string;
  youtube_subscribers?: string;
  youtube_views?: string;
  tiktok_followers?: string;
  instagram_followers?: string;
  [key: string]: string | undefined;
}

// ── Normalized artist ────────────────────────────────────────────────────────

export interface ArtistMeta {
  artistKey: string;
  displayName: string;
  country: string;
  genre: string;
  subgenre: string;
  label: string;
  spotifyListeners: number;
  spotifyListenersFmt: string;
  spotifyStreams: number;
  spotifyStreamsFmt: string;
  youtubeSubscribers: number;
  youtubeSubscribersFmt: string;
  tiktokFollowers: number;
  tiktokFollowersFmt: string;
  instagramFollowers: number;
  instagramFollowersFmt: string;
}

// ── Subgenre fallback (mirrors web artistMetadata.ts + api artists.ts) ───────
// Applied when the sheet's subgenre column is blank. Sheet value always wins.

const SUBGENRE_BY_KEY: Record<string, string> = {
  /* Corridos Tumbados */
  "fuerza regida":                          "corridos tumbados",
  "peso pluma":                             "corridos tumbados",
  "junior h":                               "corridos tumbados",
  "neton vega":                             "corridos tumbados",
  "tito double p":                          "corridos tumbados",
  "el bogueto":                             "corridos tumbados",
  "oscar maydon":                           "corridos tumbados",
  "natanael cano":                          "corridos tumbados",
  "luis r conriquez":                       "corridos tumbados",
  "gabito ballesteros":                     "corridos tumbados",
  "calle 24":                               "corridos tumbados",
  "chino pacas":                            "corridos tumbados",
  "chuyin":                                 "corridos tumbados",
  "virlan garcia":                          "corridos tumbados",
  "gael valenzuela":                        "corridos tumbados",
  "emmanuellcortess":                       "corridos tumbados",
  "jasiel nunez":                           "corridos tumbados",
  "jorsshh":                                "corridos tumbados",
  "lencho":                                 "corridos tumbados",
  "los dos de tamaulipas":                  "corridos tumbados",
  "jr torres":                              "corridos tumbados",
  "ian cordova":                            "corridos tumbados",
  "el fantasma":                            "corridos tumbados",
  "estevan plazola":                        "corridos tumbados",
  "panter belico":                          "corridos tumbados",
  "el de las r s":                          "corridos tumbados",
  "gerardo coronel":                        "corridos tumbados",
  "esau ortiz":                             "corridos tumbados",
  "kane rodriguez":                         "corridos tumbados",
  "codiciado":                              "corridos tumbados",
  "los alegres del barranco":               "corridos tumbados",
  "dannylux":                               "corridos tumbados",
  "codigo fn":                              "corridos tumbados",
  "moy bobadilla":                          "corridos tumbados",
  "los dos carnales":                       "corridos tumbados",
  "grupo arriesgado":                       "corridos tumbados",

  /* Regional Mexicano */
  "grupo frontera":                         "regional mexicano",
  "carin leon":                             "regional mexicano",
  "christian nodal":                        "regional mexicano",
  "xavi":                                   "regional mexicano",
  "grupo firme":                            "regional mexicano",
  "victor mendivil":                        "regional mexicano",
  "grupo marca registrada":                 "regional mexicano",
  "alejandro fernandez":                    "regional mexicano",
  "lenin ramirez":                          "regional mexicano",
  "joan sebastian":                         "regional mexicano",
  "eslabon armado":                         "regional mexicano",
  "eden munoz":                             "regional mexicano",
  "los dareyes de la sierra":               "regional mexicano",
  "alfredo olivas":                         "regional mexicano",
  "vicente fernandez":                      "regional mexicano",
  "herencia de grandes":                    "regional mexicano",
  "omar camacho":                           "regional mexicano",
  "edgardo nunez":                          "regional mexicano",
  "juan gabriel":                           "regional mexicano",
  "clave especial":                         "regional mexicano",
  "los angeles azules":                     "regional mexicano",
  "gerardo ortiz":                          "regional mexicano",
  "yahritza y su esencia":                  "regional mexicano",
  "la adictiva":                            "regional mexicano",
  "los plebes del rancho de ariel camacho": "regional mexicano",
  "los bukis":                              "regional mexicano",
  "espinoza paz":                           "regional mexicano",
  "pepe aguilar":                           "regional mexicano",
  "ariel camacho y los plebes del rancho":  "regional mexicano",
  "ivan cornejo":                           "regional mexicano",
  "los temrarios":                          "regional mexicano",
  "bronco":                                 "regional mexicano",
  "el chapo de sinaloa":                    "regional mexicano",
  "edicion especial":                       "regional mexicano",
  "jr":                                     "regional mexicano",
  "grupo mojado":                           "regional mexicano",
  "valentin elizalde":                      "regional mexicano",
  "el komander":                            "regional mexicano",
  "sergio vega el shaka":                   "regional mexicano",
  "t3r elemento":                           "regional mexicano",
  "angela aguilar":                         "regional mexicano",
  "grupo canaveral":                        "regional mexicano",
  "chalino sanchez":                        "regional mexicano",
  "pancho barraza":                         "regional mexicano",
  "los angeles de charly":                  "regional mexicano",
  "el bebeto":                              "regional mexicano",
  "luis mexia":                             "regional mexicano",
  "grupo bryndis":                          "regional mexicano",
  "los gemelos de sinaloa":                 "regional mexicano",
  "regulo molina":                          "regional mexicano",
  "edwin luna y la trakalosa de monterrey": "regional mexicano",
  "ana gabriel":                            "regional mexicano",

  /* Norteño */
  "julion alvarez and su norteno banda":    "norteño",
  "calibre 50":                             "norteño",
  "los tigres del norte":                   "norteño",
  "los tucanes de tijuana":                 "norteño",
  "conjunto primavera":                     "norteño",
  "pesado":                                 "norteño",
  "los invasores de nuevo leon":            "norteño",
  "cardenales de nuevo leon":               "norteño",
  "bobby pulido":                           "norteño",
  "el duelo":                               "norteño",
  "intocable":                              "norteño",
  "hermanos espinoza":                      "norteño",

  /* Banda */
  "banda ms de sergio lizarraga":           "banda",
  "la arrolladora banda el limon":          "banda",
  "banda el recodo":                        "banda",
  "banda el recodo de cruz lizarraga":      "banda",
  "banda los recoditos":                    "banda",
  "el coyote y su banda tierra santa":      "banda",
  "remmy valenzuela":                       "banda",

  /* Hip-Hop */
  "yng lvcas":                              "hip-hop",
  "el malilla":                             "hip-hop",

  /* Pop */
  "luis miguel":                            "pop",
  "reik":                                   "pop",
  "marco antonio solis":                    "pop",
  "julieta venegas":                        "pop",
  "mon laferte":                            "pop",
  "jesse and joy":                          "pop",
  "cristian castro":                        "pop",
  "jose jose":                              "pop",
  "camila":                                 "pop",
  "belinda":                                "pop",
  "selena":                                 "pop",
  "belanova":                               "pop",
  "carla morrison":                         "pop",
  "thalia":                                 "pop",
  "ha ash":                                 "pop",
  "emmanuel":                               "pop",
  "gloria trevi":                           "pop",
  "sin bandera":                            "pop",
  "yurdia":                                 "pop",
  "kenia os":                               "pop",
  "humbe":                                  "pop",
  "diego verdaguer":                        "pop",
  "paulina rubio":                          "pop",
  "reyli barba":                            "pop",
  "alan arrieta":                           "pop",
  "kevin amf":                              "pop",
  "amanda miguel":                          "pop",
  "hupe$":                                  "pop",
  "angel almaguer":                         "pop",
  "yeri mua":                               "pop",
  "carlos rivera":                          "pop",
  "alejandra guzman":                       "pop",
  "marisela":                               "pop",
  "becky g":                                "pop",
  "bellakath":                              "pop",
  "armenta":                                "pop",
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseNum(raw: string | undefined): number {
  if (!raw) return 0;
  const s = raw.trim().toUpperCase();
  if (s.endsWith("M")) return Math.round(parseFloat(s) * 1_000_000);
  if (s.endsWith("K")) return Math.round(parseFloat(s) * 1_000);
  return parseInt(s.replace(/[^0-9]/g, ""), 10) || 0;
}

function fmtNum(n: number): string {
  if (n === 0) return "—";
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function getBaseUrl(): string {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  if (!domain) {
    if (__DEV__) console.warn("[useArtistMetadata] EXPO_PUBLIC_DOMAIN not set");
    return "";
  }
  return `https://${domain}`;
}

function resolveSubgenre(artistKey: string, raw: RawRow): string {
  const fromSheet = raw.subgenre?.trim() ?? "";
  if (fromSheet) return fromSheet;
  return SUBGENRE_BY_KEY[artistKey] ?? "";
}

function normalizeRow(raw: RawRow): ArtistMeta | null {
  const displayName = raw.artist_name?.trim() ?? "";
  if (!displayName) return null;
  const artistKey = (raw.artist_key?.trim() || displayName).toLowerCase();
  const spotifyListeners = parseNum(raw.spotify_monthly_listeners);
  const spotifyStreams = parseNum(raw.spotify_total_streams);
  const youtubeSubscribers = parseNum(raw.youtube_subscribers);
  const tiktokFollowers = parseNum(raw.tiktok_followers);
  const instagramFollowers = parseNum(raw.instagram_followers);
  return {
    artistKey,
    displayName,
    country: raw.source_country?.trim() ?? "",
    genre: raw.genre?.trim() ?? "",
    subgenre: resolveSubgenre(artistKey, raw),
    label: raw.label?.trim() ?? "",
    spotifyListeners,
    spotifyListenersFmt: fmtNum(spotifyListeners),
    spotifyStreams,
    spotifyStreamsFmt: fmtNum(spotifyStreams),
    youtubeSubscribers,
    youtubeSubscribersFmt: fmtNum(youtubeSubscribers),
    tiktokFollowers,
    tiktokFollowersFmt: fmtNum(tiktokFollowers),
    instagramFollowers,
    instagramFollowersFmt: fmtNum(instagramFollowers),
  };
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export interface ArtistMetadataResult {
  artists: ArtistMeta[];
  byName: Map<string, ArtistMeta>;
  isLoading: boolean;
  hasError: boolean;
}

async function fetchMetadata(): Promise<ArtistMeta[]> {
  const base = getBaseUrl();
  if (!base) return [];
  const res = await fetch(`${base}/api/artists/metadata`);
  if (!res.ok) throw new Error(`artists/metadata HTTP ${res.status}`);
  const data = (await res.json()) as { artists: RawRow[] };
  return (data.artists ?? [])
    .map(normalizeRow)
    .filter((a): a is ArtistMeta => a !== null)
    .sort((a, b) => b.spotifyListeners - a.spotifyListeners);
}

export function useArtistMetadata(): ArtistMetadataResult {
  const { data, isLoading, error } = useQuery({
    // "v2" bumps the cache key so stale data without subgenres is not reused
    queryKey: ["artistMetadata", "v2"],
    queryFn: fetchMetadata,
    staleTime: 1000 * 60 * 30,
    retry: 2,
  });
  const artists = data ?? [];
  const byName = new Map(artists.map((a) => [a.displayName.toLowerCase(), a]));
  return { artists, byName, isLoading, hasError: !!error };
}
