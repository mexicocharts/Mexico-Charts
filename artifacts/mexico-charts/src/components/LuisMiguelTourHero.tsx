import { Link } from "wouter";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useLanguage } from "@/i18n/LanguageContext";
import "./luis-miguel-tour.css";
import "./luis-miguel-video.css";

export const LUIS_MIGUEL_TOUR_PATH = "/touring/luis-miguel-tour-2027";
const base = import.meta.env.BASE_URL;
const poster = `${base}images/campaigns/luis-miguel-2027/full-panels-poster.png`;
const videos = `${base}videos/luis-miguel-2027/`;
const REVEAL_COMPLETE = 9;
const INTRO_SPEED = 1.3;

export default function LuisMiguelTourHero({ article = false }: { article?: boolean }) {
  const { pick } = useLanguage();
  const heroRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reducedMotion = useReducedMotion();
  const motionEnabled = reducedMotion === false;
  const [paused, setPaused] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [failed, setFailed] = useState(false);
  const [inView, setInView] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const running = motionEnabled && !paused && inView && pageVisible && !failed;
  const showFallback = reducedMotion === true || failed || paused;
  const showAction = revealed || showFallback;

  function syncReveal() {
    const video = videoRef.current;
    if (!video) return;
    const complete = video.currentTime >= REVEAL_COMPLETE;
    video.playbackRate = complete ? 1 : INTRO_SPEED;
    setRevealed(complete);
  }

  useEffect(() => {
    const element = heroRef.current;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.1 });
    if (element) observer.observe(element);
    const visibility = () => setPageVisible(!document.hidden);
    visibility();
    document.addEventListener("visibilitychange", visibility);
    return () => { observer.disconnect(); document.removeEventListener("visibilitychange", visibility); };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let active = true;
    if (running) {
      video.playbackRate = video.currentTime < REVEAL_COMPLETE ? INTRO_SPEED : 1;
      video.play().catch(() => { if (active) setPaused(true); });
    } else {
      video.pause();
    }
    return () => { active = false; video.pause(); };
  }, [running]);

  function keepPanelsMoving() {
    const video = videoRef.current;
    if (!video || !running) return;
    // Play the entrance once, then retain the illuminated scene and LED pulse.
    video.currentTime = 10;
    video.play().catch(() => setPaused(true));
  }

  return (
    <section ref={heroRef} className="lm-video-hero" aria-label="Luis Miguel · Tour 2027" data-testid="luis-miguel-tour-hero">
      {article ? <span className="lm-video-sr">Luis Miguel · Tour 2027</span> : <h1 className="lm-video-sr">Luis Miguel · Tour 2027</h1>}
      <div className="lm-video-stage">
        <img style={{ visibility: showFallback ? "visible" : "hidden" }} className="lm-video-poster" src={poster} alt="Luis Miguel · Tour 2027. Toda la información de la gira, en un solo lugar." width="1280" height="720" fetchPriority="high" />
        {motionEnabled && !failed && (
          <video
            ref={videoRef}
            className={`lm-video-film${hasPlayed ? " lm-video-film-visible" : ""}`}
            muted playsInline preload="auto"
            aria-hidden="true" tabIndex={-1}
            onPlaying={() => setHasPlayed(true)}
            onTimeUpdate={syncReveal}
            onEnded={keepPanelsMoving}
            onError={(event) => {
              // A skipped source can emit an error while another source remains playable.
              if (event.currentTarget.error) { setFailed(true); setHasPlayed(false); }
            }}
          >
            <source src={`${videos}full-panels-4k.mp4`} media="(min-width: 1600px)" type="video/mp4" />
            <source src={`${videos}full-panels-1080p.mp4`} type="video/mp4" />
          </video>
        )}
      </div>
      <div className={`lm-video-actions${showAction ? " lm-video-actions-visible" : ""}`} aria-hidden={!showAction} inert={!showAction}>
        {article ? (
          <a className="lm-video-cta" href="#anuncio">{pick("Leer el anuncio", "Read the announcement")}<ArrowUpRight size={20} aria-hidden="true" /></a>
        ) : (
          <Link className="lm-video-cta" href={LUIS_MIGUEL_TOUR_PATH}>{pick("Ver información de la gira", "Explore the tour")}<ArrowUpRight size={20} aria-hidden="true" /></Link>
        )}
      </div>
    </section>
  );
}
