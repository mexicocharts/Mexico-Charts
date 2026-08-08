import { useMemo } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useCertifications, artistMatches, type CertRow } from "@/hooks/useCertifications";
import { formatCertificationLevels } from "@/lib/certificationLabels";

const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const G = "#39FF14";

const CERT_IMAGES: Record<string, string> = {
  DIAMANTE: "cert-diamond.png",
  PLATINO:  "cert-platinum.png",
  ORO:      "cert-gold.png",
};

function certKey(cert: string): "DIAMANTE" | "PLATINO" | "ORO" {
  const u = cert.toUpperCase();
  if (u.includes("DIAMANTE")) return "DIAMANTE";
  if (u.includes("PLATINO"))  return "PLATINO";
  return "ORO";
}

function CertImage({ cert, size = 28 }: { cert: string; size?: number }) {
  const key = certKey(cert);
  const base = import.meta.env.BASE_URL;
  return (
    <img
      src={`${base}${CERT_IMAGES[key]}`}
      alt={key}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      style={{ objectFit: "contain", display: "block", flexShrink: 0 }}
    />
  );
}

function CertBadge({ cert }: { cert: string }) {
  const key = certKey(cert);
  const base = import.meta.env.BASE_URL;
  const label = key === "DIAMANTE" ? "Diamante" : key === "PLATINO" ? "Platino" : "Oro";

  return (
    <img
      src={`${base}${CERT_IMAGES[key]}`}
      alt={label}
      title={label}
      width={44}
      height={44}
      loading="lazy"
      decoding="async"
      style={{ objectFit: "contain", display: "block" }}
    />
  );
}

function fmtDate(iso: string) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  const mo = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(d)} ${mo[parseInt(m) - 1]} ${y}`;
}

function StatCard({ label, value, certKey: ck }: { label: string; value: string | number; certKey?: "DIAMANTE" | "PLATINO" | "ORO" }) {
  const base = import.meta.env.BASE_URL;
  return (
    <div
      className="flex min-w-0 flex-col gap-0.5 rounded-xl px-3 py-2.5"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <div className="mb-0.5 flex min-w-0 items-center gap-1">
        {ck && (
          <img
            src={`${base}${CERT_IMAGES[ck]}`}
            alt={ck}
            width={12}
            height={12}
            loading="lazy"
            decoding="async"
            style={{ objectFit: "contain", display: "block" }}
          />
        )}
        <div className="min-w-0 truncate text-[9px] font-bold uppercase tracking-[0.16em] text-zinc-600 sm:tracking-[0.2em]">{label}</div>
      </div>
      <div className="break-words text-sm font-black leading-none" style={{ color: ck ? G : "rgba(255,255,255,0.88)" }}>
        {value}
      </div>
    </div>
  );
}

type Props = { artistName: string; accent?: string };

export default function ArtistCertifications({ artistName }: Props) {
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
  const albums  = matched.filter(r => r.formato.toLowerCase().startsWith("álb") || r.formato.toLowerCase().startsWith("alb")).length;
  const singles = matched.filter(r => r.formato.toLowerCase() === "single").length;

  const highestKey: "DIAMANTE" | "PLATINO" | "ORO" =
    totalDiamante > 0 ? "DIAMANTE" : totalPlatino > 0 ? "PLATINO" : "ORO";
  const highestCount = totalDiamante > 0 ? totalDiamante : totalPlatino > 0 ? totalPlatino : totalOro;

  const latestDate = matched[0]?.fechaISO ?? "";
  const ctaHref = `/industry/certifications?artist=${encodeURIComponent(artistName)}`;

  const stats = [
    { label: "Registros", value: matched.length },
    ...(totalDiamante > 0 ? [{ label: "Niveles Diamante", value: totalDiamante, certKey: "DIAMANTE" as const }] : []),
    ...(totalPlatino  > 0 ? [{ label: "Niveles Platino",  value: totalPlatino,  certKey: "PLATINO"  as const }] : []),
    ...(totalOro      > 0 ? [{ label: "Niveles Oro",      value: totalOro,      certKey: "ORO"      as const }] : []),
    ...(albums  > 0 ? [{ label: "Álbumes", value: albums  }] : []),
    ...(singles > 0 ? [{ label: "Singles", value: singles }] : []),
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
          border: `1px solid ${G}18`,
          boxShadow: `0 8px 48px rgba(0,0,0,0.65), 0 0 0 1px ${G}08, inset 0 1px 0 rgba(255,255,255,0.04)`,
        }}
      >
        {/* Green top stripe */}
        <div className="absolute top-0 left-0 right-0 h-[2px] z-10" style={{ background: `linear-gradient(to right, ${G}, rgba(57,255,20,0.1))` }} />

        <div className="absolute inset-0 opacity-[0.018] pointer-events-none rounded-2xl" style={{ backgroundImage: NOISE, backgroundSize: "96px" }} />

        {/* ── Header ── */}
        <div className="relative z-10 flex flex-col gap-3 px-4 pb-4 pt-5 sm:flex-row sm:items-center sm:px-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <CertImage cert={highestKey} size={22} />
          <div className="min-w-0">
            <h2 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-300 sm:text-xs sm:tracking-[0.24em]">Certificaciones en México</h2>
            <p className="mt-0.5 text-[9px] font-bold uppercase leading-relaxed tracking-[0.14em] text-zinc-600 sm:tracking-[0.18em]">
              Certificaciones otorgadas en México atribuidas a AMPROFON
            </p>
          </div>
          <div className="w-fit rounded-full border border-white/[0.06] bg-white/[0.025] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-700 sm:ml-auto sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">Fuente: AMPROFON</div>
        </div>

        {/* ── Best cert + stats ── */}
        <div className="relative z-10 flex flex-col items-stretch gap-4 px-4 py-5 sm:flex-row sm:items-start sm:px-6" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          {/* Highest cert badge — image + count */}
          <div
            className="flex h-[76px] w-full flex-row items-center justify-center gap-3 rounded-xl text-center sm:h-[80px] sm:w-[80px] sm:flex-col sm:gap-1"
            style={{ background: `${G}08`, border: `1px solid ${G}22` }}
          >
            <CertImage cert={highestKey} size={38} />
            <span className="text-lg font-black leading-none" style={{ color: G }}>{highestCount}</span>
          </div>

          {/* Stats grid */}
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {stats.map(s => (
              <StatCard key={s.label} label={s.label} value={s.value} certKey={(s as { certKey?: "DIAMANTE" | "PLATINO" | "ORO" }).certKey} />
            ))}
          </div>
        </div>

        {/* ── Table — desktop ── */}
        <div className="relative z-10 hidden md:block">
          <table className="w-full text-left">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {["Título", "Formato", "Certificación", "Nivel", "Fecha", "Disquera"].map(h => (
                  <th key={h} className={`px-5 py-2 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-700${h === "Certificación" ? " text-center" : ""}`}>{h}</th>
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
                  <td className="px-5 py-2.5 text-center"><div className="flex justify-center"><CertBadge cert={row.certificacion} /></div></td>
                  <td className="px-5 py-2.5 text-[11px] font-black whitespace-nowrap" style={{ color: G }}>
                    {formatCertificationLevels(row.certificacion, row.nivel)}
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
        <div className="relative z-10 flex flex-col md:hidden">
          {matched.slice(0, 10).map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3"
              style={{ borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : undefined }}
            >
              <div className="min-w-0">
                <div className="text-sm font-medium text-zinc-300 truncate">{row.titulo}</div>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-[9px] text-zinc-600 uppercase tracking-wider font-bold">{row.formato}</span>
                  <span className="text-[9px] text-zinc-600">{fmtDate(row.fechaISO)}</span>
                </div>
                {row.nivel && (
                  <div className="mt-1 truncate text-[10px] font-black uppercase tracking-[0.12em]" style={{ color: G }}>
                    {formatCertificationLevels(row.certificacion, row.nivel)}
                  </div>
                )}
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
              style={{ color: G }}
            >
              Ver todas las certificaciones <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
        </div>
      </div>
    </motion.section>
  );
}
