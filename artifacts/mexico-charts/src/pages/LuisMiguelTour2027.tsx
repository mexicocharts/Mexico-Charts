import { Link } from "wouter";
import PageSEO from "@/components/PageSEO";
import SiteNav from "@/components/SiteNav";
import LuisMiguelTourHero, {
  LUIS_MIGUEL_TOUR_PATH,
} from "@/components/LuisMiguelTourHero";
import { useLanguage } from "@/i18n/LanguageContext";

const officialAnnouncement = "https://x.com/LMXLM/status/2102151151932051880";
const announcementCoverage =
  "https://andina.pe/agencia/noticia-luis-miguel-vuelve-a-los-escenarios-sol-mexico-anuncia-tour-2027-1092693.aspx";

export default function LuisMiguelTour2027() {
  const { language, pick } = useLanguage();
  const title = pick(
    "Luis Miguel anuncia Tour 2027: seguiremos cada nuevo anuncio",
    "Luis Miguel announces Tour 2027: following every new announcement",
  );
  const description = pick(
    "Tu guía independiente del Tour 2027 de Luis Miguel: anuncios confirmados y seguimiento de fechas, ciudades, preventas y enlaces de compra autorizados.",
    "Your independent guide to Luis Miguel Tour 2027: confirmed announcements, dates, cities, presales and authorized ticket links.",
  );
  return (
    <div className="lm-article-page">
      <PageSEO
        title={title}
        description={description}
        path={LUIS_MIGUEL_TOUR_PATH}
        type="article"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: title,
          description,
          datePublished: "2026-09-26",
          dateModified: "2026-09-26",
          inLanguage: language === "en" ? "en" : "es-MX",
          image:
            "https://mexicochart.com/images/campaigns/luis-miguel-2027/announcement-original.jpg",
          author: {
            "@type": "Organization",
            name: "Redacción México Charts",
            url: "https://mexicochart.com/acerca-de",
          },
          publisher: {
            "@type": "Organization",
            name: "Mexico Charts",
            url: "https://mexicochart.com",
            logo: {
              "@type": "ImageObject",
              url: "https://mexicochart.com/mexico-charts-logo.png",
            },
          },
          mainEntityOfPage: `https://mexicochart.com${LUIS_MIGUEL_TOUR_PATH}`,
          citation: [officialAnnouncement, announcementCoverage],
        }}
      />
      <SiteNav />
      <LuisMiguelTourHero article />
      <main id="anuncio" className="lm-article">
        <div className="lm-article-layout">
          <article>
            <p className="lm-eyebrow">
              {pick("Giras · Cobertura especial", "Touring · Special coverage")}
            </p>
            <h1>{title}</h1>
            <p className="lm-deck">
              {pick(
                "El Sol prepara su regreso. En México Charts reuniremos la información confirmada de la gira, con seguimiento por país y ciudad para que sus seguidores puedan planear su próxima experiencia en vivo.",
                "El Sol is preparing his return. México Charts will bring together confirmed tour information, organized by country and city, to help fans plan their next live experience.",
              )}
            </p>
            <p className="lm-byline">
              {pick(
                "Por Redacción México Charts",
                "By México Charts editorial team",
              )}
              <br />
              {pick(
                "Publicado y revisado el",
                "Published and reviewed on",
              )}{" "}
              <time dateTime="2026-09-26">
                {pick("26 de septiembre de 2026", "September 26, 2026")}
              </time>
            </p>
            <div className="lm-prose">
              <p>
                {pick(
                  "Luis Miguel anunció una nueva gira para 2027 mediante una publicación en sus canales oficiales el pasado 21 de septiembre. El mensaje, acompañado de una imagen del artista y la leyenda «Luis Miguel Tour 2027», confirma el próximo capítulo de su trayectoria sobre los escenarios.",
                  "Luis Miguel announced a new tour for 2027 through his official channels on September 21. A photograph of the artist bearing the words “Luis Miguel Tour 2027” confirmed the next chapter of his live career.",
                )}{" "}
                <a
                  href={officialAnnouncement}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {pick(
                    "Ver el anuncio del artista",
                    "View the artist’s announcement",
                  )}{" "}
                  ↗
                </a>
              </p>
              <h2>
                {pick("Lo confirmado hasta ahora", "What is confirmed so far")}
              </h2>
              <p>
                {pick(
                  "El anuncio confirma la gira y el año: 2027. A la fecha de esta publicación, no se han comunicado los países, las ciudades, los recintos ni el calendario de conciertos. Las fechas de preventa y venta general también están pendientes de confirmación.",
                  "The announcement confirms the tour and its year: 2027. As of this article’s publication, countries, cities, venues and concert dates have not been announced. Presale and general sale dates also remain unconfirmed.",
                )}{" "}
                <a
                  href={announcementCoverage}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {pick("Fuente del anuncio", "Announcement coverage")} ↗
                </a>
              </p>
              <p>
                {pick(
                  "Cada nueva confirmación ayudará a darle forma al recorrido. Aquí distinguiremos los anuncios oficiales de la información que todavía está por definirse, con la fuente y la fecha de revisión de cada actualización.",
                  "Each new confirmation will help shape the tour itinerary. Here, official announcements will be clearly distinguished from details still to be determined, with a source and review date for each update.",
                )}
              </p>
              <h2>
                {pick(
                  "Tu punto de encuentro para seguir la gira",
                  "Your place to follow the tour",
                )}
              </h2>
              <p>
                {pick(
                  "México Charts dará seguimiento continuo al Tour 2027 de Luis Miguel, reuniendo los anuncios del artista, los promotores, los recintos y las plataformas autorizadas en una guía organizada por país, ciudad y recinto.",
                  "México Charts will follow Luis Miguel Tour 2027 throughout its rollout, bringing together announcements from the artist, promoters, venues and authorized ticketing platforms in a guide organized by country, city and venue.",
                )}
              </p>
              <p>
                {pick(
                  "Nuestra integración con Ticketmaster nos permitirá incorporar los eventos disponibles en su plataforma y sus enlaces de compra, junto con las fechas de preventa y venta general conforme se confirmen. Para las presentaciones comercializadas por otras boleteras, incluiremos los canales autorizados anunciados por los organizadores.",
                  "Our Ticketmaster integration will allow us to include events available on its platform and their ticket links, alongside presale and general sale dates as they are confirmed. For shows sold through other ticketing providers, we will include the authorized channels announced by the organizers.",
                )}
              </p>
              <ul>
                <li>
                  <strong>
                    {pick("Conciertos y recintos.", "Concerts and venues.")}
                  </strong>{" "}
                  {pick(
                    "Fechas confirmadas y nuevas funciones, organizadas por país y ciudad.",
                    "Confirmed dates and additional shows, organized by country and city.",
                  )}
                </li>
                <li>
                  <strong>
                    {pick(
                      "Preventas y venta general.",
                      "Presales and general sales.",
                    )}
                  </strong>{" "}
                  {pick(
                    "Días, horarios locales y requisitos de acceso publicados por los responsables de cada evento.",
                    "Dates, local times and access requirements published by each event’s organizers.",
                  )}
                </li>
                <li>
                  <strong>{pick("Enlaces de compra.", "Ticket links.")}</strong>{" "}
                  {pick(
                    "Acceso a Ticketmaster o a la boletera autorizada correspondiente a cada presentación.",
                    "Direct access to Ticketmaster or the authorized ticketing provider for each show.",
                  )}
                </li>
                <li>
                  <strong>
                    {pick("Cambios importantes.", "Important changes.")}
                  </strong>{" "}
                  {pick(
                    "Reprogramaciones, nuevas fechas y avisos relevantes para los asistentes.",
                    "Rescheduled shows, new dates and relevant notices for attendees.",
                  )}
                </li>
              </ul>
              <p>
                {pick(
                  "Nuestro objetivo es que los seguidores de Luis Miguel encuentren en México Charts un punto de consulta confiable durante toda la gira: desde el primer anuncio hasta la llegada del concierto a su ciudad.",
                  "Our aim is to give Luis Miguel fans a reliable place to consult throughout the tour, from the first announcement to the arrival of the show in their city.",
                )}
              </p>
              <p>
                <strong>
                  {pick(
                    "Una gira por descubrir. Cada anuncio, en un solo lugar.",
                    "A tour waiting to unfold. Every announcement, in one place.",
                  )}
                </strong>
              </p>
              <div className="lm-sources">
                <h2>
                  {pick(
                    "Fuentes y transparencia editorial",
                    "Sources and editorial transparency",
                  )}
                </h2>
                <ul>
                  <li>
                    <a
                      href={officialAnnouncement}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {pick(
                        "Luis Miguel · anuncio en su cuenta oficial de X · 21 de septiembre de 2026",
                        "Luis Miguel · announcement on his official X account · September 21, 2026",
                      )}{" "}
                      ↗
                    </a>
                  </li>
                  <li>
                    <a
                      href={announcementCoverage}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {pick(
                        "Agencia Andina · cobertura del anuncio · 21 de septiembre de 2026",
                        "Agencia Andina · announcement coverage · September 21, 2026",
                      )}{" "}
                      ↗
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://luismigueloficial.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {pick(
                        "Sitio oficial de Luis Miguel",
                        "Luis Miguel’s official website",
                      )}{" "}
                      ↗
                    </a>
                  </li>
                </ul>
                <p>
                  {pick(
                    "Fotografía del anuncio: Luis Miguel / @LMXLM. Diseño de campaña: México Charts.",
                    "Announcement photograph: Luis Miguel / @LMXLM. Campaign design: México Charts.",
                  )}
                </p>
                <p>
                  {pick(
                    "México Charts realiza una cobertura editorial independiente, sin afiliación con el artista, su equipo o los organizadores de la gira. La información de cada evento y la venta de entradas corresponden a sus responsables oficiales.",
                    "México Charts provides independent editorial coverage and is not affiliated with the artist, his team or the tour organizers. Event information and ticket sales are managed by their official providers.",
                  )}
                </p>
              </div>
            </div>
          </article>
          <aside aria-label={pick("Estado del anuncio", "Announcement status")}>
            <h2>Tour 2027</h2>
            <dl>
              <dt>{pick("Estado", "Status")}</dt>
              <dd>{pick("Anunciado", "Announced")}</dd>
              <dt>{pick("Países y ciudades", "Countries and cities")}</dt>
              <dd>{pick("Por anunciar", "To be announced")}</dd>
              <dt>{pick("Fechas y recintos", "Dates and venues")}</dt>
              <dd>{pick("Por anunciar", "To be announced")}</dd>
              <dt>
                {pick("Preventas y venta general", "Presales and general sale")}
              </dt>
              <dd>{pick("Por anunciar", "To be announced")}</dd>
            </dl>
            <p>
              {pick(
                "Información revisada el 26 de septiembre de 2026. Actualizaremos esta guía conforme se publiquen nuevos anuncios oficiales.",
                "Information reviewed September 26, 2026. We will update this guide as new official announcements are published.",
              )}
            </p>
            <Link href="/artist/luis-miguel">
              {pick(
                "Explorar el perfil de Luis Miguel",
                "Explore Luis Miguel’s profile",
              )}{" "}
              →
            </Link>
            <p>
              <Link href="/touring">
                {pick(
                  "Todas las giras en México Charts",
                  "All tours on México Charts",
                )}{" "}
                →
              </Link>
            </p>
          </aside>
        </div>
      </main>
    </div>
  );
}
