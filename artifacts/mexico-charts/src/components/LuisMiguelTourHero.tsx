import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
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
  return (
    <section
      className="lm-hero"
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
    </section>
  );
}
