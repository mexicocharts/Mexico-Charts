import type { ReactNode } from "react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useYouTubeConsent } from "@/components/YouTubeConsent";

const G = "#39FF14";

type EditorialHeroProps = {
  title: ReactNode;
  description: ReactNode;
  aside?: ReactNode;
  compact?: boolean;
};

export function EditorialHero({ title, description, aside, compact = false }: EditorialHeroProps) {
  return (
    <section data-editorial-hero className={aside ? "grid gap-10 2xl:grid-cols-[minmax(0,1fr)_350px] 2xl:items-center" : undefined}>
      <div className="min-w-0">
        <div className="mb-4 flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: G }}>Mexico Charts</span>
          <span className="h-px w-10" style={{ background: "rgba(57,255,20,0.25)" }} />
        </div>
        <h1
          className={`${compact ? "max-w-full" : aside ? "max-w-[10ch]" : "max-w-[12ch]"} text-balance break-normal font-black uppercase tracking-[-0.035em]`}
          style={{
            fontSize: aside
              ? "clamp(1.65rem, 6vw, 4rem)"
              : compact
                ? "clamp(1.2rem, 5.1vw, 4.25rem)"
                : "clamp(1.65rem, 7vw, 4.75rem)",
            lineHeight: 0.88,
            overflowWrap: compact ? "normal" : "anywhere",
            wordBreak: "normal",
          }}
        >
          {title}
        </h1>
        <p className="mt-6 max-w-2xl text-base font-medium leading-7 sm:text-xl sm:leading-8" style={{ color: "rgba(255,255,255,0.50)" }}>
          {description}
        </p>
      </div>
      {aside ? <div className="min-w-0" data-editorial-aside>{aside}</div> : null}
    </section>
  );
}

export function EditorialFooter() {
  const { pick } = useLanguage();
  const { reviewChoice } = useYouTubeConsent();
  return (
    <footer className="border-t px-6 py-8 text-center lg:px-10" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
        {pick(
          "Mexico Charts © 2026 — Plataforma independiente de datos, cultura e impacto de la música mexicana",
          "Mexico Charts © 2026 — Independent platform for Mexican music data, culture and impact",
        )}
      </p>
      <button type="button" onClick={reviewChoice} className="mt-3 text-[10px] font-bold text-zinc-500 underline decoration-white/20 underline-offset-4 hover:text-white">
        {pick("Preferencias de YouTube", "YouTube preferences")}
      </button>
    </footer>
  );
}
