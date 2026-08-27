import { useEffect, useState, useMemo } from "react";
import PageSEO from "@/components/PageSEO";
import { motion } from "framer-motion";
import SiteNav from "@/components/SiteNav";
import TouringCommandCenter from "@/components/TouringCommandCenter";
import { useArtistTouring, useTouring, useTouringLab, type ArtistTours } from "@/hooks/useTouring";
import { useArtistImages } from "@/hooks/useArtistImages";
import { subscribeToNewsletter } from "@/services/newsletter";

const HERO_BG = "/touring-hero.png";


function formatDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
}

function formatUsd(value: number | null | undefined): string {
  return value == null ? "Pendiente" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function publicPrice(event: { source?: string; priceRanges?: { currency: string | null; min: number | null; max: number | null }[] }) {
  if (event.source !== "ticketmaster-discovery-v2") return null;
  const price = event.priceRanges?.[0];
  if (!price || price.min === null || price.max === null) return null;
  return `${price.currency ?? ""} ${price.min.toLocaleString()}–${price.max.toLocaleString()}`.trim();
}

function publicSaleStatus(event: ArtistTours["events"][number]): string {
  const status = event.eventStatus?.toLowerCase().replace(/[_-]+/g, " ").trim();
  if (status) {
    if (status.includes("cancel")) return "Cancelado";
    if (status.includes("postpon")) return "Pospuesto";
    if (status.includes("off sale") || status.includes("offsale")) return "Venta cerrada";
    if (status.includes("on sale") || status.includes("onsale")) return "Venta pública";
    return event.eventStatus!.replace(/[_-]+/g, " ");
  }

  const now = Date.now();
  const saleStart = event.publicSaleStart ? new Date(event.publicSaleStart).getTime() : null;
  const saleEnd = event.publicSaleEnd ? new Date(event.publicSaleEnd).getTime() : null;
  if (saleStart && saleStart > now) return `Venta pública · ${formatDate(event.publicSaleStart!.slice(0, 10))}`;
  if (saleEnd && saleEnd < now) return "Venta pública cerrada";
  if (saleStart || saleEnd) return "Venta pública";
  return "Venta no informada";
}

function isCancelledEvent(event: ArtistTours["events"][number]): boolean {
  return event.eventStatus?.toLowerCase().includes("cancel") ?? false;
}

function artistKey(artist: ArtistTours): string {
  return artist.id.trim().toLowerCase();
}

function validUpcomingEvents(events: ArtistTours["events"], today: string) {
  const seen = new Set<string>();
  return events
    .filter((event) => event.eventKind !== "auxiliary" && !isCancelledEvent(event) && event.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.eventId.localeCompare(b.eventId))
    .filter((event) => {
      const key = event.eventId || [event.date, event.venue, event.city, event.name].join("|").toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

const PINNED_ARTIST_IDS = ["fuerza-regida", "carin-leon"];
// Editorial ordering is only a tie-breaker for artists already present in the feed.
const EDITORIAL_PRIORITY = [
  "fuerza-regida",
  "carin-leon",
  "grupo-firme",
  "natanael-cano",
  "banda-ms",
  "eslabon-armado",
  "los-tigres-del-norte",
  "grupo-frontera",
];

function freshnessLabel(fetchedAt: number | undefined): string {
  if (!fetchedAt) return "consulta actual";
  return new Date(fetchedAt).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-32px" },
  transition: { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] as const },
});

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <motion.div {...fadeUp(0)} style={{ color: "rgba(255,255,255,0.3)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.38em", marginBottom: 10 }}>
      {children}
    </motion.div>
  );
}

function SectionHeading({ white, green }: { white: string; green: string }) {
  return (
    <motion.h2 {...fadeUp(0.04)} className="th-anton" style={{ fontSize: 26, textTransform: "uppercase", letterSpacing: "0.04em", margin: 0 }}>
      <span style={{ color: "#fff" }}>{white} </span><span style={{ color: "#39FF14" }}>{green}</span>
    </motion.h2>
  );
}

function ShelfCard({
  artist,
  idx,
  deezerPhoto,
}: {
  artist: ArtistTours;
  idx: number;
  deezerPhoto: string | null;
}) {
  const photo = artist.events[0]?.img ?? deezerPhoto ?? null;
  const nextEv = artist.events[0];
  const accent = idx === 0 ? "#39FF14" : idx === 1 ? "rgba(57,255,20,0.7)" : "rgba(57,255,20,0.45)";

  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ scale: 1.025, y: -6, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }}
      style={{ position: "relative", width: 140, height: 310, borderRadius: 12,
        boxShadow: "0 6px 32px rgba(0,0,0,0.75)", cursor: "pointer", flexShrink: 0, scrollSnapAlign: "start" }}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden", borderRadius: 12 }}>
        <div style={{
          position: "absolute", inset: 0,
          background: photo
            ? `url(${photo}) center top / cover no-repeat`
            : "linear-gradient(160deg, #0a0a0a 0%, #141414 100%)",
          filter: photo ? "brightness(0.8) saturate(0.6) contrast(1.1)" : undefined,
          transition: "filter 0.3s",
        }} />

        {photo && <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 85% 90% at 50% 42%, transparent 45%, rgba(0,0,0,0.55) 80%, rgba(0,0,0,0.88) 100%)" }} />}

        <div style={{ position: "absolute", top: 10, left: 12, fontSize: 38, fontWeight: 900, color: "rgba(255,255,255,0.11)", lineHeight: 1, fontFamily: "Inter, sans-serif", letterSpacing: "-0.04em", userSelect: "none" }}>
          {String(idx + 1).padStart(2, "0")}
        </div>

        {artist.events.length > 0 && (
          <div style={{ position: "absolute", top: 12, right: 12, width: 6, height: 6, borderRadius: "50%", background: accent, boxShadow: `0 0 8px ${accent}` }} />
        )}

        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "0 12px 14px", background: "linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.65) 55%, transparent 100%)" }}>
          <div className="th-anton" style={{ color: "#fff", fontSize: 16, textTransform: "uppercase", lineHeight: 1.1, marginBottom: 4 }}>{artist.name}</div>
          {nextEv ? (
            <>
              <div style={{ color: accent, fontSize: 10, fontWeight: 800, letterSpacing: "0.06em" }}>{artist.events.length} fechas</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 9, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "0.03em" }}>
                {formatDate(nextEv.date)} · {nextEv.city}
              </div>
            </>
          ) : (
            <div style={{ color: "rgba(255,255,255,0.50)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.14em" }}>Sin fechas</div>
          )}
        </div>
      </div>
    </motion.div>
  );

  if (nextEv?.url) {
    return <a href={nextEv.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>{inner}</a>;
  }
  return inner;
}

function SkeletonShelfCard() {
  return (
    <div style={{ width: 140, height: 310, borderRadius: 12, background: "#0f0f0f", flexShrink: 0, scrollSnapAlign: "start", animation: "pulse 1.8s ease-in-out infinite" }} />
  );
}

type CountryFilter = "ALL" | "US" | "MX" | "OTHER";

const COUNTRY_LABELS: Record<CountryFilter, string> = {
  ALL:   "Todos",
  US:    "Estados Unidos",
  MX:    "México",
  OTHER: "Latinoamérica + otros",
};

export default function TouringHub() {
  const { data: artists, isLoading, isError } = useTouring();
  const { data: touringLab } = useTouringLab();
  const { data: fuerzaRegidaFeed } = useArtistTouring("fuerza-regida");
  const { data: carinLeonFeed } = useArtistTouring("carin-leon");
  const [countryFilter, setCountryFilter] = useState<CountryFilter>("ALL");
  const [cityFilter, setCityFilter] = useState("ALL");
  const [showAll, setShowAll] = useState(false);
  const [newsletterEmail, setNewsletterEmail] = useState("");
  const [newsletterStatus, setNewsletterStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const PAGE_SIZE = 8;

  async function submitNewsletter(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = newsletterEmail.trim();
    if (!email) return;
    setNewsletterStatus("loading");
    try {
      await subscribeToNewsletter(email, "touring");
      setNewsletterEmail("");
      setNewsletterStatus("success");
    } catch {
      setNewsletterStatus("error");
    }
  }

  const sortedArtists = artists
    ? [...artists].sort((a, b) => b.events.length - a.events.length)
    : [];

  const totalShows = sortedArtists.reduce((sum, a) => sum + a.events.length, 0);

  const fallbackTourCards = useMemo(() => {
    if (touringLab?.available && touringLab.tours.length > 0) return [];
    const today = new Date().toISOString().slice(0, 10);
    const bulkById = new Map(sortedArtists.map((artist) => [artistKey(artist), artist]));
    const individualById = new Map(
      [fuerzaRegidaFeed, carinLeonFeed]
        .filter((artist): artist is ArtistTours => Boolean(artist))
        .map((artist) => [artistKey(artist), artist]),
    );
    const candidates = new Map<string, { artist: ArtistTours; events: ArtistTours["events"] }>();

    sortedArtists.forEach((bulkArtist) => {
      const key = artistKey(bulkArtist);
      const sourceArtist = PINNED_ARTIST_IDS.includes(key)
        ? individualById.get(key) ?? bulkArtist
        : bulkArtist;
      const events = validUpcomingEvents(sourceArtist.events, today);
      if (events.length > 0) candidates.set(key, { artist: sourceArtist, events });
    });

    individualById.forEach((individualArtist, key) => {
      const events = validUpcomingEvents(individualArtist.events, today);
      if (events.length > 0) candidates.set(key, { artist: individualArtist, events });
    });

    const editorialRank = (artist: ArtistTours) => {
      const rank = EDITORIAL_PRIORITY.indexOf(artistKey(artist));
      return rank === -1 ? Number.MAX_SAFE_INTEGER : rank;
    };
    const pinned = PINNED_ARTIST_IDS
      .map((id) => candidates.get(id))
      .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
    const rest = [...candidates.entries()]
      .filter(([id]) => !PINNED_ARTIST_IDS.includes(id))
      .map(([, candidate]) => candidate)
      .sort((a, b) =>
        editorialRank(a.artist) - editorialRank(b.artist) ||
        b.events.length - a.events.length ||
        a.events[0].date.localeCompare(b.events[0].date) ||
        a.artist.name.localeCompare(b.artist.name, "es"),
      );

    return [...pinned, ...rest].slice(0, 8).map((candidate) => ({
      ...candidate,
      nextEvent: candidate.events[0],
      featured: PINNED_ARTIST_IDS.includes(artistKey(candidate.artist)),
    }));
  }, [carinLeonFeed, fuerzaRegidaFeed, sortedArtists, touringLab]);

  const showFallbackTourCards = !(touringLab?.available && touringLab.tours.length > 0) && fallbackTourCards.length > 0;
  const touringFreshness = artists?.length
    ? freshnessLabel(Math.max(...artists.map((artist) => artist.fetchedAt).filter(Boolean)))
    : "consulta actual";

  const allShowsFlat = sortedArtists
    .flatMap(a => a.events.slice(0, 8).map(ev => ({ ...ev, artistName: a.name, artistId: a.id })))
    .sort((a, b) => a.date.localeCompare(b.date));

  const countryFilteredShows = allShowsFlat.filter(ev => {
    if (countryFilter === "ALL")   return true;
    if (countryFilter === "US")    return ev.country === "US";
    if (countryFilter === "MX")    return ev.country === "MX";
    if (countryFilter === "OTHER") return ev.country !== "US" && ev.country !== "MX";
    return true;
  });

  const cityOptions = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    countryFilteredShows.forEach((ev) => {
      const city = ev.city.trim();
      if (!city) return;
      const state = ev.state.trim();
      const country = ev.country.trim();
      const key = `${city.toLowerCase()}|${state.toLowerCase()}|${country.toLowerCase()}`;
      const label = `${city}${state ? `, ${state}` : country ? `, ${country}` : ""}`;
      const existing = counts.get(key);
      counts.set(key, { label, count: (existing?.count ?? 0) + 1 });
    });
    return [...counts.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "es"));
  }, [countryFilteredShows]);

  useEffect(() => {
    setCityFilter("ALL");
    setShowAll(false);
  }, [countryFilter]);

  useEffect(() => {
    setShowAll(false);
  }, [cityFilter]);

  const filteredShows = countryFilteredShows.filter(ev => {
    if (cityFilter === "ALL") return true;
    const city = ev.city.trim();
    const state = ev.state.trim();
    const country = ev.country.trim();
    const key = `${city.toLowerCase()}|${state.toLowerCase()}|${country.toLowerCase()}`;
    return key === cityFilter;
  });

  const allImageNames = useMemo(() => {
    const names = new Set<string>();
    sortedArtists.forEach((a) => names.add(a.name));
    return [...names];
  }, [sortedArtists]);

  const deezerImages = useArtistImages(allImageNames);

  return (
    <div style={{ background: "#080808", minHeight: "100vh", fontFamily: "'Inter', sans-serif", color: "#9ca3af" }}>
      <PageSEO
        title="Touring — Artistas mexicanos en vivo"
        description="Conciertos y giras de artistas mexicanos con fechas, ciudades, recintos y enlaces oficiales de boletos para próximos eventos."
        path="/touring"
      />
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;900&display=swap');
        .th-anton { font-family: 'Anton', sans-serif !important; }
        button { cursor: pointer; }
        a { text-decoration: none; }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.35 } }

        .th-outline-btn {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.35);
          color: rgba(255,255,255,0.85);
          padding: 11px 22px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          transition: border-color 0.22s, color 0.22s, background 0.22s;
          border-radius: 0;
        }
        .th-outline-btn:hover {
          border-color: rgba(57,255,20,0.6);
          color: #39FF14;
          background: rgba(57,255,20,0.04);
        }

        .th-filter-btn {
          background: transparent;
          border: 1px solid #1e1e1e;
          color: #555;
          padding: 7px 14px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.18s;
          border-radius: 0;
        }
        .th-filter-btn:hover { border-color: #333; color: #888; }
        .th-filter-btn.active {
          background: #39FF14;
          border-color: #39FF14;
          color: #000;
        }
        .th-city-select {
          background: #090909;
          border: 1px solid #1e1e1e;
          color: rgba(255,255,255,0.66);
          min-height: 34px;
          padding: 0 36px 0 12px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          outline: none;
          border-radius: 0;
          max-width: 260px;
        }
        .th-city-select:focus {
          border-color: rgba(57,255,20,0.55);
          color: #fff;
        }

        .th-show-row {
          display: flex;
          align-items: center;
          background: #090909;
          border: 1px solid #131313;
          text-decoration: none;
          overflow: hidden;
          transition: border-color 0.2s, background 0.2s;
        }
        .th-show-row:hover {
          border-color: rgba(57,255,20,0.4);
          background: #0b0b0b;
        }
        .th-show-row-main { min-width: 0; }
        .th-show-list {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .th-insight-card {
          border: 1px solid #181818;
          overflow: hidden;
          cursor: pointer;
          background: #090909;
          transition: border-color 0.22s, box-shadow 0.22s;
        }
        .th-insight-card:hover {
          border-color: rgba(57,255,20,0.35);
          box-shadow: 0 8px 40px rgba(0,0,0,0.75);
        }

        .th-ver-mas-btn {
          background: transparent;
          border: 1px solid #1e1e1e;
          color: #555;
          padding: 11px 32px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.16em;
          cursor: pointer;
          transition: all 0.2s;
        }
        .th-ver-mas-btn:hover {
          border-color: rgba(57,255,20,0.4);
          color: rgba(57,255,20,0.8);
        }

        .th-newsletter-input {
          flex: 1;
          background: #0f0f0f;
          border: 1px solid #222;
          border-right: none;
          color: #fff;
          padding: 13px 18px;
          font-size: 12px;
          outline: none;
          font-family: 'Inter', sans-serif;
          transition: border-color 0.2s;
        }
        .th-newsletter-input:focus { border-color: rgba(57,255,20,0.3); }
        .th-newsletter-input::placeholder { color: #3a3a3a; }

        .th-subscribe-btn {
          background: #39FF14;
          border: 1px solid #39FF14;
          color: #000;
          padding: 13px 26px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          cursor: pointer;
          transition: background 0.2s, opacity 0.2s;
          font-family: 'Inter', sans-serif;
        }
        .th-subscribe-btn:hover { background: #2ee010; }

        .th-divider {
          height: 1px;
          background: linear-gradient(to right, transparent, rgba(255,255,255,0.055), transparent);
          border: none;
          margin: 0;
        }
        .th-lab-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px; }
        .th-lab-card { border: 1px solid #191919; background: linear-gradient(145deg,#0b0b0b,#080808); padding: 20px; }
        .th-launch-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; }
        .th-launch-card { border: 1px solid rgba(57,255,20,0.2); background: linear-gradient(145deg,rgba(57,255,20,0.06),#080808 58%); padding: 18px; min-width: 0; }
        .th-launch-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 18px; }
        .th-launch-fact { min-width: 0; }

        @media (min-width: 721px) and (max-width: 1100px) {
          .th-hero {
            height: 500px !important;
          }
          .th-hero-title {
            font-size: clamp(4rem, 10vw, 5.9rem) !important;
          }
          .th-content-section,
          .th-shelf-heading,
          .th-shelf-track,
          .th-newsletter,
          .th-footer {
            padding-left: 28px !important;
            padding-right: 28px !important;
          }
          .th-section-head {
            align-items: flex-start !important;
            flex-direction: column;
            gap: 18px;
          }
          .th-filter-group {
            width: 100%;
            overflow-x: auto;
            gap: 6px !important;
            padding-bottom: 4px;
            scrollbar-width: none;
          }
          .th-filter-btn {
            flex-shrink: 0;
            min-height: 38px;
            padding: 8px 14px !important;
          }
          .th-city-select {
            width: 100%;
            max-width: none;
            min-width: 0;
            box-sizing: border-box;
          }
          .th-filter-controls { width: 100%; min-width: 0; }
          .th-show-row {
            min-height: 68px;
          }
          .th-show-thumb {
            width: 64px !important;
            height: 68px !important;
          }
          .th-show-row-main {
            align-items: flex-start !important;
            flex-direction: column;
            justify-content: center;
            gap: 4px !important;
            padding: 10px 16px !important;
          }
          .th-show-date,
          .th-show-artist {
            min-width: 0 !important;
          }
          .th-show-artist {
            font-size: 15px !important;
            line-height: 1;
          }
          .th-show-venue,
          .th-show-city {
            width: 100%;
            margin-left: 0 !important;
            white-space: nowrap !important;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .th-ticket-cta {
            min-width: 108px;
            justify-content: center;
          }
          .th-launch-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }

        @media (max-width: 720px) {
          .th-hero {
            height: calc(100svh - 56px) !important;
            min-height: 580px;
          }
          .th-hero::after {
            content: "";
            position: absolute;
            inset: 0;
            z-index: 4;
            pointer-events: none;
            background:
              linear-gradient(to top, #080808 0%, rgba(8,8,8,0.14) 42%, rgba(8,8,8,0) 68%),
              radial-gradient(ellipse at 16% 72%, rgba(57,255,20,0.12) 0%, transparent 46%);
          }
          .th-hero-copy {
            padding: 44px 24px 34px !important;
            max-width: none !important;
          }
          .th-hero-title {
            font-size: clamp(3.8rem, 18vw, 5.2rem) !important;
            letter-spacing: 0 !important;
          }
          .th-hero-stats { gap: 20px !important; flex-wrap: wrap; }
          .th-section-head {
            align-items: flex-start !important;
            flex-direction: column;
            gap: 18px;
          }
          .th-shelf-heading,
          .th-shelf-track,
          .th-content-section,
          .th-newsletter,
          .th-footer {
            padding-left: 24px !important;
            padding-right: 24px !important;
          }
          .th-shelf-heading { align-items: flex-start !important; flex-wrap: wrap; }
          .th-shelf-meta { width: 100%; }
          .th-filter-group {
            width: 100%;
            overflow-x: auto;
            padding-bottom: 4px;
            scrollbar-width: none;
            gap: 6px !important;
            scroll-snap-type: x proximity;
          }
          .th-filter-btn {
            flex-shrink: 0;
            min-height: 38px;
            padding: 8px 12px !important;
            scroll-snap-align: start;
          }
          .th-city-select {
            width: 100%;
            max-width: none;
            min-width: 0;
            box-sizing: border-box;
          }
          .th-filter-controls { width: 100%; min-width: 0; }
          .th-show-row {
            align-items: stretch;
            min-height: 106px;
            background: linear-gradient(110deg, #080808 0%, #0c0c0c 70%, rgba(57,255,20,0.025) 100%) !important;
            border-color: rgba(255,255,255,0.07) !important;
          }
          .th-show-thumb {
            width: 68px !important;
            height: auto !important;
          }
          .th-show-row-main {
            flex-direction: column;
            align-items: flex-start !important;
            justify-content: center;
            gap: 5px !important;
            padding: 12px 14px !important;
          }
          .th-show-date {
            min-width: 0 !important;
            font-size: 10px !important;
            line-height: 1.1;
          }
          .th-show-artist {
            min-width: 0 !important;
            font-size: 16px !important;
            line-height: 1.02;
            max-width: 100%;
            overflow-wrap: anywhere;
          }
          .th-show-venue,
          .th-show-city {
            width: 100%;
            white-space: normal !important;
            margin-left: 0 !important;
          }
          .th-show-venue {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            line-height: 1.35;
          }
          .th-show-city {
            color: rgba(255,255,255,0.42) !important;
            font-size: 9px !important;
            text-transform: uppercase;
            letter-spacing: 0.12em !important;
          }
          .th-ticket-cta { display: none !important; }
          .th-launch-grid { grid-template-columns: 1fr; }
          .th-launch-card { padding: 16px; }
          .th-launch-facts { gap: 10px; }
          .th-newsletter {
            align-items: stretch !important;
            flex-direction: column;
            gap: 20px !important;
          }
          .th-newsletter-form {
            max-width: none !important;
            flex-direction: column;
            gap: 8px !important;
          }
          .th-newsletter-input { border-right: 1px solid #222; }
          .th-subscribe-btn { width: 100%; }
          .th-footer {
            align-items: flex-start !important;
            flex-direction: column;
            gap: 8px;
          }
        }
      ` }} />

      <SiteNav />

      {/* ── HERO ── */}
      <section className="th-hero" style={{ position: "relative", height: 540, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")", opacity: 0.05, mixBlendMode: "overlay", pointerEvents: "none", zIndex: 4 }} />
        <img src={HERO_BG} alt="" width={1200} height={720} loading="eager" fetchPriority="high" decoding="async" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 75%", filter: "contrast(1.06) brightness(1.01) saturate(1.08)" }} />
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to right, rgba(4,10,4,0.74) 0%, rgba(4,10,4,0.40) 30%, transparent 56%)", zIndex: 3, pointerEvents: "none" }} />
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 100, background: "linear-gradient(to top, #080808 0%, transparent 100%)", zIndex: 3, pointerEvents: "none" }} />

        <div className="th-hero-copy" style={{ position: "relative", zIndex: 10, padding: "56px 44px 44px", maxWidth: 520, height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16,1,0.3,1] }}
              style={{ color: "#39FF14", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.38em", marginBottom: 18 }}>
              Touring
            </motion.div>
            <motion.h1 className="th-anton th-hero-title"
              initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.75, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
              style={{ color: "#fff", fontSize: 80, lineHeight: 0.88, textTransform: "uppercase", letterSpacing: "-0.01em" }}>
              La Música<br />Mexicana<br />en Vivo
            </motion.h1>
          </div>
          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.65, ease: [0.16,1,0.3,1] }}
            style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {!isLoading && !isError && totalShows > 0 && (
              <div className="th-hero-stats" style={{ display: "flex", gap: 28 }}>
                <div>
                  <div style={{ color: "#39FF14", fontSize: 28, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.02em" }}>{totalShows}</div>
                  <div style={{ color: "rgba(255,255,255,0.62)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.28em", marginTop: 4 }}>Fechas próximas</div>
                </div>
                <div style={{ width: 1, background: "rgba(255,255,255,0.1)", alignSelf: "stretch" }} />
                <div>
                  <div style={{ color: "#39FF14", fontSize: 28, fontWeight: 900, lineHeight: 1, letterSpacing: "-0.02em" }}>{sortedArtists.filter(a => a.events.length > 0).length}</div>
                  <div style={{ color: "rgba(255,255,255,0.62)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.28em", marginTop: 4 }}>Artistas en gira</div>
                </div>
              </div>
            )}
            <a href="#agenda">
              <button className="th-outline-btn">
                Explorar fechas <span style={{ fontSize: 13, opacity: 0.7 }}>→</span>
              </button>
            </a>
          </motion.div>
        </div>
      </section>

      {/* ── Próximas giras ── */}
      <section style={{ paddingTop: 32, paddingBottom: 32, borderBottom: "1px solid #111" }}>
        <div className="th-shelf-heading" style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 32px", marginBottom: 22 }}>
          <span style={{ color: "#39FF14", fontSize: 13 }}>◈</span>
          <h2 style={{ color: "rgba(255,255,255,0.65)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.32em", margin: 0 }}>
            Giras destacadas y próximas
          </h2>
          <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.06)", marginLeft: 8 }} />
          {!isLoading && !isError && totalShows > 0 && (
            <span className="th-shelf-meta" style={{ color: "rgba(255,255,255,0.50)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.16em", display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#39FF14", display: "inline-block", boxShadow: "0 0 6px rgba(57,255,20,0.5)" }} />
              {totalShows} fechas · Ticketmaster
            </span>
          )}
        </div>

        {isError && (
          <div role="status" style={{ margin: "0 32px", background: "#0d0d0d", border: "1px solid rgba(255,60,60,0.15)", padding: "14px 20px", color: "rgba(255,255,255,0.5)", fontSize: 11, letterSpacing: "0.04em", lineHeight: 1.6 }}>
            <span style={{ display: "block", color: "rgba(255,80,80,0.72)", fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.14em" }}>
              Giras temporalmente no disponibles
            </span>
            No pudimos actualizar las fechas en este momento. La agenda volverá cuando la fuente responda.
          </div>
        )}

        {!isLoading && !isError && sortedArtists.length === 0 && (
          <div style={{ margin: "0 32px", background: "#0d0d0d", border: "1px solid rgba(255,255,255,0.08)", padding: "14px 20px", color: "rgba(255,255,255,0.42)", fontSize: 11, lineHeight: 1.6 }}>
            Aún no hay giras activas para mostrar.
          </div>
        )}

        <div className="th-shelf-track" style={{ display: "flex", gap: 14, overflowX: "auto", padding: "4px 32px 16px", scrollSnapType: "x mandatory", scrollbarWidth: "none", WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => <SkeletonShelfCard key={i} />)
            : sortedArtists.map((artist, idx) => (
                <ShelfCard
                  key={artist.id}
                  artist={artist}
                  idx={idx}
                  deezerPhoto={deezerImages[artist.name] ?? null}
                />
              ))}
        </div>
      </section>

      {/* ── ALL UPCOMING SHOWS — flat list ── */}
      {!isLoading && !isError && (
        <section id="agenda" className="th-content-section" style={{ padding: "44px 32px", borderBottom: "1px solid #111", scrollMarginTop: 96 }}>
          <div className="th-section-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 24 }}>
            <div>
              <SectionEyebrow>Agenda</SectionEyebrow>
              <SectionHeading white="Todas las" green="Fechas" />
            </div>
            <div className="th-filter-controls" style={{ display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
              <div className="th-filter-group" style={{ display: "flex", gap: 3 }}>
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
                    <button key={f}
                      type="button"
                      className={`th-filter-btn${isActive ? " active" : ""}`}
                      onClick={() => setCountryFilter(f)}
                      aria-pressed={isActive}
                      aria-label={`Filtrar fechas: ${COUNTRY_LABELS[f]}`}>
                      {COUNTRY_LABELS[f]}
                      <span style={{
                        background: isActive ? "rgba(0,0,0,0.18)" : "#141414",
                        color: isActive ? "#000" : "#3a3a3a",
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "1px 5px",
                      }}>{count}</span>
                    </button>
                  );
                })}
              </div>
              <select
                className="th-city-select"
                value={cityFilter}
                onChange={(event) => setCityFilter(event.target.value)}
                aria-label="Filtrar fechas por ciudad"
              >
                <option value="ALL">Todas las ciudades ({countryFilteredShows.length})</option>
                {cityOptions.map((city) => (
                  <option key={city.key} value={city.key}>
                    {city.label} ({city.count})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {filteredShows.length === 0 ? (
            <div style={{
              padding: "44px 18px",
              color: "rgba(255,255,255,0.55)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              textAlign: "center",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "linear-gradient(135deg, rgba(57,255,20,0.055), rgba(255,255,255,0.025) 38%, rgba(0,0,0,0.22))",
            }}>
              Ticketmaster no tiene fechas disponibles para este filtro por el momento
            </div>
          ) : (
            <>
              <div className="th-show-list">
                {filteredShows.slice(0, showAll ? filteredShows.length : PAGE_SIZE).map((ev, i) => (
                  <motion.a
                    key={ev.eventId} href={ev.url} target="_blank" rel="noopener noreferrer"
                    className="th-show-row"
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-20px" }}
                    transition={{ delay: i * 0.02, duration: 0.4, ease: [0.16,1,0.3,1] }}>
                    {ev.img && (
                      <div className="th-show-thumb" style={{ width: 54, height: 54, flexShrink: 0, overflow: "hidden" }}>
                        <img src={ev.img} alt="" width={54} height={54} loading="lazy" decoding="async" style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.45) saturate(0.3)" }} />
                      </div>
                    )}
                    <div className="th-show-row-main" style={{ flex: 1, display: "flex", alignItems: "center", padding: "0 18px", minWidth: 0, gap: 0 }}>
                      <span className="th-show-date" style={{ color: "#39FF14", fontSize: 10, fontWeight: 700, minWidth: 100, flexShrink: 0, letterSpacing: "0.04em" }}>{formatDate(ev.date)}</span>
                      <span className="th-anton th-show-artist" style={{ color: "#e8e8e8", fontSize: 13, textTransform: "uppercase", minWidth: 160, flexShrink: 0, letterSpacing: "0.02em" }}>{ev.artistName}</span>
                      <span className="th-show-venue" style={{ color: "rgba(255,255,255,0.55)", fontSize: 11, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.venue}</span>
                      <span className="th-show-city" style={{ color: "rgba(255,255,255,0.52)", fontSize: 10, flexShrink: 0, marginLeft: 16, letterSpacing: "0.03em" }}>{ev.city}{ev.state ? `, ${ev.state}` : ""}</span>
                      {publicPrice(ev) && <span style={{ color: "rgba(255,255,255,0.38)", fontSize: 9, flexShrink: 0, marginLeft: 14 }}>{publicPrice(ev)}</span>}
                    </div>
                    <div className="th-ticket-cta" style={{ padding: "0 18px", flexShrink: 0, borderLeft: "1px solid #141414", height: 54, display: "flex", alignItems: "center" }}>
                      <span style={{ color: "rgba(57,255,20,0.7)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.15em" }}>Boletos →</span>
                    </div>
                  </motion.a>
                ))}
              </div>

              {filteredShows.length > PAGE_SIZE && (
                <div style={{ marginTop: 20, textAlign: "center" }}>
                  <button
                    type="button"
                    className="th-ver-mas-btn"
                    onClick={() => setShowAll(s => !s)}
                    aria-expanded={showAll}
                    aria-label={showAll ? "Mostrar menos fechas" : `Mostrar ${filteredShows.length - PAGE_SIZE} fechas más`}
                  >
                    {showAll ? `Ver menos ↑` : `Ver más · ${filteredShows.length - PAGE_SIZE} fechas más →`}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      <TouringCommandCenter />

      {/* Touring Lab only publishes supported observations; demand remains unavailable until authorized inputs exist. */}
      <section className="th-content-section" style={{ padding: "48px 32px", borderBottom: "1px solid #111", background: "#070707" }}>
        <SectionEyebrow>Datos y metodología</SectionEyebrow>
        <SectionHeading white="Touring" green="Lab" />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14, marginBottom: 24 }}>
          <span style={{ border: "1px solid rgba(57,255,20,.28)", color: "#39FF14", padding: "5px 9px", fontSize: 8, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".16em" }}>Point estimates</span>
          <span style={{ border: "1px solid #202020", color: "rgba(255,255,255,.5)", padding: "5px 9px", fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".13em" }}>Evidence-gated</span>
          <span style={{ border: "1px solid #202020", color: "rgba(255,255,255,.5)", padding: "5px 9px", fontSize: 8, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".13em" }}>No promoter-reported claims</span>
        </div>
        <p style={{ maxWidth: 760, color: "rgba(255,255,255,.48)", fontSize: 11, lineHeight: 1.7, margin: "0 0 24px" }}>
          {touringLab?.methodology ?? touringLab?.message ?? "Estamos construyendo un historial automatizado de cambios públicos. Todavía no existe evidencia autorizada suficiente para estimar demanda, inventario, boletos vendidos, sell-through o gross."}
        </p>
        {showFallbackTourCards && (
          <div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
              <div>
                <div style={{ color: "#fff", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em" }}>Giras destacadas y próximas</div>
                <div style={{ color: "rgba(255,255,255,.42)", fontSize: 10, lineHeight: 1.5, marginTop: 5, maxWidth: 640 }}>
                  Selección que combina relevancia de artistas de Mexico Charts con fechas próximas confirmadas por Ticketmaster; no es un ranking de popularidad ni una estimación de inventario.
                </div>
              </div>
              <div style={{ color: "rgba(255,255,255,.35)", fontSize: 9, textTransform: "uppercase", letterSpacing: ".1em" }}>Vista de lanzamiento · sin snapshots históricos</div>
            </div>
            <div className="th-launch-grid">
              {fallbackTourCards.map(({ artist, events, nextEvent, featured }, index) => {
                const price = publicPrice(nextEvent);
                const isToday = nextEvent.date === new Date().toISOString().slice(0, 10);
                return (
                  <article key={artist.id} className="th-launch-card">
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div>
                        <div style={{ color: "#39FF14", fontSize: 8, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".16em", marginBottom: 8 }}>
                          {featured ? "Destacada" : isToday ? "En vivo hoy" : "Próxima"}
                        </div>
                        <h3 className="th-anton" style={{ color: "#fff", fontSize: 22, textTransform: "uppercase", margin: 0, lineHeight: 1.05 }}>{artist.name}</h3>
                      </div>
                      <span style={{ color: "rgba(57,255,20,.7)", fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{String(index + 1).padStart(2, "0")}</span>
                    </div>
                    <div className="th-launch-facts">
                      <div className="th-launch-fact">
                        <strong style={{ display: "block", color: "#fff", fontSize: 18 }}>{events.length}</strong>
                        <span style={{ color: "rgba(255,255,255,.38)", fontSize: 8, textTransform: "uppercase", letterSpacing: ".1em" }}>Conciertos listados</span>
                      </div>
                      <div className="th-launch-fact">
                        <strong style={{ display: "block", color: "#fff", fontSize: 12 }}>{formatDate(nextEvent.date)}</strong>
                        <span style={{ color: "rgba(255,255,255,.38)", fontSize: 8, textTransform: "uppercase", letterSpacing: ".1em" }}>Siguiente fecha</span>
                      </div>
                    </div>
                    <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", marginTop: 16, paddingTop: 14, display: "grid", gap: 7 }}>
                      <div style={{ color: "rgba(255,255,255,.7)", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {nextEvent.city} · {nextEvent.venue}
                      </div>
                      <div style={{ color: "rgba(255,255,255,.52)", fontSize: 9 }}>
                        {publicSaleStatus(nextEvent)}{price ? ` · ${price}` : ""}
                      </div>
                    </div>
                    <a href={nextEvent.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", marginTop: 15, color: "#39FF14", fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".14em" }}>
                      Ver evento oficial →
                    </a>
                  </article>
                );
              })}
            </div>
          </div>
        )}
        {touringLab?.available && touringLab.tours.length > 0 && (
          <div className="th-lab-grid">
            {touringLab.tours.map(tour => (
              <article key={tour.artistId} className="th-lab-card">
                <div style={{ color: "#39FF14", fontSize: 8, fontWeight: 900, textTransform: "uppercase", letterSpacing: ".18em", marginBottom: 10 }}>{tour.status === "active" ? "En gira" : tour.status === "upcoming" ? "Próxima" : tour.status === "completed" ? "Finalizada" : "Estado desconocido"}</div>
                <h3 className="th-anton" style={{ color: "#fff", fontSize: 22, textTransform: "uppercase", margin: "0 0 5px" }}>{tour.artistName}</h3>
                <div style={{ color: "rgba(255,255,255,.42)", fontSize: 10, lineHeight: 1.5, minHeight: 30 }}>{tour.tourName}</div>
                <div style={{ display: "flex", gap: 22, marginTop: 18 }}>
                  <div><strong style={{ display: "block", color: "#fff", fontSize: 18 }}>{tour.concertCount}</strong><span style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: ".12em" }}>Shows observados</span></div>
                  <div><strong style={{ display: "block", color: "#fff", fontSize: 12 }}>{tour.nextConcertDate ? formatDate(tour.nextConcertDate) : "—"}</strong><span style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: ".12em" }}>Próxima fecha</span></div>
                </div>
              </article>
            ))}
          </div>
        )}
        <div style={{ color: "rgba(255,255,255,.3)", fontSize: 8, lineHeight: 1.7, textTransform: "uppercase", letterSpacing: ".11em", marginTop: 20 }}>
          Fuente: {touringLab?.source ?? "Ticketmaster Discovery API"} · Agenda consultada: {touringFreshness}. Metadatos públicos y enlaces oficiales; un seat map estático no representa disponibilidad en vivo. Ofertas primary, resale, VIP y bloqueadas se mantienen separadas cuando la fuente las identifica. Historial: collecting hasta contar con snapshots.
        </div>
      </section>

      {/* ── NEWSLETTER ── */}
      <section className="th-newsletter" style={{ padding: "36px 32px", background: "#060606", borderTop: "1px solid #111", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 32 }}>
        <div>
          <div style={{ color: "rgba(255,255,255,0.52)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.34em", marginBottom: 8 }}>Alertas de Touring</div>
          <div style={{ color: "#e0e0e0", fontWeight: 700, fontSize: 15, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>Sé el Primero en Saber</div>
          <div style={{ color: "#444", fontSize: 11, lineHeight: 1.5 }}>Recibe alertas de nuevos tours y reportes exclusivos</div>
        </div>
        <div style={{ maxWidth: 400, flex: 1 }}>
          <form className="th-newsletter-form" onSubmit={submitNewsletter} style={{ display: "flex", gap: 0 }}>
            <input
              type="email"
              required
              value={newsletterEmail}
              onChange={(event) => setNewsletterEmail(event.target.value)}
              placeholder="Tu correo electrónico"
              className="th-newsletter-input"
              aria-label="Correo para alertas de touring"
            />
            <button type="submit" className="th-subscribe-btn" disabled={newsletterStatus === "loading"}>
              {newsletterStatus === "loading" ? "Guardando" : "Suscribirme"}
            </button>
          </form>
          {newsletterStatus === "success" && (
            <div style={{ color: "#39FF14", fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.18em", marginTop: 10 }}>
              Listo, ya quedaste en la lista
            </div>
          )}
          {newsletterStatus === "error" && (
            <div style={{ color: "#f87171", fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.18em", marginTop: 10 }}>
              No se pudo guardar, intenta otra vez
            </div>
          )}
        </div>
      </section>

      <footer className="th-footer" style={{ padding: "18px 32px", borderTop: "1px solid #0f0f0f", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ color: "#555", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em" }}>© 2026 Mexico Charts</div>
        <div style={{ color: "rgba(57,255,20,0.5)", fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.28em" }}>El Movimiento No Para</div>
      </footer>
    </div>
  );
}
