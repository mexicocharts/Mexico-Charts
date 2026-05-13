/* ─────────────────────────────────────────────────────────────────
   MEXICO CHARTS — Social Template Design System
   Shared components for all Instagram/social post templates.
   Canvas size: 1080 × 1350 px  (4:5 Instagram portrait)
───────────────────────────────────────────────────────────────── */
import React from "react";

export const W = 1080;
export const H = 1350;
export const ACCENT = "#39FF14";
export const BG = "#050505";
export const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;
export const LOGO_URL = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;

/* ── Base canvas ───────────────────────────────────────────────── */
export function TemplateCanvas({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        width: W,
        height: H,
        background: BG,
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
        WebkitFontSmoothing: "antialiased",
        ...style,
      }}
    >
      {/* Grain texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: NOISE,
          backgroundSize: "192px",
          opacity: 0.045,
          pointerEvents: "none",
          zIndex: 99,
        }}
      />
      {children}
    </div>
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
        padding: compact ? "32px 64px 24px" : "44px 64px 36px",
      }}
    >
      <img
        src={LOGO_URL}
        alt="Mexico Charts"
        style={{ height: compact ? 32 : 40, objectFit: "contain", opacity: 0.95 }}
      />
      {(date || source) && (
        <div style={{ textAlign: "right" }}>
          {date && (
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "rgba(255,255,255,0.32)",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              {date}
            </div>
          )}
          {source && (
            <div
              style={{
                fontSize: 15,
                color: "rgba(255,255,255,0.18)",
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
        fontSize: 19,
        fontWeight: 900,
        textTransform: "uppercase",
        letterSpacing: "0.32em",
        color,
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
          fontSize: size === "sm" ? 13 : 15,
          fontWeight: 900,
          color: ACCENT,
          background: `${ACCENT}18`,
          border: `1px solid ${ACCENT}35`,
          borderRadius: 5,
          padding: "3px 6px",
          textAlign: "center",
          letterSpacing: "0.04em",
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
          color: "rgba(255,255,255,0.15)",
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
        fontSize: size === "sm" ? 14 : 16,
        fontWeight: 800,
        color: up ? ACCENT : "rgba(255,80,80,0.7)",
        textAlign: "center",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
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
  const rowH = compact ? 74 : 84;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        height: rowH,
        borderBottom: "1px solid rgba(255,255,255,0.045)",
        gap: 18,
        background: isTop3 ? `${accent}08` : "transparent",
        padding: "0 64px",
      }}
    >
      {/* Rank number */}
      <div
        style={{
          width: 56,
          fontSize: isTop3 ? 32 : 25,
          fontWeight: 900,
          color: isTop3 ? accent : "rgba(255,255,255,0.22)",
          flexShrink: 0,
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        {String(row.rank).padStart(2, "0")}
      </div>

      <MovementBadge movement={row.movement} isNew={row.isNew} size={compact ? "sm" : "md"} />

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: compact ? 22 : 26,
            fontWeight: isTop3 ? 800 : 700,
            color: isTop3 ? "#fff" : "rgba(255,255,255,0.82)",
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
                fontSize: compact ? 16 : 18,
                color: "rgba(255,255,255,0.28)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {row.subtitle}
            </div>
          )}
          {showMeta && row.peak && (
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.18)", letterSpacing: "0.05em" }}>
              PICO #{row.peak}
            </div>
          )}
          {showMeta && row.weeks && (
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.18)", letterSpacing: "0.05em" }}>
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
              fontSize: compact ? 19 : 22,
              fontWeight: 900,
              color: isTop3 ? accent : "rgba(255,255,255,0.42)",
              letterSpacing: "-0.01em",
            }}
          >
            {row.stat}
          </div>
          {row.statLabel && (
            <div
              style={{
                fontSize: 13,
                color: "rgba(255,255,255,0.18)",
                letterSpacing: "0.08em",
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
        padding: "9px 24px",
        borderRadius: 40,
        fontSize: 17,
        fontWeight: 800,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        border: `1.5px solid ${active ? color + "80" : "rgba(255,255,255,0.08)"}`,
        color: active ? color : "rgba(255,255,255,0.18)",
        background: active ? `${color}12` : "transparent",
        whiteSpace: "nowrap",
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
          borderRadius: round ? "50%" : 14,
          background: `linear-gradient(135deg, #1c1c1c, #0d0d0d)`,
          border: `1px solid rgba(255,255,255,0.09)`,
          overflow: "hidden",
          boxShadow: `0 16px 56px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.05), 0 0 40px ${accent}15`,
        }}
      >
        {src ? (
          <img
            src={src}
            alt=""
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "saturate(0.75) contrast(1.08) brightness(0.92)",
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: `radial-gradient(circle at 40% 40%, ${accent}15, #0d0d0d)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: size * 0.35, color: accent, opacity: 0.35 }}>♪</span>
          </div>
        )}
      </div>
      {rank !== undefined && (
        <div
          style={{
            position: "absolute",
            top: -10,
            left: -10,
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: accent,
            color: "#000",
            fontSize: 16,
            fontWeight: 900,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: `0 0 16px ${accent}70`,
          }}
        >
          {rank}
        </div>
      )}
    </div>
  );
}

/* ── Large stat number ─────────────────────────────────────────── */
export function LargeStatNum({
  value,
  label,
  accent = ACCENT,
  size = 110,
}: {
  value: string;
  label?: string;
  accent?: string;
  size?: number;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: size,
          fontWeight: 900,
          color: accent,
          letterSpacing: "-0.045em",
          lineHeight: 0.88,
          textShadow: `0 0 80px ${accent}35, 0 0 200px ${accent}12`,
        }}
      >
        {value}
      </div>
      {label && (
        <div
          style={{
            fontSize: 23,
            fontWeight: 700,
            color: "rgba(255,255,255,0.38)",
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            marginTop: 18,
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
}

/* ── Stats pill ────────────────────────────────────────────────── */
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
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: "24px 32px",
        flex: 1,
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 800,
          color: "rgba(255,255,255,0.28)",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 42,
          fontWeight: 900,
          color: accent,
          letterSpacing: "-0.03em",
          lineHeight: 1,
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
        fontSize: 16,
        color: "rgba(255,255,255,0.18)",
        letterSpacing: "0.13em",
        textTransform: "uppercase",
        fontWeight: 600,
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
        padding: compact ? "22px 64px" : "28px 64px",
        borderTop: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <img
        src={LOGO_URL}
        alt="Mexico Charts"
        style={{ height: compact ? 26 : 32, objectFit: "contain", opacity: 0.75 }}
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
            fontSize: compact ? 15 : 17,
            fontWeight: 600,
            color: "rgba(255,255,255,0.16)",
            letterSpacing: "0.06em",
          }}
        >
          {website}
        </div>
      </div>
    </div>
  );
}
