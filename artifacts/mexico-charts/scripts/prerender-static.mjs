import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { artistProfileRoutes } from "./artist-profile-routes.mjs";
import { buildStructuredDataGraph } from "../src/lib/structured-data.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "dist", "public");
const baseHtmlPath = path.join(outDir, "index.html");
const siteUrl = "https://mexicochart.com";
const ogImage = `${siteUrl}/opengraph.jpg`;

const routes = [
  {
    path: "/",
    title: "Charts de música mexicana, artistas e industria | Mexico Charts",
    description:
      "Descubre quién lidera la música mexicana con charts de Spotify, YouTube, Apple Music y Deezer, perfiles de artistas, streaming, giras y certificaciones.",
    eyebrow: "Mexico Charts",
    heading: "La industria de la música mexicana, en movimiento",
    body:
      "Mexico Charts es una plataforma independiente que reúne charts, perfiles de artistas y cobertura de la industria de la música mexicana.",
    links: [
      ["/charts", "Charts Mexico"],
      ["/artists", "Artistas"],
      ["/industria", "Industria"],
      ["/touring", "Touring"],
      ["/metodologia", "Metodologia"],
    ],
  },
  {
    path: "/charts",
    title: "Charts de música en México — Spotify, YouTube, Apple Music y Deezer",
    description:
      "Charts diarios y semanales de música en México con fuente, fecha de actualización y rankings de Spotify, YouTube, Apple Music y Deezer.",
    eyebrow: "Mexico Charts",
    heading: "Charts de música en México",
    body:
      "Un hub consolidado de rankings para el mercado mexicano con listas de Spotify, YouTube, Apple Music y Deezer en un solo lugar.",
    sections: [
      ["Rankings por plataforma", "Consulta canciones, artistas, videos y álbumes según las listas disponibles de cada servicio para México."],
      ["Actualización y fuentes", "Las listas se actualizan de forma diaria, semanal o intradía según el calendario de cada plataforma, con su fuente y fecha visibles."],
    ],
    links: [
      ["/charts", "Charts"],
      ["/metodologia", "Metodologia"],
    ],
  },
  {
    path: "/esta-semana",
    title: "Esta semana — artistas mexicanos en Spotify, YouTube, Apple Music y Deezer",
    description:
      "Los artistas mexicanos destacados esta semana en las listas oficiales de Spotify, YouTube, Apple Music y Deezer.",
    eyebrow: "Mexico Charts · Esta semana",
    heading: "Mexicanos destacados por plataforma",
    body:
      "Una lectura semanal de las posiciones ocupadas por artistas mexicanos en Spotify, YouTube, Apple Music y Deezer, conservando el puesto original de cada lista.",
    links: [
      ["/esta-semana", "Esta semana"],
      ["/charts", "Todas las listas"],
      ["/metodologia", "Metodologia"],
    ],
  },
  {
    path: "/mx100",
    title: "Mexico Charts Top 100 — MX100",
    description:
      "Ranking editorial de artistas de música mexicana que combina el ranking de artistas de Spotify México y la audiencia semanal de artistas de YouTube México.",
    eyebrow: "MX100",
    heading: "Mexico Charts Top 100",
    body:
      "El ranking editorial de Mexico Charts combina el ranking de artistas de Spotify México y la audiencia semanal de artistas de YouTube México para ordenar artistas de música mexicana.",
    links: [
      ["/mx100", "MX100"],
      ["/artists", "Artistas"],
      ["/charts", "Charts"],
      ["/metodologia", "Metodologia"],
    ],
  },
  {
    path: "/radar-nuevos",
    title: "Radar Nuevos — Mexico Charts",
    description:
      "Ranking editorial de artistas nuevos y emergentes en música mexicana: primeras señales, etapa de descubrimiento, consumo actual y potencial de breakout.",
    eyebrow: "Radar Nuevos",
    heading: "Artistas en primer impulso",
    body:
      "Una lectura editorial de artistas nuevos, emergentes o en etapa de primer gran breakout dentro de la música mexicana.",
    links: [
      ["/radar-nuevos", "Radar Nuevos"],
      ["/mx100", "MX100"],
      ["/charts", "Charts"],
      ["/artists", "Artistas"],
    ],
  },
  {
    path: "/artists",
    title: "Artistas de musica mexicana — Mexico Charts",
    description:
      "Base de datos de artistas mexicanos y música mexicana con estadísticas de streaming, redes sociales, charts, audiencia y contexto de crecimiento.",
    eyebrow: "Artistas",
    heading: "Base de datos de artistas mexicanos",
    body:
      "Perfiles de artistas de música mexicana con información organizada sobre audiencia, streaming, redes sociales, charts y certificaciones disponibles.",
    links: [
      ["/artists", "Artistas"],
      ["/charts", "Charts"],
      ["/metodologia", "Metodologia"],
    ],
  },
  {
    path: "/compare",
    title: "Comparar artistas — Mexico Charts",
    description:
      "Compara dos perfiles de artistas lado a lado con señales de streaming, YouTube, social, certificaciones, giras y presencia en listas.",
    eyebrow: "Herramienta Mexico Charts",
    heading: "Comparar artistas",
    body:
      "Selecciona dos artistas y compara señales editoriales de Mexico Charts: ranking, streaming, YouTube, certificaciones, touring y presencia en listas.",
    links: [
      ["/compare", "Comparar"],
      ["/artists", "Artistas"],
      ["/mx100", "MX100"],
    ],
  },
  {
    path: "/monitoreo",
    title: "Monitoreo de artistas — Mexico Charts",
    description:
      "Monitorea artistas elegibles con historial acumulado, métricas de audiencia, streaming y planes desde $6 USD al mes.",
    eyebrow: "Mexico Charts Monitor",
    heading: "Sigue la evolución de tus artistas",
    body:
      "Planes de monitoreo para conservar el historial disponible de audiencia, streaming y catálogo de artistas elegibles.",
    links: [
      ["/monitoreo", "Monitoreo"],
      ["/artists", "Artistas"],
      ["/terminos", "Términos"],
      ["/privacidad", "Privacidad"],
    ],
  },
  {
    path: "/legacy-acts",
    title: "Legacy Acts — Mexico Charts",
    description:
      "Ranking editorial de legacy acts de música mexicana con consumo histórico, audiencia actual, seguidores y señales de catálogo.",
    eyebrow: "Catalogo",
    heading: "Legacy Acts",
    body:
      "Una lectura editorial de carreras históricas y catálogo vigente dentro de la música mexicana, conectando consumo histórico con señales actuales.",
    links: [
      ["/legacy-acts", "Legacy Acts"],
      ["/mx100", "MX100"],
      ["/artists", "Artistas"],
    ],
  },
  {
    path: "/industria",
    title: "Industria musical mexicana — IFPI, AMPROFON y mercado",
    description:
      "Datos de la industria musical mexicana, mercado de música grabada, crecimiento digital, certificaciones y fuentes como IFPI y AMPROFON.",
    eyebrow: "Industria",
    heading: "Industria musical mexicana",
    body:
      "Análisis del mercado de música grabada en México, crecimiento digital, certificaciones, reportes de IFPI y datos atribuidos a AMPROFON.",
    links: [
      ["/industria", "Industria"],
      ["/industry/certifications", "Certificaciones"],
      ["/metodologia", "Metodologia"],
    ],
  },
  {
    path: "/generos",
    title: "Generos de musica mexicana — Mexico Charts",
    description:
      "Mapa editorial de géneros, subgéneros y escenas de la música mexicana con artistas, charts y tendencias de streaming.",
    eyebrow: "Generos",
    heading: "El mapa de generos mexicanos",
    body:
      "Explora corridos, regional mexicano, banda, norteño, sierreño, tumbados y otras escenas con contexto editorial y datos conectados a artistas y charts.",
    links: [
      ["/generos", "Generos"],
      ["/artists", "Artistas"],
      ["/charts", "Charts"],
    ],
  },
  {
    path: "/industry/certifications",
    title: "Certificaciones AMPROFON — Mexico Charts",
    description:
      "Certificaciones de la industria musical mexicana con fuente AMPROFON, niveles de oro, platino y diamante, y datos organizados por artista.",
    eyebrow: "Certificaciones",
    heading: "Certificaciones de musica en Mexico",
    body:
      "Explora certificaciones de álbumes y sencillos en México con datos atribuidos a AMPROFON, niveles de oro, platino y diamante, y resumen por artista.",
    links: [
      ["/industry/certifications", "Certificaciones"],
      ["/industria", "Industria"],
      ["/metodologia", "Metodologia"],
    ],
  },
  {
    path: "/insights/mexico-top-10-ifpi-2026",
    title: "Mexico Top 10 IFPI 2026 — Mexico Charts",
    description:
      "Insight editorial sobre el Top 10 de México en IFPI 2026, mercado de música grabada, streaming y contexto de la música mexicana.",
    eyebrow: "Insight",
    heading: "Mexico Top 10 IFPI 2026",
    body:
      "Lectura editorial del reporte IFPI con foco en México, artistas destacados, mercado digital y el crecimiento de la música mexicana.",
    links: [
      ["/insights/mexico-top-10-ifpi-2026", "Insight IFPI"],
      ["/industria", "Industria"],
      ["/charts", "Charts"],
    ],
  },
  {
    path: "/touring",
    title: "Touring Mexico — artistas mexicanos en gira",
    description:
      "Conciertos y giras de artistas mexicanos con fechas, ciudades, recintos y enlaces oficiales de boletos.",
    eyebrow: "Touring",
    heading: "La musica mexicana en vivo",
    body:
      "Agenda de shows y artistas en gira. Mexico Charts presenta fechas públicas y enlaces oficiales de boletos de Ticketmaster.",
    links: [
      ["/touring", "Touring"],
      ["/metodologia", "Metodologia"],
    ],
  },
  {
    path: "/metodologia",
    title: "Metodologia — Mexico Charts",
    description:
      "Cómo Mexico Charts recopila, organiza y presenta datos de música mexicana, charts, streaming, touring, industria y certificaciones.",
    eyebrow: "Metodologia",
    heading: "Como trabajamos los datos",
    body:
      "Mexico Charts recopila, identifica, normaliza, valida y presenta datos públicos, oficiales o licenciados. Conservamos las posiciones originales de las listas externas y distinguimos los cálculos, agregados y rankings editoriales propios.",
    sections: [
      [
        "Fuentes y actualización",
        "Usamos datos de Spotify, YouTube, Apple Music, Deezer, Songstats, Ticketmaster, Pollstar, IFPI, AMPROFON y otras fuentes verificables según la sección. Las listas diarias y semanales se actualizan cuando recibimos una nueva edición; audiencia, giras y certificaciones dependen del calendario y disponibilidad de cada fuente.",
      ],
      [
        "Elegibilidad",
        "La cobertura se concentra en artistas mexicanos y artistas vinculados de manera verificable con la música mexicana por origen, trayectoria, repertorio, género, mercado o comunidad cultural. Grupos, carreras solistas, colaboraciones, alias y duplicados se identifican como entidades separadas o consolidadas según corresponda.",
      ],
      [
        "MX100",
        "MX100 calcula hasta 100 posiciones elegibles activas entre los artistas actualmente monitoreados a partir del ranking de artistas de Spotify México y la audiencia semanal de artistas de YouTube México. El número puede ser menor si no hay suficientes señales válidas.",
      ],
      [
        "Integridad del ranking",
        "Mexico Charts publica las fuentes, periodos, criterios de elegibilidad y principios generales. Los coeficientes, transformaciones, límites, desempates y controles de anomalías permanecen internos para reducir intentos de manipulación.",
      ],
      [
        "Independencia y correcciones",
        "Las posiciones no se modifican para favorecer artistas, sellos, representantes, proveedores, anunciantes o socios. Licenciar datos no concede control editorial. Los errores identificados se corrigen y los resultados afectados se recalculan cuando es técnicamente posible.",
      ],
    ],
    links: [
      ["/charts", "Charts"],
      ["/artists", "Artistas"],
      ["/industria", "Industria"],
      ["/touring", "Touring"],
    ],
  },
  {
    path: "/fuentes-de-datos",
    title: "Fuentes de datos de artistas — Mexico Charts",
    description:
      "Conoce las plataformas, métricas, cobertura y proceso de verificación de los datos de artistas en Mexico Charts.",
    eyebrow: "Fuentes de datos",
    heading: "Datos de artistas, con contexto",
    body:
      "Mexico Charts reúne señales de audiencia, streaming y crecimiento, las vincula al perfil canónico del artista y conserva su contexto de plataforma y fecha.",
    links: [
      ["/artists", "Artistas"],
      ["/charts", "Charts"],
      ["/metodologia", "Metodología"],
    ],
  },
  {
    path: "/acerca-de",
    title: "Acerca de Mexico Charts — Datos y cultura de la música mexicana",
    description:
      "Mexico Charts es una plataforma independiente de datos sobre música mexicana, listas, artistas, streaming, industria, certificaciones y giras.",
    eyebrow: "Acerca de",
    heading: "Mexico Charts",
    body:
      "Mexico Charts organiza charts, artistas, industria, certificaciones y touring de la música mexicana con una mirada editorial independiente.",
    links: [
      ["/metodologia", "Metodologia"],
      ["/charts", "Charts"],
    ],
  },
  {
    path: "/contacto",
    title: "Contacto — Mexico Charts",
    description:
      "Contacto de Mexico Charts para colaboraciones, correcciones de datos, prensa, propuestas editoriales y oportunidades relacionadas con música mexicana.",
    eyebrow: "Contacto",
    heading: "Contacto Mexico Charts",
    body:
      "Canal de contacto para colaboraciones, correcciones de datos, preguntas editoriales y propuestas relacionadas con Mexico Charts.",
    links: [
      ["/contacto", "Contacto"],
      ["/metodologia", "Metodologia"],
    ],
  },
  {
    path: "/contribuir",
    title: "Contribuye — Corrige perfiles y solicita artistas | Mexico Charts",
    description:
      "Ayuda a Mexico Charts a verificar enlaces oficiales, corregir perfiles y priorizar nuevos artistas relacionados con la música mexicana.",
    eyebrow: "Comunidad Mexico Charts",
    heading: "Ayúdanos a hacerlo mejor",
    body:
      "Envía enlaces oficiales, corrige información de un perfil o solicita la incorporación de un artista. Cada aporte pasa por revisión editorial.",
    links: [
      ["/artists", "Artistas"],
      ["/contacto", "Contacto"],
    ],
  },
  {
    path: "/privacidad",
    title: "Privacidad — Mexico Charts",
    description:
      "Política de privacidad de Mexico Charts: uso del sitio, analítica, cookies, servicios externos y manejo de información relacionada con mexicochart.com.",
    eyebrow: "Privacidad",
    heading: "Privacidad",
    body:
      "Información de privacidad y uso del sitio de Mexico Charts para visitantes, colaboradores y lectores.",
    links: [
      ["/privacidad", "Privacidad"],
      ["/contacto", "Contacto"],
    ],
  },
  {
    path: "/terminos",
    title: "Términos de uso — Mexico Charts",
    description: "Términos generales para el uso de Mexico Charts y sus cuentas gratuitas.",
    eyebrow: "Mexico Charts",
    heading: "Términos de uso",
    body: "Condiciones generales para usar Mexico Charts y sus cuentas gratuitas.",
    links: [
      ["/privacidad", "Privacidad"],
      ["/contacto", "Contacto"],
    ],
  },
];

routes.push(
  ...artistProfileRoutes.map((artist) => ({
    path: artist.path,
    title: `${artist.name} — Perfil de artista | Mexico Charts`,
    description: `${artist.name}: perfil de artista con ${artist.context}. Datos organizados por Mexico Charts.`,
    eyebrow: "Perfil de artista",
    heading: artist.name,
    body: `Perfil de ${artist.name} en Mexico Charts con estadísticas de streaming, YouTube, Spotify, charts, señales de momentum, certificaciones y contexto editorial cuando hay datos disponibles.`,
    links: [
      ["/artists", "Artistas"],
      ["/charts", "Charts"],
      ["/mx100", "MX100"],
      ["/metodologia", "Metodologia"],
    ],
  })),
);

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function canonical(routePath) {
  return routePath === "/" ? `${siteUrl}/` : `${siteUrl}${routePath}`;
}

function updateHead(html, route) {
  const url = canonical(route.path);
  const title = escapeHtml(route.title);
  const description = escapeHtml(route.description);

  return html
    .replace(/<title>.*?<\/title>/s, `<title>${title}</title>`)
    .replace(
      /<meta name="description" content=".*?" \/>/s,
      `<meta name="description" content="${description}" />`,
    )
    .replace(/<link rel="canonical" href=".*?" \/>/s, `<link rel="canonical" href="${url}" />`)
    .replace(/<meta property="og:title" content=".*?" \/>/s, `<meta property="og:title" content="${title}" />`)
    .replace(
      /<meta property="og:description" content=".*?" \/>/s,
      `<meta property="og:description" content="${description}" />`,
    )
    .replace(/<meta property="og:url" content=".*?" \/>/s, `<meta property="og:url" content="${url}" />`)
    .replace(/<meta property="og:image" content=".*?" \/>/s, `<meta property="og:image" content="${ogImage}" />`)
    .replace(/<meta property="og:image:alt" content=".*?" \/>/s, `<meta property="og:image:alt" content="${title}" />`)
    .replace(/<meta name="twitter:title" content=".*?" \/>/s, `<meta name="twitter:title" content="${title}" />`)
    .replace(
      /<meta name="twitter:description" content=".*?" \/>/s,
      `<meta name="twitter:description" content="${description}" />`,
    )
    .replace(/<meta name="twitter:image" content=".*?" \/>/s, `<meta name="twitter:image" content="${ogImage}" />`)
    .replace(
      /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
      `<script type="application/ld+json">
    ${JSON.stringify(
      buildStructuredDataGraph({
        title: route.title,
        description: route.description,
        canonicalUrl: url,
      }),
      null,
      6,
    )}
    </script>`,
    );
}

function renderContent(route) {
  const links = route.links
    .map(([href, label]) => `<a href="${href}">${escapeHtml(label)}</a>`)
    .join("");
  const sections = (route.sections ?? [])
    .map(([heading, body]) => `<section><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(body)}</p></section>`)
    .join("");

  return `<div id="prerender-content" class="prerender-content">
      <main>
        <p class="prerender-eyebrow">${escapeHtml(route.eyebrow)}</p>
        <h1>${escapeHtml(route.heading)}</h1>
        <p>${escapeHtml(route.body)}</p>
        ${sections}
        <nav aria-label="Secciones principales">${links}</nav>
      </main>
    </div>
    <script>document.getElementById("prerender-content")?.remove();</script>`;
}

function injectContent(html, route) {
  const styles = `<style>
      .prerender-content {
        min-height: 100vh;
        background: #080808;
        color: #fff;
        font-family: Inter, system-ui, sans-serif;
        display: flex;
        align-items: center;
        padding: 48px 28px;
      }
      .prerender-content main { max-width: 860px; }
      .prerender-content h1 {
        margin: 0;
        font-size: clamp(2.5rem, 8vw, 5rem);
        line-height: 0.92;
        text-transform: uppercase;
        letter-spacing: 0;
      }
      .prerender-content p {
        max-width: 58ch;
        color: rgba(255,255,255,0.68);
        line-height: 1.7;
      }
      .prerender-content section {
        margin-top: 28px;
        padding-top: 20px;
        border-top: 1px solid rgba(255,255,255,0.08);
      }
      .prerender-content h2 {
        margin: 0;
        color: #39FF14;
        font-size: 0.78rem;
        text-transform: uppercase;
        letter-spacing: 0.16em;
      }
      .prerender-eyebrow {
        color: #39FF14 !important;
        font-size: 0.7rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.24em;
      }
      .prerender-content nav {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 24px;
      }
      .prerender-content a {
        color: #39FF14;
        border: 1px solid rgba(57,255,20,0.28);
        padding: 9px 12px;
        text-decoration: none;
        text-transform: uppercase;
        font-size: 0.68rem;
        font-weight: 800;
        letter-spacing: 0.14em;
      }
    </style>`;

  return html
    .replace("</head>", `${styles}\n  </head>`)
    .replace('<div id="root"></div>', `${renderContent(route)}\n    <div id="root"></div>`);
}

async function writeRoute(baseHtml, route) {
  const html = injectContent(updateHead(baseHtml, route), route);
  if (route.path === "/") {
    await writeFile(baseHtmlPath, html);
    return;
  }

  const cleanRoutePath = path.join(outDir, route.path.slice(1));
  const hasChildRoutes = routes.some(
    (candidate) => candidate.path !== route.path && candidate.path.startsWith(`${route.path}/`),
  );

  if (hasChildRoutes) {
    // Parent routes such as /touring need a directory so child routes can exist.
    try {
      const st = statSync(cleanRoutePath);
      if (st.isFile()) {
        await rm(cleanRoutePath, { force: true });
      }
    } catch { /* doesn't exist — safe to proceed */ }

    await mkdir(cleanRoutePath, { recursive: true });
    await writeFile(path.join(cleanRoutePath, "index.html"), html);
    return;
  }

  await mkdir(path.dirname(cleanRoutePath), { recursive: true });
  try {
    const st = statSync(cleanRoutePath);
    if (st.isDirectory()) {
      await rm(cleanRoutePath, { recursive: true, force: true });
    }
  } catch { /* doesn't exist — safe to proceed */ }

  await writeFile(cleanRoutePath, html);
}

function buildArtistAliasRedirect(baseHtml, artist) {
  const redirectScript = `<script>window.location.replace(${JSON.stringify(artist.path)});</script>`;
  return updateHead(baseHtml, {
    path: artist.path,
    title: `${artist.name} — Perfil de artista | Mexico Charts`,
    description: `Redirección al perfil canónico de ${artist.name} en Mexico Charts.`,
  })
    .replace(/<meta name="robots" content=".*?" \/>/s, '<meta name="robots" content="noindex,follow" />')
    .replace(
      "</head>",
      `  <meta http-equiv="refresh" content="0; url=${artist.path}" />\n  ${redirectScript}\n</head>`,
    )
    .replace(
      '<div id="root"></div>',
      `<main style="min-height:100vh;background:#050505;color:#fff;display:grid;place-items:center;font-family:system-ui,sans-serif"><p>Redirigiendo al perfil de ${escapeHtml(artist.name)}…</p></main><div id="root"></div>`,
    );
}

async function writeAliasRedirect(baseHtml, aliasPath, artist) {
  const html = buildArtistAliasRedirect(baseHtml, artist);
  const outputPath = path.join(outDir, aliasPath.slice(1));
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html);
}

const baseHtml = await readFile(baseHtmlPath, "utf8");
for (const route of routes) {
  await writeRoute(baseHtml, route);
}

const canonicalArtistSlugs = new Set(artistProfileRoutes.map((artist) => artist.path.replace(/^\/artist\//, "")));
const compactAliases = new Map();
const ambiguousCompactAliases = new Set();
for (const artist of artistProfileRoutes) {
  const slug = artist.path.replace(/^\/artist\//, "");
  const compact = slug.replace(/-/g, "");
  if (!compact || compact === slug || canonicalArtistSlugs.has(compact) || ambiguousCompactAliases.has(compact)) continue;
  const existing = compactAliases.get(compact);
  if (existing && existing.path !== artist.path) {
    compactAliases.delete(compact);
    ambiguousCompactAliases.add(compact);
  } else {
    compactAliases.set(compact, artist);
  }
}
for (const [compact, artist] of compactAliases) {
  await writeAliasRedirect(baseHtml, `/artist/${compact}`, artist);
}

console.log(`Prerendered ${routes.length} static route shells and ${compactAliases.size} canonical artist alias redirects.`);
