import { useMemo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Trophy, ArrowRight } from "lucide-react";
import { useCertifications, artistMatches, type CertRow } from "@/hooks/useCertifications";

const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const DIAMOND_COLOR = "#60a5fa";
const PLATINO_COLOR = "#94a3b8";
const ORO_COLOR     = "#b45309";

function levelColor(cert: string) {
  const u = cert.toUpperCase();
  if (u.includes("DIAMANTE")) return DIAMOND_COLOR;
  if (u.includes("PLATINO"))  return PLATINO_COLOR;
  return ORO_COLOR;
}

function CertBadge({ cert }: { cert: string }) {
  const u = cert.toUpperCase();
  const isDia = u.includes("DIAMANTE");
  const isPla = u.includes("PLATINO");
  const mixed = cert.includes("&");
  const color = isDia ? DIAMOND_COLOR : isPla ? PLATINO_COLOR : ORO_COLOR;
  const label = isDia ? "Diamante" : isPla ? "Platino" : "Oro";

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.14em] whitespace-nowrap"
      style={{ background: `${color}15`, color, border: `1px solid ${color}28` }}
    >
      {label}{mixed ? " +" : ""}
    </span>
  );
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  const mo = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(d)} ${mo[parseInt(m) - 1]} ${y}`;
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div
      className="rounded-xl px-3 py-2.5 flex flex-col gap-0.5"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="text-[9px] uppercase tracking-[0.2em] font-bold text-zinc-600">{label}</div>
      <div className="text-sm font-black leading-none" style={{ color: color ?? "rgba(255,255,255,0.88)" }}>
        {value}
      </div>
    </div>
  );
}

type Props = { artistName: string; accent?: string };

export default function ArtistCertifications({ artistName, accent = "#39FF14" }: Props) {
  const { rows, loading } = useCertifications();

  const matched: CertRow[] = useMemo(() => {
    if (!rows.length || !artistName) return [];
    return rows
      .filter(r => artistMatches(r.artista, artistName))
      .sort((a, b) => b.fechaISO.localeCompare(a.fechaISO));
  }, [rows, artistName]);

  if (loading || matched.length === 0) return null;

  const totalDiamante = matched.reduce((s, r) => s + r.diamante, 0);
  const totalPlatino  = matched.reduce((s, r) => s + r.platino, 0);
  const totalOro      = matched.reduce((s, r) => s + r.oro, 0);
  const albums        = matched.filter(r => r.formato.toLowerCase().startsWith("álb") || r.formato.toLowerCase().startsWith("alb")).length;
  const singles       = matched.filter(r => r.formato.toLowerCase() === "single").length;

  const highestLevel = totalDiamante > 0 ? "DIAMANTE" : totalPlatino > 0 ? "PLATINO" : "ORO";
  const highestColor = totalDiamante > 0 ? DIAMOND_COLOR : totalPlatino > 0 ? PLATINO_COLOR : ORO_COLOR;
  const highestCount = totalDiamante > 0 ? totalDiamante : totalPlatino > 0 ? totalPlatino : totalOro;

  const latestDate = matched[0]?.fechaISO ?? "";
  const ctaHref = `/industry/certifications?artist=${encodeURIComponent(artistName)}`;

  const stats = [
    { label: "Total", value: matched.length },
    ...(totalDiamante > 0 ? [{ label: "Diamante", value: totalDiamante, color: DIAMOND_COLOR }] : []),
    ...(totalPlatino  > 0 ? [{ label: "Platino",  value: totalPlatino,  color: PLATINO_COLOR }] : []),
    ...(totalOro      > 0 ? [{ label: "Oro",       value: totalOro,      color: ORO_COLOR     }] : []),
    ...(albums  > 0 ? [{ label: "Álbumes",  value: albums  }] : []),
    ...(singles > 0 ? [{ label: "Singles",  value: singles }] : []),
    { label: "Última cert.", value: fmtDate(latestDate) },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      data-testid="section-certifications"
    >
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: "linear-gradient(160deg,#0d0d0d 0%,#090909 100%)",
          border: "1px solid rgba(255,255,255,0.07)",
          boxShadow: "0 8px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}
      >
        <div className="absolute inset-0 opacity-[0.018] pointer-events-none rounded-2xl" style={{ backgroundImage: NOISE, backgroundSize: "96px" }} />

        {/* ── Header ── */}
        <div className="relative z-10 flex items-center gap-3 px-6 pt-5 pb-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <Trophy className="w-4 h-4 flex-shrink-0" style={{ color: highestColor }} />
          <div>
            <h2 className="text-xs font-black uppercase tracking-[0.24em] text-zinc-300">Certificaciones en México</h2>
            <p className="text-[9px] text-zinc-600 uppercase tracking-[0.18em] font-bold mt-0.5">
              Certificaciones otorgadas en México atribuidas a AMPROFON
            </p>
          </div>
          <div className="ml-auto text-[9px] font-black uppercase tracking-[0.16em] text-zinc-700">Fuente: AMPROFON</div>
        </div>

        {/* ── Best cert + stats ── */}
        <div className="relative z-10 flex flex-wrap items-start gap-4 px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          {/* Highest cert badge */}
          <div
            className="flex flex-col items-center justify-center w-[72px] h-[72px] rounded-xl flex-shrink-0 text-center"
            style={{ background: `${highestColor}10`, border: `1px solid ${highestColor}28` }}
          >
            <span className="text-[8px] font-black uppercase tracking-[0.1em] leading-none" style={{ color: highestColor }}>
              {highestLevel}
            </span>
            <span className="text-2xl font-black leading-none text-white mt-1">{highestCount}</span>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 flex-1 min-w-0">
            {stats.map(s => (
              <StatCard key={s.label} label={s.label} value={s.value} color={(s as { color?: string }).color} />
            ))}
          </div>
        </div>

        {/* ── Table — desktop ── */}
        <div className="relative z-10 hidden md:block">
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {["Título", "Formato", "Certificación", "Nivel", "Fecha", "Disquera"].map(h => (
                  <th key={h} className="px-5 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-700">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matched.slice(0, 15).map((row, i) => (
                <tr
                  key={i}
                  className="hover:bg-white/[0.018] transition-colors"
                  style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.035)" : undefined }}
                >
                  <td className="px-5 py-2.5 text-sm font-medium text-zinc-300 max-w-[200px]">
                    <span className="block truncate">{row.titulo}</span>
                  </td>
                  <td className="px-5 py-2.5 text-[10px] text-zinc-600 uppercase tracking-wider font-bold whitespace-nowrap">{row.formato}</td>
                  <td className="px-5 py-2.5"><CertBadge cert={row.certificacion} /></td>
                  <td className="px-5 py-2.5 text-[11px] font-black whitespace-nowrap" style={{ color: levelColor(row.certificacion) }}>
                    {row.nivel}
                  </td>
                  <td className="px-5 py-2.5 text-[10px] text-zinc-600 whitespace-nowrap">{fmtDate(row.fechaISO)}</td>
                  <td className="px-5 py-2.5 text-[10px] text-zinc-600 max-w-[130px]">
                    <span className="block truncate">{row.disquera || "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {matched.length > 15 && (
            <p className="px-5 py-2 text-[9px] text-zinc-700 font-bold uppercase tracking-[0.18em]">
              +{matched.length - 15} más · Ver todas abajo
            </p>
          )}
        </div>

        {/* ── Cards — mobile ── */}
        <div className="relative z-10 md:hidden flex flex-col">
          {matched.slice(0, 10).map((row, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-zinc-300 truncate">{row.titulo}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-bold">{row.formato}</span>
                  <span className="text-zinc-800">·</span>
                  <span className="text-[9px] text-zinc-600">{fmtDate(row.fechaISO)}</span>
                </div>
              </div>
              <CertBadge cert={row.certificacion} />
            </div>
          ))}
          {matched.length > 10 && (
            <p className="px-4 py-2 text-[9px] text-zinc-700 font-bold uppercase tracking-[0.18em]">
              +{matched.length - 10} más
            </p>
          )}
        </div>

        {/* ── CTA ── */}
        <div
          className="relative z-10 flex items-center justify-between gap-4 px-6 py-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <span className="text-[9px] text-zinc-700 font-bold uppercase tracking-[0.14em]">
            Mexico Charts no emite certificaciones oficiales.
          </span>
          <Link href={ctaHref}>
            <span
              className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.18em] cursor-pointer whitespace-nowrap transition-opacity hover:opacity-70"
              style={{ color: accent }}
            >
              Ver todas las certificaciones <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
        </div>
      </div>
    </motion.section>
  );
}
