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
      "Mexico Charts presenta charts, artistas, industria y touring de la musica mexicana con fuentes claras y contexto editorial.",
    eyebrow: "Mexico Charts",
    heading: "Datos, charts y contexto de la musica mexicana",
    body:
      "Una plataforma independiente sobre musica mexicana: charts de Spotify, YouTube, Apple Music y Deezer; perfiles de artistas; industria; touring; certificaciones y metodologia.",
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
      "Charts diarios y semanales de musica en Mexico con fuente, fecha de actualizacion y filtros editoriales de Mexico Charts.",
    eyebrow: "Charts Mexico",
    heading: "Charts de musica en Mexico",
    body:
      "Rankings de YouTube, Spotify, Apple Music y Deezer para Mexico. Incluye fuente de cada plataforma, fecha de actualizacion y vista filtrada por artistas mexicanos cuando aplica.",
    links: [
      ["/charts", "Charts"],
      ["/metodologia", "Metodologia"],
    ],
  },
  {
    path: "/artists",
    title: "Artistas de musica mexicana — Mexico Charts",
    description:
      "Base editorial de artistas mexicanos con datos de streaming, redes, charts y contexto de crecimiento.",
    eyebrow: "Artistas",
    heading: "Base de datos de artistas mexicanos",
    body:
      "Perfiles de artistas de musica mexicana con informacion organizada sobre audiencia, streaming, redes sociales, charts y certificaciones disponibles.",
    links: [
      ["/artists", "Artistas"],
      ["/charts", "Charts"],
      ["/metodologia", "Metodologia"],
    ],
  },
  {
    path: "/industria",
    title: "Industria musical mexicana — IFPI, AMPROFON y mercado",
    description:
      "Contexto y datos de la industria musical mexicana con fuentes como IFPI y AMPROFON.",
    eyebrow: "Industria",
    heading: "Industria musical mexicana",
    body:
      "Analisis del mercado de musica grabada en Mexico, crecimiento digital, certificaciones, reportes de IFPI y datos atribuidos a AMPROFON.",
    links: [
      ["/industria", "Industria"],
      ["/industry/certifications", "Certificaciones"],
      ["/metodologia", "Metodologia"],
    ],
  },
  {
    path: "/touring",
    title: "Touring Mexico — artistas mexicanos en gira",
    description:
      "Conciertos, giras y perfiles de touring de artistas mexicanos con datos de Ticketmaster y Pollstar cuando estan disponibles.",
    eyebrow: "Touring",
    heading: "La musica mexicana en vivo",
    body:
      "Agenda de shows, artistas en gira y perfiles editoriales de touring. Mexico Charts usa Ticketmaster para fechas publicas y Pollstar para perfiles historicos cuando hay datos disponibles.",
    links: [
      ["/touring", "Touring"],
      ["/touring/junior-h", "Junior H"],
      ["/touring/luis-miguel", "Luis Miguel"],
      ["/metodologia", "Metodologia"],
    ],
  },
  {
    path: "/metodologia",
    title: "Metodologia — Mexico Charts",
    description:
      "Como Mexico Charts recopila, organiza y presenta datos de musica, charts, touring, industria y certificaciones.",
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
