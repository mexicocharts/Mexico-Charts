interface TmEvent {
  eventId: string;
  name: string;
  date: string;
  time: string | null;
  venue: string;
  city: string;
  state: string;
  country: string;
  url: string;
  img: string | null;
}

interface ArtistTours {
  id: string;
  name: string;
  events: TmEvent[];
  fetchedAt: number;
}

interface TouringResponse {
  artists: ArtistTours[];
  cachedAt?: number;
}

const TOURING_API =
  process.env.TOURING_API_URL ?? "https://mexicochart.com/api/touring/concerts";

const args = new Set(process.argv.slice(2));

function formatDate(iso: string): string {
  if (!iso) return "fecha por confirmar";
  const date = new Date(`${iso}T12:00:00`);
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
  }).format(date);
}

function countryName(country: string): string {
  if (country === "MX") return "Mexico";
  if (country === "US") return "Estados Unidos";
  return country || "mercados internacionales";
}

function cityLabel(event: TmEvent): string {
  const region = event.state ? `, ${event.state}` : "";
  return `${event.city}${region}`;
}

function flattenEvents(artists: ArtistTours[]) {
  return artists
    .flatMap((artist) =>
      artist.events.map((event) => ({
        artist: artist.name,
        event,
      })),
    )
    .filter((item) => item.event.date)
    .sort((a, b) => a.event.date.localeCompare(b.event.date));
}

function topArtistsByShows(artists: ArtistTours[]) {
  return [...artists]
    .filter((artist) => artist.events.length > 0)
    .sort((a, b) => b.events.length - a.events.length)
    .slice(0, 5);
}

function topCities(events: ReturnType<typeof flattenEvents>) {
  const counts = new Map<string, number>();
  for (const { event } of events) {
    const key = cityLabel(event);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
}

function countryBreakdown(events: ReturnType<typeof flattenEvents>) {
  const counts = new Map<string, number>();
  for (const { event } of events) {
    counts.set(event.country, (counts.get(event.country) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function pluralShows(count: number): string {
  return count === 1 ? "una fecha" : `${count} fechas`;
}

function buildScript(artists: ArtistTours[]): string {
  const activeArtists = topArtistsByShows(artists);
  const events = flattenEvents(artists);
  const upcoming = events.slice(0, 4);
  const cities = topCities(events);
  const countries = countryBreakdown(events);
  const leader = activeArtists[0];

  const lines = [
    "Bienvenidos al Touring Desk de Mexico Charts.",
    "",
    "Soy Adrian, y este es el reporte rapido de conciertos y giras.",
    "",
  ];

  if (events.length === 0) {
    lines.push(
      "Por ahora, Ticketmaster no muestra fechas activas para los artistas monitoreados por Mexico Charts.",
      "Seguiremos actualizando esta seccion cuando entren nuevos anuncios.",
      "",
      "Esto fue el Touring Desk de Mexico Charts.",
    );
    return lines.join("\n");
  }

  lines.push(
    `En este corte tenemos ${pluralShows(events.length)} activas entre ${activeArtists.length} artistas monitoreados.`,
  );

  if (leader) {
    lines.push(
      `${leader.name} encabeza la actividad de touring con ${pluralShows(leader.events.length)} próximas en el calendario.`,
    );
  }

  if (upcoming[0]) {
    lines.push(
      `La siguiente fecha destacada es ${upcoming[0].artist} el ${formatDate(upcoming[0].event.date)} en ${cityLabel(upcoming[0].event)}, desde ${upcoming[0].event.venue}.`,
    );
  }

  if (upcoming[1]) {
    lines.push(
      `Tambien viene ${upcoming[1].artist} el ${formatDate(upcoming[1].event.date)} en ${cityLabel(upcoming[1].event)}.`,
    );
  }

  if (cities.length > 0) {
    const cityText = cities.map(([city, count]) => `${city} con ${pluralShows(count)}`).join(", ");
    lines.push(`Entre las ciudades con mas movimiento aparecen ${cityText}.`);
  }

  if (countries.length > 0) {
    const countryText = countries
      .slice(0, 2)
      .map(([country, count]) => `${countryName(country)} con ${pluralShows(count)}`)
      .join(" y ");
    lines.push(`Por mercado, la actividad se concentra en ${countryText}.`);
  }

  if (activeArtists[1]) {
    lines.push(
      `Otro nombre a seguir es ${activeArtists[1].name}, que tambien mantiene presencia fuerte en la agenda en vivo.`,
    );
  }

  lines.push(
    "",
    "Esto fue el Touring Desk de Mexico Charts. Nos vemos en la proxima actualizacion.",
  );

  return lines.join("\n");
}

function buildTavusPayload(script: string) {
  return {
    replica_id: process.env.TAVUS_REPLICA_ID ?? "r72f7f7f7c8b",
    video_name: `Mexico Charts - Touring Desk - ${new Date().toISOString().slice(0, 10)}`,
    script,
    fast: true,
    transparent_background: true,
  };
}

async function main() {
  const response = await fetch(TOURING_API);
  if (!response.ok) {
    throw new Error(`Touring API fetch failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as TouringResponse;
  const script = buildScript(data.artists ?? []);

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
