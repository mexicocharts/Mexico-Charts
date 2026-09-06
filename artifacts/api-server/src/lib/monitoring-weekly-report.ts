import PDFDocument from "pdfkit";
import { compareMonitoringCatalogDaily, monitoringCatalogDateDescription, type MonitoringReportInput } from "./monitoring-report-pdf";

// Presentation recovered from build-peso-monitor-report.py, the original
// eight-page approved report. Coordinates retain its 792x612 landscape grid.
// No artist values, dates, recommendations or artwork are copied from the demo.
export type WeeklyReportInput = Omit<
  MonitoringReportInput,
  "month" | "liveVideos" | "comparisonArtists" | "dailyPulse"
> & {
  weekEnd: string;
  artistImageUrl: string | null;
  liveVideos: Array<
    MonitoringReportInput["liveVideos"][number] & {
      thumbnail_url?: string | null;
      observed_at?: string | null;
      seconds_since_previous?: number | string | null;
    }
  >;
  comparisonArtists: Array<
    MonitoringReportInput["comparisonArtists"][number] & {
      snapshotDate?: string;
      spotifyGrowth30?: { absolute: number } | null;
      youtubeGrowth30?: { absolute: number } | null;
    }
  >;
  dailyPulse: MonitoringReportInput["dailyPulse"] & {
    signals?: Array<Record<string, unknown>>;
  };
};

const BG = "#050505",
  PANEL = "#101010",
  LINE = "#292929";
const WHITE = "#FFFFFF",
  MUTED = "#8B8B8B",
  GREEN = "#39FF14",
  RED = "#FF5C68";
const n = (v: unknown): number | null =>
  v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
const exact = (v: unknown) =>
  n(v) == null ? "Sin lectura" : new Intl.NumberFormat("es-MX").format(n(v)!);
const compact = (v: unknown) => {
  const value = n(v);
  if (value == null) return "Sin lectura";
  for (const [scale, unit] of [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ] as const) {
    if (Math.abs(value) >= scale) return `${(value / scale).toFixed(1)}${unit}`;
  }
  return exact(value);
};
const signed = (v: number | null) =>
  v == null ? "Ventana sin lectura" : `${v >= 0 ? "+" : ""}${compact(v)}`;
export function weeklyStart(end: string) {
  const date = new Date(`${end}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 6);
  return date.toISOString().slice(0, 10);
}
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date.slice(0, 10)}T12:00:00Z`));

async function imageBytes(raw: string | null | undefined) {
  if (!raw) return null;
  const allowed =
    /^(?:i\.scdn\.co|image-cdn-[a-z]+\.spotifycdn\.com|(?:[a-z-]+\.)?dzcdn\.net|i\.ytimg\.com|yt3\.ggpht\.com|yt3\.googleusercontent\.com|is[1-5]-ssl\.mzstatic\.com|cdn\.songstats\.com)$/;
  try {
    const url = new URL(raw);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !allowed.test(url.hostname)
    )
      return null;
    const response = await fetch(url, {
      signal: AbortSignal.timeout(4_000),
      redirect: "error",
    });
    if (
      !response.ok ||
      !/^image\/(jpeg|png)/.test(response.headers.get("content-type") ?? "")
    )
      return null;
    const reader = response.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 4_000_000) {
        await reader.cancel();
        return null;
      }
      chunks.push(part.value);
    }
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}

export async function createMonitoringWeeklyReport(
  input: WeeklyReportInput,
): Promise<Buffer> {
  const history = input.history
    .filter((row) => row.date <= input.weekEnd)
    .sort((a, b) => a.date.localeCompare(b.date));
  const current = history.at(-1);
  if (!current) throw new Error("No stored observations for the selected week");
  // Current catalog/video/market data cannot be relabelled as a historical cut.
  if (input.weekEnd !== input.history.at(-1)?.date)
    throw new Error(
      "Historical report requires an archived complete report payload",
    );
  const videos = [...input.liveVideos]
    .sort((a, b) => (n(b.view_count) ?? -1) - (n(a.view_count) ?? -1))
    .slice(0, 3);
  const featuredSpotify = (["track", "album"] as const).flatMap(type =>
    input.spotifyCatalog.items
      .filter(item => item.type === type)
      .sort(compareMonitoringCatalogDaily)
      .slice(0, 5),
  );
  const images = await Promise.all([
    imageBytes(input.artistImageUrl),
    ...videos.map((v) => imageBytes(v.thumbnail_url)),
    ...featuredSpotify.map(item => imageBytes(item.artworkUrl)),
  ]);
  const doc = new PDFDocument({
    autoFirstPage: false,
    compress: true,
    info: {
      Title: `${input.artistName} - Reporte semanal ${input.weekEnd}`,
      Author: "Mexico Charts",
    },
  });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c) => chunks.push(Buffer.from(c)));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const text = (
    x: number,
    y: number,
    value: string,
    size = 10,
    color = WHITE,
    width = 724,
  ) => {
    doc.fillColor(color).font("Helvetica").fontSize(size);
    const heading = size >= 15;
    if (heading)
      while (size > 8 && doc.widthOfString(value) > width)
        doc.fontSize((size -= 0.5));
    doc.text(value, x, 612 - y - size, {
      width,
      height: heading ? size * 1.4 : size * 3,
      lineBreak: !heading,
      ellipsis: true,
    });
  };
  const panel = (
    x: number,
    y: number,
    w: number,
    h: number,
    fill = PANEL,
    stroke = LINE,
  ) => {
    doc.roundedRect(x, 612 - y - h, w, h, 12).fillAndStroke(fill, stroke);
  };
  const picture = (
    bytes: Buffer | null | undefined,
    x: number,
    y: number,
    w: number,
    h: number,
  ) => {
    if (!bytes) {
      text(x, y + h / 2, "Imagen no disponible", 8, MUTED, w);
      return;
    }
    try {
      doc.image(bytes, x, 612 - y - h, {
        fit: [w, h],
        align: "center",
        valign: "center",
      });
    } catch {
      text(x, y + h / 2, "Imagen no disponible", 8, MUTED, w);
    }
  };
  const page = (section: string, index: number, title?: string) => {
    doc.addPage({ size: [792, 612], margin: 0 });
    doc.rect(0, 0, 792, 612).fill(BG);
    if (index === 1) return;
    text(34, 584, "MEXICO CHARTS / MONITOR", 8, GREEN);
    text(34, 570, section.toUpperCase(), 8, MUTED);
    text(716, 577, `${index} / 8`, 8, MUTED, 42);
    doc.moveTo(34, 50).lineTo(758, 50).strokeColor(LINE).stroke();
    if (title) text(34, 526, title, 22);
    doc.moveTo(34, 587).lineTo(758, 587).strokeColor(LINE).stroke();
    text(
      34,
      12,
      "Datos: Songstats, Kworb y YouTube / Cálculo de Mexico Charts",
      6.5,
      MUTED,
      550,
    );
    text(612, 12, `CORTE: ${dateLabel(input.weekEnd)}`, 6.5, MUTED, 150);
  };
  const metrics = (rows: Array<[string, string, string]>, y = 422) =>
    rows.forEach(([label, value, detail], i) => {
      const x = 34 + i * 181;
      panel(x, y - 27, 169, 85);
      text(x + 14, y + 30, label, 6.5, MUTED, 141);
      text(x + 14, y, value, 22, WHITE, 141);
      text(x + 14, y - 17, detail, 7, GREEN, 141);
    });
  const change = (key: keyof typeof current, days: number) => {
    const cutoff = new Date(`${current.date}T12:00:00Z`);
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    const date = cutoff.toISOString().slice(0, 10);
    const old = history.find((row) => row.date === date);
    const before = n(old?.[key]),
      after = n(current[key]);
    return before == null || after == null ? null : after - before;
  };
  const start = weeklyStart(input.weekEnd);
  page("", 1);
  picture(images[0], 462, 70, 285, 470);
  text(44, 554, "MEXICO CHARTS", 10, GREEN);
  text(44, 532, "MONITOR / REPORTE SEMANAL", 8, MUTED);
  const words = input.artistName.toUpperCase().split(" ");
  const split = Math.ceil(words.length / 2);
  text(44, 330, words.slice(0, split).join(" "), 48, WHITE, 390);
  text(44, 275, words.slice(split).join(" "), 48, WHITE, 390);
  text(
    47,
    242,
    `${dateLabel(start)} - ${dateLabel(input.weekEnd)}`,
    13,
    GREEN,
    410,
  );
  text(
    47,
    214,
    "Audiencia, Spotify, YouTube, mercados y comparaciones",
    10,
    MUTED,
    400,
  );
  panel(44, 78, 325, 95);
  text(62, 145, "REPORTE SEMANAL", 7, GREEN);
  text(62, 122, input.dailyPulse.headline, 13, WHITE, 286);
  text(62, 98, "Tendencias / Spotify / YouTube / mercados", 8, MUTED, 286);
  text(666, 42, "PRIVADO", 8, GREEN);

  page("Reporte semanal", 2, "Resultados de la semana");
  panel(34, 365, 724, 105, "#0A140B", "#245D21");
  text(54, 438, "DATO PRINCIPAL", 7, GREEN);
  text(54, 405, input.dailyPulse.headline, 22, WHITE, 680);
  text(54, 380, input.dailyPulse.summary, 9, MUTED, 680);
  const actions =
    input.dailyPulse.signals?.flatMap((s) =>
      typeof s.title === "string" ? [s.title] : [],
    ) ?? [];
  [
    [
      "CAMBIOS",
      signed(change("spotifyMonthlyListeners", 7)),
      "Oyentes Spotify / ventana exacta de siete días",
    ],
    [
      "ANÁLISIS",
      signed(change("youtubeChannelViews", 7)),
      "Vistas del canal / ventana exacta de siete días",
    ],
    [
      "RECOMENDACIONES",
      actions[0] ?? "Sin señal suficiente",
      "Revisar las señales observadas antes de decidir una acción",
    ],
  ].forEach(([label, value, detail], i) => {
    const x = 34 + i * 242;
    panel(x, 174, 230, 167);
    text(x + 16, 316, label!, 7, GREEN, 198);
    text(x + 16, 286, value!, 15, WHITE, 198);
    text(x + 16, 256, detail!, 8, MUTED, 198);
  });
  text(34, 143, "PRIORIDAD DE LA SEMANA", 7, GREEN);
  text(
    34,
    116,
    actions[0] ?? "Sin recomendación sustentada para este corte",
    11,
    WHITE,
    724,
  );
  text(
    34,
    91,
    "Las ventanas sin observaciones comparables se muestran sin lectura.",
    8,
    MUTED,
  );

  page("Audiencia y crecimiento", 3, "Rendimiento digital");
  metrics(
    [
      [
        "OYENTES SPOTIFY",
        compact(current.spotifyMonthlyListeners),
        `${signed(change("spotifyMonthlyListeners", 30))} / 30d`,
      ],
      [
        "SEGUIDORES SPOTIFY",
        compact(current.spotifyFollowers),
        `${signed(change("spotifyFollowers", 30))} / 30d`,
      ],
      [
        "VISTAS YOUTUBE",
        compact(current.youtubeChannelViews),
        `${signed(change("youtubeChannelViews", 30))} / 30d`,
      ],
      [
        "INSTAGRAM",
        compact(current.instagramFollowers),
        `${signed(change("instagramFollowers", 30))} / 30d`,
      ],
    ],
    457,
  );
  panel(34, 84, 724, 245);
  text(52, 303, "OYENTES MENSUALES SPOTIFY / 90 DÍAS", 7, GREEN);
  const chart = history.filter(
    (r) =>
      r.spotifyMonthlyListeners != null &&
      Date.parse(current.date) - Date.parse(r.date) < 90 * 86400000,
  );
  text(
    52,
    278,
    chart.length
      ? `${compact(chart[0]!.spotifyMonthlyListeners)} -> ${compact(chart.at(-1)!.spotifyMonthlyListeners)}`
      : "Sin historial comparable",
    19,
  );
  if (chart.length > 1) {
    const vals = chart.map((r) => r.spotifyMonthlyListeners!);
    const lo = Math.min(...vals),
      span = Math.max(1, Math.max(...vals) - lo);
    const t0 = Date.parse(chart[0]!.date),
      ts = Math.max(1, Date.parse(chart.at(-1)!.date) - t0);
    chart.forEach((r, i) => {
      const x = 54 + ((Date.parse(r.date) - t0) / ts) * 676,
        y = 612 - 118 - ((r.spotifyMonthlyListeners! - lo) / span) * 118;
      if (i === 0) doc.moveTo(x, y);
      else doc.lineTo(x, y);
    });
    doc.strokeColor(GREEN).lineWidth(2).stroke();
    text(54, 101, dateLabel(chart[0]!.date), 6.5, MUTED);
    text(654, 101, dateLabel(chart.at(-1)!.date), 6.5, MUTED, 90);
  }

  page("Spotify", 4, "Canciones y álbumes en Spotify");
  const sp = input.spotifyCatalog;
  metrics([
    [
      "CANCIONES / DIARIO",
      compact(sp.trackDailyStreams),
      `${sp.trackCount} canciones`,
    ],
    [
      "CANCIONES / ACUMULADO",
      compact(sp.trackTotalStreams),
      "Catálogo registrado",
    ],
    [
      "ÁLBUMES / DIARIO",
      compact(sp.albumDailyStreams),
      `${sp.albumCount} álbumes`,
    ],
    [
      "ÁLBUMES / ACUMULADO",
      compact(sp.albumTotalStreams),
      "Álbumes registrados",
    ],
  ]);
  for (const [col, type] of (["track", "album"] as const).entries()) {
    const x = 34 + col * 366;
    panel(x, 82, 354, 285);
    text(
      x + 18,
      340,
      type === "track"
        ? "CANCIONES CON MÁS STREAMS DIARIOS"
        : "ÁLBUMES CON MÁS STREAMS DIARIOS",
      7,
      GREEN,
      320,
    );
    text(x + 18, 318, "TÍTULO", 6, MUTED);
    text(x + 232, 318, "DIARIOS", 6, MUTED);
    text(x + 292, 318, "TOTAL", 6, MUTED);
    const featured = sp.items
      .filter((i) => i.type === type)
      .sort(compareMonitoringCatalogDaily)
      .slice(0, 5);
    featured.forEach((item, i) => {
        const y = 286 - i * 42;
        const imageIndex = 1 + videos.length + col * 5 + i;
        picture(images[imageIndex], x + 18, y - 5, 30, 30);
        text(x + 56, y, item.title, 8.5, WHITE, 162);
        text(x + 232, y, compact(item.dailyStreams), 8, GREEN, 55);
        text(x + 292, y, compact(item.totalStreams), 8, WHITE, 55);
      });
  }
  text(
    34,
    48,
    `Spotify: lectura del catálogo ${monitoringCatalogDateDescription(sp)}. Los totales de canciones y álbumes se superponen; no se suman.`,
    7,
    MUTED,
  );

  page("YouTube en vivo", 5, "Videos de YouTube con mayor actividad");
  videos.forEach((v, i) => {
    const x = 34 + i * 242;
    panel(x, 242, 230, 240);
    picture(images[i + 1], x + 12, 348, 206, 116);
    text(x + 14, 324, `0${i + 1} / ${v.title ?? v.video_id}`, 9, WHITE, 202);
    text(x + 14, 292, compact(v.view_count), 23, WHITE, 202);
    text(x + 14, 276, "Fuente: YouTube Data API", 6.5, MUTED, 202);
    text(
      x + 14,
      253,
      `${signed(n(v.view_delta))} / ${n(v.seconds_since_previous) == null ? "sin ventana" : `${Math.round(n(v.seconds_since_previous)! / 60)} min`}`,
      8,
      GREEN,
      202,
    );
  });
  panel(34, 70, 724, 145, "#0A140B", "#245D21");
  const featured = videos[0],
    views = n(featured?.view_count);
  const step =
    views == null
      ? null
      : Math.pow(10, Math.floor(Math.log10(Math.max(1, views))));
  const target =
    views == null || step == null
      ? null
      : (Math.floor(views / step) + 1) * step;
  text(
    54,
    185,
    `PRÓXIMO HITO / ${featured?.title ?? "Sin video observado"}`,
    7,
    GREEN,
    684,
  );
  text(54, 146, exact(views), 29);
  text(
    54,
    124,
    target && views != null
      ? `${((views / target) * 100).toFixed(1)}% hacia ${compact(target)} / faltan ${exact(target - views)}`
      : "Sin lectura para calcular un hito",
    9,
    MUTED,
  );
  if (target && views != null) {
    doc.roundedRect(54, 508, 650, 8, 4).fill(LINE);
    doc.roundedRect(54, 508, (650 * views) / target, 8, 4).fill(GREEN);
  }
  text(
    54,
    79,
    `Cálculo de Mexico Charts / lectura: ${featured?.observed_at ?? "sin fecha"}`,
    7,
    MUTED,
    684,
  );

  page(
    "Mercados, comparaciones y alertas",
    6,
    "Mercados y rendimiento comparado",
  );
  panel(34, 202, 355, 280);
  text(52, 454, "TOP MERCADOS MÉXICO / SPOTIFY", 7, GREEN);
  const cities = input.topMexicoCities.slice(0, 5);
  const maxCity = Math.max(1, ...cities.map((c) => c.currentListeners ?? 0));
  cities.forEach((c, i) => {
    const y = 410 - i * 43;
    text(52, y, `0${i + 1}`, 7, GREEN);
    text(75, y, c.name, 9, WHITE, 180);
    text(262, y, exact(c.currentListeners), 8, WHITE, 105);
    doc.roundedRect(75, 612 - y + 7, 270, 5, 2).fill(LINE);
    if (c.currentListeners != null)
      doc
        .roundedRect(
          75,
          612 - y + 7,
          (270 * c.currentListeners) / maxCity,
          5,
          2,
        )
        .fill(GREEN);
  });
  panel(403, 202, 355, 280);
  text(421, 454, "COMPARACIÓN / FECHAS OBSERVADAS", 7, GREEN);
  text(421, 428, "ARTISTA", 6, MUTED);
  text(545, 428, "OYENTES", 6, MUTED);
  text(615, 428, "SPOTIFY 30D", 6, MUTED);
  text(700, 428, "YT 30D", 6, MUTED);
  const bench = [
    {
      artistName: input.artistName,
      spotifyMonthlyListeners: current.spotifyMonthlyListeners,
      snapshotDate: current.date,
      spotifyGrowth30: { absolute: change("spotifyMonthlyListeners", 30) },
      youtubeGrowth30: { absolute: change("youtubeChannelViews", 30) },
    },
    ...input.comparisonArtists,
  ].slice(0, 3);
  bench.forEach((a, i) => {
    const y = 394 - i * 47;
    text(421, y, a.artistName, 9, WHITE, 118);
    text(421, y - 12, a.snapshotDate ?? "Sin fecha", 6, MUTED, 118);
    text(545, y, compact(a.spotifyMonthlyListeners), 8, WHITE, 65);
    text(615, y, signed(n(a.spotifyGrowth30?.absolute)), 7, GREEN, 78);
    text(700, y, signed(n(a.youtubeGrowth30?.absolute)), 7, GREEN, 52);
  });
  text(34, 170, "SEÑALES DEL CORTE", 7, GREEN);
  (actions.length
    ? actions.slice(0, 3)
    : ["Sin señales registradas en la lectura disponible"]
  ).forEach((s, i) => {
    const x = 34 + i * 242;
    panel(x, 78, 230, 70);
    text(x + 14, 119, s, 8, WHITE, 202);
    text(
      x + 14,
      92,
      "Señal observada / sin notificación enviada",
      6.5,
      MUTED,
      202,
    );
  });

  page(
    "Comparación y recomendaciones",
    7,
    "Rendimiento frente a otros artistas",
  );
  const comparable = input.comparisonArtists.filter(
    (a) => a.snapshotDate === current.date && a.spotifyMonthlyListeners != null,
  );
  [
    [
      "OYENTES",
      comparable.length && current.spotifyMonthlyListeners != null
        ? `#${1 + comparable.filter((a) => a.spotifyMonthlyListeners! > current.spotifyMonthlyListeners!).length}`
        : "Sin corte comparable",
      "Comparación sólo entre lecturas de la misma fecha",
    ],
    [
      "YOUTUBE 30D",
      signed(change("youtubeChannelViews", 30)),
      "Diferencia entre observaciones de fechas exactas",
    ],
    [
      "SPOTIFY 30D",
      signed(change("spotifyMonthlyListeners", 30)),
      "Oyentes mensuales / Cálculo de Mexico Charts",
    ],
  ].forEach(([label, value, detail], i) => {
    const x = 34 + i * 242;
    panel(x, 350, 230, 122);
    text(x + 16, 444, label!, 7, GREEN, 198);
    text(x + 16, 405, value!, 25, WHITE, 198);
    text(x + 16, 376, detail!, 8, MUTED, 198);
  });
  panel(34, 92, 724, 230);
  text(54, 292, "RECOMENDACIONES / PRÓXIMA SEMANA", 7, GREEN);
  const recommendations = actions.slice(0, 4).map((s) => `Revisar: ${s}`);
  if (!recommendations.length)
    recommendations.push(
      "Sin evidencia suficiente para una recomendación específica en este corte.",
    );
  recommendations.forEach((s, i) => {
    const x = 54 + (i % 2) * 350,
      y = 248 - Math.floor(i / 2) * 80;
    text(x, y, `0${i + 1}`, 8, GREEN);
    text(x + 30, y, s, 9, WHITE, 285);
  });
  text(
    54,
    111,
    "Recomendaciones de Mexico Charts basadas en señales reales; no son alertas configuradas.",
    7,
    MUTED,
  );

  page("Datos y fuentes", 8, "Cifras exactas del reporte");
  panel(34, 248, 355, 230);
  text(52, 450, "MÉTRICAS DEL CORTE", 7, GREEN);
  (
    [
      ["Oyentes mensuales Spotify", "spotifyMonthlyListeners"],
      ["Seguidores Spotify", "spotifyFollowers"],
      ["Vistas totales YouTube", "youtubeChannelViews"],
      ["Seguidores Instagram", "instagramFollowers"],
      ["Seguidores TikTok", "tiktokFollowers"],
    ] as const
  ).forEach(([label, key], i) => {
    const y = 416 - i * 37;
    text(52, y, label, 7.5, MUTED, 145);
    text(201, y, exact(current[key]), 8, WHITE, 98);
    const delta = change(key, 30);
    text(
      302,
      y,
      signed(delta),
      7,
      delta != null && delta < 0 ? RED : GREEN,
      78,
    );
  });
  panel(403, 248, 355, 230);
  text(421, 450, "FUENTES", 7, GREEN);
  [
    "Songstats: audiencia y estadísticas de plataformas",
    "Kworb: streams por canción y álbum",
    "Fuente: YouTube Data API / estadísticas directas",
    "Cálculo de Mexico Charts / ventanas observadas",
    "Comparaciones: fecha indicada para cada artista",
    "No se estiman vistas entre actualizaciones",
  ].forEach((s, i) => {
    const y = 410 - i * 30;
    text(421, y, `0${i + 1}`, 7, GREEN);
    text(448, y, s, 7.5, MUTED, 285);
  });
  panel(34, 78, 724, 140, "#0A140B", "#245D21");
  text(54, 187, "NOTAS", 7, GREEN);
  text(
    54,
    158,
    `Semana: ${dateLabel(start)} - ${dateLabel(input.weekEnd)}`,
    10,
    WHITE,
    680,
  );
  text(
    54,
    137,
    "Los catálogos, videos y mercados indican las lecturas disponibles al generar el reporte.",
    9,
    MUTED,
    680,
  );
  text(
    54,
    105,
    "Frecuencia semanal / el envío por correo y las preferencias persistentes siguen pendientes.",
    8,
    WHITE,
    680,
  );
  doc.end();
  return result;
}
