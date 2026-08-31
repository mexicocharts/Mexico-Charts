import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { ChevronDown, Languages, Menu, X } from "lucide-react";
import SiteSearch from "@/components/SiteSearch";
import { useLanguage, type SiteLanguage } from "@/i18n/LanguageContext";
import AccountControl from "@/components/AccountControl";
import BrandLogo from "@/components/BrandLogo";

const G = "#39FF14";

const ARTISTAS_ITEMS = [
  { es: "Directorio", en: "Directory", href: "/artists", descriptionEs: "Roster completo con filtros", descriptionEn: "Complete roster with filters" },
  { es: "Comparar artistas", en: "Compare artists", href: "/compare", descriptionEs: "Dos perfiles, señales lado a lado", descriptionEn: "Two profiles, side by side" },
  { es: "Monitorear artista", en: "Monitor an artist", href: "/monitoreo", descriptionEs: "Desde $6 USD al mes", descriptionEn: "From $6 USD per month" },
];

const CHARTS_ITEMS = [
  { es: "Todas las listas", en: "All charts", href: "/charts", descriptionEs: "Spotify, YouTube, Apple Music y Deezer", descriptionEn: "Spotify, YouTube, Apple Music and Deezer" },
  { es: "Esta semana", en: "This week", href: "/esta-semana", descriptionEs: "Los mexicanos destacados por plataforma", descriptionEn: "Mexican highlights by platform" },
];

const INDUSTRIA_ITEMS = [
  { es: "Industria", en: "Industry", href: "/industria", descriptionEs: "Mercado, reportes y contexto", descriptionEn: "Market, reports and context" },
  { es: "Certificaciones", en: "Certifications", href: "/industry/certifications", descriptionEs: "Oro, Platino y Diamante", descriptionEn: "Gold, Platinum and Diamond" },
  { es: "Música Grabada", en: "Recorded Music", href: "/insights/mexico-top-10-ifpi-2026", descriptionEs: "IFPI y crecimiento global", descriptionEn: "IFPI and global growth" },
];

const NAV = [
  { es: "INICIO",    en: "HOME",    href: "/" },
  { es: "ARTISTAS",  en: "ARTISTS", href: "/artists", dropdown: ARTISTAS_ITEMS },
  { es: "MX100",     en: "MX100",   href: "/mx100" },
  { es: "LISTAS",    en: "CHARTS",  href: "/charts", dropdown: CHARTS_ITEMS },
  { es: "GÉNEROS",   en: "GENRES",  href: "/generos" },
  { es: "INDUSTRIA", en: "INDUSTRY", href: "/industria", dropdown: INDUSTRIA_ITEMS },
  { es: "GIRAS",     en: "TOURING", href: "/touring" },
];

type Props = {
  /** Pass true to show "INICIO" pill as green (HomeV6 style) */
  homeActive?: boolean;
  /** Lightweight pages can omit the data-backed global search mount. */
  showSearch?: boolean;
};

export default function SiteNav({ homeActive = false, showSearch = true }: Props) {
  const { language, setLanguage, pick } = useLanguage();
  const [location] = useLocation();
  const [dropOpen, setDropOpen] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [location]);

  function openDrop(label: string) {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setDropOpen(label);
  }
  function closeDrop() {
    closeTimer.current = setTimeout(() => setDropOpen(null), 120);
  }

  const industryActive = location.startsWith("/industria") || location.startsWith("/industry");
  const isActive = (href: string) => {
    if (homeActive) return href === "/";
    if (href === "/") return location === "/";
    if (href === "/artists") return location === "/artists" || location.startsWith("/artist/") || location === "/compare" || location.startsWith("/monitoreo");
    if (href === "/charts") return location === "/charts" || location === "/esta-semana";
    if (href === "/touring") return location === "/touring" || location.startsWith("/touring/");
    if (href === "/industria") return industryActive || location.startsWith("/insights/");
    return location === href || location.startsWith(href + "/");
  };

  const languageButton = (value: SiteLanguage) => (
    <button
      type="button"
      onClick={() => setLanguage(value)}
      aria-pressed={language === value}
      className="rounded-md px-2 py-1 text-[9px] font-black uppercase tracking-[0.12em] transition-colors"
      style={{
        color: language === value ? "#050505" : "rgba(255,255,255,0.42)",
        background: language === value ? G : "transparent",
      }}
    >
      {value.toUpperCase()}
    </button>
  );

  return (
    <header className="sticky top-0 z-50"
      style={{ background: "rgba(8,8,8,0.97)", backdropFilter: "blur(18px)", borderBottom: "1px solid rgba(255,255,255,0.055)" }}>
      <div className="flex items-center justify-between px-6 lg:px-8 xl:px-10 h-14">
        <Link href="/"><BrandLogo size={40} loading="eager" fetchPriority="high" className="h-10 w-10 object-contain cursor-pointer" style={{ filter: "drop-shadow(0 0 6px rgba(57,255,20,0.25))" }} /></Link>

        <nav className="hidden lg:flex items-center gap-5 xl:gap-7">
          {NAV.map(item => {
            const label = pick(item.es, item.en);
            if (item.dropdown) {
              const dropdownActive = isActive(item.href);
              const dropdownId = `desktop-nav-${item.es.toLowerCase()}`;
              return (
                <div key={item.es} className="relative"
                  onMouseEnter={() => openDrop(item.es)} onMouseLeave={closeDrop}>
                  <button
                    type="button"
                    className="relative flex items-center gap-1 text-[11px] font-black uppercase tracking-[0.2em] cursor-pointer transition-colors"
                    aria-expanded={dropOpen === item.es}
                    aria-haspopup="true"
                    aria-controls={dropdownId}
                    aria-label={pick(`Abrir menú de ${item.es.toLowerCase()}`, `Open ${item.en.toLowerCase()} menu`)}
                    style={{ color: dropdownActive ? G : "rgba(255,255,255,0.42)", background: "none", border: "none" }}>
                    {label}
                    <ChevronDown className="w-3 h-3 opacity-60" />
                    {dropdownActive && (
                      <span className="absolute -bottom-[20px] left-0 right-0 h-[2px] rounded-full" style={{ background: G }} />
                    )}
                  </button>

                  {dropOpen === item.es && (
                    <div id={dropdownId} className="absolute top-[calc(100%+10px)] left-1/2 -translate-x-1/2 w-[360px] rounded-xl overflow-hidden p-3"
                      style={{ background: "linear-gradient(145deg, #090909 0%, #050505 100%)", border: "1px solid rgba(57,255,20,0.14)", boxShadow: "0 18px 48px rgba(0,0,0,0.72), inset 0 1px 0 rgba(57,255,20,0.08)" }}>
                      <div className="mb-2 flex items-center justify-between px-2">
                        <span className="text-[9px] font-black uppercase tracking-[0.26em]" style={{ color: "rgba(57,255,20,0.8)" }}>
                          {label}
                        </span>
                        <span className="h-px flex-1 ml-3" style={{ background: "linear-gradient(to right, rgba(57,255,20,0.18), transparent)" }} />
                      </div>
                      {item.dropdown.map(sub => {
                        const subLabel = pick(sub.es, sub.en);
                        const subDescription = pick(sub.descriptionEs, sub.descriptionEn);
                        const subActive = location === sub.href || location.startsWith(sub.href + "/") || (sub.href === "/industria" && location.startsWith("/insights/"));
                        return (
                          <Link key={sub.href} href={sub.href} aria-current={subActive ? "page" : undefined}>
                            <span className="mb-1 flex items-center justify-between gap-3 rounded-lg px-3 py-3 transition-colors cursor-pointer"
                              style={{
                                color: subActive ? G : "rgba(255,255,255,0.72)",
                                background: subActive ? "rgba(57,255,20,0.08)" : "rgba(255,255,255,0.018)",
                                border: subActive ? "1px solid rgba(57,255,20,0.22)" : "1px solid rgba(255,255,255,0.04)",
                              }}
                              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = subActive ? "rgba(57,255,20,0.1)" : "rgba(255,255,255,0.045)"; }}
                              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = subActive ? "rgba(57,255,20,0.08)" : "rgba(255,255,255,0.018)"; }}>
                              <span>
                                <span className="block text-[11px] font-black uppercase tracking-[0.16em]">{subLabel}</span>
                                <span className="mt-1 block text-[10px] font-medium normal-case tracking-normal" style={{ color: "rgba(255,255,255,0.38)" }}>{subDescription}</span>
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

            const active = isActive(item.href);

            return (
              <Link key={item.es} href={item.href} aria-current={active ? "page" : undefined}>
                <span className="relative text-[11px] font-black uppercase tracking-[0.2em] cursor-pointer transition-colors"
                  style={{ color: active ? G : "rgba(255,255,255,0.42)" }}>
                  {label}
                  {active && <span className="absolute -bottom-[18px] left-0 right-0 h-[2px] rounded-full" style={{ background: G }} />}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-5 flex shrink-0 items-center gap-3 xl:ml-7">
          {showSearch && <SiteSearch />}
          <div className="hidden lg:block"><AccountControl /></div>
          <div className="hidden items-center gap-0.5 rounded-lg p-0.5 lg:flex" aria-label={pick("Idioma del sitio", "Site language")}
            style={{ background: "rgba(255,255,255,0.045)", border: "1px solid rgba(255,255,255,0.09)" }}>
            {languageButton("es")}
            {languageButton("en")}
          </div>
          <div className="hidden lg:flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.55)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: G }} />{pick("En vivo", "Live")}
          </div>

          {/* Hamburger — visible below lg */}
          <button
            type="button"
            className="lg:hidden flex items-center justify-center w-9 h-9 rounded-lg"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}
            onClick={() => setMobileOpen(o => !o)}
            aria-label={pick("Menú", "Menu")}
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
                {pick("Explorar", "Explore")}
              </span>
              <span className="h-px flex-1 ml-4" style={{ background: "linear-gradient(to right, rgba(57,255,20,0.22), transparent)" }} />
            </div>

            <div>
              {NAV.map(item => {
                const label = pick(item.es, item.en);
                if (item.dropdown) {
                  const dropdownActive = isActive(item.href);
                  const mobileItemOpen = mobileDropdownOpen === item.es;
                  const mobilePanelId = `site-mobile-${item.es.toLowerCase()}`;
                  return (
                    <div key={item.es}>
                      <button
                        type="button"
                        className="flex w-full items-center justify-between border-b py-4 text-left text-[13px] font-black uppercase tracking-[0.24em]"
                        aria-expanded={mobileItemOpen}
                        aria-controls={mobilePanelId}
                        aria-label={pick(`${mobileItemOpen ? "Cerrar" : "Abrir"} sección ${item.es.toLowerCase()}`, `${mobileItemOpen ? "Close" : "Open"} ${item.en.toLowerCase()} section`)}
                        onClick={() => setMobileDropdownOpen(open => open === item.es ? null : item.es)}
                        style={{
                          color: dropdownActive ? G : "rgba(255,255,255,0.64)",
                          borderColor: "rgba(255,255,255,0.06)",
                          background: "transparent",
                        }}
                      >
                        <span>{label}</span>
                        <ChevronDown
                          className="h-3.5 w-3.5 transition-transform"
                          style={{
                            color: dropdownActive ? G : "rgba(255,255,255,0.24)",
                            transform: mobileItemOpen ? "rotate(180deg)" : "rotate(0deg)",
                          }}
                        />
                      </button>

                      {mobileItemOpen && (
                        <div id={mobilePanelId} className="border-b py-2 pl-4" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                          {item.dropdown.map(sub => {
                            const subLabel = pick(sub.es, sub.en);
                            const subActive = location === sub.href || location.startsWith(sub.href + "/") || (sub.href === "/industria" && location.startsWith("/insights/"));
                            return (
                              <Link key={sub.href} href={sub.href} aria-current={subActive ? "page" : undefined}>
                                <span className="flex items-center justify-between py-3 text-[12px] font-black uppercase tracking-[0.2em]"
                                  style={{ color: subActive ? G : "rgba(255,255,255,0.48)" }}>
                                  <span>{subLabel}</span>
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

                const active = isActive(item.href);
                return (
                  <Link key={item.es} href={item.href} aria-current={active ? "page" : undefined}>
                    <span className="group flex items-center justify-between border-b py-4 text-[13px] font-black uppercase tracking-[0.24em]"
                      style={{
                        color: active ? G : "rgba(255,255,255,0.64)",
                        borderColor: "rgba(255,255,255,0.06)",
                      }}>
                      <span>{label}</span>
                      <span className="text-[12px]" style={{ color: active ? G : "rgba(255,255,255,0.2)" }}>→</span>
                    </span>
                  </Link>
                );
              })}
            </div>

            <div className="mt-7 flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: "rgba(255,255,255,0.028)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                <Languages className="h-3.5 w-3.5" />{pick("Idioma", "Language")}
              </span>
              <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: "rgba(255,255,255,0.045)" }}>
                {languageButton("es")}
                {languageButton("en")}
              </div>
            </div>
            <div className="mt-3 border-t border-white/[0.06]"><AccountControl mobile /></div>
          </nav>
        </div>
      )}
    </header>
  );
}
