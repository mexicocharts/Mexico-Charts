import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import SiteNav from "@/components/SiteNav";

const HERO_BG    = "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=1280&h=620&fit=crop&q=85";
const ARTIST_BACK = "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=640&h=620&fit=crop&q=80";
const CONCERT1   = "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&h=500&fit=crop&q=75";
const CONCERT2   = "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=500&fit=crop&q=75";
const CONCERT3   = "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=400&h=500&fit=crop&q=75";
const CONCERT4   = "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=500&fit=crop&q=75";
const INSIGHT1   = "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?w=400&h=220&fit=crop&q=70";
const INSIGHT2   = "https://images.unsplash.com/photo-1429962714451-bb934ecdc4ec?w=400&h=220&fit=crop&q=70";
const INSIGHT3   = "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=400&h=220&fit=crop&q=70";
const INSIGHT4   = "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=400&h=220&fit=crop&q=70";

const upcomingTours = [
  {
    id: "junior-h", featured: true,
    artist: "Junior H", tour: "Sad Boyz", year: "Tour 2025",
    image: CONCERT1, slug: "junior-h",
    dates: [
      { date: "Jun 14", city: "Houston, TX",  venue: "713 Music Hall" },
      { date: "Jun 15", city: "Dallas, TX",   venue: "The Bomb Factory" },
      { date: "Jun 20", city: "Phoenix, AZ",  venue: "Arizona Financial" },
    ],
  },
  {
    id: "peso-pluma", slug: "peso-pluma",
    artist: "Peso Pluma", tour: "Éxodo Tour", year: "2025",
    image: CONCERT2,
    dates: [
      { date: "Jun 12", city: "Chicago, IL",      venue: "" },
      { date: "Jun 13", city: "Indianapolis, IN",  venue: "" },
      { date: "Jun 15", city: "Detroit, MI",       venue: "" },
    ],
  },
  {
    id: "natanael-cano", slug: "natanael-cano",
    artist: "Natanael Cano", tour: "Tumbado", year: "Tour 2025",
    image: CONCERT3,
    dates: [
      { date: "Jun 19", city: "Denver, CO",        venue: "" },
      { date: "Jun 21", city: "Salt Lake City, UT", venue: "" },
      { date: "Jun 23", city: "Seattle, WA",        venue: "" },
    ],
  },
  {
    id: "fuerza-regida", slug: "fuerza-regida",
    artist: "Fuerza Regida", tour: "Tour 2025", year: "",
    image: CONCERT4,
    dates: [
      { date: "Jun 13", city: "Los Ángeles, CA", venue: "" },
      { date: "Jun 14", city: "San Diego, CA",   venue: "" },
      { date: "Jun 21", city: "San José, CA",    venue: "" },
    ],
  },
];

const profileCards = [
  { artist: "Peso Pluma",    subtitle: "Éxodo Tour 2024",    gross: "$87.4M",  tickets: "758K", shows: 288, image: CONCERT2, slug: "peso-pluma" },
  { artist: "Luis Miguel",   subtitle: "Tour 2023–2024",     gross: "$317.2M", tickets: "2.2M", shows: 173, image: CONCERT3, slug: "luis-miguel" },
  { artist: "Junior H",      subtitle: "Sad Boyz",           gross: "$90.4M",  tickets: "758K", shows: 69,  image: CONCERT1, slug: "junior-h" },
  { artist: "Grupo Firme",   subtitle: "Tour 2022–2023",     gross: "$81.6M",  tickets: "687K", shows: 72,  image: CONCERT4, slug: "grupo-firme" },
];

const insights = [
  { tag: "Análisis",    title: "El Crecimiento Global de la Música Mexicana",  date: "10 Mayo, 2024",  image: INSIGHT1 },
  { tag: "Data Story",  title: "Tumbado en USA: Números que Impactan",          date: "28 Abril, 2024", image: INSIGHT2 },
  { tag: "Artículo",   title: "De la Calle a los Escenarios Más Grandes",      date: "15 Abril, 2024", image: INSIGHT3 },
  { tag: "Mercados",   title: "México en los Escenarios del Mundo",             date: "03 Abril, 2024", image: INSIGHT4 },
];

export default function TouringHub() {
  const [activeTab, setActiveTab] = useState<string | null>(null);

  return (
    <div style={{ background: "#080808", minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: "#9ca3af" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;900&display=swap');
        .th-anton { font-family: 'Anton', sans-serif !important; }
        button { cursor: pointer; }
        a { text-decoration: none; }
      ` }} />

      <SiteNav />

      {/* ── HERO ── */}
      <section style={{ position: "relative", height: 520, overflow: "hidden" }}>
        <img src={HERO_BG} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(8,8,8,0.95) 40%, rgba(8,8,8,0.55) 65%, rgba(8,8,8,0.25) 100%)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(8,8,8,1) 0%, transparent 40%)" }} />

        <div style={{ position: "absolute", right: "12%", top: 0, height: "100%", width: 360 }}>
          <img src={ARTIST_BACK} alt="" style={{ height: "100%", width: "100%", objectFit: "cover", objectPosition: "center top", maskImage: "linear-gradient(to left, rgba(0,0,0,0.7) 30%, transparent 100%)", WebkitMaskImage: "linear-gradient(to left, rgba(0,0,0,0.7) 30%, transparent 100%)" }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 60%, rgba(57,255,20,0.1) 0%, transparent 65%)" }} />
        </div>

        <div style={{ position: "relative", zIndex: 10, padding: "52px 40px 40px", maxWidth: 520, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ color: "#39FF14", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3em", marginBottom: 16 }}>Touring</div>
            <motion.h1
              className="th-anton"
              initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
              style={{ color: "#fff", fontSize: 76, lineHeight: 0.9, textTransform: "uppercase" }}>
              La Música<br />Mexicana<br />en Vivo
            </motion.h1>
          </div>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.6 }}>
            <Link href="/touring/peso-pluma">
              <button style={{ background: "transparent", border: "1px solid #fff", color: "#fff", padding: "10px 20px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", display: "flex", alignItems: "center", gap: 8 }}>
                Explorar Perfiles <span style={{ fontSize: 14 }}>→</span>
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── UPCOMING TOURS ── */}
      <section style={{ padding: "40px 32px", borderBottom: "1px solid #111" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 className="th-anton" style={{ color: "#fff", fontSize: 28, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Upcoming <span style={{ color: "#39FF14" }}>Tours</span>
          </h2>
          <button style={{ background: "none", border: "none", color: "#39FF14", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", display: "flex", alignItems: "center", gap: 4 }}>
            Ver Todos los Tours →
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 12, border: "1px solid #1a1a1a", padding: 16, background: "#0d0d0d" }}>
          {upcomingTours.map((tour, idx) => (
            <motion.div
              key={tour.id}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.08 }}
              style={{ position: "relative", overflow: "hidden", cursor: "pointer", border: "1px solid #1f1f1f", background: "#0a0a0a", minHeight: tour.featured ? 320 : 280 }}
              whileHover={{ borderColor: "#39FF14" }}
              onClick={() => setActiveTab(activeTab === tour.id ? null : tour.id)}>
              <div style={{ position: "relative", height: tour.featured ? 160 : 130, overflow: "hidden" }}>
                <img src={tour.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", filter: "brightness(0.7)" }} />
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 30%, rgba(10,10,10,1) 100%)" }} />
                {tour.featured && (
                  <div style={{ position: "absolute", top: 10, left: 10, background: "#39FF14", color: "#000", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em", padding: "3px 8px" }}>
                    Destacado
                  </div>
                )}
              </div>
              <div style={{ padding: "14px 14px 12px" }}>
                <div className="th-anton" style={{ color: "#fff", fontSize: tour.featured ? 30 : 20, lineHeight: 1, textTransform: "uppercase" }}>
                  {tour.artist}
                </div>
                {tour.featured && (
                  <div style={{ color: "#39FF14", fontStyle: "italic", fontSize: 18, fontWeight: 700, lineHeight: 1.2, marginTop: 2 }}>{tour.tour}</div>
                )}
                <div style={{ color: "#555", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.15em", marginTop: 4 }}>
                  {tour.featured ? tour.year : tour.tour + (tour.year ? " " + tour.year : "")}
                </div>
                <div style={{ marginTop: 14, borderTop: "1px solid #1a1a1a", paddingTop: 10 }}>
                  <div style={{ color: "#39FF14", fontSize: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: 8 }}>Próximas Fechas</div>
                  {tour.dates.map((d, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6, gap: 8 }}>
                      <div style={{ display: "flex", gap: 8, flex: 1, minWidth: 0 }}>
                        <span style={{ color: "#666", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>{d.date}</span>
                        <span style={{ color: "#aaa", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {d.city}{d.venue ? `, ${d.venue}` : ""}
                        </span>
                      </div>
                      {tour.featured && (
                        <button style={{ background: "none", border: "none", color: "#39FF14", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", flexShrink: 0, padding: 0 }}>
                          Comprar
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button style={{ marginTop: 10, background: "none", border: "none", color: "#fff", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", display: "flex", alignItems: "center", gap: 4, padding: 0 }}>
                  {tour.featured ? "Ver Todas las Fechas" : "Ver Fechas"} →
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FEATURED TOURING PROFILES ── */}
      <section style={{ padding: "40px 32px", borderBottom: "1px solid #111" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h2 className="th-anton" style={{ fontSize: 28, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            <span style={{ color: "#fff" }}>Featured</span> <span style={{ color: "#39FF14" }}>Touring Profiles</span>
          </h2>
          <button style={{ background: "none", border: "none", color: "#39FF14", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>
            Ver Todos los Perfiles →
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {profileCards.map((p, i) => (
            <motion.div key={p.artist}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              style={{ border: "1px solid #1a1a1a", overflow: "hidden", cursor: "pointer", background: "#0a0a0a", position: "relative" }}
              whileHover={{ borderColor: "#39FF14" }}>
              <div style={{ position: "relative", height: 160, overflow: "hidden" }}>
                <img src={p.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", filter: "brightness(0.6) grayscale(0.2)" }} />
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
          <button style={{ background: "none", border: "none", color: "#39FF14", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>
            Ver Todos los Artículos →
          </button>
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

      {/* ── FOOTER ── */}
      <footer style={{ padding: "20px 32px", borderTop: "1px solid #111", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: "#444", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>© 2024 Mexico Charts</div>
        <div style={{ color: "#39FF14", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.2em" }}>El Movimiento No Para</div>
        <div style={{ color: "#444", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.1em" }}>México en la Música. El Mundo en la Lista</div>
      </footer>
    </div>
  );
}
