import { Link } from "wouter";
import { Home, ChevronRight } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";
import { CONTACT_EMAIL } from "@/config/brand";
import { EditorialFooter, EditorialHero } from "@/components/EditorialLayout";
import { useLanguage } from "@/i18n/LanguageContext";

const G = "#39FF14";
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export default function Metodologia() {
  const { pick } = useLanguage();
  return (
    <div style={{ background: "#080808", minHeight: "100vh", color: "#fff", overflowX: "hidden" }}>
      <PageSEO
        title={pick("Metodología — Mexico Charts", "Methodology — Mexico Charts")}
        description={pick("Cómo Mexico Charts recopila, organiza y presenta datos de música, streaming, listas, giras e industria.", "How Mexico Charts collects, organizes and presents music, streaming, chart, touring and industry data.")}
        path="/metodologia"
      />
      <div className="fixed inset-0 pointer-events-none opacity-[0.016]"
        style={{ backgroundImage: NOISE, backgroundSize: "128px", zIndex: 0 }} />

      <SiteNav />

      <div className="px-6 lg:px-10 py-3 flex items-center gap-1.5" style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <Link href="/"><span className="cursor-pointer" style={{ color: "rgba(255,255,255,0.35)" }}><Home className="w-3 h-3" /></span></Link>
        <ChevronRight className="w-3 h-3" style={{ color: "rgba(255,255,255,0.20)" }} />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: "rgba(255,255,255,0.5)" }}>{pick("Metodología", "Methodology")}</span>
      </div>

      <div className="relative z-10 max-w-[860px] mx-auto px-6 lg:px-10 py-20">
        <EditorialHero
          title={pick("Metodología", "Methodology")}
          description={pick("Cómo recopilamos, organizamos y presentamos los datos", "How we collect, organize and present data")}
          compact
        />

        <div style={{ borderTop: `1px solid rgba(57,255,20,0.12)` }} className="mt-14 pt-12 space-y-10">
          <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.62)" }}>
            {pick("Mexico Charts recopila, organiza y presenta información pública y/o licenciada de distintas fuentes relacionadas con música, streaming, listas, giras e industria.", "Mexico Charts collects, organizes and presents public and/or licensed information from multiple sources related to music, streaming, charts, touring and the music industry.")}
          </p>
          <p className="text-base leading-relaxed" style={{ color: "rgba(255,255,255,0.62)" }}>
            {pick("Nuestros rankings y perfiles pueden incluir datos de Spotify, YouTube, Apple Music, Deezer, Songstats, Ticketmaster, Pollstar, IFPI, AMPROFON y otras fuentes oficiales, públicas o editoriales, dependiendo de la disponibilidad y del tipo de sección.", "Our rankings and profiles may include data from Spotify, YouTube, Apple Music, Deezer, Songstats, Ticketmaster, Pollstar, IFPI, AMPROFON and other official, public or editorial sources, depending on availability and the section.")}
          </p>

          <div className="grid gap-3 md:grid-cols-3">
            {[
              {
                title: pick("Datos licenciados", "Licensed data"),
                body: pick("Las métricas de audiencia e historial identificadas como Songstats se obtienen mediante acceso licenciado. Mexico Charts normaliza y presenta únicamente campos seleccionados; las respuestas completas del proveedor permanecen privadas.", "Audience and historical metrics identified as Songstats are obtained through licensed access. Mexico Charts normalizes and presents selected fields only; full provider responses remain private."),
              },
              {
                title: pick("Fuentes oficiales y públicas", "Official and public sources"),
                body: pick("Las cifras de plataforma y listas se vinculan al artista correcto mediante identificadores y fuentes verificadas. En YouTube se prioriza el canal oficial registrado cuando está disponible.", "Platform figures and charts are linked to the correct artist through verified identifiers and sources. On YouTube, the registered official channel is prioritized when available."),
              },
              {
                title: pick("Cálculos de Mexico Charts", "Mexico Charts calculations"),
                body: pick("Cambios, tendencias, agregados y comparaciones pueden calcularse a partir de snapshots guardados. Se distinguen de una lista oficial y se acompaña la cifra con su plataforma o periodo cuando corresponde.", "Changes, trends, aggregates and comparisons may be calculated from saved snapshots. They are distinguished from official charts and accompanied by their platform or period when appropriate."),
              },
            ].map(({ title, body }) => (
              <div key={title} className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <h3 className="text-[10px] font-black uppercase tracking-[0.18em] mb-3" style={{ color: G }}>{title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{body}</p>
              </div>
            ))}
          </div>

          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.22em] mb-6" style={{ color: G }}>{pick("Principios", "Principles")}</h2>
            <ul className="space-y-3">
              {[
                pick("Transparencia de fuente cuando sea posible", "Source transparency whenever possible"),
                pick("Actualización regular de datos", "Regular data updates"),
                pick("Separación entre listas oficiales, datos agregados y análisis editorial", "Separation of official charts, aggregated data and editorial analysis"),
                pick("Corrección de errores cuando sean identificados", "Correction of identified errors"),
                pick("Contexto cultural junto a los números", "Cultural context alongside the numbers"),
              ].map(item => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 flex-shrink-0 w-1 h-1 rounded-full" style={{ background: G }} />
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl p-5 mb-2" style={{ background: "rgba(57,255,20,0.04)", border: `1px solid rgba(57,255,20,0.12)` }}>
            <h3 className="text-[10px] font-black uppercase tracking-[0.22em] mb-2" style={{ color: G }}>{pick("Importante", "Important")}</h3>
            <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
              {pick("Mexico Charts no inventa cifras. Cuando una cifra es estimada, agregada o editorial, debe indicarse claramente.", "Mexico Charts does not invent figures. When a figure is estimated, aggregated or editorial, it must be clearly identified.")}
            </p>
          </div>

          <div className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-3" style={{ color: G }}>{pick("Verificado por Mexico Charts", "Verified by Mexico Charts")}</h3>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
              {pick("Significa que Mexico Charts verificó la identidad del artista y vinculó fuentes oficiales y mapeos de datos al registro correcto. No significa que el artista haya reclamado el perfil, participado en su creación o respaldado a Mexico Charts.", "It means Mexico Charts verified the artist's identity and linked official sources and data mappings to the correct record. It does not mean the artist claimed the profile, participated in its creation or endorsed Mexico Charts.")}
            </p>
          </div>

          <div className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-3" style={{ color: G }}>{pick("Sellos y distribuidores asociados", "Associated labels and distributors")}</h3>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
              {pick("Este campo puede reunir asociaciones de sello o distribución actuales e históricas observadas en el catálogo. No implica que todas las compañías listadas sean el sello actual del artista.", "This field may include current and historical label or distribution associations observed in the catalog. It does not imply that every listed company is the artist's current label.")}
            </p>
          </div>

          <div className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-3" style={{ color: G }}>{pick("Disponibilidad y ausencia de datos", "Data availability and absence")}</h3>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
              {pick("La cobertura varía por artista, plataforma y fecha. Un campo ausente no equivale a cero: si una fuente no ofrece una métrica verificable, Mexico Charts la omite o lo indica expresamente. Las plataformas también pueden actualizar en horarios distintos, por lo que sus fechas de corte no siempre coinciden.", "Coverage varies by artist, platform and date. A missing field does not equal zero: when a source does not provide a verifiable metric, Mexico Charts omits it or states that explicitly. Platforms may also update at different times, so their cutoff dates do not always match.")}
            </p>
          </div>

          <div className="space-y-5">
            {[
              {
                title: pick("Listas", "Charts"),
                body: pick("Las listas pueden provenir de plataformas públicas o fuentes externas. Cuando una lista pertenece a una plataforma específica, Mexico Charts la presenta como ranking de esa plataforma y no como ranking propio, salvo que se indique claramente que es una lista editorial o agregada.", "Charts may come from public platforms or external sources. When a chart belongs to a specific platform, Mexico Charts presents it as that platform's ranking rather than its own, unless it is clearly identified as editorial or aggregated."),
              },
              {
                title: pick("Artistas", "Artists"),
                body: pick("La base de datos de artistas se enfoca principalmente en artistas mexicanos y artistas vinculados a la música mexicana. Algunos casos pueden incluir artistas nacidos fuera de México pero culturalmente vinculados al mercado, género o comunidad mexicana.", "The artist database focuses primarily on Mexican artists and artists connected to Mexican music. Some cases may include artists born outside Mexico who are culturally linked to the Mexican market, genre or community."),
              },
              {
                title: "Streaming",
                body: pick("Las cifras de streaming, oyentes, seguidores o reproducciones pueden cambiar con el tiempo y depender de la disponibilidad de cada plataforma o fuente.", "Streaming, listener, follower or play counts may change over time and depend on the availability of each platform or source."),
              },
              {
                title: pick("Giras", "Touring"),
                body: pick("Los datos de giras pueden provenir de fuentes oficiales, reportes de la industria, plataformas de venta de boletos o bases de datos especializadas. Cuando los datos sean estimados o incompletos, debe indicarse.", "Touring data may come from official sources, industry reports, ticketing platforms or specialized databases. Estimated or incomplete data must be identified as such."),
              },
            ].map(({ title, body }) => (
              <div key={title} className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-3" style={{ color: "rgba(255,255,255,0.55)" }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>{body}</p>
              </div>
            ))}
          </div>

          <div className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <h3 className="text-xs font-black uppercase tracking-[0.2em] mb-3" style={{ color: G }}>{pick("Correcciones", "Corrections")}</h3>
            <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
              {pick("Si detectas un error, puedes contactarnos en", "If you find an error, contact us at")}{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="hover:underline" style={{ color: G }}>{CONTACT_EMAIL}</a>{" "}
              {pick("con la fuente o información correspondiente.", "with the relevant source or information.")}
            </p>
          </div>
        </div>
      </div>

      <EditorialFooter />
    </div>
  );
}
