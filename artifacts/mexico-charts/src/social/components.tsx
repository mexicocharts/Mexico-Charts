/* ─────────────────────────────────────────────────────────────────
   MEXICO CHARTS — Social Template Design System v2
   Shared components for all Instagram/social post templates.
   Canvas size: 1080 × 1350 px  (4:5 Instagram portrait)
───────────────────────────────────────────────────────────────── */
import React from "react";

export const W = 1080;
export const H = 1350;
export const ACCENT = "#39FF14";
export const BG = "#050505";

/* Fine cinematic grain — SVG fractal noise */
export const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export const LOGO_URL = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;

/* ── Base canvas ───────────────────────────────────────────────── */
export function TemplateCanvas({
  children,
  style,
  exportLoading = false,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  exportLoading?: boolean;
}) {
  return (
    <div
      data-export-loading={exportLoading ? "true" : undefined}
      style={{
        width: W,
        height: H,
        background:
          "linear-gradient(180deg, #050505 0%, #090909 44%, #050505 100%)",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        WebkitFontSmoothing: "antialiased",
        display: "flex",
        flexDirection: "column",
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            `linear-gradient(135deg, ${ACCENT}09 0%, transparent 28%, rgba(255,255,255,0.04) 58%, transparent 82%), ` +
            "linear-gradient(90deg, rgba(255,255,255,0.035) 0 1px, transparent 1px)",
          backgroundSize: "auto, 44px 44px",
          pointerEvents: "none",
        }}
      />
      {/* Cinematic grain texture — stronger for premium feel */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: NOISE,
          backgroundSize: "192px",
          opacity: 0.065,
          pointerEvents: "none",
          zIndex: 99,
          mixBlendMode: "overlay",
        }}
      />
      {children}
    </div>
  );
}

/* ── Atmospheric fog layers (layered smoke/haze) ───────────────── */
export function AtmosphericFog({
  top = true,
  bottom = false,
  left = false,
  right = false,
  intensity = 1,
}: {
  top?: boolean;
  bottom?: boolean;
  left?: boolean;
  right?: boolean;
  intensity?: number;
}) {
  const a = (v: number) => Math.round(v * intensity * 255).toString(16).padStart(2, "0");
  return (
    <>
      {top && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 700,
          background: `radial-gradient(ellipse 80% 70% at 50% -5%, ${ACCENT}${a(0.07)} 0%, transparent 65%)`,
          pointerEvents: "none",
        }} />
      )}
      {bottom && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 600,
          background: `radial-gradient(ellipse 70% 60% at 50% 110%, ${ACCENT}${a(0.06)} 0%, transparent 60%)`,
          filter: "blur(30px)",
          pointerEvents: "none",
        }} />
      )}
      {left && (
        <div style={{
          position: "absolute", top: "20%", left: -100,
          width: 500, height: 500,
          background: `radial-gradient(circle, ${ACCENT}${a(0.05)} 0%, transparent 70%)`,
          filter: "blur(60px)",
          pointerEvents: "none",
        }} />
      )}
      {right && (
        <div style={{
          position: "absolute", top: "25%", right: -100,
          width: 500, height: 500,
          background: `radial-gradient(circle, ${ACCENT}${a(0.05)} 0%, transparent 70%)`,
          filter: "blur(60px)",
          pointerEvents: "none",
        }} />
      )}
    </>
  );
}

/* ── Cinematic photo background (for artist photo variants) ────── */
export function CinematicPhoto({
  src,
  position = "center top",
  darken = 0.72,
  emeraldOverlay = 0.04,
  blur = false,
}: {
  src: string;
  position?: string;
  darken?: number;
  emeraldOverlay?: number;
  blur?: boolean;
}) {
  return (
    <>
      {/* Blurred background fill */}
      {blur && (
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${src})`,
          backgroundSize: "cover",
          backgroundPosition: position,
          filter: "blur(40px) saturate(0.5)",
          transform: "scale(1.08)",
          opacity: 0.3,
          pointerEvents: "none",
        }} />
      )}
      {/* Sharp photo layer */}
      <div style={{
        position: "absolute", inset: 0,
        backgroundImage: `url(${src})`,
        backgroundSize: "cover",
        backgroundPosition: position,
        filter: "saturate(0.7) contrast(1.1) brightness(0.55)",
        pointerEvents: "none",
      }} />
      {/* Dark gradient for text readability */}
      <div style={{
        position: "absolute", inset: 0,
        background: `
          linear-gradient(180deg, rgba(5,5,5,${darken * 0.6}) 0%, rgba(5,5,5,${darken * 0.3}) 40%, rgba(5,5,5,${darken * 0.85}) 75%, rgba(5,5,5,0.97) 100%),
          linear-gradient(135deg, rgba(5,5,5,0.4) 0%, transparent 50%)
        `,
        pointerEvents: "none",
      }} />
      {/* Soft emerald color wash */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse 80% 60% at 30% 60%, ${ACCENT}${Math.round(emeraldOverlay * 255).toString(16).padStart(2, "0")} 0%, transparent 65%)`,
        pointerEvents: "none",
      }} />
    </>
  );
}

/* ── Thin accent divider ───────────────────────────────────────── */
export function AccentLine({
  opacity = 0.7,
  color = ACCENT,
}: {
  opacity?: number;
  color?: string;
}) {
  return (
    <div
      style={{
        height: 1.5,
        flexShrink: 0,
        background: `linear-gradient(to right, transparent, ${color}${Math.round(opacity * 255).toString(16).padStart(2, "0")}, transparent)`,
      }}
    />
  );
}

/* ── Logo bar (top of card) ────────────────────────────────────── */
export function LogoBar({
  date,
  source,
  compact = false,
}: {
  date?: string;
  source?: string;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: compact ? "30px 64px 22px" : "42px 64px 32px",
        flexShrink: 0,
        position: "relative",
        zIndex: 2,
      }}
    >
      <img
        src={LOGO_URL}
        alt="Mexico Charts"
        crossOrigin="anonymous"
        style={{ height: compact ? 34 : 44, objectFit: "contain", opacity: 0.98 }}
      />
      {(date || source) && (
        <div
          style={{
            textAlign: "right",
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(255,255,255,0.035)",
            padding: "10px 14px",
            minWidth: 184,
          }}
        >
          {date && (
            <div
              style={{
                fontSize: 15,
                fontWeight: 900,
                color: "rgba(255,255,255,0.58)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
              }}
            >
              {date}
            </div>
          )}
          {source && (
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                color: "rgba(255,255,255,0.28)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginTop: 4,
              }}
            >
              {source}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Eyebrow label ─────────────────────────────────────────────── */
export function SectionLabel({ children, color = ACCENT }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      style={{
        fontSize: 18,
        fontWeight: 900,
        textTransform: "uppercase",
        letterSpacing: "0.32em",
        color,
        position: "relative",
        zIndex: 2,
      }}
    >
      {children}
    </div>
  );
}

/* ── Movement indicator ────────────────────────────────────────── */
export function MovementBadge({
  movement,
  isNew,
  size = "md",
}: {
  movement?: number;
  isNew?: boolean;
  size?: "sm" | "md";
}) {
  const w = 44;
  if (isNew) {
    return (
      <div
        style={{
          width: w,
          flexShrink: 0,
          fontSize: size === "sm" ? 11 : 13,
          fontWeight: 900,
          color: ACCENT,
          background: `${ACCENT}1a`,
          border: `1px solid ${ACCENT}45`,
          borderRadius: 4,
          padding: "3px 5px",
          textAlign: "center",
          letterSpacing: "0.05em",
          boxShadow: `0 0 10px ${ACCENT}20`,
        }}
      >
        NEW
      </div>
    );
  }
  if (movement === undefined) return <div style={{ width: w, flexShrink: 0 }} />;
  if (movement === 0) {
    return (
      <div
        style={{
          width: w,
          flexShrink: 0,
          fontSize: 16,
          color: "rgba(255,255,255,0.12)",
          textAlign: "center",
        }}
      >
        —
      </div>
    );
  }
  const up = movement > 0;
  return (
    <div
      style={{
        width: w,
        flexShrink: 0,
        fontSize: size === "sm" ? 13 : 15,
        fontWeight: 900,
        color: up ? ACCENT : "rgba(255,80,80,0.75)",
        textAlign: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        letterSpacing: "-0.01em",
      }}
    >
      <span>{up ? "▲" : "▼"}</span>
      <span>{Math.abs(movement)}</span>
    </div>
  );
}

/* ── Chart row ─────────────────────────────────────────────────── */
export interface ChartRowData {
  rank: number;
  title: string;
  subtitle?: string;
  stat?: string;
  statLabel?: string;
  movement?: number;
  isNew?: boolean;
  peak?: number;
  weeks?: number;
  imageUrl?: string | null;
  roundImage?: boolean;
}

export function ChartRow({
  row,
  compact = false,
  accent = ACCENT,
  showMeta = false,
}: {
  row: ChartRowData;
  compact?: boolean;
  accent?: string;
  showMeta?: boolean;
}) {
  const isTop3 = row.rank <= 3;
  const rowH = compact ? 78 : 92;
  const imageSize = compact ? 54 : 64;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: rowH,
        gap: 16,
        background: isTop3
          ? `linear-gradient(90deg, ${accent}18 0%, rgba(255,255,255,0.06) 42%, rgba(255,255,255,0.025) 100%)`
          : "rgba(255,255,255,0.035)",
        border: isTop3 ? `1px solid ${accent}24` : "1px solid rgba(255,255,255,0.07)",
        borderRadius: 14,
        margin: "7px 46px",
        padding: "0 18px",
        position: "relative",
        zIndex: 2,
        boxShadow: isTop3
          ? `0 18px 42px rgba(0,0,0,0.34), inset 0 0 32px ${accent}06`
          : "0 12px 28px rgba(0,0,0,0.22)",
      }}
    >
      {/* Left accent for #1 */}
      {row.rank === 1 && (
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0,
          width: 5,
          borderRadius: "14px 0 0 14px",
          background: `linear-gradient(to bottom, ${accent}30, ${accent}, ${accent}30)`,
          boxShadow: `3px 0 22px ${accent}55`,
        }} />
      )}

      {/* Rank number */}
      <div
        style={{
          width: 58,
          fontSize: isTop3 ? 38 : 26,
          fontWeight: 900,
          color: isTop3 ? accent : "rgba(255,255,255,0.26)",
          flexShrink: 0,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          textShadow: isTop3 ? `0 0 24px ${accent}55` : "none",
        }}
      >
        {String(row.rank).padStart(2, "0")}
      </div>

      <MovementBadge movement={row.movement} isNew={row.isNew} size={compact ? "sm" : "md"} />

      {/* Thumbnail — only rendered when imageUrl is explicitly set */}
      {"imageUrl" in row && (
        <div style={{
          width: imageSize,
          height: imageSize,
          flexShrink: 0,
          borderRadius: row.roundImage ? "50%" : 12,
          overflow: "hidden",
          background: `linear-gradient(135deg, #1e1e1e, #0c0c0c)`,
          border: `1px solid ${isTop3 ? `${accent}45` : "rgba(255,255,255,0.11)"}`,
          boxShadow: isTop3 ? `0 0 28px ${accent}18` : "0 12px 22px rgba(0,0,0,0.28)",
        }}>
          {row.imageUrl ? (
            <img
              src={row.imageUrl}
              alt=""
              crossOrigin="anonymous"
              style={{ width: "100%", height: "100%", objectFit: "cover", filter: "saturate(0.95) contrast(1.08)" }}
            />
          ) : (
            <div style={{
              width: "100%", height: "100%",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: `radial-gradient(circle at 40% 35%, ${accent}15, #0d0d0d)`,
            }}>
              <span style={{ fontSize: compact ? 18 : 22, color: accent, opacity: 0.3 }}>♪</span>
            </div>
          )}
        </div>
      )}

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: compact ? 24 : 28,
            fontWeight: isTop3 ? 900 : 800,
            color: isTop3 ? "#fff" : "rgba(255,255,255,0.86)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            letterSpacing: "-0.01em",
            lineHeight: 1,
          }}
        >
          {row.title}
        </div>
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            marginTop: 5,
          }}
        >
          {row.subtitle && (
            <div
              style={{
                fontSize: compact ? 15 : 17,
                color: "rgba(255,255,255,0.38)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {row.subtitle}
            </div>
          )}
          {showMeta && row.peak && (
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.15)", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
              PICO #{row.peak}
            </div>
          )}
          {showMeta && row.weeks && (
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.15)", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
              {row.weeks} SEM
            </div>
          )}
        </div>
      </div>

      {/* Stat */}
      {row.stat && (
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div
            style={{
              fontSize: compact ? 22 : 26,
              fontWeight: 900,
              color: isTop3 ? accent : "rgba(255,255,255,0.56)",
              letterSpacing: "-0.02em",
              textShadow: isTop3 ? `0 0 24px ${accent}45` : "none",
            }}
          >
            {row.stat}
          </div>
          {row.statLabel && (
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.25)",
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginTop: 2,
              }}
            >
              {row.statLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Platform badge ────────────────────────────────────────────── */
const PLATFORM_COLORS: Record<string, string> = {
  spotify: "#1DB954",
  youtube: "#FF0000",
  apple: "#FF2D55",
  deezer: "#A238FF",
  tiktok: "#ffffff",
};
const PLATFORM_LABELS: Record<string, string> = {
  spotify: "Spotify",
  youtube: "YouTube",
  apple: "Apple Music",
  deezer: "Deezer",
  tiktok: "TikTok",
};

export function PlatformBadge({
  platform,
  active = true,
}: {
  platform: string;
  active?: boolean;
}) {
  const color = PLATFORM_COLORS[platform] ?? "#fff";
  return (
    <div
      style={{
        padding: "10px 20px",
        borderRadius: 8,
        fontSize: 15,
        fontWeight: 900,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        border: `1px solid ${active ? color + "70" : "rgba(255,255,255,0.08)"}`,
        color: active ? color : "rgba(255,255,255,0.16)",
        background: active
          ? `linear-gradient(180deg, ${color}18, ${color}08)`
          : "rgba(255,255,255,0.025)",
        whiteSpace: "nowrap",
        boxShadow: active ? `0 0 22px ${color}18, inset 0 0 24px ${color}07` : "none",
        position: "relative",
        zIndex: 2,
      }}
    >
      {PLATFORM_LABELS[platform] ?? platform}
    </div>
  );
}

/* ── Album / artist image frame ────────────────────────────────── */
export function AlbumFrame({
  src,
  rank,
  size = 168,
  accent = ACCENT,
  round = false,
}: {
  src?: string;
  rank?: number;
  size?: number;
  accent?: string;
  round?: boolean;
}) {
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: round ? "50%" : 16,
          background: `linear-gradient(135deg, #1e1e1e, #0c0c0c)`,
          border: `1px solid ${rank && rank <= 3 ? `${accent}48` : "rgba(255,255,255,0.1)"}`,
          overflow: "hidden",
          boxShadow: `0 22px 64px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04), 0 0 52px ${accent}${rank && rank <= 3 ? "28" : "14"}`,
        }}
      >
        {src ? (
          <img
            src={src}
            alt=""
            crossOrigin="anonymous"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "saturate(0.96) contrast(1.08) brightness(0.94)",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `radial-gradient(circle at 40% 35%, ${accent}18, #0d0d0d)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: size * 0.35, color: accent, opacity: 0.3 }}>♪</span>
          </div>
        )}
      </div>
      {rank !== undefined && (
        <div
          style={{
            position: "absolute",
            top: -11,
            left: -11,
            width: 44,
            height: 44,
            borderRadius: 12,
            background: accent,
            color: "#000",
            fontSize: 18,
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 24px ${accent}80, 0 4px 12px rgba(0,0,0,0.8)`,
          }}
        >
          {rank}
        </div>
      )}
    </div>
  );
}

/* ── Large stat number — with glow & optional scale watermark ──── */
export function LargeStatNum({
  value,
  label,
  accent = ACCENT,
  size = 110,
  watermark = false,
}: {
  value: string;
  label?: string;
  accent?: string;
  size?: number;
  watermark?: boolean;
}) {
  return (
    <div style={{ position: "relative" }}>
      {/* Ghost scale watermark behind the number */}
      {watermark && (
        <div style={{
          position: "absolute",
          top: "50%", left: -40,
          transform: "translateY(-50%)",
          fontSize: size * 3.2,
          fontWeight: 900,
          color: `${accent}06`,
          letterSpacing: "-0.06em",
          lineHeight: 1,
          pointerEvents: "none",
          userSelect: "none",
          whiteSpace: "nowrap",
        }}>
          {value}
        </div>
      )}
      <div
        style={{
          fontSize: size,
          fontWeight: 900,
          color: accent,
          letterSpacing: "-0.045em",
          lineHeight: 0.88,
          textShadow: `0 0 40px ${accent}60, 0 0 100px ${accent}30, 0 0 200px ${accent}12`,
          position: "relative",
          zIndex: 1,
        }}
      >
        {value}
      </div>
      {label && (
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: "rgba(255,255,255,0.35)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginTop: 18,
            position: "relative",
            zIndex: 1,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

/* ── Stats pill — premium with accent border ───────────────────── */
export function StatPill({
  label,
  value,
  accent = ACCENT,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderLeft: `3px solid ${accent}60`,
        borderRadius: 12,
        padding: "22px 28px",
        flex: 1,
        boxShadow: `inset 0 0 30px ${accent}05`,
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 800,
          color: "rgba(255,255,255,0.24)",
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 40,
          fontWeight: 900,
          color: accent,
          letterSpacing: "-0.03em",
          lineHeight: 1,
          textShadow: `0 0 30px ${accent}45`,
        }}
      >
        {value}
      </div>
    </div>
  );
}

/* ── Source footer line ────────────────────────────────────────── */
export function SourceFooter({
  source,
  platform,
  date,
}: {
  source?: string;
  platform?: string;
  date?: string;
}) {
  const parts = [source, platform, date].filter(Boolean);
  return (
    <div
      style={{
        fontSize: 15,
        color: "rgba(255,255,255,0.16)",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        fontWeight: 600,
        position: "relative",
        zIndex: 2,
      }}
    >
      {parts.join(" · ")}
    </div>
  );
}

/* ── CTA Footer bar (bottom of card) ──────────────────────────── */
export function CTAFooter({
  handle = "@mexicocharts",
  website = "mexicochart.com",
  compact = false,
}: {
  handle?: string;
  website?: string;
  compact?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: compact ? "20px 64px" : "26px 64px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
        flexShrink: 0,
        position: "relative",
        zIndex: 2,
      }}
    >
      <img
        src={LOGO_URL}
        alt="Mexico Charts"
        crossOrigin="anonymous"
        style={{ height: compact ? 26 : 32, objectFit: "contain", opacity: 0.8 }}
      />
      <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
        <div
          style={{
            fontSize: compact ? 16 : 18,
            fontWeight: 700,
            color: "rgba(255,255,255,0.28)",
            letterSpacing: "0.07em",
          }}
        >
          {handle}
        </div>
        <div
          style={{
            fontSize: compact ? 14 : 16,
            fontWeight: 600,
            color: "rgba(255,255,255,0.14)",
            letterSpacing: "0.06em",
          }}
        >
          {website}
        </div>
      </div>
    </div>
  );
}
