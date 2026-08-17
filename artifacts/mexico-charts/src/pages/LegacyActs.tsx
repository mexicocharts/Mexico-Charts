import { useMemo } from "react";
import { Link } from "wouter";
import { Archive, Disc3, Headphones, Users } from "lucide-react";
import PageSEO from "@/components/PageSEO";
import SiteNav from "@/components/SiteNav";
import { useArtistImages } from "@/hooks/useArtistImages";
import { useBatchKworbStreamStats, type KworbStreamSnapshot } from "@/hooks/useKworbStats";
import { useArtistMetadata } from "@/services/dataProvider";
import { slugify } from "@/lib/utils";
import { canonicalArtistHref } from "@/lib/artistRoutes.mjs";
import { countryLabel, genreLabel } from "@/lib/presentationLabels";
import type { ArtistMetadata } from "@/services/artistMetadata";

const ACCENT = "#39FF14";

const LEGACY_ACT_NAMES = [
  "Maná",
  "Luis Miguel",
  "Marco Antonio Solis",
  "Los Angeles Azules",
  "Alejandro Fernandez",
  "Joan Sebastian",
  "Vicente Fernandez",
  "Los Tigres Del Norte",
  "Juan Gabriel",
  "Los Tucanes De Tijuana",
  "José José",
  "Cardenales De Nuevo León",
  "Banda El Recodo",
  "Cartel De Santa",
  "Selena",
  "Intocable",
  "Ana Gabriel",
  "Thalía",
  "Los Bukis",
  "Conjunto Primavera",
  "Pesado",
  "Los Temerarios",
  "Emmanuel",
  "Gloria Trevi",
  "Pepe Aguilar",
  "Sin Bandera",
  "Bobby Pulido",
  "Los Invasores De Nuevo León",
  "Bronco",
  "El Chapo De Sinaloa",
  "Diego Verdaguer",
  "Valentín Elizalde",
  "Paulina Rubio",
  "Grupo Mojado",
  "Sergio Vega El Shaka",
  "Chalino Sanchez",
  "Grupo Cañaveral",
  "Pancho Barraza",
  "Alejandra Guzman",
  "Los Angeles de Charly",
  "Grupo Bryndis",
  "Marisela",
  "Ana Bárbara",
  "La Sonora Dinamita",
  "Los Cadetes de Linares",
  "Jenni Rivera",
  "Los Socios Del Ritmo",
  "Antonio Aguilar",
  "El Trono de Mexico",
  "Banda Machos",
  "Ramón Ayala y Sus Bravos del Norte",
  "Mi Banda El Mexicano",
  "La Original Banda El Limón de Salvador Lizárraga",
  "Yuri",
  "Liberación",
  "RBD",
  "Los Acosta",
  "Mijares",
  "Banda Cuisillos",
  "K-Paz De La Sierra",
  "Los Mier",
  "Palomo",
  "Banda Maguey",
  "Los Huracanes del Norte",
  "Los Caminantes",
  "Los Yaguarú",
  "Grupo Limite",
  "Daniela Romo",
  "Alicia Villarreal",
  "Alacranes Musical",
  "Panteon Rococo",
  "Pedro Infante",
  "Carlos Y Jose",
  "Los Yonics Zamacona",
  "Los Panchos",
  "Moenia",
  "Grupo Exterminador",
  "Los Tigrillos",
  "Lalo Mora",
  "El Tigrillo Palma",
  "Sonora Santanera",
  "Montez De Durango",
  "Pedro Fernández",
  "José Maria Napoleón",
  "Timbiriche",
  "Rigo Tovar",
  "Los Rehenes",
  "Grupo Yndio",
  "Fito Olivares Y La Pura Sabrosura",
  "Miguel y Miguel",
  "Los Horóscopos De Durango",
  "Grupo Viento Y Sol",
  "Grupo Kual Dinastía Pedraza",
  "José Alfredo Jimenez",
  "Javier Solis",
  "Julio Preciado",
  "El Poder Del Norte",
  "Industria del Amor",
  "Alberto Vazquez",
  "Tierra Cali",
  "Guardianes Del Amor",
  "Lila Downs",
  "Patrulla 81",
  "Beto Quintanilla",
  "Los Traileros Del Norte",
  "Lorenzo De Monteclaro",
  "La Dinastía de Tuzantla Michoacán",
  "Interpuesto",
  "Ezequiel Peña",
  "Los Baron De Apodaca",
  "Mariachi Vargas De Tecalitlan",
  "Banda R-15",
  "Grupo Pegasso",
  "Paquita La Del Barrio",
  "Aida Cuevas",
  "Gerardo Reyes",
  "Los Freddy's",
  "Miguel Aceves Mejia",
  "Jorge Negrete",
  "Control",
  "Beto Zapata",
  "Oscar Iván Treviño",
];

interface LegacyAct {
  meta: ArtistMetadata;
  rank: number;
  score: number;
  catalogScore: number;
  audienceScore: number;
  fanbaseScore: number;
  catalog: number;
  audience: number;
  fanbase: number;
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function compact(value: number): string {
  if (!value) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return Math.round(value).toLocaleString("es-MX");
}

function logScore(value: number, max: number, points: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(points, (Math.log10(value + 1) / Math.log10(max + 1)) * points);
}

function socialScore(value: number, max: number, points: number): number {
  if (value <= 0 || max <= 0) return 0;
  return Math.min(points, Math.pow(value / max, 0.38) * points);
}

function getLegacyCandidates(metadata: Map<string, ArtistMetadata>): ArtistMetadata[] {
  const legacySet = new Set(LEGACY_ACT_NAMES.map(normalize));
  return [...metadata.values()].filter((meta) => legacySet.has(normalize(meta.displayName)));
}

function buildLegacyActs(
  metadata: Map<string, ArtistMetadata>,
  streamSnapshots: Record<string, KworbStreamSnapshot | null> = {},
): LegacyAct[] {
  const candidates = getLegacyCandidates(metadata);
  const values = candidates.map((meta) => ({
    meta,
    catalog:
      (streamSnapshots[meta.displayName]?.totalStreams ?? 0) +
      (streamSnapshots[meta.displayName]?.totalViews ?? 0),
    audience: meta.spotifyListeners,
    fanbase:
      meta.spotifyFollowers +
      meta.youtubeSubscribers +
      meta.instagramFollowers +
      meta.tiktokFollowers +
      meta.facebookFollowers,
  }));

  const maxCatalog = Math.max(...values.map((item) => item.catalog), 1);
  const maxAudience = Math.max(...values.map((item) => item.audience), 1);
  const maxFanbase = Math.max(...values.map((item) => item.fanbase), 1);

  return values
    .map((item) => {
      const catalogScore = logScore(item.catalog, maxCatalog, 70);
      const audienceScore = logScore(item.audience, maxAudience, 18);
      const fanbaseScore = socialScore(item.fanbase, maxFanbase, 12);
      return {
        ...item,
        catalogScore,
        audienceScore,
        fanbaseScore,
        score: catalogScore + audienceScore + fanbaseScore,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.audience - a.audience ||
        b.catalog - a.catalog ||
        b.fanbase - a.fanbase,
    )
    .slice(0, 50)
    .map((item, index) => ({ ...item, rank: index + 1 }));
}

function LegacyRow({ act, photoUrl }: { act: LegacyAct; photoUrl?: string | null }) {
  const initial = act.meta.displayName.trim()[0]?.toUpperCase() ?? "?";

  return (
    <Link href={canonicalArtistHref(act.meta.artistKey) ?? canonicalArtistHref(act.meta.displayName) ?? "/artists"}>
      <article
        className="group grid cursor-pointer gap-4 border border-white/[0.08] bg-[#080808] p-4 transition hover:border-[#39FF14]/40 sm:grid-cols-[92px_1fr] md:grid-cols-[104px_1fr_300px] md:items-center"
        style={{ borderRadius: 8 }}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 text-right text-3xl font-black tabular-nums text-white md:w-12 md:text-4xl">
            {act.rank}
          </div>
          <div
            className="relative h-14 w-14 flex-shrink-0 overflow-hidden border bg-white/[0.04] md:h-16 md:w-16"
            style={{ borderColor: act.rank <= 3 ? "rgba(57,255,20,0.42)" : "rgba(255,255,255,0.1)", borderRadius: 8 }}
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={act.meta.displayName}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                style={{ filter: "brightness(0.82) saturate(0.8) contrast(1.08)" }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-black text-zinc-500">
                {initial}
              </div>
            )}
          </div>
        </div>

        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
            {act.rank <= 5 ? "Catálogo dominante" : "Legado activo"}
          </div>
          <h2 className="mt-2 break-words text-3xl font-black uppercase leading-[0.94] text-white group-hover:text-[#39FF14] md:text-4xl lg:text-[2.65rem]">
            {act.meta.displayName}
          </h2>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-black uppercase tracking-[0.14em] text-zinc-500">
            <span>{genreLabel(act.meta.subgenre || act.meta.genre || "Mexico Charts")}</span>
            {act.meta.country && <span>{countryLabel(act.meta.country)}</span>}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:col-span-2 md:col-span-1">
          <div className="border border-white/[0.08] bg-white/[0.025] p-2" style={{ borderRadius: 6 }}>
            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Audiencia</div>
            <div className="mt-1 text-sm font-black text-white">{compact(act.audience)}</div>
          </div>
          <div className="border border-white/[0.08] bg-white/[0.025] p-2" style={{ borderRadius: 6 }}>
            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Catálogo</div>
            <div className="mt-1 text-sm font-black text-white">{compact(act.catalog)}</div>
          </div>
          <div className="border border-white/[0.08] bg-white/[0.025] p-2" style={{ borderRadius: 6 }}>
            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-zinc-600">Fanbase</div>
            <div className="mt-1 text-sm font-black text-white">{compact(act.fanbase)}</div>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default function LegacyActs() {
  const metadata = useArtistMetadata();
  const legacyNames = useMemo(
    () => getLegacyCandidates(metadata.byKey).map((meta) => meta.displayName),
    [metadata.byKey],
  );
  const streamStats = useBatchKworbStreamStats(legacyNames);
  const legacyActs = useMemo(
    () => buildLegacyActs(metadata.byKey, streamStats.data ?? {}),
    [metadata.byKey, streamStats.data],
  );
  const imageNames = useMemo(() => legacyActs.map((act) => act.meta.displayName), [legacyActs]);
  const artistImages = useArtistImages(imageNames);
  const leader = legacyActs[0];
  const isLoading = metadata.isLoading || streamStats.isLoading;
  const isError = metadata.isError || streamStats.isError;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <PageSEO
        title="Legacy Acts — Mexico Charts"
        description="Ranking de carreras históricas con consumo vigente dentro de Mexico Charts"
        path="/legacy-acts"
      />
      <SiteNav />

      <main>
        <section className="overflow-hidden border-b border-white/[0.06] bg-[radial-gradient(ellipse_at_top_left,rgba(57,255,20,0.16),transparent_58%),#050505]">
          <div className="mx-auto max-w-[1320px] px-5 py-12 md:px-8 md:py-16">
            <div className="mb-5 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: ACCENT }}>
              <Archive className="h-4 w-4" />
              Catálogo Mexico Charts
            </div>
            <div className="grid gap-8 lg:grid-cols-[1fr_460px] lg:items-end">
              <div>
                <h1 className="text-[3rem] font-black uppercase leading-[0.86] tracking-normal text-white sm:text-7xl lg:text-[7.6rem]">
                  Legacy <span style={{ color: ACCENT }}>Acts</span>
                </h1>
                <p className="mt-6 max-w-3xl text-base leading-7 text-zinc-400 md:text-lg">
                  Carreras históricas con consumo vigente, rankeadas desde la metadata activa de artistas por audiencia, catálogo y fanbase
                </p>
              </div>

              {leader && (
                <Link href={canonicalArtistHref(leader.meta.artistKey) ?? canonicalArtistHref(leader.meta.displayName) ?? "/artists"}>
                  <article
                    className="group cursor-pointer overflow-hidden border bg-black/35 transition hover:border-[#39FF14]/45"
                    style={{ borderColor: "rgba(57,255,20,0.24)", borderRadius: 8 }}
                  >
                    <div className="grid grid-cols-[112px_1fr]">
                      <div className="min-h-[150px] overflow-hidden bg-white/[0.04]">
                        {artistImages[leader.meta.displayName] ? (
                          <img
                            src={artistImages[leader.meta.displayName] ?? ""}
                            alt={leader.meta.displayName}
                            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                            style={{ filter: "brightness(0.78) saturate(0.8) contrast(1.1)" }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-4xl font-black text-zinc-600">
                            {leader.meta.displayName[0]}
                          </div>
                        )}
                      </div>
                      <div className="p-5">
                        <div className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: ACCENT }}>
                          Líder legacy
                        </div>
                        <h2 className="mt-2 text-3xl font-black uppercase leading-[0.94] text-white">
                          {leader.meta.displayName}
                        </h2>
                        <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] font-black uppercase tracking-[0.12em] text-zinc-500">
                          <span>{compact(leader.audience)} audiencia</span>
                          <span>{compact(leader.catalog)} catálogo</span>
                          <span>{compact(leader.fanbase)} fanbase</span>
                          <span>#1 ranking</span>
                        </div>
                      </div>
                    </div>
                  </article>
                </Link>
              )}
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="border border-white/[0.08] bg-white/[0.03] p-4" style={{ borderRadius: 8 }}>
                <Headphones className="mb-4 h-5 w-5" style={{ color: ACCENT }} />
                <div className="text-2xl font-black">{leader ? compact(leader.audience) : "—"}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Audiencia líder</div>
              </div>
              <div className="border border-white/[0.08] bg-white/[0.03] p-4" style={{ borderRadius: 8 }}>
                <Disc3 className="mb-4 h-5 w-5" style={{ color: ACCENT }} />
                <div className="text-2xl font-black">{leader ? compact(leader.catalog) : "—"}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Catálogo líder</div>
              </div>
              <div className="border border-white/[0.08] bg-white/[0.03] p-4" style={{ borderRadius: 8 }}>
                <Users className="mb-4 h-5 w-5" style={{ color: ACCENT }} />
                <div className="text-2xl font-black">{legacyActs.length || "—"}</div>
                <div className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-zinc-500">Acts rankeados</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[1320px] px-5 py-8 md:px-8">
          <div className="mb-6 border border-white/[0.08] bg-[#0a0a0a] p-4" style={{ borderRadius: 8 }}>
            <p className="text-xs leading-5 text-zinc-400">
              Ranking calculado entre los artistas mexicanos actualmente monitoreados por Mexico Charts. No representa necesariamente la totalidad de artistas mexicanos. Para legacy acts, la elegibilidad usa carreras históricas o catálogo cultural consolidado; el orden prioriza consumo histórico verificado en snapshots de artistas, audiencia actual, seguidores y presencia social.
            </p>
          </div>

          {isLoading && (
            <div className="space-y-3" aria-busy="true" aria-label="Cargando legacy acts">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="h-32 animate-pulse bg-white/[0.04]" style={{ borderRadius: 8 }} />
              ))}
            </div>
          )}

          {isError && (
            <div className="border border-red-500/20 bg-red-500/[0.045] p-5" style={{ borderRadius: 8 }} role="status">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-red-200">
                Catálogo temporalmente no disponible
              </div>
              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-500">
                No pudimos actualizar la metadata de artistas en este momento. Inténtalo de nuevo cuando la fuente vuelva a responder.
              </p>
            </div>
          )}

          {!isLoading && !isError && legacyActs.length === 0 && (
            <div className="border border-white/[0.08] bg-white/[0.025] p-5 text-sm leading-6 text-zinc-500" style={{ borderRadius: 8 }}>
              Aún no hay legacy acts disponibles con la fuente actual.
            </div>
          )}

          {!isLoading && !isError && legacyActs.length > 0 && (
            <div className="space-y-3">
              {legacyActs.map((act) => (
                <LegacyRow
                  key={act.meta.artistKey}
                  act={act}
                  photoUrl={artistImages[act.meta.displayName]}
                />
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
