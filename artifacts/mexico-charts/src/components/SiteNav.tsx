import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ChevronDown, Menu, X } from "lucide-react";

const logoUrl = `${import.meta.env.BASE_URL}mexico-charts-logo.png`;
const G = "#39FF14";

const INDUSTRIA_ITEMS = [
  { label: "Industria", href: "/industria", description: "Mercado, reportes y contexto" },
  { label: "Certificaciones", href: "/industry/certifications", description: "Oro, Platino y Diamante" },
  { label: "Música Grabada", href: "/insights/mexico-top-10-ifpi-2026", description: "IFPI y crecimiento global" },
];

const NAV = [
  { label: "INICIO",       href: "/" },
  { label: "ARTISTAS",     href: "/artists" },
  { label: "MX100",        href: "/mx100" },
  { label: "LISTAS",       href: "/charts" },
  { label: "GÉNEROS",      href: "/generos" },
  { label: "INDUSTRIA",    href: "/industria", dropdown: INDUSTRIA_ITEMS },
  { label: "GIRAS",        href: "/touring" },
];

type Props = {
  /** Pass true to show "INICIO" pill as green (HomeV6 style) */
  homeActive?: boolean;
};

export default function SiteNav({ homeActive = false }: Props) {
  const [location] = useLocation();
  const [dropOpen, setDropOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileIndustryOpen, setMobileIndustryOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location]);

  function openDrop() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setDropOpen(true);
  }
  function closeDrop() {
    closeTimer.current = setTimeout(() => setDropOpen(false), 120);
  }

  const industryActive = location.startsWith("/industria") || location.startsWith("/industry");
  const isActive = (href: string, label: string) => {
    if (homeActive) return label === "INICIO";
    if (href === "/") return location === "/";
    if (href === "/artists") return location === "/artists" || location.startsWith("/artist/");
    if (href === "/charts") return location === "/charts";
    if (href === "/touring") return location === "/touring" || location.startsWith("/touring/");
    if (href === "/industria") return industryActive || location.startsWith("/insights/");
    return location === href || location.startsWith(href + "/");
  };

  return (
    <header className="sticky top-0 z-50"
      style={{ background: "rgba(8,8,8,0.97)", backdropFilter: "blur(18px)", borderBottom: "1px solid rgba(255,255,255,0.055)" }}>
      <div className="flex items-center justify-between px-6 lg:px-10 h-14">
        <Link href="/"><img src={logoUrl} alt="Mexico Charts" className="h-10 object-contain cursor-pointer" style={{ filter: "drop-shadow(0 0 6px rgba(57,255,20,0.25))" }} /></Link>

        <nav className="hidden lg:flex items-center gap-7">
          {NAV.map(item => {
            if (item.dropdown) {
              return (
                <div key={item.label} className="relative"
                  onMouseEnter={openDrop} onMouseLeave={closeDrop}>
                  <button
                    type="button"
                    className="relative flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.2em] cursor-pointer transition-colors"
                    aria-expanded={dropOpen}
                    aria-haspopup="true"
                    aria-label="Abrir menú de industria"
                    style={{ color: industryActive ? G : "rgba(255,255,255,0.42)", background: "none", border: "none" }}>
                    {item.label}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                    {industryActive && (
                      <span className="absolute -bottom-[20px] left-0 right-0 h-[2px] rounded-full" style={{ background: G }} />
                    )}
                  </button>

                  {dropOpen && (
                    <div className="absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-[360px] rounded-xl overflow-hidden p-3"
                      style={{ background: "linear-gradient(145deg, #090909 0%, #050505 100%)", border: "1px solid rgba(57,255,20,0.14)", boxShadow: "0 18px 48px rgba(0,0,0,0.72), inset 0 1px 0 rgba(57,255,20,0.08)" }}>
                      <div className="mb-2 flex items-center justify-between px-2">
                        <span className="text-[9px] font-black uppercase tracking-[0.26em]" style={{ color: "rgba(57,255,20,0.8)" }}>
                          Industria
                        </span>
                        <span className="h-px flex-1 ml-3" style={{ background: "linear-gradient(to right, rgba(57,255,20,0.18), transparent)" }} />
                      </div>
                      {item.dropdown.map(sub => {
                        const subActive = location === sub.href || location.startsWith(sub.href + "/") || (sub.href === "/industria" && location.startsWith("/insights/"));
                        return (
                          <Link key={sub.href} href={sub.href}>
                            <span className="mb-1 flex items-center justify-between gap-3 rounded-lg px-3 py-3 transition-colors cursor-pointer"
                              style={{
                                color: subActive ? G : "rgba(255,255,255,0.72)",
                                background: subActive ? "rgba(57,255,20,0.08)" : "rgba(255,255,255,0.018)",
                                border: subActive ? "1px solid rgba(57,255,20,0.22)" : "1px solid rgba(255,255,255,0.04)",
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = subActive ? "rgba(57,255,20,0.1)" : "rgba(255,255,255,0.045)"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = subActive ? "rgba(57,255,20,0.08)" : "rgba(255,255,255,0.018)"; }}>
                              <span>
                                <span className="block text-[11px] font-black uppercase tracking-[0.16em]">{sub.label}</span>
                                <span className="mt-1 block text-[10px] font-medium normal-case tracking-normal" style={{ color: "rgba(255,255,255,0.38)" }}>{sub.description}</span>
                              </span>
                              <span className="text-[13px]" style={{ color: subActive ? G : "rgba(255,255,255,0.24)" }}>→</span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const active = isActive(item.href, item.label);

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
          <div className="hidden lg:flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.55)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: G }} />En vivo
          </div>
          <div className="hidden lg:flex w-8 h-8 rounded-full items-center justify-center text-[10px] font-black"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }}>MX</div>

          {/* Hamburger — visible below lg */}
          <button
            type="button"
            className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Menú"
            aria-expanded={mobileOpen}
            aria-controls="site-mobile-nav"
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t" style={{ background: "linear-gradient(180deg, rgba(5,5,5,0.99) 0%, rgba(2,2,2,0.99) 100%)", borderColor: "rgba(255,255,255,0.07)" }}>
          <nav id="site-mobile-nav" className="px-7 py-7">
            <div className="mb-7 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-[0.32em]" style={{ color: "rgba(57,255,20,0.86)" }}>
                Explorar
              </span>
              <span className="h-px flex-1 ml-4" style={{ background: "linear-gradient(to right, rgba(57,255,20,0.22), transparent)" }} />
            </div>

            <div>
              {NAV.map(item => {
                if (item.dropdown) {
                  return (
                    <div key={item.label}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between border-b py-4 text-left text-[13px] font-black uppercase tracking-[0.24em]"
                        aria-expanded={mobileIndustryOpen}
                        aria-controls="site-mobile-industria"
                        onClick={() => setMobileIndustryOpen(open => !open)}
                        style={{
                          color: industryActive ? G : "rgba(255,255,255,0.64)",
                          borderColor: "rgba(255,255,255,0.06)",
                          background: "transparent",
                        }}
                      >
                        <span>{item.label}</span>
                        <ChevronDown
                          className="h-3.5 w-3.5 transition-transform"
                          style={{
                            color: industryActive ? G : "rgba(255,255,255,0.24)",
                            transform: mobileIndustryOpen ? "rotate(180deg)" : "rotate(0deg)",
                          }}
                        />
                      </button>

                      {mobileIndustryOpen && (
                        <div id="site-mobile-industria" className="border-b py-2 pl-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                          {item.dropdown.map(sub => {
                            const subActive = location === sub.href || location.startsWith(sub.href + "/") || (sub.href === "/industria" && location.startsWith("/insights/"));
                            return (
                              <Link key={sub.href} href={sub.href}>
                                <span className="flex items-center justify-between py-3 text-[12px] font-black uppercase tracking-[0.2em]"
                                  style={{ color: subActive ? G : "rgba(255,255,255,0.48)" }}>
                                  <span>{sub.label}</span>
                                  <span style={{ color: subActive ? G : "rgba(255,255,255,0.18)" }}>→</span>
                                </span>
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                }

                const active = isActive(item.href, item.label);
                return (
                  <Link key={item.label} href={item.href}>
                    <span className="group flex items-center justify-between border-b py-4 text-[13px] font-black uppercase tracking-[0.24em]"
                      style={{
                        color: active ? G : "rgba(255,255,255,0.64)",
                        borderColor: "rgba(255,255,255,0.06)",
                      }}>
                      <span>{item.label}</span>
                      <span className="text-[12px]" style={{ color: active ? G : "rgba(255,255,255,0.2)" }}>→</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
