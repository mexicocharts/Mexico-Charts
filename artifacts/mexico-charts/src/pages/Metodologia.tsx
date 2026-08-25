import { Link } from "wouter";
import { Home, ChevronRight } from "lucide-react";
import SiteNav from "@/components/SiteNav";
import PageSEO from "@/components/PageSEO";
import { CONTACT_EMAIL } from "@/config/brand";
import { EditorialFooter, EditorialHero } from "@/components/EditorialLayout";
import { useLanguage } from "@/i18n/LanguageContext";

const G = "#39FF14";
const NOISE = `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const cardStyle = {
  background: "rgba(255,255,255,0.03)",
  border: "1px solid rgba(255,255,255,0.07)",
};

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

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: "rgba(255,255,255,0.34)" }}>
            <span>{pick("Versión 1.1", "Version 1.1")}</span>
            <span aria-hidden="true" style={{ color: "rgba(57,255,20,0.45)" }}>•</span>
            <span>{pick("Actualizada el 25 de agosto de 2026", "Updated August 25, 2026")}</span>
            <Link href="/fuentes-de-datos">
              <span className="cursor-pointer hover:underline" style={{ color: G }}>{pick("Directorio de fuentes →", "Source directory →")}</span>
            </Link>
          </div>

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

          <section>
            <h2 className="text-sm font-black uppercase tracking-[0.22em] mb-3" style={{ color: G }}>{pick("Cómo procesamos los datos", "How we process data")}</h2>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "rgba(255,255,255,0.5)" }}>
              {pick("El proceso puede variar según la fuente, pero sigue estas etapas para reducir errores de identidad, formato y periodo.", "The process may vary by source, but follows these stages to reduce identity, format and measurement-period errors.")}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                ["01", pick("Recopilación", "Collection"), pick("Obtenemos datos públicos, oficiales o licenciados y conservamos la fuente y fecha disponibles.", "We obtain public, official or licensed data and retain the available source and date.")],
                ["02", pick("Identificación", "Identification"), pick("Vinculamos cada dato con el artista, lanzamiento, canal, evento o lista correctos mediante identificadores y revisión de nombres.", "We link each data point to the correct artist, release, channel, event or chart using identifiers and name review.")],
                ["03", pick("Normalización", "Normalization"), pick("Unificamos nombres, fechas, periodos y formatos sin alterar el valor publicado por la fuente.", "We standardize names, dates, periods and formats without changing the value published by the source.")],
                ["04", pick("Validación", "Validation"), pick("Revisamos duplicados, asociaciones incorrectas, valores ausentes y cambios inusuales cuando pueden verificarse.", "We review duplicates, incorrect associations, missing values and unusual changes when they can be verified.")],
                ["05", pick("Historial", "History"), pick("Guardamos snapshots seleccionados para calcular cambios, tendencias y comparaciones entre periodos.", "We store selected snapshots to calculate changes, trends and comparisons between periods.")],
                ["06", pick("Publicación", "Publication"), pick("Mostramos la cifra con su plataforma, periodo, fecha o carácter editorial cuando corresponde.", "We display the figure with its platform, period, date or editorial status when appropriate.")],
              ].map(([number, title, body]) => (
                <div key={number} className="rounded-xl p-5" style={cardStyle}>
                  <div className="text-[10px] font-black tracking-[0.18em] mb-3" style={{ color: G }}>{number}</div>
                  <h3 className="text-xs font-black uppercase tracking-[0.16em] mb-2" style={{ color: "rgba(255,255,255,0.62)" }}>{title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.43)" }}>{body}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-black uppercase tracking-[0.22em] mb-6" style={{ color: G }}>{pick("Qué usamos y para qué", "What we use and why")}</h2>
            <div className="overflow-hidden rounded-xl" style={cardStyle}>
              {[
                ["Spotify, YouTube, Apple Music y Deezer", pick("Listas de plataforma, posiciones, reproducciones y métricas de audiencia cuando están disponibles.", "Platform charts, positions, plays and audience metrics when available.")],
                ["Songstats", pick("Métricas de audiencia e historial obtenidas mediante acceso licenciado; solo se publican campos seleccionados.", "Audience and historical metrics obtained through licensed access; only selected fields are published.")],
                ["Ticketmaster y Pollstar", pick("Eventos, giras y reportes de taquilla, según cobertura y disponibilidad.", "Events, touring and box-office reports, subject to coverage and availability.")],
                ["IFPI y AMPROFON", pick("Reportes de mercado, listas y certificaciones publicadas por organismos de la industria.", "Market reports, charts and certifications published by industry organizations.")],
                [pick("Fuentes oficiales adicionales", "Additional official sources"), pick("Canales de artistas, sellos, distribuidores, recintos y promotores para verificar identidad, catálogo o eventos.", "Artist, label, distributor, venue and promoter channels used to verify identity, catalog or events.")],
              ].map(([source, use], index) => (
                <div key={source} className="grid gap-2 p-5 sm:grid-cols-[210px_1fr]" style={{ borderTop: index ? "1px solid rgba(255,255,255,0.06)" : undefined }}>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: "rgba(255,255,255,0.62)" }}>{source}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.43)" }}>{use}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-black uppercase tracking-[0.22em] mb-6" style={{ color: G }}>{pick("Tipos de ranking", "Ranking types")}</h2>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                [pick("Lista oficial de plataforma", "Official platform chart"), pick("Se reproduce la posición publicada por la fuente. Mexico Charts puede ordenar, buscar o aplicar un filtro identificado, pero no convierte el resultado en un ranking propio.", "The position published by the source is reproduced. Mexico Charts may sort, search or apply an identified filter, but does not turn the result into its own ranking.")],
                [pick("Cálculo o agregado", "Calculation or aggregate"), pick("Mexico Charts calcula un cambio, total o comparación a partir de datos identificados. La plataforma, el periodo y el carácter calculado se indican cuando corresponde.", "Mexico Charts calculates a change, total or comparison from identified data. The platform, period and calculated nature are stated when appropriate.")],
                [pick("Ranking editorial", "Editorial ranking"), pick("Mexico Charts define los criterios y combina señales para producir el orden. MX100 pertenece a esta categoría y su fórmula se documenta abajo.", "Mexico Charts defines the criteria and combines signals to produce the order. MX100 belongs to this category and its formula is documented below.")],
              ].map(([title, body]) => (
                <div key={title} className="rounded-xl p-5" style={cardStyle}>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.17em] mb-3" style={{ color: G }}>{title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.43)" }}>{body}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-black uppercase tracking-[0.22em] mb-6" style={{ color: G }}>{pick("Elegibilidad de artistas", "Artist eligibility")}</h2>
            <div className="rounded-xl p-6 space-y-4" style={cardStyle}>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                {pick("La cobertura se concentra en artistas mexicanos y en artistas vinculados de manera verificable con la música mexicana por origen, trayectoria, repertorio, género, mercado o comunidad cultural. Haber nacido fuera de México no excluye automáticamente a un artista, y aparecer en una lista de México no establece por sí solo la elegibilidad.", "Coverage focuses on Mexican artists and artists verifiably connected to Mexican music through origin, career, repertoire, genre, market or cultural community. Being born outside Mexico does not automatically exclude an artist, and appearing on a Mexico chart does not by itself establish eligibility.")}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                {pick("Los grupos se evalúan como una entidad artística. Las carreras solistas se mantienen separadas de los grupos a los que pertenecen. Una colaboración se atribuye a los artistas acreditados por la fuente; solo se trata como entidad independiente cuando existe un registro propio y señales suficientes para monitorearla. Los alias, cambios de nombre y duplicados se consolidan cuando representan al mismo proyecto artístico.", "Groups are evaluated as an artist entity. Solo careers remain separate from the groups their members belong to. A collaboration is attributed to the artists credited by the source; it is treated as a separate entity only when it has its own record and enough signals to monitor it. Aliases, name changes and duplicates are consolidated when they represent the same artist project.")}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.35)" }}>
                {pick("La inclusión depende también de la cobertura disponible. La ausencia de un artista no implica una evaluación negativa ni una afirmación sobre su nacionalidad o relevancia cultural.", "Inclusion also depends on available coverage. An artist's absence does not imply a negative assessment or a claim about nationality or cultural relevance.")}
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-black uppercase tracking-[0.22em] mb-6" style={{ color: G }}>{pick("Frecuencia de actualización", "Update frequency")}</h2>
            <div className="overflow-hidden rounded-xl" style={cardStyle}>
              {[
                [pick("Listas diarias", "Daily charts"), pick("Se actualizan normalmente cada día cuando la plataforma publica y Mexico Charts recibe una nueva edición.", "Normally updated each day when the platform publishes and Mexico Charts receives a new edition.")],
                [pick("Listas semanales", "Weekly charts"), pick("Se actualizan después de la publicación y procesamiento de la nueva semana de la fuente.", "Updated after the source's new weekly edition is published and processed.")],
                [pick("Audiencia y fanbase", "Audience and fanbase"), pick("Se actualizan periódicamente según la disponibilidad, límites y calendario de cada plataforma o proveedor.", "Updated periodically according to each platform or provider's availability, limits and schedule.")],
                [pick("Giras y certificaciones", "Touring and certifications"), pick("Se actualizan cuando aparecen nuevos eventos, reportes o publicaciones verificables.", "Updated when new verifiable events, reports or publications become available.")],
                ["MX100", pick("Se recalcula cuando cambian sus entradas del ranking de artistas de Spotify México o de audiencia semanal de artistas de YouTube México.", "Recalculated when its Spotify Mexico artist-ranking or YouTube Mexico weekly artist-audience inputs change.")],
              ].map(([dataset, cadence], index) => (
                <div key={dataset} className="grid gap-2 p-5 sm:grid-cols-[210px_1fr]" style={{ borderTop: index ? "1px solid rgba(255,255,255,0.06)" : undefined }}>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: "rgba(255,255,255,0.62)" }}>{dataset}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.43)" }}>{cadence}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "rgba(255,255,255,0.3)" }}>
              {pick("Los horarios no están garantizados: una demora, revisión o cambio técnico de la fuente puede retrasar la actualización. Las fechas de corte de dos plataformas pueden ser distintas.", "Schedules are not guaranteed: a source delay, review or technical change may postpone an update. Two platforms may have different cutoff dates.")}
            </p>
          </section>

          <section>
            <h2 className="text-sm font-black uppercase tracking-[0.22em] mb-6" style={{ color: G }}>{pick("Metodología MX100", "MX100 methodology")}</h2>
            <div className="rounded-xl p-6 mb-4" style={{ background: "rgba(57,255,20,0.04)", border: "1px solid rgba(57,255,20,0.14)" }}>
              <h3 className="text-base font-black uppercase tracking-[0.08em] mb-3" style={{ color: "rgba(255,255,255,0.82)" }}>{pick("Qué mide", "What it measures")}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.52)" }}>
                {pick("MX100 es un ranking editorial calculado por Mexico Charts que ordena hasta 100 artistas de música mexicana actualmente monitoreados a partir de su presencia en listas oficiales de consumo en México. Combina el ranking de artistas de Spotify México y la audiencia semanal de artistas de YouTube México para ofrecer una lectura multiplataforma; no reproduce ninguna de esas listas por separado ni representa necesariamente a la totalidad de artistas mexicanos.", "MX100 is an editorial ranking calculated by Mexico Charts that orders up to 100 currently monitored Mexican-music artists based on their presence in official Mexico consumption charts. It combines the Spotify Mexico artist ranking and YouTube Mexico weekly artist audience for a cross-platform view; it does not reproduce either chart and does not necessarily represent every Mexican artist.")}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2 mb-4">
              {[
                ["Spotify", pick("Utiliza la posición del artista en la lista semanal oficial de Spotify México. La posición funciona como señal de consumo porque Spotify no publica un total semanal de streams por artista y país.", "Uses the artist's position on Spotify Mexico's official weekly chart. Position serves as a consumption signal because Spotify does not publish weekly artist stream totals by country.")],
                ["YouTube", pick("Utiliza la lista semanal oficial de artistas y la audiencia registrada en México durante el periodo disponible.", "Uses the official weekly artist chart and audience recorded in Mexico during the available period.")],
              ].map(([title, body]) => (
                <div key={title} className="rounded-xl p-5" style={cardStyle}>
                  <h3 className="text-xs font-black uppercase tracking-[0.13em] mb-3" style={{ color: G }}>{title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.43)" }}>{body}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {[
                [pick("Elegibilidad por consumo", "Consumption eligibility"), pick("Para entrar a MX100, un artista debe tener al menos una señal verificable dentro del ranking de artistas de Spotify México o la lista semanal de audiencia de artistas de YouTube México.", "To enter MX100, an artist must have at least one verifiable signal within the Spotify Mexico artist ranking or the YouTube Mexico weekly artist-audience chart.")],
                [pick("Datos ausentes", "Missing data"), pick("Una plataforma sin señal disponible no se estima. La ausencia puede deberse a que el artista no aparece en la lista, a diferencias de cobertura o a una demora de la fuente; no equivale necesariamente a ausencia de consumo.", "A platform signal that is unavailable is not estimated. Absence may mean the artist does not appear on the chart, coverage differs or the source is delayed; it does not necessarily mean there was no consumption.")],
                [pick("Protección de integridad", "Integrity protection"), pick("Mexico Charts publica las fuentes, periodos, criterios de elegibilidad y principios generales del ranking. Los coeficientes, transformaciones, límites, desempates y controles de anomalías permanecen internos para reducir intentos de manipulación.", "Mexico Charts publishes the ranking's sources, periods, eligibility criteria and general principles. Coefficients, transformations, caps, tie-breaks and anomaly controls remain internal to reduce manipulation attempts.")],
                [pick("Intervención editorial", "Editorial intervention"), pick("La selección de fuentes y los criterios de elegibilidad son decisiones editoriales. Una vez aplicados, el orden se determina mediante el cálculo interno: no se sube ni se baja manualmente a un artista por preferencia, relación comercial o narrativa editorial.", "Source selection and eligibility criteria are editorial decisions. Once applied, order is determined by the internal calculation: artists are not manually moved up or down because of preference, commercial relationship or editorial narrative.")],
              ].map(([title, body]) => (
                <div key={title} className="rounded-xl p-5" style={cardStyle}>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.17em] mb-3" style={{ color: G }}>{title}</h3>
                  <p className="text-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.43)" }}>{body}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-sm font-black uppercase tracking-[0.22em] mb-6" style={{ color: G }}>{pick("Independencia editorial y comercial", "Editorial and commercial independence")}</h2>
            <div className="rounded-xl p-6 space-y-4" style={cardStyle}>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                {pick("Mexico Charts opera de manera editorialmente independiente. La posición de un artista, la cobertura de un lanzamiento y la presentación de una cifra no se modifican para favorecer o perjudicar a artistas, sellos, distribuidores, representantes, proveedores de datos, anunciantes, socios comerciales o preferencias personales.", "Mexico Charts operates with editorial independence. An artist's position, release coverage and the presentation of a figure are not changed to favor or disadvantage artists, labels, distributors, representatives, data providers, advertisers, commercial partners or personal preferences.")}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                {pick("Licenciar datos o mantener una relación comercial con un proveedor no le concede control sobre los rankings, criterios editoriales, análisis o decisiones de publicación de Mexico Charts. Las relaciones relevantes que puedan representar un conflicto de interés deben identificarse cuando corresponda.", "Licensing data or maintaining a commercial relationship with a provider does not give that provider control over Mexico Charts rankings, editorial criteria, analysis or publication decisions. Relevant relationships that may represent a conflict of interest must be identified when appropriate.")}
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-sm font-black uppercase tracking-[0.22em] mb-6" style={{ color: G }}>{pick("Correcciones e historial", "Corrections and history")}</h2>
            <div className="rounded-xl p-6 space-y-4" style={cardStyle}>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                {pick("Cuando Mexico Charts identifica un error de asociación, transcripción, cálculo o presentación, corrige el registro y vuelve a calcular los resultados afectados cuando es técnicamente posible. Una corrección puede cambiar una cifra, perfil, comparación o posición histórica.", "When Mexico Charts identifies an association, transcription, calculation or presentation error, it corrects the record and recalculates affected results when technically possible. A correction may change a figure, profile, comparison or historical position.")}
              </p>
              <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.5)" }}>
                {pick("Si una fuente revisa o elimina datos, Mexico Charts puede actualizar su copia para reflejar la información más reciente. Los snapshots históricos pueden conservar el valor disponible en la fecha original cuando son necesarios para documentar una serie; en ese caso, una revisión posterior debe distinguirse del dato observado originalmente.", "If a source revises or removes data, Mexico Charts may update its copy to reflect the latest information. Historical snapshots may retain the value available on the original date when needed to document a series; in that case, a later revision should be distinguished from the originally observed data.")}
              </p>
            </div>
          </section>

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
