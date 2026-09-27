import { Link } from "wouter";
import PageSEO from "@/components/PageSEO";
import SiteNav from "@/components/SiteNav";
import { LUIS_MIGUEL_TOUR_PATH } from "@/components/LuisMiguelTourHero";
import "./luis-miguel-editorial.css";
import "@/components/luis-miguel-tour.css";
import { useLanguage } from "@/i18n/LanguageContext";

const officialAnnouncement = "https://x.com/LMXLM/status/2102151151932051880";
const announcementCoverage =
  "https://andina.pe/agencia/noticia-luis-miguel-vuelve-a-los-escenarios-sol-mexico-anuncia-tour-2027-1092693.aspx";

export default function LuisMiguelTour2027() {
  const { language, pick } = useLanguage();
  const title = pick(
    "Luis Miguel Tour 2027: lo confirmado y lo que viene",
    "Luis Miguel Tour 2027: what is confirmed and what comes next",
  );
  const description = pick(
    "Tu guía independiente del Tour 2027 de Luis Miguel: anuncios confirmados y seguimiento de fechas, ciudades, preventas y enlaces de compra autorizados.",
    "Your independent guide to Luis Miguel Tour 2027: confirmed announcements, dates, cities, presales and authorized ticket links.",
  );
  return (
    <div className="lm-article-page lm-editorial">
      <PageSEO
        title={title}
        description={description}
        path={LUIS_MIGUEL_TOUR_PATH}
        type="article"
        ogImage="https://mexicochart.com/images/campaigns/luis-miguel-2027/full-panels-poster.png"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "NewsArticle",
          headline: title,
          description,
          datePublished: "2026-09-26",
          dateModified: "2026-09-27",
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
      <div className="lm-ed-masthead">
        <span>MEXICO CHARTS</span>
        <span>
          {pick("GIRAS · COBERTURA ESPECIAL", "TOURING · SPECIAL COVERAGE")}
        </span>
      </div>
      <header className="lm-ed-header">
        <nav aria-label={pick("Ruta de navegación", "Breadcrumb")}>
          <Link href="/">{pick("Inicio", "Home")}</Link>
          <span>/</span>
          <Link href="/touring">{pick("Giras", "Touring")}</Link>
          <span>/</span>
          <span>Luis Miguel</span>
        </nav>
        <p className="lm-ed-kicker">
          {pick("EL PRÓXIMO CAPÍTULO", "THE NEXT CHAPTER")}
        </p>
        <h1>
          LUIS MIGUEL<span>TOUR 2027</span>
        </h1>
        <p className="lm-ed-title">
          {pick(
            "Lo confirmado. Lo que viene. Todo en un solo lugar.",
            "What is confirmed. What comes next. All in one place.",
          )}
        </p>
        <p className="lm-ed-intro">{description}</p>
        <div className="lm-ed-meta">
          <span>
            {pick("POR REDACCIÓN MEXICO CHARTS", "BY MEXICO CHARTS EDITORIAL")}
          </span>
          <span>
            {pick("PUBLICADO · 26 SEP 2026", "PUBLISHED · SEP 26, 2026")}
          </span>
          <span>
            {pick("ACTUALIZADO · 27 SEP 2026", "UPDATED · SEP 27, 2026")}
          </span>
        </div>
      </header>
      <figure className="lm-ed-cover">
        <img
          src="/images/campaigns/luis-miguel-2027/full-panels-poster.png"
          alt={pick(
            "Luis Miguel · Tour 2027, campaña editorial de Mexico Charts",
            "Luis Miguel · Tour 2027, Mexico Charts editorial campaign",
          )}
          width="3840"
          height="2160"
          fetchPriority="high"
        />
        <figcaption>
          {pick(
            "Fotografía del anuncio: Luis Miguel / @LMXLM · Dirección visual: Mexico Charts",
            "Announcement photograph: Luis Miguel / @LMXLM · Visual direction: Mexico Charts",
          )}
        </figcaption>
      </figure>
      <section
        className="lm-ed-status"
        aria-label={pick("Estado de la gira", "Tour status")}
      >
        {[
          [pick("GIRA", "TOUR"), pick("Anunciada", "Announced")],
          [
            pick("FECHAS Y CIUDADES", "DATES & CITIES"),
            pick("Por anunciar", "To be announced"),
          ],
          [pick("PREVENTAS", "PRESALES"), pick("Pendientes", "Pending")],
          [pick("VENTA GENERAL", "GENERAL SALE"), pick("Pendiente", "Pending")],
        ].map(([label, value], i) => (
          <div key={label}>
            <span>{label}</span>
            <strong className={i === 0 ? "confirmed" : ""}>{value}</strong>
          </div>
        ))}
      </section>
      <main id="anuncio" className="lm-article">
        <div className="lm-article-layout">
          <article>
            <div className="lm-prose">
              <section id="anuncio-oficial">
                <p className="lm-ed-section-label">
                  01 / {pick("EL ANUNCIO", "THE ANNOUNCEMENT")}
                </p>
                <h2>
                  {pick("El regreso empieza aquí", "The return starts here")}
                </h2>
                <p className="lm-ed-lead">
                  {pick(
                    "Luis Miguel abre un nuevo capítulo sobre los escenarios. El anuncio de Tour 2027 marca el inicio de una cobertura que seguirá creciendo con cada confirmación: del primer calendario a la apertura de las ventas en cada ciudad.",
                    "Luis Miguel opens a new chapter on stage. The Tour 2027 announcement begins coverage that will grow with each confirmation, from the first itinerary to the opening of ticket sales in each city.",
                  )}
                </p>

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
              </section>
              <section id="confirmado">
                <p className="lm-ed-section-label">
                  02 / {pick("LO CONFIRMADO", "CONFIRMED DETAILS")}
                </p>
                <h2>
                  {pick(
                    "Lo confirmado hasta ahora",
                    "What is confirmed so far",
                  )}
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
                    "Una nueva etapa después del Tour 2024",
                    "A new chapter after Tour 2024",
                  )}
                </h2>
                <p>
                  {pick(
                    "El regreso llega después de un ciclo de conciertos que llevó al cantante por América y Europa. El archivo oficial del Tour 2024 documenta presentaciones en mercados como Argentina, México, Estados Unidos y España: un antecedente del alcance internacional de su actividad en vivo, aunque no un adelanto del recorrido de 2027.",
                    "The return follows a concert cycle that took the singer across the Americas and Europe. The official Tour 2024 archive documents appearances in markets including Argentina, Mexico, the United States and Spain: context for the international reach of his live career, rather than a preview of the 2027 itinerary.",
                  )}{" "}
                  <a
                    href="https://luismigueloficial.com/tour-2024"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {pick(
                      "Consultar el archivo oficial de 2024",
                      "Explore the official 2024 archive",
                    )}{" "}
                    ↗
                  </a>
                </p>
                <p>
                  {pick(
                    "El anuncio abre ahora una nueva etapa de expectativa. La selección de canciones, el concepto de producción y los detalles de cada presentación no se desprenden del cartel inicial. Nuestra cobertura se ampliará cuando existan anuncios concretos sobre esos aspectos, manteniendo separados los antecedentes de la gira anterior y las novedades del nuevo tour.",
                    "The announcement now opens a new period of anticipation. The initial poster does not establish the set list, production concept or details of individual performances. Our coverage will expand as concrete announcements address those aspects, keeping the previous tour’s history separate from developments for the new tour.",
                  )}
                </p>
              </section>
              <section id="cobertura">
                <p className="lm-ed-section-label">
                  03 / {pick("NUESTRA COBERTURA", "OUR COVERAGE")}
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
                    "Reuniremos los eventos disponibles en Ticketmaster y sus enlaces directos de compra, junto con las fechas de preventa y venta general conforme se confirmen. Para las presentaciones comercializadas por otras boleteras, incluiremos los canales autorizados anunciados por los organizadores.",
                    "We will bring together events available on Ticketmaster and direct ticket links, alongside presale and general sale dates as they are confirmed. For shows sold through other ticketing providers, we will include the authorized channels announced by the organizers.",
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
                    <strong>
                      {pick("Enlaces de compra.", "Ticket links.")}
                    </strong>{" "}
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
              </section>
              <section id="fechas" className="lm-ed-dates">
                <p className="lm-ed-section-label">
                  04 / {pick("CALENDARIO", "CALENDAR")}
                </p>
                <h2>
                  {pick(
                    "Fechas, países y ciudades",
                    "Dates, countries and cities",
                  )}
                </h2>
                <p>
                  {pick(
                    "El recorrido de 2027 está pendiente de publicación. Esta guía incorporará las presentaciones confirmadas con su país, ciudad, recinto y fecha de concierto. Las funciones adicionales se identificarán por separado para que puedas distinguir cada oportunidad de asistir.",
                    "The 2027 itinerary has yet to be published. This guide will list confirmed shows with their country, city, venue and concert date. Additional performances will be identified separately so each opportunity to attend is clear.",
                  )}
                </p>
                <div className="lm-ed-empty">
                  <span>2027</span>
                  <div>
                    <strong>
                      {pick(
                        "El próximo destino está por anunciarse",
                        "The next destination is yet to be announced",
                      )}
                    </strong>
                    <p>
                      {pick(
                        "Aún no hay un calendario confirmado publicado en esta guía. Volveremos a este espacio con los anuncios de cada plaza.",
                        "This guide does not yet contain a confirmed schedule. This space will be updated with announcements for each destination.",
                      )}
                    </p>
                  </div>
                </div>
                <p>
                  {pick(
                    "La presencia de una ciudad en una gira anterior no confirma una parada en 2027. Tampoco debe interpretarse un encabezado genérico «2026–2027» de una boletera como la confirmación de un concierto: lo relevante será la ficha específica del evento y el anuncio de sus responsables.",
                    "A city’s inclusion in a previous tour does not confirm a stop in 2027. A ticketing page’s generic “2026–2027” heading is not confirmation of a concert either: the individual event listing and its organizers’ announcement are what matter.",
                  )}
                </p>
              </section>
              <section id="boletos">
                <p className="lm-ed-section-label">
                  05 / {pick("BOLETOS", "TICKETS")}
                </p>
                <h2>
                  {pick(
                    "De la preventa a tu concierto",
                    "From presale to your concert",
                  )}
                </h2>
                <p>
                  {pick(
                    "Cada mercado puede tener una boletera, una moneda y un calendario de venta distintos. Por eso organizaremos la información por presentación, con horarios locales y los requisitos que publique cada organizador, en lugar de dar por hecho una única preventa para toda la gira.",
                    "Each market may use a different ticketing provider, currency and sales schedule. We will therefore organize information by show, using local times and requirements published by each organizer, rather than assuming one presale applies to the whole tour.",
                  )}
                </p>
                <div className="lm-ed-steps">
                  {[
                    [
                      pick("Identifica tu fecha", "Find your show"),
                      pick(
                        "País, ciudad, recinto y día del concierto, reunidos en una misma ficha.",
                        "Country, city, venue and concert date together in one listing.",
                      ),
                    ],
                    [
                      pick("Consulta la apertura", "Check the sale opening"),
                      pick(
                        "Preventa y venta general diferenciadas, con zona horaria y condiciones cuando se publiquen.",
                        "Separate presale and general sale information, with time zones and conditions when published.",
                      ),
                    ],
                    [
                      pick("Accede a la boletera", "Go to the ticket provider"),
                      pick(
                        "Enlaces al evento en Ticketmaster o al canal autorizado que corresponda. La compra se completa en esa plataforma.",
                        "Links to the event on Ticketmaster or the appropriate authorized channel. Purchases are completed on that platform.",
                      ),
                    ],
                  ].map(([heading, body], i) => (
                    <div key={heading}>
                      <span>0{i + 1}</span>
                      <div>
                        <h3>{heading}</h3>
                        <p>{body}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p>
                  {pick(
                    "Los precios, cargos, paquetes y condiciones se incorporarán únicamente cuando estén publicados para el evento correspondiente. Un enlace de compra no garantiza disponibilidad: el inventario y las condiciones vigentes serán los que muestre la boletera al momento de consultar.",
                    "Prices, fees, packages and conditions will only be included once published for the relevant show. A ticket link does not guarantee availability: the ticket provider’s current inventory and terms apply at the time of your visit.",
                  )}
                </p>
              </section>
              <section id="preguntas">
                <p className="lm-ed-section-label">
                  06 / {pick("GUÍA RÁPIDA", "QUICK GUIDE")}
                </p>
                <h2>
                  {pick("Preguntas frecuentes", "Frequently asked questions")}
                </h2>
                {[
                  [
                    pick(
                      "¿Cuándo comienza el Tour 2027?",
                      "When does Tour 2027 begin?",
                    ),
                    pick(
                      "El anuncio identifica el año de la gira, pero no establece todavía una fecha de apertura. No publicaremos un día de inicio hasta contar con una confirmación atribuible al artista o a los organizadores.",
                      "The announcement identifies the tour year but does not yet establish an opening date. We will only publish a starting date once it is confirmed by the artist or organizers.",
                    ),
                  ],
                  [
                    pick(
                      "¿Habrá conciertos en México?",
                      "Will there be shows in Mexico?",
                    ),
                    pick(
                      "La lista de países y ciudades sigue pendiente en esta guía. Actualizaremos esta sección cuando se anuncien oficialmente las presentaciones, sin dar por confirmadas las plazas de giras anteriores.",
                      "The list of countries and cities remains pending in this guide. We will update this section when shows are officially announced, without assuming stops from previous tours will return.",
                    ),
                  ],
                  [
                    pick(
                      "¿Mexico Charts vende o reserva boletos?",
                      "Does Mexico Charts sell or reserve tickets?",
                    ),
                    pick(
                      "No. Mexico Charts reúne información y dirige a los canales autorizados. La venta, los pagos, la entrega de entradas y la atención relacionada con una compra corresponden a la boletera y al organizador de cada evento.",
                      "No. Mexico Charts gathers information and directs readers to authorized channels. Sales, payments, ticket delivery and purchase support are handled by the ticket provider and event organizer.",
                    ),
                  ],
                  [
                    pick(
                      "¿Dónde se anunciarán los cambios?",
                      "Where will updates appear?",
                    ),
                    pick(
                      "Esta página será el punto de consulta de nuestra cobertura. Cada actualización relevante incluirá su fuente y fecha de revisión. Los avisos del artista, promotores, recintos y boleteras seguirán siendo la referencia oficial de cada presentación.",
                      "This page will serve as the reference for our coverage. Relevant updates will include their source and review date. Notices from the artist, promoters, venues and ticket providers remain each show’s official reference.",
                    ),
                  ],
                ].map(([q, a]) => (
                  <details key={q}>
                    <summary>{q}</summary>
                    <p>{a}</p>
                  </details>
                ))}
              </section>
              <div id="fuentes" className="lm-sources">
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
            <p className="lm-ed-section-label">
              {pick("EN ESTA GUÍA", "IN THIS GUIDE")}
            </p>
            <nav className="lm-ed-index">
              {[
                ["anuncio-oficial", pick("El anuncio", "The announcement")],
                ["confirmado", pick("Lo confirmado", "What is confirmed")],
                ["cobertura", pick("Nuestra cobertura", "Our coverage")],
                ["fechas", pick("Fechas y ciudades", "Dates and cities")],
                [
                  "boletos",
                  pick("Preventas y boletos", "Presales and tickets"),
                ],
                ["preguntas", pick("Preguntas frecuentes", "FAQ")],
                ["fuentes", pick("Fuentes", "Sources")],
              ].map(([id, label], i) => (
                <a key={id} href={`#${id}`}>
                  <span>0{i + 1}</span>
                  {label}
                </a>
              ))}
            </nav>
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
                "Información revisada el 27 de septiembre de 2026. Actualizaremos esta guía conforme se publiquen nuevos anuncios oficiales.",
                "Information reviewed September 27, 2026. We will update this guide as new official announcements are published.",
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
      <footer className="lm-ed-footer">
        <Link href="/">MEXICO CHARTS</Link>
        <span>
          {pick(
            "COBERTURA INDEPENDIENTE · MÚSICA EN VIVO",
            "INDEPENDENT COVERAGE · LIVE MUSIC",
          )}
        </span>
        <Link href="/touring">{pick("Explorar giras", "Explore tours")} ↗</Link>
      </footer>
    </div>
  );
}
