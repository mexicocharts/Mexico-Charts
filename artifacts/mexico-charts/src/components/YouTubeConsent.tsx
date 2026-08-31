import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useLanguage } from "@/i18n/LanguageContext";

const STORAGE_KEY = "mc_youtube_policy_ack";
const POLICY_VERSION = "2026-08-30";
type Choice = "accepted" | "declined" | null;

type ConsentContextValue = {
  choice: Choice;
  youtubeEnabled: boolean;
  reviewChoice: () => void;
};

const ConsentContext = createContext<ConsentContextValue>({ choice: null, youtubeEnabled: false, reviewChoice: () => undefined });

function readChoice(): Choice {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as { version?: string; choice?: Choice } | null;
    return value?.version === POLICY_VERSION && (value.choice === "accepted" || value.choice === "declined") ? value.choice : null;
  } catch {
    return null;
  }
}

export function YouTubeConsentProvider({ children }: { children: ReactNode }) {
  const [choice, setChoice] = useState<Choice>(() => readChoice());
  const [reviewing, setReviewing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const open = choice === null || reviewing;
  const { pick } = useLanguage();

  useEffect(() => {
    document.documentElement.dataset.youtubeConsent = choice ?? "unset";
  }, [choice]);

  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector<HTMLElement>("a,button");
    first?.focus();
  }, [open]);

  const save = (next: Exclude<Choice, null>) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: POLICY_VERSION, choice: next }));
    setChoice(next);
    setReviewing(false);
  };

  const value = useMemo(() => ({ choice, youtubeEnabled: choice === "accepted", reviewChoice: () => setReviewing(true) }), [choice]);

  return (
    <ConsentContext.Provider value={value}>
      {children}
      {open ? (
        <div className="fixed inset-x-0 bottom-0 z-[100] p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:p-5" role="presentation">
          <div ref={panelRef} role="dialog" aria-modal="true" aria-labelledby="youtube-consent-title" className="mx-auto max-w-3xl rounded-2xl border border-white/15 bg-[#101010]/[.98] p-5 text-white shadow-2xl backdrop-blur-xl sm:p-6">
            <h2 id="youtube-consent-title" className="text-base font-black text-white">{pick("YouTube en Mexico Charts", "YouTube on Mexico Charts")}</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-zinc-400">
              {pick(
                "Usamos servicios de la API de YouTube para mostrar datos públicos de canales y videos. Para activar estas funciones, acepta nuestra Política de Privacidad y nuestros Términos, que incorporan los Términos de Servicio de YouTube.",
                "Mexico Charts uses YouTube API Services to display public channel and video data. To enable these features, accept our Privacy Policy and Terms, which incorporate the YouTube Terms of Service.",
              )}
            </p>
            <nav aria-label={pick("Enlaces de privacidad y términos", "Privacy and terms links")} className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-bold text-zinc-400">
              <Link href="/privacidad" className="hover:text-white">{pick("Privacidad", "Privacy")}</Link>
              <Link href="/terminos" className="hover:text-white">{pick("Términos", "Terms")}</Link>
              <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer" className="hover:text-white">{pick("Términos de YouTube", "YouTube Terms")}</a>
              <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="hover:text-white">{pick("Privacidad de Google", "Google Privacy")}</a>
            </nav>
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => save("declined")} className="min-h-11 rounded-full border border-white/15 px-5 text-xs font-black text-zinc-300 hover:border-white/30 hover:text-white">
                {pick("Continuar sin YouTube", "Continue without YouTube")}
              </button>
              <button type="button" onClick={() => save("accepted")} className="min-h-11 rounded-full bg-[#39FF14] px-5 text-xs font-black text-black hover:bg-[#6aff4e]">
                {pick("Aceptar y continuar", "Accept and continue")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConsentContext.Provider>
  );
}

export function useYouTubeConsent() {
  return useContext(ConsentContext);
}

export function YouTubeConsentGate({ children }: { children: ReactNode }) {
  const { youtubeEnabled, reviewChoice } = useYouTubeConsent();
  const { pick } = useLanguage();
  if (youtubeEnabled) return <>{children}</>;
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[.025] p-5 text-center" data-youtube-disabled>
      <p className="text-sm font-medium text-zinc-500">{pick("Las funciones de YouTube están desactivadas.", "YouTube features are disabled.")}</p>
      <button type="button" onClick={reviewChoice} className="mt-3 rounded-full border border-[#39FF14]/40 px-4 py-2 text-xs font-black text-[#39FF14]">
        {pick("Activar funciones de YouTube", "Enable YouTube features")}
      </button>
    </div>
  );
}

export function YouTubeSourceLabel({ observedAt }: { observedAt?: string | null }) {
  const { pick } = useLanguage();
  return <p className="mt-1 text-[10px] font-bold text-zinc-600">{pick("Fuente: YouTube Data API", "Source: YouTube Data API")}{observedAt ? ` · ${pick("observación guardada", "saved observation")} ${observedAt}` : ""}</p>;
}

export function MexicoChartsCalculationLabel({ windowLabel }: { windowLabel?: string }) {
  const { pick } = useLanguage();
  return <p className="mt-1 text-[10px] font-bold text-zinc-600">{pick("Cálculo de Mexico Charts", "Mexico Charts calculation")}{windowLabel ? ` · ${windowLabel}` : ""}</p>;
}

export function YouTubeMixedLegend() {
  const { pick } = useLanguage();
  return <p className="text-[10px] font-medium leading-5 text-zinc-600">{pick("Totales: YouTube Data API. Cambios y comparaciones: cálculos de Mexico Charts a partir de observaciones guardadas.", "Totals: YouTube Data API. Changes and comparisons: Mexico Charts calculations from saved observations.")}</p>;
}
