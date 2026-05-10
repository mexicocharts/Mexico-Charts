const GOLD = "#F5C700";
const PINK = "#E040FB";
const BG = "#0e0e0e";
const CARD = "#161616";
const BORDER = "rgba(255,255,255,0.08)";

const artists = [
  { rank: 1, name: "Peso Pluma",      genre: "Corridos Tumbados", listeners: "47.1M", growth: "+12%", color: GOLD },
  { rank: 2, name: "Fuerza Regida",   genre: "Regional Mexicano", listeners: "18.2M", growth: "+31%", color: GOLD },
  { rank: 3, name: "Natanael Cano",   genre: "Corridos Tumbados", listeners: "15.4M", growth: "+8%",  color: GOLD },
  { rank: 4, name: "Junior H",        genre: "Regional Mexicano", listeners: "12.8M", growth: "+22%", color: GOLD },
  { rank: 5, name: "Carin León",      genre: "Norteño / Banda",   listeners: "11.3M", growth: "+19%", color: GOLD },
  { rank: 6, name: "Eslabón Armado",  genre: "Regional Mexicano", listeners: "9.7M",  growth: "+14%", color: GOLD },
  { rank: 7, name: "Banda MS",        genre: "Banda",             listeners: "8.4M",  growth: "+5%",  color: GOLD },
  { rank: 8, name: "Christian Nodal", genre: "Regional Mexicano", listeners: "7.9M",  growth: "+11%", color: GOLD },
];

const genres = [
  { label: "Corridos Tumbados", artists: 38, pct: 74, color: GOLD },
  { label: "Regional Mexicano",  artists: 52, pct: 91, color: PINK },
  { label: "Banda",              artists: 24, pct: 58, color: "#4FC3F7" },
  { label: "Norteño",            artists: 19, pct: 47, color: "#AED581" },
];

export default function LuminateMexicoCharts() {
  return (
    <div style={{ background: BG, minHeight: "100vh", fontFamily: "'Arial Black', 'Arial', sans-serif", color: "#fff", overflowX: "hidden" }}>

      {/* ── Top announcement bar ── */}
      <div style={{ background: GOLD, padding: "8px 32px", display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <span style={{ color: "#000", fontWeight: 900, fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase" }}>
          DATOS ACTUALIZADOS · SEMANA 19 · 2026
        </span>
        <span style={{ color: "#000", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>
          145 ARTISTAS · 6 GÉNEROS · STREAMING + VENTAS
        </span>
      </div>

      {/* ── Nav ── */}
      <nav style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 40px", borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, background: GOLD, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#000", fontWeight: 900, fontSize: 13, letterSpacing: "-0.05em" }}>MC</span>
          </div>
          <span style={{ fontWeight: 900, fontSize: 14, letterSpacing: "0.22em", textTransform: "uppercase", color: "#fff" }}>Mexico Charts</span>
        </div>
        <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
          {["Charts", "Artistas", "Géneros", "Plataformas", "Tendencias"].map(item => (
            <span key={item} style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", cursor: "pointer" }}>{item}</span>
          ))}
        </div>
        <button style={{ border: `1.5px solid ${GOLD}`, background: "transparent", color: GOLD, padding: "8px 22px", fontSize: 10, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", cursor: "pointer" }}>
          Ver Todo
        </button>
      </nav>

      {/* ── Hero ── */}
      <section style={{ padding: "64px 40px 48px", maxWidth: 1200, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 3, height: 14, background: GOLD }} />
            <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.28em", textTransform: "uppercase", color: GOLD }}>Ranking Semanal · México</span>
          </div>
          <div style={{ borderLeft: `4px solid ${GOLD}`, paddingLeft: 24, marginBottom: 28 }}>
            <h1 style={{ fontSize: 52, fontWeight: 900, lineHeight: 1.0, letterSpacing: "-0.02em", textTransform: "uppercase", margin: 0 }}>
              La música<br />
              <span style={{ color: GOLD }}>mexicana</span><br />
              en datos
            </h1>
          </div>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.7, marginBottom: 32, maxWidth: 380, fontFamily: "Arial, sans-serif", fontWeight: 400 }}>
            El ranking más completo de la industria musical mexicana. Datos en tiempo real de Spotify, YouTube, Apple Music y más.
          </p>
          <div style={{ display: "flex", gap: 14 }}>
            <button style={{ border: `2px solid ${GOLD}`, background: "transparent", color: GOLD, padding: "12px 28px", fontSize: 11, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", cursor: "pointer" }}>
              Ver Charts
            </button>
            <button style={{ border: `2px solid rgba(255,255,255,0.2)`, background: "transparent", color: "rgba(255,255,255,0.6)", padding: "12px 28px", fontSize: 11, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", cursor: "pointer" }}>
              145 Artistas
            </button>
          </div>
        </div>

        {/* Hero stats block */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2 }}>
          {[
            { label: "Streams Esta Semana", value: "4.2B", accent: GOLD },
            { label: "Artistas en Chart", value: "145", accent: PINK },
            { label: "Países Alcanzados", value: "60+", accent: "#4FC3F7" },
            { label: "Géneros Activos", value: "6", accent: "#AED581" },
          ].map(s => (
            <div key={s.label} style={{ background: CARD, border: `1px solid ${BORDER}`, padding: "28px 24px" }}>
              <div style={{ fontSize: 36, fontWeight: 900, color: s.accent, lineHeight: 1, marginBottom: 6, letterSpacing: "-0.02em" }}>{s.value}</div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)" }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: `linear-gradient(to right, transparent, ${GOLD}40, transparent)`, margin: "0 40px" }} />

      {/* ── Top Artists Chart ── */}
      <section style={{ padding: "52px 40px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 3, height: 20, background: GOLD }} />
            <h2 style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.28em", textTransform: "uppercase", margin: 0, color: "rgba(255,255,255,0.7)" }}>Top Artistas · Oyentes Mensuales</h2>
          </div>
          <button style={{ border: `1px solid rgba(255,255,255,0.15)`, background: "transparent", color: "rgba(255,255,255,0.45)", padding: "6px 18px", fontSize: 9, fontWeight: 900, letterSpacing: "0.2em", textTransform: "uppercase", cursor: "pointer" }}>
            Ver Todos →
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {artists.map((a, i) => (
            <div key={a.rank} style={{ display: "flex", alignItems: "center", background: i === 0 ? `${GOLD}08` : CARD, border: `1px solid ${i === 0 ? `${GOLD}30` : BORDER}`, padding: "16px 24px", gap: 20, cursor: "pointer", transition: "all 0.15s" }}>
              {/* Rank */}
              <div style={{ width: 36, fontSize: i < 3 ? 18 : 14, fontWeight: 900, color: i === 0 ? GOLD : i === 1 ? PINK : "rgba(255,255,255,0.35)", letterSpacing: "-0.03em", textAlign: "right", flexShrink: 0 }}>
                {String(a.rank).padStart(2, "0")}
              </div>
              {/* Avatar placeholder with duotone feel */}
              <div style={{ width: 40, height: 40, flexShrink: 0, background: `linear-gradient(135deg, ${GOLD}22, ${PINK}22)`, border: `1px solid ${GOLD}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 900, color: GOLD }}>{a.name[0]}</span>
              </div>
              {/* Name & genre */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 900, letterSpacing: "0.02em", textTransform: "uppercase", color: i === 0 ? "#fff" : "rgba(255,255,255,0.85)" }}>{a.name}</div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)", marginTop: 2 }}>{a.genre}</div>
              </div>
              {/* Bar */}
              <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.07)", position: "relative", maxWidth: 200 }}>
                <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${(parseFloat(a.listeners) / 50) * 100}%`, background: i === 0 ? GOLD : i === 1 ? PINK : "rgba(255,255,255,0.3)" }} />
              </div>
              {/* Listeners */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 900, color: i === 0 ? GOLD : "#fff", letterSpacing: "-0.02em" }}>{a.listeners}</div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", color: "rgba(255,255,255,0.35)", textTransform: "uppercase" }}>oyentes</div>
              </div>
              {/* Growth */}
              <div style={{ width: 52, textAlign: "right", flexShrink: 0 }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: GOLD, letterSpacing: "0.06em" }}>{a.growth}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Genre breakdown ── */}
      <section style={{ padding: "0 40px 64px", maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
          <div style={{ width: 3, height: 20, background: PINK }} />
          <h2 style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.28em", textTransform: "uppercase", margin: 0, color: "rgba(255,255,255,0.7)" }}>Géneros · Distribución</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2 }}>
          {genres.map(g => (
            <div key={g.label} style={{ background: CARD, border: `1px solid ${BORDER}`, padding: "24px 20px" }}>
              <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.4)", marginBottom: 12 }}>{g.label}</div>
              <div style={{ fontSize: 30, fontWeight: 900, color: g.color, lineHeight: 1, marginBottom: 4 }}>{g.artists}</div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)", marginBottom: 16 }}>artistas</div>
              <div style={{ height: 2, background: "rgba(255,255,255,0.07)" }}>
                <div style={{ height: "100%", width: `${g.pct}%`, background: g.color }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer bar ── */}
      <footer style={{ borderTop: `1px solid ${BORDER}`, padding: "24px 40px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, fontWeight: 900, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>Mexico Charts · Datos Semana 19 · 2026</span>
        <div style={{ display: "flex", gap: 24 }}>
          {["Spotify", "YouTube", "Apple Music", "Deezer"].map(p => (
            <span key={p} style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)" }}>{p}</span>
          ))}
        </div>
      </footer>
    </div>
  );
}
