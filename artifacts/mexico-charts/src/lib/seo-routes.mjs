const routes = [
  ["/", "Charts de música mexicana, artistas e industria | Mexico Charts", "Descubre quién lidera la música mexicana con charts de Spotify, YouTube, Apple Music y Deezer, perfiles de artistas, streaming, giras y certificaciones."],
  ["/charts", "Charts de música en México — Spotify, YouTube, Apple Music y Deezer", "Charts diarios y semanales de música en México con fuente, fecha de actualización y rankings de Spotify, YouTube, Apple Music y Deezer."],
  ["/esta-semana", "Esta semana — artistas mexicanos en Spotify, YouTube, Apple Music y Deezer", "Los artistas mexicanos destacados esta semana en las listas oficiales de Spotify, YouTube, Apple Music y Deezer."],
  ["/mx100", "Mexico Charts Top 100 — MX100", "Ranking editorial de artistas de música mexicana que combina el ranking de artistas de Spotify México y la audiencia semanal de artistas de YouTube México."],
  ["/radar-nuevos", "Radar Nuevos — Mexico Charts", "Ranking editorial de artistas nuevos y emergentes en música mexicana: primeras señales, etapa de descubrimiento, consumo actual y potencial de breakout."],
  ["/artists", "Artistas de musica mexicana — Mexico Charts", "Base de datos de artistas mexicanos y música mexicana con estadísticas de streaming, redes sociales, charts, audiencia y contexto de crecimiento."],
  ["/compare", "Comparar artistas — Mexico Charts", "Compara dos perfiles de artistas lado a lado con señales de streaming, YouTube, social, certificaciones, giras y presencia en listas."],
  ["/monitoreo", "Monitoreo de artistas — Mexico Charts", "Monitorea artistas elegibles con historial acumulado, métricas de audiencia, streaming y planes desde $6 USD al mes."],
  ["/legacy-acts", "Legacy Acts — Mexico Charts", "Ranking editorial de legacy acts de música mexicana con consumo histórico, audiencia actual, seguidores y señales de catálogo."],
  ["/industria", "Industria musical mexicana — IFPI, AMPROFON y mercado", "Datos de la industria musical mexicana, mercado de música grabada, crecimiento digital, certificaciones y fuentes como IFPI y AMPROFON."],
  ["/generos", "Generos de musica mexicana — Mexico Charts", "Mapa editorial de géneros, subgéneros y escenas de la música mexicana con artistas, charts y tendencias de streaming."],
  ["/industry/certifications", "Certificaciones AMPROFON — Mexico Charts", "Certificaciones de la industria musical mexicana con fuente AMPROFON, niveles de oro, platino y diamante, y datos organizados por artista."],
  ["/insights/mexico-top-10-ifpi-2026", "México entra al Top 10 global de música grabada — Mexico Charts", "Insight editorial sobre el Top 10 de México en IFPI 2026, mercado de música grabada, streaming y contexto de la música mexicana."],
  ["/touring", "Touring Mexico — artistas mexicanos en gira", "Conciertos y giras de artistas mexicanos con fechas, ciudades, recintos y enlaces oficiales de boletos."],
  ["/metodologia", "Metodologia — Mexico Charts", "Cómo Mexico Charts recopila, organiza y presenta datos de música mexicana, charts, streaming, touring, industria y certificaciones."],
  ["/fuentes-de-datos", "Fuentes de datos de artistas — Mexico Charts", "Conoce las plataformas, métricas, cobertura y proceso de verificación de los datos de artistas en Mexico Charts."],
  ["/acerca-de", "Acerca de Mexico Charts — Datos y cultura de la música mexicana", "Mexico Charts es una plataforma independiente de datos sobre música mexicana, listas, artistas, streaming, industria, certificaciones y giras."],
  ["/contacto", "Contacto — Mexico Charts", "Contacto de Mexico Charts para colaboraciones, correcciones de datos, prensa, propuestas editoriales y oportunidades relacionadas con música mexicana."],
  ["/contribuir", "Contribuye — Corrige perfiles y solicita artistas | Mexico Charts", "Ayuda a Mexico Charts a verificar enlaces oficiales, corregir perfiles y priorizar nuevos artistas relacionados con la música mexicana."],
  ["/privacidad", "Privacidad — Mexico Charts", "Política de privacidad de Mexico Charts: uso del sitio, analítica, cookies, servicios externos y manejo de información relacionada con mexicochart.com."],
  ["/terminos", "Términos de uso — Mexico Charts", "Términos generales para el uso de Mexico Charts y sus cuentas gratuitas."],
];

export const PLATFORM_CHART_ROUTES = [
  {
    path: "/charts/spotify",
    platform: "Spotify",
    title: "Charts de Spotify México — canciones y artistas | Mexico Charts",
    description: "Consulta charts diarios y semanales de Spotify México para canciones y artistas, con fuente y fecha de actualización visibles.",
    heading: "Charts de Spotify México",
    body: "Rankings diarios y semanales de canciones y artistas de Spotify para el mercado mexicano, reunidos por Mexico Charts con su fuente y fecha visibles.",
    breadcrumbs: [["/", "Mexico Charts"], ["/charts", "Charts de música en México"], ["/charts/spotify", "Charts de Spotify México"]],
  },
  {
    path: "/charts/youtube",
    platform: "YouTube",
    title: "Charts de YouTube México — canciones, videos y artistas | Mexico Charts",
    description: "Consulta charts de YouTube México para canciones, videos, Shorts y artistas, con periodos diarios o semanales y fuente visible.",
    heading: "Charts de YouTube México",
    body: "Listas de canciones, videos, Shorts y artistas de YouTube para México, con el periodo diario o semanal y la fuente de cada ranking.",
    breadcrumbs: [["/", "Mexico Charts"], ["/charts", "Charts de música en México"], ["/charts/youtube", "Charts de YouTube México"]],
  },
  {
    path: "/charts/apple-music",
    platform: "Apple Music",
    title: "Charts de Apple Music México — canciones y álbumes | Mexico Charts",
    description: "Consulta los charts de canciones y álbumes de Apple Music México, con actualización intradía y fuente visible.",
    heading: "Charts de Apple Music México",
    body: "Rankings de canciones y álbumes de Apple Music para el mercado mexicano, consultados intradía y presentados con su fuente visible.",
    breadcrumbs: [["/", "Mexico Charts"], ["/charts", "Charts de música en México"], ["/charts/apple-music", "Charts de Apple Music México"]],
  },
  {
    path: "/charts/deezer",
    platform: "Deezer",
    title: "Chart de Deezer México — canciones | Mexico Charts",
    description: "Consulta el chart diario de canciones de Deezer México, con fuente y fecha de actualización visibles.",
    heading: "Chart de Deezer México",
    body: "Ranking diario de canciones de Deezer para México, presentado por Mexico Charts con su fuente y fecha de actualización visibles.",
    breadcrumbs: [["/", "Mexico Charts"], ["/charts", "Charts de música en México"], ["/charts/deezer", "Chart de Deezer México"]],
  },
];

for (const platform of PLATFORM_CHART_ROUTES) {
  routes.push([platform.path, platform.title, platform.description]);
}

export const SEO_ROUTE_DEFINITIONS = Object.freeze(Object.fromEntries(
  routes.map(([path, title, description]) => [path, Object.freeze({
    path,
    canonicalPath: path,
    title: title.includes("Mexico Charts") ? title : `${title} — Mexico Charts`,
    description,
    robots: "index,follow",
  })]),
));

export function getSeoRoute(path) {
  return SEO_ROUTE_DEFINITIONS[path] ?? null;
}

export function getPlatformChartRoute(path) {
  return PLATFORM_CHART_ROUTES.find((route) => route.path === path) ?? null;
}

export function getPlatformChartRouteByPlatform(platform) {
  return PLATFORM_CHART_ROUTES.find((route) => route.platform === platform) ?? null;
}

export function applySeoRouteDefinition(route) {
  const definition = getSeoRoute(route.path);
  return definition ? { ...route, ...definition } : route;
}
