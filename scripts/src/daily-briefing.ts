type Row = Record<string, string>;

const MASTER_SHEET_ID = "1lnqsIqI3mi3eC7iD6H7QThS-tzZ4thyyHcYNfX3Vdts";
const gvizCSV = (sheet: string) =>
  `https://docs.google.com/spreadsheets/d/${MASTER_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${sheet}`;

const sources = {
  artistsDaily: gvizCSV("artists_daily_mx"),
  songsDaily: gvizCSV("songs_daily_mx"),
  viralDaily: gvizCSV("songs_viral_mx"),
  albumsWeekly: gvizCSV("albums_weekly_mx"),
};

const args = new Set(process.argv.slice(2));

function parseCSV(input: string): Row[] {
  const rows: string[][] = [];
  let current = "";
  let record: string[] = [];
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      record.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      record.push(current);
      if (record.some((value) => value.trim() !== "")) rows.push(record);
      record = [];
      current = "";
    } else {
      current += char;
    }
  }

  record.push(current);
  if (record.some((value) => value.trim() !== "")) rows.push(record);

  const headers = rows
    .shift()
    ?.map((header) => header.trim().replace(/^\uFEFF/, "")) ?? [];

  return rows.map((row) =>
    Object.fromEntries(headers.map((header, index) => [header, (row[index] ?? "").trim()])),
  );
}

async function fetchRows(label: string, url: string): Promise<Row[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${label} fetch failed: HTTP ${response.status}`);
  }
  return parseCSV(await response.text());
}

function isEligible(row: Row): boolean {
  const include = (row.include_on_site ?? "").toLowerCase().trim();
  if (include === "true") return true;
  if (include === "false") return false;

  const status = (row.status ?? row.eligibility_status ?? "").toLowerCase().trim();
  return status === "" || (!status.includes("exclud") && !status.includes("review"));
}

function rank(row: Row): number {
  return Number.parseInt(row.mexico_charts_rank ?? "", 10) || 9999;
}

function numberFrom(raw: string | undefined): number {
  if (!raw) return 0;
  const value = raw.trim().toUpperCase();
  if (value.endsWith("M")) return Number.parseFloat(value) * 1_000_000;
  if (value.endsWith("K")) return Number.parseFloat(value) * 1_000;
  return Number.parseFloat(value.replace(/[^0-9.-]/g, "")) || 0;
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} millones`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} mil`;
  return String(Math.round(value));
}

function first(rows: Row[], count: number): Row[] {
  return rows.filter(isEligible).sort((a, b) => rank(a) - rank(b)).slice(0, count);
}

function artistName(row: Row): string {
  return row.artist || row.artist_name || "artista sin nombre";
}

function songTitle(row: Row): string {
  return row.track_name || row.title || "tema sin titulo";
}

function songArtist(row: Row): string {
  return row.display_artist_names_mexico_only || row.artist_names_source || row.artist || "artista sin nombre";
}

function albumTitle(row: Row): string {
  return row.album || row.album_name || "album sin titulo";
}

function albumArtist(row: Row): string {
  return row.primary_artist || row.artist_name || row.artist_credit || "artista sin nombre";
}

function buildScript(data: {
  artistsDaily: Row[];
  songsDaily: Row[];
  viralDaily: Row[];
  albumsWeekly: Row[];
}): string {
  const topArtists = first(data.artistsDaily, 5);
  const topSongs = first(data.songsDaily, 5);
  const viralSongs = first(data.viralDaily, 3);
  const topAlbums = first(data.albumsWeekly, 3);

  const leader = topArtists[0];
  const second = topArtists[1];
  const topSong = topSongs[0];
  const viral = viralSongs[0];
  const album = topAlbums[0];

  const biggestGrowth = [...data.artistsDaily]
    .filter(isEligible)
    .map((row) => ({ row, growth: numberFrom(row.listeners_change_pct) }))
    .filter((item) => item.growth > 0)
    .sort((a, b) => b.growth - a.growth)[0];

  const lines = [
    "Bienvenidos a Mexico Charts.",
    "",
    "Soy Adrian, y este es el briefing diario de la musica mexicana.",
    "",
  ];

  if (leader) {
    lines.push(
      `En el ranking diario de artistas, ${artistName(leader)} aparece en el numero uno de Mexico Charts.`,
    );
  }

  if (second) {
    lines.push(`${artistName(second)} le sigue de cerca en la segunda posicion.`);
  }

  if (topSong) {
    const streams = numberFrom(topSong.streams);
    const streamText = streams ? `, con aproximadamente ${formatCompact(streams)} de streams` : "";
    lines.push(
      `En canciones, el tema que marca el ritmo del dia es "${songTitle(topSong)}" de ${songArtist(topSong)}${streamText}.`,
    );
  }

  if (viral) {
    lines.push(
      `En la lista viral, "${songTitle(viral)}" de ${songArtist(viral)} es uno de los movimientos que vale la pena seguir.`,
    );
  }

  if (album) {
    lines.push(
      `Y en albums, ${albumArtist(album)} mantiene presencia con "${albumTitle(album)}" entre los proyectos mas visibles de la semana.`,
    );
  }

  if (biggestGrowth) {
    lines.push(
      `El dato de momentum viene de ${artistName(biggestGrowth.row)}, con un crecimiento aproximado de ${biggestGrowth.growth.toFixed(0)} por ciento en oyentes.`,
    );
  }

  lines.push(
    "",
    "Esto fue el briefing diario de Mexico Charts. Nos vemos en la proxima actualizacion.",
  );

  return lines.join("\n");
}

function buildTavusPayload(script: string) {
  return {
    replica_id: process.env.TAVUS_REPLICA_ID ?? "r72f7f7f7c8b",
    video_name: `Mexico Charts - Daily Briefing - ${new Date().toISOString().slice(0, 10)}`,
    script,
    fast: true,
    transparent_background: true,
  };
}

async function main() {
  const [artistsDaily, songsDaily, viralDaily, albumsWeekly] = await Promise.all([
    fetchRows("artists_daily_mx", sources.artistsDaily),
    fetchRows("songs_daily_mx", sources.songsDaily),
    fetchRows("songs_viral_mx", sources.viralDaily),
    fetchRows("albums_weekly_mx", sources.albumsWeekly),
  ]);

  const script = buildScript({ artistsDaily, songsDaily, viralDaily, albumsWeekly });

  if (args.has("--tavus-payload")) {
    console.log(JSON.stringify(buildTavusPayload(script), null, 2));
    return;
  }

  console.log(script);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

export {};
