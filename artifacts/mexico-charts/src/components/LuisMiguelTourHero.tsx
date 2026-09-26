import { Link } from "wouter";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ArrowRight, Pause, Play } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import "./luis-miguel-tour.css";

export const LUIS_MIGUEL_TOUR_PATH = "/touring/luis-miguel-tour-2027";
const assets = `${import.meta.env.BASE_URL}images/campaigns/luis-miguel-2027/`;

export default function LuisMiguelTourHero({
  article = false,
}: {
  article?: boolean;
}) {
  const { pick } = useLanguage();
  const heroRef = useRef<HTMLElement>(null);
  const reducedMotion = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const motionEnabled = reducedMotion === false;
  const running = motionEnabled && !paused && inView && pageVisible;

  useEffect(() => {
    if (!motionEnabled) return;
    const element = heroRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.05 },
    );
    if (element) observer.observe(element);
    const updateVisibility = () => setPageVisible(!document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, [motionEnabled]);

  function resetDepth() {
    heroRef.current?.style.setProperty("--lm-depth-x", "0px");
    heroRef.current?.style.setProperty("--lm-depth-y", "0px");
  }

  useEffect(() => {
    if (!running) resetDepth();
  }, [running]);

  function moveDepth(event: PointerEvent<HTMLElement>) {
    // Touch scrolling stays native; only a fine mouse pointer adds depth.
    if (!running || event.pointerType !== "mouse") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = Math.max(
      -1,
      Math.min(1, ((event.clientX - bounds.left) / bounds.width - 0.5) * 2),
    );
    const y = Math.max(
      -1,
      Math.min(1, ((event.clientY - bounds.top) / bounds.height - 0.5) * 2),
    );
    event.currentTarget.style.setProperty("--lm-depth-x", `${x * 6}px`);
    event.currentTarget.style.setProperty("--lm-depth-y", `${y * 4}px`);
  }

  return (
    <section
      ref={heroRef}
      className={`lm-hero${motionEnabled ? " lm-animated" : ""}`}
      data-motion-running={running}
      onPointerMove={moveDepth}
      onPointerLeave={resetDepth}
      aria-label={pick("Luis Miguel · Tour 2027", "Luis Miguel · Tour 2027")}
      data-testid="luis-miguel-tour-hero"
    >
      <img
        className="lm-stage"
        src={`${assets}led-stage.webp`}
        alt=""
        width="2059"
        height="764"
        fetchPriority="high"
      />
      <div className="lm-atmosphere" aria-hidden="true" />
      <div className="lm-light-sweep" aria-hidden="true" />
      {/* Display the original photograph directly. CSS crops the poster lettering;
          no generative portrait, facial retouching or replacement is used. */}
      <div className="lm-portrait">
        <img
          src={`${assets}announcement-original.jpg`}
          alt={pick(
            "Luis Miguel en la fotografía del anuncio de su Tour 2027",
            "Luis Miguel in the photograph announcing his Tour 2027",
          )}
          width="1028"
          height="1254"
          fetchPriority="high"
        />
      </div>
      <div className="lm-hero-copy">
        <p className="lm-eyebrow">
          {pick("El Sol de México · Nueva gira", "El Sol de México · New tour")}
        </p>
        {article ? (
          <div className="lm-name" aria-hidden="true">
            <span>LUIS</span>
            <span>MIGUEL</span>
          </div>
        ) : (
          <h1 className="lm-name">
            <span>LUIS</span>
            <span>MIGUEL</span>
          </h1>
        )}
        <p className="lm-year">TOUR 2027</p>
        <p className="lm-status">
          {pick(
            "Anuncio confirmado · Fechas por anunciar",
            "Tour announced · Dates to be announced",
          )}
        </p>
        <div className="lm-actions">
          {article ? (
            <a className="lm-button lm-button-primary" href="#anuncio">
              {pick("Leer el anuncio", "Read the announcement")}
              <ArrowRight size={16} />
            </a>
          ) : (
            <Link
              className="lm-button lm-button-primary"
              href={LUIS_MIGUEL_TOUR_PATH}
            >
              {pick("Leer el anuncio", "Read the announcement")}
              <ArrowRight size={16} />
            </Link>
          )}
          <Link className="lm-button" href="/artist/luis-miguel">
            {pick("Ver perfil", "View profile")}
          </Link>
        </div>
      </div>
      {motionEnabled && (
        <button
          type="button"
          className="lm-motion-toggle"
          onClick={() => setPaused((value) => !value)}
          aria-pressed={paused}
          aria-label={pick("Pausar animación", "Pause animation")}
        >
          {paused ? (
            <Play size={12} aria-hidden="true" />
          ) : (
            <Pause size={12} aria-hidden="true" />
          )}
          {paused
            ? pick("Reanudar", "Resume")
            : pick("Pausar animación", "Pause animation")}
        </button>
      )}
    </section>
  );
}
