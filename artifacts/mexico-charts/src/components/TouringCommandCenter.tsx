import { Link } from "wouter";
import {
  useRemoveTouringWatch,
  useSaveTouringWatch,
  useTouringIntelligence,
  useTouringWatchlist,
  type Confidence,
} from "@/hooks/useTouringIntelligence";

const confidenceLabel: Record<Confidence, string> = {
  high: "confianza alta",
  medium: "confianza media",
  limited: "confianza limitada",
  unavailable: "sin estimación",
};

export default function TouringCommandCenter() {
  const intelligence = useTouringIntelligence();
  const watchlist = useTouringWatchlist();
  const saveWatch = useSaveTouringWatch();
  const removeWatch = useRemoveTouringWatch();
  const watched = new Set((watchlist.data?.artists ?? []).map((artist) => artist.artist_id));

  if (intelligence.isLoading) return null;
  if (!intelligence.data?.tours.length) return null;

  const tours = intelligence.data.tours.slice(0, 10);
  const changes = intelligence.data.recentChanges.slice(0, 5);

  return (
    <section style={{ padding: "48px 32px", borderBottom: "1px solid #111", background: "#090909" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <p style={{ color: "#39FF14", fontSize: 9, fontWeight: 900, letterSpacing: ".28em", textTransform: "uppercase", margin: 0 }}>
          Qué importa ahora
        </p>
        <div style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 20, flexWrap: "wrap", marginTop: 8 }}>
          <div>
            <h2 className="th-anton" style={{ color: "#fff", fontSize: 34, textTransform: "uppercase", margin: 0 }}>Touring Command Center</h2>
            <p style={{ color: "rgba(255,255,255,.46)", fontSize: 11, lineHeight: 1.7, maxWidth: 720, margin: "8px 0 0" }}>
              Ranking editorial por escala, cercanía, estado de venta y cobertura pública. El Demand Score es una señal estimada, no boletos vendidos.
            </p>
          </div>
          <span style={{ border: "1px solid #222", color: "#777", padding: "7px 10px", fontSize: 8, fontWeight: 900, letterSpacing: ".14em", textTransform: "uppercase" }}>
            Actualizado {new Date(intelligence.data.generatedAt).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(245px,1fr))", gap: 10, marginTop: 24 }}>
          {tours.map((tour, index) => {
            const isWatched = watched.has(tour.artistId);
            const busy = saveWatch.isPending || removeWatch.isPending;
            return (
              <article key={tour.artistId} style={{ border: "1px solid #1b1b1b", background: "#0c0c0c", padding: 17 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span style={{ color: "#39FF14", fontSize: 10, fontWeight: 900 }}>#{index + 1}</span>
                  <span style={{ color: "#666", fontSize: 8, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase" }}>{tour.appearanceType}</span>
                </div>
                <h3 className="th-anton" style={{ color: "#fff", fontSize: 21, textTransform: "uppercase", margin: "12px 0 4px" }}>{tour.artistName}</h3>
                <p style={{ color: "#777", fontSize: 10, minHeight: 28, margin: 0 }}>{tour.tourName}</p>
                <div style={{ display: "flex", gap: 20, marginTop: 15 }}>
                  <div><strong style={{ color: "#fff", fontSize: 18 }}>{tour.concertCount}</strong><small style={{ display: "block", color: "#555", fontSize: 8, textTransform: "uppercase" }}>fechas</small></div>
                  <div><strong style={{ color: "#fff", fontSize: 18 }}>{tour.demandScore || "—"}</strong><small style={{ display: "block", color: "#555", fontSize: 8, textTransform: "uppercase" }}>demanda</small></div>
                </div>
                <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #181818", color: "#666", fontSize: 8, fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase" }}>
                  {tour.status} · {confidenceLabel[tour.demandConfidence]}
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => isWatched
                    ? removeWatch.mutate(tour.artistId)
                    : saveWatch.mutate({ artistId: tour.artistId, artistName: tour.artistName, urgentAlerts: true, dailyDigest: true, announcementAlerts: true, onsaleAlerts: true, changeAlerts: true })}
                  style={{ width: "100%", marginTop: 13, padding: "9px 10px", border: `1px solid ${isWatched ? "#39FF14" : "#292929"}`, background: isWatched ? "rgba(57,255,20,.09)" : "transparent", color: isWatched ? "#39FF14" : "#aaa", fontSize: 8, fontWeight: 900, letterSpacing: ".14em", textTransform: "uppercase" }}
                >
                  {isWatched ? "Siguiendo · quitar" : "Seguir artista + alertas"}
                </button>
              </article>
            );
          })}
        </div>

        {intelligence.data.publicEstimation?.tours?.length > 0 && (
          <div style={{ marginTop: 28, borderTop: "1px solid #1b1b1b", paddingTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
              <div>
                <h3 style={{ color: "#fff", fontSize: 11, fontWeight: 900, letterSpacing: ".16em", textTransform: "uppercase", margin: 0 }}>Tour totals · Mexico Charts Estimate</h3>
                <p style={{ color: "#666", fontSize: 9, margin: "6px 0 0" }}>Point estimates con evidencia; no son reportes de promotor ni inventario.</p>
              </div>
              <span style={{ color: "#39FF14", fontSize: 8, fontWeight: 900, letterSpacing: ".12em", textTransform: "uppercase" }}>{intelligence.data.publicEstimation.label}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(235px,1fr))", gap: 9, marginTop: 12 }}>
              {intelligence.data.publicEstimation.tours.slice(0, 6).map((tour) => (
                <article key={`${tour.artistId}-${tour.tourName}`} style={{ border: "1px solid rgba(57,255,20,.22)", padding: 13, background: "rgba(57,255,20,.025)" }}>
                  <strong style={{ color: "#fff", fontSize: 13, textTransform: "uppercase" }}>{tour.artistName}</strong>
                  <div style={{ color: "#666", fontSize: 9, marginTop: 4 }}>{tour.tourName}</div>
                  <div style={{ display: "flex", gap: 18, marginTop: 12 }}>
                    <span style={{ color: "#fff", fontSize: 14, fontWeight: 900 }}>{tour.estimatedTicketsSold?.toLocaleString("en-US") ?? "—"}<small style={{ display: "block", color: "#555", fontSize: 7, letterSpacing: ".1em", textTransform: "uppercase" }}>tickets</small></span>
                    <span style={{ color: "#39FF14", fontSize: 14, fontWeight: 900 }}>{tour.estimatedGrossUsd == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(tour.estimatedGrossUsd)}<small style={{ display: "block", color: "#555", fontSize: 7, letterSpacing: ".1em", textTransform: "uppercase" }}>gross</small></span>
                    <span style={{ color: "#aaa", fontSize: 14, fontWeight: 900 }}>{tour.confidencePercent ?? "—"}%<small style={{ display: "block", color: "#555", fontSize: 7, letterSpacing: ".1em", textTransform: "uppercase" }}>confianza</small></span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {changes.length > 0 && (
          <div style={{ marginTop: 30 }}>
            <h3 style={{ color: "#fff", fontSize: 11, fontWeight: 900, letterSpacing: ".16em", textTransform: "uppercase" }}>Cambios recientes observados</h3>
            <div style={{ display: "grid", gap: 7, marginTop: 12 }}>
              {changes.map((change) => (
                <Link key={`${change.eventId}-${change.observedAt}`} href={`/touring/event/${encodeURIComponent(change.eventId)}`} style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", border: "1px solid #181818", padding: "11px 13px", color: "#aaa", fontSize: 10 }}>
                  <span><strong style={{ color: "#fff" }}>{change.artistName}</strong> · {change.eventName}</span>
                  <span style={{ color: "#39FF14", fontSize: 8, fontWeight: 900, letterSpacing: ".1em", textTransform: "uppercase" }}>{change.changedFields.join(", ")} →</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
