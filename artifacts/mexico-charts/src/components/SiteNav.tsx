import { useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { ChevronDown } from "lucide-react";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;
const G = "#39FF14";

const INDUSTRIA_ITEMS = [
  { label: "Industria",      href: "/industria" },
  { label: "Certificaciones", href: "/industry/certifications" },
  { label: "Música Grabada", href: "/insights/mexico-top-10-ifpi-2026" },
];

const NAV = [
  { label: "INICIO",       href: "/" },
  { label: "ARTISTAS",     href: "/artists" },
  { label: "CHARTS",       href: "#" },
  { label: "GÉNEROS",      href: "#" },
  { label: "INDUSTRIA",    href: "/industria", dropdown: INDUSTRIA_ITEMS },
  { label: "TOURING",      href: "#" },
];

type Props = {
  /** Pass true to show "INICIO" pill as green (HomeV6 style) */
  homeActive?: boolean;
};

export default function SiteNav({ homeActive = false }: Props) {
  const [location] = useLocation();
  const [dropOpen, setDropOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openDrop() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setDropOpen(true);
  }
  function closeDrop() {
    closeTimer.current = setTimeout(() => setDropOpen(false), 120);
  }

  const industryActive = location.startsWith("/industria") || location.startsWith("/industry");

  return (
    <header className="sticky top-0 z-50"
      style={{ background: "rgba(8,8,8,0.97)", backdropFilter: "blur(18px)", borderBottom: "1px solid rgba(255,255,255,0.055)" }}>
      <div className="flex items-center justify-between px-6 lg:px-10 h-14">
        <Link href="/"><img src={logoUrl} alt="Mexico Charts" className="h-8 object-contain opacity-90 cursor-pointer" /></Link>

        <nav className="hidden lg:flex items-center gap-7">
          {NAV.map(item => {
            if (item.dropdown) {
              return (
                <div key={item.label} className="relative"
                  onMouseEnter={openDrop} onMouseLeave={closeDrop}>
                  <button
                    className="relative flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.2em] cursor-pointer transition-colors"
                    style={{ color: industryActive ? G : "rgba(255,255,255,0.42)", background: "none", border: "none" }}>
                    {item.label}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                    {industryActive && (
                      <span className="absolute -bottom-[20px] left-0 right-0 h-[2px] rounded-full" style={{ background: G }} />
                    )}
                  </button>

                  {dropOpen && (
                    <div className="absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-44 rounded-xl overflow-hidden py-1"
                      style={{ background: "#111", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 8px 32px rgba(0,0,0,0.6)" }}>
                      {item.dropdown.map(sub => {
                        const subActive = location === sub.href || location.startsWith(sub.href + "/");
                        return (
                          <Link key={sub.href} href={sub.href}>
                            <span className="block px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.16em] transition-colors cursor-pointer"
                              style={{ color: subActive ? G : "rgba(255,255,255,0.55)" }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#fff"; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = subActive ? G : "rgba(255,255,255,0.55)"; (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                              {subActive && <span style={{ color: G }}>› </span>}{sub.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const active = homeActive
              ? item.label === "INICIO"
              : location === item.href && item.href !== "#";

            return (
              <Link key={item.label} href={item.href}>
                <span className="relative text-[11px] font-black uppercase tracking-[0.2em] cursor-pointer transition-colors"
                  style={{ color: active ? G : "rgba(255,255,255,0.42)" }}>
                  {item.label}
                  {active && <span className="absolute -bottom-[18px] left-0 right-0 h-[2px] rounded-full" style={{ background: G }} />}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="hidden lg:flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.28)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: G }} />En vivo
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }}>MX</div>
        </div>
      </div>
    </header>
  );
}
