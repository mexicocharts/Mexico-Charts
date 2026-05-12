import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import SiteNav from "@/components/SiteNav";
import { useTouring, type ArtistTours, type TmEvent } from "@/hooks/useTouring";

const HERO_BG     = "/touring-hero.png";
const ARTIST_BACK = "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=640&h=620&fit=crop&q=80";
const INSIGHT1    = "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=400&h=220&fit=crop&q=70";
const INSIGHT2    = "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=400&h=220&fit=crop&q=70";
const INSIGHT3    = "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&h=220&fit=crop&q=70";
const INSIGHT4    = "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=220&fit=crop&q=70";

const FALLBACK_IMGS: Record<string, string> = {
  "fuerza-regida":    "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&h=500&fit=crop&q=75",
  "banda-ms":         "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=500&fit=crop&q=75",
  "grupo-firme":      "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=400&h=500&fit=crop&q=75",
  "junior-h":         "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=500&fit=crop&q=75",
  "peso-pluma":       "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&h=500&fit=crop&q=75",
  "eslabon-armado":   "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=400&h=500&fit=crop&q=75",
  "natanael-cano":    "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=500&fit=crop&q=75",
  "carin-leon":       "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&h=500&fit=crop&q=75",
  "eden-munoz":       "https://images.unsplash.com/photo-1598387993281-cecf8b71a8f8?w=400&h=500&fit=crop&q=75",
  "christian-nodal":  "https://images.unsplash.com/photo-1460723237483-7a6dc9d0b212?w=400&h=500&fit=crop&q=75",
  "larry-hernandez":  "https://images.unsplash.com/photo-1504704911898-68304a7d2807?w=400&h=500&fit=crop&q=75",
  "xavi":             "https://images.unsplash.com/photo-1571935441008-e6244ff434d8?w=400&h=500&fit=crop&q=75",
  "los-dos-carnales": "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=400&h=500&fit=crop&q=75",
};

const PROFILE_SLUGS: Record<string, string> = {
  "peso-pluma": "peso-pluma",
};

const insights = [
  { tag: "Análisis",   title: "El Crecimiento Global de la Música Mexicana", date: "10 Mayo, 2024",  image: INSIGHT1 },
  { tag: "Data Story", title: "Tumbado en USA: Números que Impactan",         date: "28 Abril, 2024", image: INSIGHT2 },
  { tag: "Artículo",  title: "De la Calle a los Escenarios Más Grandes",     date: "15 Abril, 2024", image: INSIGHT3 },
  { tag: "Mercados",  title: "México en los Escenarios del Mundo",            date: "03 Abril, 2024", image: INSIGHT4 },
];

function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${d} ${months[parseInt(m,10)-1]} ${y}`;
}

function ShelfCard({ artist, idx }: { artist: ArtistTours; idx: number }) {
  const photo = artist.events[0]?.img ?? FALLBACK_IMGS[artist.id] ?? null;
  const profileSlug = PROFILE_SLUGS[artist.id];
  const nextEv = artist.events[0];
  const accent = idx === 0 ? "#39FF14" : idx === 1 ? "rgba(57,255,20,0.7)" : "rgba(57,255,20,0.45)";

  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: idx * 0.055, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.03, y: -5, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } }}
      style={{ position: "relative", width: 140, height: 310, borderRadius: 12, boxShadow: "0 4px 28px rgba(0,0,0,0.7)", cursor: "pointer", flexShrink: 0, scrollSnapAlign: "start" }}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 14,
        WebkitMaskImage: "radial-gradient(ellipse 100% 100% at 50% 50%, white 97%, transparent 100%)",
        maskImage: "radial-gradient(ellipse 100% 100% at 50% 50%, white 97%, transparent 100%)" }}>

        <div style={{
          position: "absolute", inset: 0,
          background: photo ? `url(${photo}) center top / cover no-repeat` : "linear-gradient(160deg, #0a0a0a 0%, #141414 100%)",
          filter: photo ? "brightness(0.82) saturate(0.65) contrast(1.08)" : undefined,
        }} />

        {photo && <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 85% 90% at 50% 42%, transparent 45%, rgba(0,0,0,0.55) 80%, rgba(0,0,0,0.85) 100%)" }} />}

        <div style={{ position: "absolute", top: 10, left: 12, fontSize: 40, fontWeight: 900, color: "rgba(255,255,255,0.08)", lineHeight: 1, fontFamily: "Inter, sans-serif", letterSpacing: "-0.04em", userSelect: "none" }}>
          {String(idx + 1).padStart(2, "0")}
        </div>

        {artist.events.length > 0 && (
          <div style={{ position: "absolute", top: 12, right: 12, width: 7, height: 7, borderRadius: "50%", background: accent, boxShadow: `0 0 6px ${accent}` }} />
        )}

        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 12px 12px", background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 55%, transparent 100%)" }}>
          <div className="th-anton" style={{ color: "#fff", fontSize: 17, textTransform: "uppercase", lineHeight: 1.1, marginBottom: 3 }}>{artist.name}</div>
          {nextEv ? (
            <>
              <div style={{ color: accent, fontSize: 10, fontWeight: 900 }}>{artist.events.length} shows</div>
              <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {formatDate(nextEv.date)} · {nextEv.city}
              </div>
            </>
          ) : (
            <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em" }}>Sin fechas</div>
          )}
        </div>
      </div>
    </motion.div>
  );

  if (profileSlug) {
    return <Link href={`/touring/${profileSlug}`}>{inner}</Link>;
  }
  if (nextEv?.url) {
    return <a href={nextEv.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>{inner}</a>;
  }
  return inner;
}

function SkeletonShelfCard() {
  return (
    <div style={{ width: 140, height: 310, borderRadius: 12, background: "#111", flexShrink: 0, scrollSnapAlign: "start", animation: "pulse 1.5s ease-in-out infinite" }} />
  );
}

const profileCards = [
  { artist: "Peso Pluma",  subtitle: "Éxodo Tour 2024",  gross: "$87.4M",  tickets: "758K", shows: 288, slug: "peso-pluma",    img: FALLBACK_IMGS["peso-pluma"] },
  { artist: "Luis Miguel", subtitle: "Tour 2023–2024",   gross: "$317.2M", tickets: "2.2M", shows: 173, slug: "luis-miguel",   img: FALLBACK_IMGS["grupo-firme"] },
  { artist: "Junior H",   subtitle: "Sad Boyz",          gross: "$90.4M",  tickets: "758K", shows: 69,  slug: "junior-h",     img: FALLBACK_IMGS["junior-h"] },
  { artist: "Grupo Firme",subtitle: "Tour 2022–2023",    gross: "$81.6M",  tickets: "687K", shows: 72,  slug: "grupo-firme",  img: FALLBACK_IMGS["grupo-firme"] },
];

type CountryFilter = "ALL" | "US" | "MX" | "OTHER";

const COUNTRY_LABELS: Record<CountryFilter, string> = {
  ALL:   "Todos",
  US:    "Estados Unidos",
  MX:    "México",
  OTHER: "Internacional",
};

export default function TouringHub() {
  const { data: artists, isLoading, isError } = useTouring();
  const [countryFilter, setCountryFilter] = useState<CountryFilter>("ALL");
  const [showAll, setShowAll] = useState(false);
  const PAGE_SIZE = 8;

  const sortedArtists = artists
    ? [...artists].sort((a, b) => b.events.length - a.events.length)
    : [];

  const totalShows = sortedArtists.reduce((sum, a) => sum + a.events.length, 0);

  const allShowsFlat = sortedArtists
    .flatMap(a => a.events.slice(0, 8).map(ev => ({ ...ev, artistName: a.name, artistId: a.id })))
    .sort((a, b) => a.date.localeCompare(b.date));

  const filteredShows = allShowsFlat.filter(ev => {
    if (countryFilter === "ALL")   return true;
    if (countryFilter === "US")    return ev.country === "US";
    if (countryFilter === "MX")    return ev.country === "MX";
    if (countryFilter === "OTHER") return ev.country !== "US" && ev.country !== "MX";
    return true;
  });

  return (
    <div style={{ background: "#080808", minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: "#9ca3af" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;900&display=swap');
        .th-anton { font-family: 'Anton', sans-serif !important; }
        button { cursor: pointer; }
        a { text-decoration: none; }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
      ` }} />

      <SiteNav />

      {/* ── HERO ── */}
      <section style={{ position: "relative", height: 520, overflow: "hidden" }}>
        <img src={HERO_BG} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(8,8,8,0.95) 40%, rgba(8,8,8,0.55) 65%, rgba(8,8,8,0.25) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(8,8,8,1) 0%, transparent 40%)" }} />


        <div style={{ position: "relative", zIndex: 10, padding: "52px 40px 40px", maxWidth: 520, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "#39FF14", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", marginBottom: 16 }}>Touring</div>
            <motion.h1 className="th-anton"
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
              style={{ color: "#fff", fontSize: 76, lineHeight: 0.9, textTransform: "uppercase" }}>
              La Música<br />Mexicana<br />en Vivo
            </motion.h1>
          </div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }}
            style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {!isLoading && !isError && totalShows > 0 && (
              <div style={{ display: "flex", gap: 24 }}>
                <div>
                  <div style={{ color: "#39FF14", fontSize: 26, fontWeight: 900 }}>{totalShows}</div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.2em" }}>Shows próximos</div>
                </div>
                <div>
                  <div style={{ color: "#39FF14", fontSize: 26, fontWeight: 900 }}>{sortedArtists.filter(a => a.events.length > 0).length}</div>
                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.2em" }}>Artistas en gira</div>
                </div>
              </div>
            )}
            <Link href="/touring/peso-pluma">
              <button style={{ background: "transparent", border: "1px solid #fff", color: "#fff", padding: "10px 20px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", display: "inline-flex", alignItems: "center", gap: 8 }}>
                Explorar Perfiles <span style={{ fontSize: 14 }}>→</span>
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── UPCOMING TOURS — horizontal shelf ── */}
      <section style={{ paddingTop: 36, paddingBottom: 28, borderBottom: "1px solid #111", position: "relative" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 1, background: "linear-gradient(to right, transparent, rgba(255,255,255,0.06), transparent)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 32px", marginBottom: 20 }}>
          <span style={{ color: "#39FF14", fontSize: 14 }}>◈</span>
          <h2 style={{ color: "rgba(255,255,255,0.45)", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.25em", margin: 0 }}>
            Upcoming Tours
          </h2>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)", marginLeft: 8 }} />
          {!isLoading && !isError && totalShows > 0 && (
            <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#39FF14", display: "inline-block" }} />
              {totalShows} shows · Ticketmaster
            </span>
          )}
        </div>

        {isError && (
          <div style={{ margin: "0 32px", background: "#0d0d0d", border: "1px solid rgba(255,60,60,0.2)", padding: "16px 20px", color: "rgba(255,80,80,0.7)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.12em" }}>
            Error cargando datos de Ticketmaster
          </div>
        )}

        <div style={{ display: "flex", gap: 16, overflowX: "auto", padding: "4px 32px 12px", scrollSnapType: "x mandatory", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonShelfCard key={i} />)
            : sortedArtists.map((artist, idx) => (
                <ShelfCard key={artist.id} artist={artist} idx={idx} />
              ))}
        </div>
      </section>

      {/* ── ALL UPCOMING SHOWS — flat list ── */}
      {!isLoading && !isError && totalShows > 0 && (
        <section style={{ padding: "40px 32px", borderBottom: "1px solid #111" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 className="th-anton" style={{ fontSize: 28, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              <span style={{ color: "#fff" }}>Todos los</span> <span style={{ color: "#39FF14" }}>Shows</span>
            </h2>
            <div style={{ display: "flex", gap: 4 }}>
              {(["ALL", "US", "MX", "OTHER"] as CountryFilter[]).map(f => {
                const isActive = countryFilter === f;
                const count = f === "ALL"
                  ? allShowsFlat.length
                  : allShowsFlat.filter(ev =>
                      f === "US" ? ev.country === "US"
                    : f === "MX" ? ev.country === "MX"
                    : ev.country !== "US" && ev.country !== "MX"
                    ).length;
                return (
                  <button key={f} onClick={() => setCountryFilter(f)}
                    style={{
                      background: isActive ? "#39FF14" : "transparent",
                      border: `1px solid ${isActive ? "#39FF14" : "#2a2a2a"}`,
                      color: isActive ? "#000" : "#666",
                      padding: "6px 14px",
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      transition: "all 0.15s",
                    }}>
                    {COUNTRY_LABELS[f]}
                    <span style={{
                      background: isActive ? "rgba(0,0,0,0.15)" : "#1a1a1a",
                      color: isActive ? "#000" : "#444",
                      fontSize: 9,
                      fontWeight: 700,
                      padding: "1px 5px",
                      borderRadius: 2,
                    }}>{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {filteredShows.length === 0 ? (
            <div style={{ padding: "32px 0", color: "rgba(255,255,255,0.2)", fontSize: 12, textTransform: "uppercase", letterSpacing: "0.15em", textAlign: "center" }}>
              Sin shows en esta región por el momento
            </div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {filteredShows.slice(0, showAll ? filteredShows.length : PAGE_SIZE).map((ev, i) => (
                  <motion.a
                    key={ev.eventId} href={ev.url} target="_blank" rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}
                    style={{ display: "flex", alignItems: "center", background: "#0a0a0a", border: "1px solid #111", textDecoration: "none", overflow: "hidden" }}
                    whileHover={{ borderColor: "#39FF14" }}>
                    {ev.img && (
                      <div style={{ width: 52, height: 52, flexShrink: 0, overflow: "hidden" }}>
                        <img src={ev.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.55) saturate(0.4)" }} />
                      </div>
                    )}
                    <div style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 16px", minWidth: 0, gap: 0 }}>
                      <span style={{ color: "#39FF14", fontSize: 10, fontWeight: 700, minWidth: 96, flexShrink: 0 }}>{formatDate(ev.date)}</span>
                      <span className="th-anton" style={{ color: "#fff", fontSize: 13, textTransform: "uppercase", minWidth: 160, flexShrink: 0 }}>{ev.artistName}</span>
                      <span style={{ color: "rgba(255,255,255,0.38)", fontSize: 11, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.venue}</span>
                      <span style={{ color: "rgba(255,255,255,0.25)", fontSize: 10, flexShrink: 0, marginLeft: 16 }}>{ev.city}{ev.state ? `, ${ev.state}` : ""}</span>
                    </div>
                    <div style={{ padding: "0 16px", flexShrink: 0, borderLeft: "1px solid #161616", height: 52, display: "flex", alignItems: "center" }}>
                      <span style={{ color: "#39FF14", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>Boletos →</span>
                    </div>
                  </motion.a>
                ))}
              </div>

              {filteredShows.length > PAGE_SIZE && (
                <div style={{ marginTop: 16, textAlign: "center" }}>
                  <button
                    onClick={() => setShowAll(s => !s)}
                    style={{ background: "transparent", border: "1px solid #2a2a2a", color: "#666", padding: "10px 28px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", cursor: "pointer" }}>
                    {showAll ? `Ver menos ↑` : `Ver más · ${filteredShows.length - PAGE_SIZE} shows más →`}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ── FEATURED TOURING PROFILES ── */}
      <section style={{ padding: "40px 32px", borderBottom: "1px solid #111" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 className="th-anton" style={{ fontSize: 28, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <span style={{ color: "#fff" }}>Featured</span> <span style={{ color: "#39FF14" }}>Touring Profiles</span>
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {profileCards.map((p, i) => (
            <motion.div key={p.artist}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              style={{ border: "1px solid #1a1a1a", overflow: "hidden", cursor: "pointer", background: "#0a0a0a", position: "relative" }}
              whileHover={{ borderColor: "#39FF14" }}>
              <div style={{ position: "relative", height: 160, overflow: "hidden" }}>
                <img src={p.img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", filter: "brightness(0.6) grayscale(0.2)" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 20%, rgba(10,10,10,0.95) 100%)" }} />
                <div style={{ position: "absolute", bottom: 12, left: 14, right: 14 }}>
                  <div className="th-anton" style={{ color: "#fff", fontSize: 22, textTransform: "uppercase", lineHeight: 1 }}>{p.artist}</div>
                  <div style={{ color: "#39FF14", fontSize: 11, fontWeight: 600, marginTop: 2 }}>{p.subtitle}</div>
                </div>
              </div>
              <div style={{ padding: "14px 14px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: 12, borderBottom: "1px solid #1a1a1a" }}>
                  <div>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>{p.gross}</div>
                    <div style={{ color: "#555", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em" }}>Gross Reportado</div>
                  </div>
                  <div style={{ textAlign: "center" }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>{p.tickets}</div>
                    <div style={{ color: "#555", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em" }}>Tickets</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>{p.shows}</div>
                    <div style={{ color: "#555", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em" }}>Shows</div>
                  </div>
                </div>
                <Link href={`/touring/${p.slug}`}>
                  <button style={{ marginTop: 12, background: "none", border: "none", color: "#39FF14", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 4, padding: 0, width: "100%" }}>
                    Ver Perfil Completo →
                  </button>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── TOURING INSIGHTS ── */}
      <section style={{ padding: "40px 32px", borderBottom: "1px solid #111" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 className="th-anton" style={{ fontSize: 28, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <span style={{ color: "#fff" }}>Touring</span> <span style={{ color: "#39FF14" }}>Insights</span>
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {insights.map((ins, i) => (
            <motion.div key={ins.title}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.07 }}
              style={{ border: "1px solid #1a1a1a", overflow: "hidden", cursor: "pointer", background: "#0a0a0a" }}
              whileHover={{ borderColor: "#39FF14" }}>
              <div style={{ position: "relative", height: 140, overflow: "hidden" }}>
                <img src={ins.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.5) saturate(0.4)" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, rgba(10,10,10,0.9) 100%)" }} />
                <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(57,255,20,0.15)", border: "1px solid rgba(57,255,20,0.3)", color: "#39FF14", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", padding: "2px 8px" }}>
                  {ins.tag}
                </div>
              </div>
              <div style={{ padding: "14px 14px 16px" }}>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, lineHeight: 1.3, marginBottom: 8 }}>{ins.title}</div>
                <div style={{ color: "#555", fontSize: 10 }}>{ins.date}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── NEWSLETTER ── */}
      <section style={{ padding: "32px 32px", background: "#0d0d0d", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid #333", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✉</div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 14, textTransform: "uppercase", letterSpacing: "0.1em" }}>Sé el Primero en Saber</div>
            <div style={{ color: "#666", fontSize: 11, marginTop: 2 }}>Recibe alertas de nuevos tours y reportes exclusivos</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 0, maxWidth: 420, flex: 1 }}>
          <input placeholder="Tu correo electrónico"
            style={{ flex: 1, background: "#1a1a1a", border: "1px solid #333", borderRight: "none", color: "#fff", padding: "12px 16px", fontSize: 12, outline: "none" }} />
          <button style={{ background: "#39FF14", border: "none", color: "#000", padding: "12px 24px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            Suscribirme
          </button>
        </div>
      </section>

      <footer style={{ padding: "20px 32px", borderTop: "1px solid #111", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: "#444", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>© 2024 Mexico Charts</div>
        <div style={{ color: "#39FF14", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em" }}>El Movimiento No Para</div>
        <div style={{ color: "#444", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>Datos: Ticketmaster Discovery API</div>
      </footer>
    </div>
  );
}
