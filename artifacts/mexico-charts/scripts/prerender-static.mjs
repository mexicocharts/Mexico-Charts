import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "dist", "public");
const baseHtmlPath = path.join(outDir, "index.html");
const siteUrl = "https://mexicochart.com";
const ogImage = `${siteUrl}/opengraph.jpg`;

const routes = [
  {
    path: "/",
    title: "Mexico Charts — Datos, charts y contexto de la musica mexicana",
    description:
      "Mexico Charts presenta charts de música mexicana, artistas, streaming, industria, certificaciones y touring con fuentes como Spotify, YouTube, IFPI, AMPROFON, Pollstar y Ticketmaster.",
    eyebrow: "Mexico Charts",
    heading: "Datos, charts y contexto de la musica mexicana",
    body:
      "Una plataforma independiente sobre música mexicana: charts de Spotify, YouTube, Apple Music y Deezer; perfiles de artistas; industria; touring; certificaciones y metodología.",
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
    title: "Charts Mexico — YouTube, Spotify, Apple Music y Deezer",
    description:
      "Charts diarios y semanales de música en México con fuente, fecha de actualización y rankings de Spotify, YouTube, Apple Music y Deezer.",
    eyebrow: "Charts Mexico",
    heading: "Charts de musica en Mexico",
    body:
      "Rankings de YouTube, Spotify, Apple Music y Deezer para México. Incluye fuente de cada plataforma, fecha de actualización y vista filtrada por artistas mexicanos cuando aplica.",
    links: [
      ["/charts", "Charts"],
      ["/metodologia", "Metodologia"],
    ],
  },
  {
    path: "/mx100",
    title: "Mexico Charts Top 100 — MX100",
    description:
      "Ranking editorial de Mexico Charts que mide a los artistas más exitosos de la música mexicana a partir de Spotify semanal, YouTube México, fanbase y giras.",
    eyebrow: "MX100",
    heading: "Mexico Charts Top 100",
    body:
      "El ranking editorial de Mexico Charts combina señales de streaming, YouTube México, fanbase, touring y presencia en listas para ordenar artistas de música mexicana.",
    links: [
      ["/mx100", "MX100"],
      ["/artists", "Artistas"],
      ["/charts", "Charts"],
      ["/metodologia", "Metodologia"],
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
      "Consulta certificaciones de álbumes y sencillos en México con datos atribuidos a AMPROFON, niveles de oro, platino y diamante, y resumen por artista.",
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
      "Conciertos, giras y perfiles de touring de artistas mexicanos con fechas de Ticketmaster y datos de Pollstar cuando están disponibles.",
    eyebrow: "Touring",
    heading: "La musica mexicana en vivo",
    body:
      "Agenda de shows, artistas en gira y perfiles editoriales de touring. Mexico Charts usa Ticketmaster para fechas públicas y Pollstar para perfiles históricos cuando hay datos disponibles.",
    links: [
      ["/touring", "Touring"],
      ["/touring/peso-pluma", "Peso Pluma"],
      ["/touring/junior-h", "Junior H"],
      ["/touring/luis-miguel", "Luis Miguel"],
      ["/metodologia", "Metodologia"],
    ],
  },
  {
    path: "/touring/peso-pluma",
    title: "Peso Pluma Touring — Mexico Charts",
    description:
      "Perfil de touring de Peso Pluma con contexto editorial de giras, mercado en vivo y señales de música mexicana.",
    eyebrow: "Touring",
    heading: "Peso Pluma en vivo",
    body:
      "Perfil editorial de touring para Peso Pluma dentro de Mexico Charts, con contexto de fechas, mercado en vivo y señales de crecimiento.",
    links: [
      ["/touring", "Touring"],
      ["/touring/junior-h", "Junior H"],
      ["/touring/luis-miguel", "Luis Miguel"],
    ],
  },
  {
    path: "/touring/junior-h",
    title: "Junior H Touring — Mexico Charts",
    description:
      "Perfil de touring de Junior H con contexto editorial de giras, fechas activas y señales del mercado en vivo.",
    eyebrow: "Touring",
    heading: "Junior H en vivo",
    body:
      "Perfil editorial de touring para Junior H dentro de Mexico Charts, con contexto de fechas, mercado en vivo y señales de la escena sierreña.",
    links: [
      ["/touring", "Touring"],
      ["/touring/peso-pluma", "Peso Pluma"],
      ["/touring/luis-miguel", "Luis Miguel"],
    ],
  },
  {
    path: "/touring/luis-miguel",
    title: "Luis Miguel Touring — Mexico Charts",
    description:
      "Perfil de touring de Luis Miguel con contexto editorial de giras, mercado en vivo y datos históricos del espectáculo latino.",
    eyebrow: "Touring",
    heading: "Luis Miguel en vivo",
    body:
      "Perfil editorial de touring para Luis Miguel dentro de Mexico Charts, con contexto de giras, recintos, taquilla y mercado latino en vivo.",
    links: [
      ["/touring", "Touring"],
      ["/touring/peso-pluma", "Peso Pluma"],
      ["/touring/junior-h", "Junior H"],
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
      "Mexico Charts organiza datos de plataformas y fuentes externas. Los charts conservan posiciones originales, los filtros editoriales se identifican claramente y las fuentes se muestran cuando corresponde.",
    links: [
      ["/charts", "Charts"],
      ["/artists", "Artistas"],
      ["/industria", "Industria"],
      ["/touring", "Touring"],
    ],
  },
  {
    path: "/tavus-preview",
    title: "Video Tavus — Mexico Charts",
    description:
      "Vista editorial de un video Tavus integrado dentro de Mexico Charts como resumen semanal de charts, artistas y señales de música mexicana.",
    eyebrow: "Video editorial",
    heading: "Mexico Charts en video",
    body:
      "Preview interno de un módulo de video narrado para Mexico Charts, pensado como resumen semanal con señales de Spotify, YouTube, artistas y contexto editorial.",
    links: [
      ["/", "Inicio"],
      ["/charts", "Charts"],
      ["/artist-momentum", "Momentum"],
      ["/touring", "Touring"],
    ],
  },
  {
    path: "/acerca-de",
    title: "Acerca de Mexico Charts",
    description:
      "Mexico Charts es una plataforma independiente de datos sobre música mexicana, charts, artistas, streaming, industria, certificaciones y touring.",
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
];

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
      {
        "@context": "https://schema.org",
        "@type": route.path === "/" ? "WebSite" : "WebPage",
        name: route.title,
        url,
        description: route.description,
        inLanguage: "es-MX",
        ...(route.path === "/"
          ? {
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: `${siteUrl}/artists?q={search_term_string}`,
                },
                "query-input": "required name=search_term_string",
              },
            }
          : {}),
      },
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

  return `<div id="prerender-content" class="prerender-content">
      <main>
        <p class="prerender-eyebrow">${escapeHtml(route.eyebrow)}</p>
        <h1>${escapeHtml(route.heading)}</h1>
        <p>${escapeHtml(route.body)}</p>
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
      .prerender-content main { max-width: 760px; }
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

  const routeFile = path.join(outDir, route.path.slice(1));
  await mkdir(path.dirname(routeFile), { recursive: true });
  await writeFile(routeFile, html);
}

const baseHtml = await readFile(baseHtmlPath, "utf8");
for (const route of routes) {
  await writeRoute(baseHtml, route);
}

console.log(`Prerendered ${routes.length} static route shells.`);
