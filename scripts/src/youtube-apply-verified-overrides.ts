import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg") as {
  Pool: new (config: { connectionString: string }) => {
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
    end: () => Promise<void>;
  };
};

interface ChannelItem {
  id: string;
  snippet: {
    title: string;
    customUrl?: string;
    publishedAt?: string;
    thumbnails?: { default?: { url: string }; medium?: { url: string }; high?: { url: string } };
  };
  statistics?: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
    hiddenSubscriberCount?: boolean;
  };
}

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

const VERIFIED_OVERRIDES = [
  { artistKey: "banda ms de sergio lizarraga", artistName: "Banda MS de Sergio Lizárraga", handle: "BandaMS" },
  { artistKey: "julion alvarez and su norteno banda", artistName: "Julión Álvarez & Su Norteño Banda", handle: "LosPasosdeJulionOficial" },
  { artistKey: "jesse and joy", artistName: "Jesse & Joy", handle: "jesseyjoyoficial" },
  { artistKey: "danna paola", artistName: "Danna Paola", handle: "dannapaolaVEVO" },
  { artistKey: "edicion especial", artistName: "Edición Especial", handle: "edicionespecial" },
  { artistKey: "la original banda el limon de salvador lizarraga", artistName: "La Original Banda El Limón de Salvador Lizárraga", handle: "LaOriginalBandaElLimon" },
  { artistKey: "los rehenes", artistName: "Los Rehenes", handle: "LosRehenesOficial" },
  { artistKey: "banda el recodo de cruz lizarraga", artistName: "Banda El Recodo De Cruz Lizárraga", handle: "bandaelrecodooficial" },
  { artistKey: "el duelo", artistName: "EL DUELO", handle: "thegroupduelo" },
  { artistKey: "el coyote y su banda tierra santa", artistName: "El Coyote Y Su Banda Tierra Santa", handle: "ElCoyoteYBandaTVEVO" },
  { artistKey: "industria del amor", artistName: "Industria del Amor", handle: "IndustriaDelAmorOficial" },
  { artistKey: "javier rosas y su artilleria pesada", artistName: "Javier Rosas Y Su Artillería Pesada", handle: "JavierRosasap" },
  { artistKey: "jose maria napoleon", artistName: "José Maria Napoleón", handle: "josenapoleonoficial" },
  { artistKey: "tito torbellino", artistName: "Tito Torbellino", handle: "TitoTorbellinoOficial" },
  { artistKey: "banda los sebastianes de saul plata", artistName: "Banda Los Sebastianes de Saúl Plata", handle: "BandaLosSebastianes" },
  { artistKey: "banda pequenos musical", artistName: "Banda Pequeños Musical", handle: "pequenosmusicaloficial" },
  { artistKey: "banda cuisillos", artistName: "Banda Cuisillos", handle: "CuisillosOficial" },
  { artistKey: "colmillo norteno", artistName: "COLMILLO NORTEÑO", handle: "ColmilloOficial" },
  { artistKey: "grupo limite", artistName: "Grupo Limite", handle: "limiteoficial6415" },
  { artistKey: "los gemelos de sinaloa", artistName: "Los Gemelos De Sinaloa", handle: "LosGemelosOficial" },
  { artistKey: "noel torres", artistName: "Noel Torres", handle: "Noeltorresmusica" },
  { artistKey: "ramon ayala", artistName: "Ramón Ayala", handle: "ramonayalatv" },
  { artistKey: "ramon ayala y sus bravos del norte", artistName: "Ramón Ayala y Sus Bravos del Norte", handle: "ramonayalatv" },
  { artistKey: "sergio vega el shaka", artistName: "Sergio Vega El Shaka", handle: "SergioVegaVEVO" },
  { artistKey: "timbiriche", artistName: "Timbiriche", handle: "TimbiricheVEVO" },
  { artistKey: "adan romero", artistName: "Adan Romero", handle: "AdanRomerooficial" },
  { artistKey: "banda clave nueva de max peraza", artistName: "Banda Clave Nueva de Max Peraza", handle: "bandaclavenueva5113" },
  { artistKey: "chuy montana", artistName: "Chuy Montana", handle: "ChuyMontana-Oficial" },
  { artistKey: "fito olivares y la pura sabrosura", artistName: "Fito Olivares Y La Pura Sabrosura", handle: "Fitoolivares-w4p7i" },
  { artistKey: "grupo kual dinastia pedraza", artistName: "Grupo Kual Dinastía Pedraza", handle: "grupokualdinastiapedraza6570" },
  { artistKey: "grupo pegasso del pollo esteban", artistName: "Grupo Pegasso Del Pollo Esteban", handle: "grupopegassooficial" },
  { artistKey: "grupo super lamas", artistName: "Grupo SUPER LAMAS", handle: "lossuperlamas" },
  { artistKey: "jorsshh", artistName: "Jorsshh", handle: "Jorsshhoficial" },
  { artistKey: "julio preciado y su banda perla del pacifico", artistName: "Julio Preciado Y Su Banda Perla Del Pacifico", handle: "JulioPreciadoOficial" },
  { artistKey: "leandro rios", artistName: "Leandro Ríos", handle: "LeandroRiosG" },
  { artistKey: "los alegres de la sierra", artistName: "Los Alegres de la Sierra", handle: "alegresdelasierraoficial2856" },
  { artistKey: "los buitres de culiacan", artistName: "Los Buitres De Culiacán", handle: "LosBuitresdeCuliacánSinaloa" },
  { artistKey: "los tiranos del norte", artistName: "Los Tiranos Del Norte", handle: "LosTiranosdelNortemusic" },
  { artistKey: "mariachi vargas de tecalitlan", artistName: "Mariachi Vargas De Tecalitlan", handle: "MariachiVargasOficial" },
  { artistKey: "mariana seoane", artistName: "Mariana Seoane", handle: "laseoaneoficial_" },
  { artistKey: "banda sinaloense ms de sergio lizarraga", artistName: "Banda Sinaloense MS de Sergio Lizárraga", handle: "BandaMS" },
  { artistKey: "banda tito y su torbellino", artistName: "Banda Tito Y Su Torbellino", handle: "TitoTorbellinoOficial" },
  { artistKey: "el tigrillo palma", artistName: "El Tigrillo Palma", handle: "eltigrillopalma9984" },
  { artistKey: "ezequiel pena", artistName: "Ezequiel Peña", handle: "chequepena" },
  { artistKey: "ian cordova", artistName: "Ian Cordova", handle: "IanCordova_Oficial" },
  { artistKey: "lorenzo de monteclaro", artistName: "Lorenzo De Monteclaro", handle: "LORENZODEMONTECLAROOFFICIAL" },
  { artistKey: "los nuevos ilegales", artistName: "Los Nuevos Ilegales", handle: "losnuevosilegalesoficial" },
  { artistKey: "los razos", artistName: "Los Razos", handle: "losrazosVEVO" },
  { artistKey: "nivel codiciado", artistName: "Nivel Codiciado", handle: "OficialmenteNivel" },
  { artistKey: "nueva h", artistName: "Nueva H", handle: "NuevaH_CT" },
  { artistKey: "adan chalino sanchez", artistName: "Adan Chalino Sanchez", handle: "adanchalinosanchez1869" },
  { artistKey: "banda r 15", artistName: "Banda R-15", handle: "BandaR-15" },
  { artistKey: "beto quintanilla", artistName: "Beto Quintanilla", handle: "betoquintanilla1948" },
  { artistKey: "cornelio vega y su dinastia", artistName: "Cornelio Vega y Su Dinastia", handle: "corneliovegaysudinastia9977" },
  { artistKey: "el halcon de la sierra", artistName: "El Halcon De La Sierra", handle: "halcondelasierra" },
  { artistKey: "grupo selectivo", artistName: "Grupo Selectivo", handle: "gruposelectivo" },
  { artistKey: "jimmy guzman", artistName: "Jimmy Guzman", handle: "JimmyGuzmanMusic" },
  { artistKey: "juanpa salazar", artistName: "Juanpa Salazar", handle: "juanpasalazarmusic3196" },
  { artistKey: "los amos de nuevo leon", artistName: "Los Amos De Nuevo Leon", handle: "LosAmosOficial" },
  { artistKey: "los morros del norte", artistName: "Los Morros Del Norte", handle: "losmorrosdelnorteoficial7000" },
  { artistKey: "luis y julian", artistName: "Luis y Julian", handle: "LuisYJulianVEVO-db6xc" },
  { artistKey: "miguel aceves mejia", artistName: "Miguel Aceves Mejia", handle: "MiguelAcevesMejiaOk" },
];

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    args.set(key, value);
  }
  return {
    write: args.get("write") === "true",
  };
}

function fmtCount(value: number | null): string {
  if (value == null) return "";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(value);
}

async function ytFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env["YOUTUBE_API_KEY"];
  if (!key) throw new Error("Missing YOUTUBE_API_KEY.");
  const qs = new URLSearchParams({ ...params, key });
  const res = await fetch(`${YOUTUBE_API_BASE}${path}?${qs.toString()}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`YouTube API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function channelByHandle(handle: string): Promise<ChannelItem | null> {
  const data = await ytFetch<{ items?: ChannelItem[] }>("/channels", {
    part: "snippet,statistics",
    forHandle: `@${handle}`,
  });
  return data.items?.[0] ?? null;
}

async function saveChannel(pool: InstanceType<typeof Pool>, artistKey: string, channel: ChannelItem) {
  const thumbnail =
    channel.snippet.thumbnails?.high?.url ??
    channel.snippet.thumbnails?.medium?.url ??
    channel.snippet.thumbnails?.default?.url ??
    null;
  const subscriberCount = channel.statistics?.hiddenSubscriberCount
    ? null
    : channel.statistics?.subscriberCount != null
      ? Number(channel.statistics.subscriberCount)
      : null;

  await pool.query(
    `insert into youtube_channels (
      artist_key, channel_id, title, thumbnail_url, subscriber_count,
      view_count, video_count, custom_url, published_at, cached_at, linked_at
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),now())
    on conflict (artist_key) do update set
      channel_id = excluded.channel_id,
      title = excluded.title,
      thumbnail_url = excluded.thumbnail_url,
      subscriber_count = excluded.subscriber_count,
      view_count = excluded.view_count,
      video_count = excluded.video_count,
      custom_url = excluded.custom_url,
      published_at = excluded.published_at,
      cached_at = excluded.cached_at,
      linked_at = excluded.linked_at`,
    [
      artistKey,
      channel.id,
      channel.snippet.title,
      thumbnail,
      subscriberCount,
      channel.statistics?.viewCount != null ? Number(channel.statistics.viewCount) : null,
      channel.statistics?.videoCount != null ? Number(channel.statistics.videoCount) : null,
      channel.snippet.customUrl ?? null,
      channel.snippet.publishedAt ? new Date(channel.snippet.publishedAt) : null,
    ],
  );
}

async function clearCandidate(pool: InstanceType<typeof Pool>, artistKey: string) {
  await pool.query("delete from youtube_channel_candidates where artist_key = $1", [artistKey]).catch(() => undefined);
}

async function main() {
  const { write } = parseArgs();
  if (!process.env["DATABASE_URL"]) throw new Error("Missing DATABASE_URL.");

  const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
  try {
    const linkedRows = await pool.query<{ artist_key: string }>("select artist_key from youtube_channels");
    const linked = new Set(linkedRows.rows.map(row => row.artist_key));
    const queue = VERIFIED_OVERRIDES.filter(override => !linked.has(override.artistKey));
    console.log(`${write ? "Writing" : "Dry run"} verified YouTube overrides. pending=${queue.length} alreadyLinked=${VERIFIED_OVERRIDES.length - queue.length}.`);

    let saved = 0;
    let skipped = 0;
    for (const override of queue) {
      const channel = await channelByHandle(override.handle);
      if (!channel) {
        skipped += 1;
        console.log(`NO_RESULT,${override.artistKey},${override.artistName},@${override.handle}`);
        continue;
      }
      const subscribers = channel.statistics?.hiddenSubscriberCount ? null : Number(channel.statistics?.subscriberCount ?? 0);
      console.log(`${write ? "SAVE" : "MATCH"},${override.artistKey},${override.artistName},${channel.id},${channel.snippet.title},${fmtCount(subscribers)},@${override.handle}`);
      if (write) {
        await saveChannel(pool, override.artistKey, channel);
        await clearCandidate(pool, override.artistKey);
        saved += 1;
      }
      await new Promise(resolve => setTimeout(resolve, 125));
    }

    const finalCount = await pool.query("select count(*)::int as count from youtube_channels");
    console.log(`Done. saved=${saved} skipped=${skipped} db_channels=${finalCount.rows[0].count}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
