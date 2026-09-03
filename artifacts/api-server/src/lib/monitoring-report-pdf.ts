import PDFDocument from "pdfkit";

type Snapshot = {
  date: string;
  spotifyMonthlyListeners: number | null;
  spotifyFollowers: number | null;
  youtubeSubscribers: number | null;
  youtubeChannelViews: number | null;
  instagramFollowers: number | null;
  tiktokFollowers: number | null;
};

type SpotifyItem = {
  type: "track" | "album";
  title: string;
  totalStreams: number | null;
  dailyStreams: number | null;
};

type LiveVideo = {
  video_id: string;
  title?: string | null;
  view_count?: string | number | null;
  view_delta?: string | number | null;
  views_24h?: string | number | null;
};

export type MonitoringReportInput = {
  artistName: string;
  artistKey: string;
  month: string;
  generatedAt: Date;
  history: Snapshot[];
  spotifyCatalog: {
    snapshotDate: string | null;
    trackCount: number;
    albumCount: number;
    trackDailyStreams: number | null;
    albumDailyStreams: number | null;
    trackTotalStreams: number | null;
    albumTotalStreams: number | null;
    items: SpotifyItem[];
  };
  liveVideos: LiveVideo[];
  topMexicoCities: Array<{ name: string; currentListeners: number | null }>;
  dailyPulse: {
    headline: string;
    summary: string;
  };
  spotifyHistory: Array<{ date: string; totalStreams: number | null; dailyStreams: number | null }>;
  liveVideoHistory: Array<{ video_id: string; snapshot_date: string; view_count: string | number | null }>;
  comparisonArtists: Array<{ artistName: string; spotifyMonthlyListeners: number | null }>;
};

const COLORS = {
  black: "#050505",
  panel: "#111111",
  line: "#2A2A2A",
  white: "#FFFFFF",
  muted: "#8B8B8B",
  green: "#39FF14",
  spotify: "#1ED760",
  red: "#FF5C68",
};

function number(value: number | null | undefined): string {
  return value == null ? "—" : new Intl.NumberFormat("es-MX").format(value);
}

function compact(value: number | null | undefined): string {
  if (value == null) return "—";
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (absolute >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return number(value);
}

function numeric(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function beginPage(doc: PDFKit.PDFDocument, title: string, page: number, total: number) {
  doc.addPage({ size: "LETTER", layout: "landscape", margin: 0 });
  doc.rect(0, 0, 792, 612).fill(COLORS.black);
  doc.fillColor(COLORS.green).font("Helvetica-Bold").fontSize(8).text("MEXICO CHARTS / MONITOR PRO", 34, 25);
  doc.fillColor(COLORS.muted).fontSize(7).text(title.toUpperCase(), 34, 39);
  doc.text(`${page} / ${total}`, 716, 32, { width: 42, align: "right" });
  doc.moveTo(34, 55).lineTo(758, 55).strokeColor(COLORS.line).lineWidth(0.7).stroke();
}

function footer(doc: PDFKit.PDFDocument, input: MonitoringReportInput) {
  doc.moveTo(34, 580).lineTo(758, 580).strokeColor(COLORS.line).lineWidth(0.7).stroke();
  doc.fillColor(COLORS.muted).font("Helvetica").fontSize(6.5)
    .text("Datos normalizados guardados por Mexico Charts. No incluye respuestas crudas de proveedores.", 34, 587);
  doc.font("Helvetica-Bold").text(`CORTE: ${input.month}`, 650, 587, { width: 108, align: "right" });
}

function card(doc: PDFKit.PDFDocument, x: number, y: number, width: number, height: number) {
  doc.roundedRect(x, y, width, height, 12).fillAndStroke(COLORS.panel, COLORS.line);
}

function metricCard(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  label: string,
  value: string,
  detail: string,
  accent = COLORS.green,
) {
  card(doc, x, y, 169, 88);
  doc.fillColor(COLORS.muted).font("Helvetica-Bold").fontSize(6.5).text(label.toUpperCase(), x + 14, y + 16, { width: 141 });
  doc.fillColor(COLORS.white).fontSize(22).text(value, x + 14, y + 34, { width: 141 });
  doc.fillColor(accent).fontSize(7).text(detail, x + 14, y + 70, { width: 141 });
}

function table(
  doc: PDFKit.PDFDocument,
  title: string,
  rows: Array<[string, string, string]>,
  x: number,
  y: number,
  width: number,
) {
  const height = 54 + Math.max(1, rows.length) * 31;
  card(doc, x, y, width, height);
  doc.fillColor(COLORS.green).font("Helvetica-Bold").fontSize(7).text(title.toUpperCase(), x + 16, y + 16, { width: width - 32 });
  rows.forEach(([label, primary, secondary], index) => {
    const rowY = y + 45 + index * 31;
    if (index) doc.moveTo(x + 16, rowY - 9).lineTo(x + width - 16, rowY - 9).strokeColor(COLORS.line).lineWidth(0.5).stroke();
    doc.fillColor(COLORS.white).font("Helvetica-Bold").fontSize(8.5).text(label, x + 16, rowY, { width: width * 0.53, ellipsis: true });
    doc.fillColor(COLORS.green).fontSize(8).text(primary, x + width * 0.60, rowY, { width: width * 0.17, align: "right" });
    doc.fillColor(COLORS.muted).fontSize(8).text(secondary, x + width * 0.79, rowY, { width: width * 0.15, align: "right" });
  });
}

function lineChart(doc: PDFKit.PDFDocument, values: number[], x: number, y: number, width: number, height: number) {
  if (values.length < 2) return;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = Math.max(1, high - low);
  const points = values.map((value, index) => ({
    x: x + index * width / (values.length - 1),
    y: y + height - (value - low) * height / span,
  }));
  doc.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach(point => doc.lineTo(point.x, point.y));
  doc.strokeColor(COLORS.green).lineWidth(2).stroke();
}

export function createMonitoringReportPdf(input: MonitoringReportInput): Promise<Buffer> {
  const doc = new PDFDocument({ autoFirstPage: false, compress: true, info: {
    Title: `Monitor Pro de ${input.artistName} — ${input.month}`,
    Author: "Mexico Charts",
    Subject: "Reporte privado de Artist Pro",
  } });
  const chunks: Buffer[] = [];
  doc.on("data", chunk => chunks.push(Buffer.from(chunk)));
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const monthly = input.history.filter(point => point.date.startsWith(input.month));
  const current = monthly.at(-1) ?? input.history.at(-1) ?? null;
  const previous = monthly.at(-2) ?? input.history.at(-2) ?? null;
  const spotifyDelta = current?.spotifyMonthlyListeners != null && previous?.spotifyMonthlyListeners != null
    ? current.spotifyMonthlyListeners - previous.spotifyMonthlyListeners
    : null;
  const youtubeDelta = current?.youtubeChannelViews != null && previous?.youtubeChannelViews != null
    ? current.youtubeChannelViews - previous.youtubeChannelViews
    : null;
  const topTracks = input.spotifyCatalog.items.filter(item => item.type === "track")
    .sort((a, b) => (b.dailyStreams ?? -1) - (a.dailyStreams ?? -1)).slice(0, 10);
  const topAlbums = input.spotifyCatalog.items.filter(item => item.type === "album")
    .sort((a, b) => (b.dailyStreams ?? -1) - (a.dailyStreams ?? -1)).slice(0, 10);

  beginPage(doc, "Reporte ejecutivo", 1, 5);
  doc.fillColor(COLORS.green).font("Helvetica-Bold").fontSize(9).text("REPORTE PRIVADO / ARTIST PRO", 44, 94);
  doc.fillColor(COLORS.white).fontSize(45).text(input.artistName, 44, 122, { width: 650 });
  doc.fillColor(COLORS.muted).font("Helvetica").fontSize(13).text(`Audiencia, catálogo completo de Spotify, YouTube y mercados · ${input.month}`, 47, 180);
  card(doc, 44, 238, 704, 128);
  doc.fillColor(COLORS.green).font("Helvetica-Bold").fontSize(7).text("LECTURA PRINCIPAL", 64, 262);
  doc.fillColor(COLORS.white).fontSize(22).text(input.dailyPulse.headline, 64, 287, { width: 650 });
  doc.fillColor(COLORS.muted).font("Helvetica").fontSize(10).text(input.dailyPulse.summary, 64, 326, { width: 650 });
  metricCard(doc, 44, 398, "Oyentes Spotify", compact(current?.spotifyMonthlyListeners), spotifyDelta == null ? "sin comparación" : `${spotifyDelta >= 0 ? "+" : ""}${number(spotifyDelta)} última lectura`, COLORS.spotify);
  metricCard(doc, 225, 398, "Streams canciones / día", compact(input.spotifyCatalog.trackDailyStreams), `${input.spotifyCatalog.trackCount} canciones`, COLORS.spotify);
  metricCard(doc, 406, 398, "Vistas YouTube", compact(current?.youtubeChannelViews), youtubeDelta == null ? "sin comparación" : `${youtubeDelta >= 0 ? "+" : ""}${number(youtubeDelta)} última lectura`);
  metricCard(doc, 587, 398, "Videos monitorizados", number(input.liveVideos.length), "contadores almacenados");
  footer(doc, input);

  beginPage(doc, "Audiencia e historial", 2, 5);
  doc.fillColor(COLORS.white).font("Helvetica-Bold").fontSize(23).text("Evolución de audiencia", 34, 78);
  metricCard(doc, 34, 118, "Oyentes Spotify", compact(current?.spotifyMonthlyListeners), number(current?.spotifyMonthlyListeners), COLORS.spotify);
  metricCard(doc, 215, 118, "Seguidores Spotify", compact(current?.spotifyFollowers), number(current?.spotifyFollowers), COLORS.spotify);
  metricCard(doc, 396, 118, "Suscriptores YouTube", compact(current?.youtubeSubscribers), number(current?.youtubeSubscribers));
  metricCard(doc, 577, 118, "Instagram", compact(current?.instagramFollowers), number(current?.instagramFollowers));
  card(doc, 34, 234, 724, 290);
  doc.fillColor(COLORS.green).fontSize(7).text("OYENTES MENSUALES DE SPOTIFY / HISTORIAL DEL MES", 54, 258);
  const listeners = monthly.map(point => point.spotifyMonthlyListeners).filter((value): value is number => value != null);
  if (listeners.length > 1) {
    lineChart(doc, listeners, 58, 306, 672, 160);
    doc.fillColor(COLORS.muted).fontSize(7).text(monthly[0]?.date ?? "", 58, 482);
    doc.text(monthly.at(-1)?.date ?? "", 650, 482, { width: 80, align: "right" });
  } else {
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(12).text("El historial todavía no contiene dos lecturas comparables para este mes.", 54, 350, { width: 684, align: "center" });
  }
  footer(doc, input);

  beginPage(doc, "Spotify", 3, 5);
  doc.fillColor(COLORS.white).font("Helvetica-Bold").fontSize(23).text("Catálogo completo de Spotify", 34, 78);
  metricCard(doc, 34, 116, "Canciones / diario", compact(input.spotifyCatalog.trackDailyStreams), `${input.spotifyCatalog.trackCount} canciones`, COLORS.spotify);
  metricCard(doc, 215, 116, "Canciones / acumulado", compact(input.spotifyCatalog.trackTotalStreams), "catálogo registrado", COLORS.spotify);
  metricCard(doc, 396, 116, "Álbumes / diario", compact(input.spotifyCatalog.albumDailyStreams), `${input.spotifyCatalog.albumCount} álbumes`, COLORS.spotify);
  metricCard(doc, 577, 116, "Álbumes / acumulado", compact(input.spotifyCatalog.albumTotalStreams), "álbumes registrados", COLORS.spotify);
  table(doc, "Canciones con más streams diarios", topTracks.map(item => [item.title, `+${compact(item.dailyStreams)}`, compact(item.totalStreams)]), 34, 232, 354);
  table(doc, "Álbumes con más streams diarios", topAlbums.map(item => [item.title, `+${compact(item.dailyStreams)}`, compact(item.totalStreams)]), 404, 232, 354);
  footer(doc, input);

  beginPage(doc, "YouTube en vivo", 4, 5);
  doc.fillColor(COLORS.white).font("Helvetica-Bold").fontSize(23).text("Videos de YouTube monitorizados", 34, 78);
  const videoRows = input.liveVideos.slice(0, 12).map(video => [
    video.title || "Video sin título",
    compact(numeric(video.view_count)),
    `+${compact(numeric(video.views_24h) ?? numeric(video.view_delta))}`,
  ] as [string, string, string]);
  table(doc, "Contadores exactos almacenados", videoRows, 34, 124, 724);
  if (!videoRows.length) {
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(11).text("No hay contadores de videos vinculados y almacenados para este artista en el corte seleccionado.", 54, 225, { width: 684, align: "center" });
  }
  footer(doc, input);

  beginPage(doc, "Mercados y metodología", 5, 5);
  doc.fillColor(COLORS.white).font("Helvetica-Bold").fontSize(23).text("Mercados principales y cobertura", 34, 78);
  table(doc, "Top mercados de México", input.topMexicoCities.slice(0, 10).map((city, index) => [`${String(index + 1).padStart(2, "0")} · ${city.name}`, number(city.currentListeners), "oyentes"]), 34, 124, 354);
  card(doc, 404, 124, 354, 305);
  doc.fillColor(COLORS.green).font("Helvetica-Bold").fontSize(7).text("QUÉ INCLUYE ESTE REPORTE", 422, 145);
  const notes = [
    `${input.spotifyCatalog.trackCount} canciones y ${input.spotifyCatalog.albumCount} álbumes con streams almacenados.`,
    `${input.spotifyHistory.length} cortes diarios de Spotify disponibles.`,
    `${input.liveVideos.length} videos vinculados y ${input.liveVideoHistory.length} observaciones históricas de YouTube.`,
    `${input.history.length} lecturas históricas y ${input.comparisonArtists.length} referentes reales disponibles.`,
    "Las ausencias se muestran como no disponibles; Mexico Charts no inventa datos.",
    "No se incluyen credenciales, respuestas crudas ni información de facturación.",
  ];
  notes.forEach((note, index) => {
    doc.fillColor(COLORS.green).font("Helvetica-Bold").fontSize(8).text(String(index + 1).padStart(2, "0"), 422, 180 + index * 44);
    doc.fillColor(COLORS.white).font("Helvetica").fontSize(9).text(note, 440, 178 + index * 44, { width: 288, lineGap: 2 });
  });
  doc.fillColor(COLORS.muted).fontSize(7).text(`Generado ${input.generatedAt.toISOString()} · artista ${input.artistKey}`, 404, 452, { width: 354 });
  footer(doc, input);

  doc.end();
  return completed;
}
