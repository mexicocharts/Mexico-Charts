import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOGO_ID, ORGANIZATION_ID, WEBSITE_ID, breadcrumbId, pageId } from "../src/lib/structured-data.mjs";
import { WEEKLY_EDITIONS } from "../src/data/weekly-editions.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist", "public");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function structuredData(html) {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert(match, "Missing JSON-LD block");
  return JSON.parse(match[1]);
}

function verifyGraph(graph, canonicalUrl) {
  assert(graph["@context"] === "https://schema.org", "Unexpected JSON-LD context");
  assert(Array.isArray(graph["@graph"]), "JSON-LD must use @graph");
  const nodes = graph["@graph"];
  const byId = (id) => nodes.filter((node) => node["@id"] === id);
  assert(byId(ORGANIZATION_ID).length === 1, "Expected exactly one Organization entity");
  assert(byId(WEBSITE_ID).length === 1, "Expected exactly one WebSite entity");
  assert(byId(LOGO_ID).length === 1, "Expected exactly one logo entity");
  assert(byId(pageId(canonicalUrl)).length === 1, "Expected exactly one page entity");

  const organization = byId(ORGANIZATION_ID)[0];
  const website = byId(WEBSITE_ID)[0];
  const page = byId(pageId(canonicalUrl))[0];
  assert(organization.name === "Mexico Charts", "Organization name changed");
  assert(
    JSON.stringify(organization.sameAs) === JSON.stringify([
      "https://www.instagram.com/mexicocharts/",
      "https://www.tiktok.com/@mexicocharts",
    ]),
    "Organization sameAs must contain only verified official profiles",
  );
  assert(website.publisher?.["@id"] === ORGANIZATION_ID, "WebSite publisher is disconnected");
  assert(page.isPartOf?.["@id"] === WEBSITE_ID, "WebPage is disconnected from WebSite");
  assert(page.publisher?.["@id"] === ORGANIZATION_ID, "WebPage publisher is disconnected");
}

function verifyBreadcrumb(graph, canonicalUrl, expectedNames) {
  const nodes = graph["@graph"];
  const breadcrumbs = nodes.filter((node) => node["@type"] === "BreadcrumbList");
  assert(breadcrumbs.length === 1, `Expected one breadcrumb for ${canonicalUrl}`);
  const breadcrumb = breadcrumbs[0];
  assert(breadcrumb["@id"] === breadcrumbId(canonicalUrl), `Unstable breadcrumb ID for ${canonicalUrl}`);
  assert(
    JSON.stringify(breadcrumb.itemListElement.map((item) => item.name)) === JSON.stringify(expectedNames),
    `Incorrect breadcrumb hierarchy for ${canonicalUrl}`,
  );
  const page = nodes.find((node) => node["@id"] === pageId(canonicalUrl));
  assert(page.breadcrumb?.["@id"] === breadcrumb["@id"], `Page breadcrumb is disconnected for ${canonicalUrl}`);
}

const [homeHtml, chartsHtml, aboutHtml, articleHtml, artistHtml, sitemap] = await Promise.all([
  readFile(path.join(dist, "index.html"), "utf8"),
  readFile(path.join(dist, "charts"), "utf8"),
  readFile(path.join(dist, "acerca-de"), "utf8"),
  readFile(path.join(dist, "insights", "mexico-top-10-ifpi-2026"), "utf8"),
  readFile(path.join(dist, "artist", "peso-pluma"), "utf8"),
  readFile(path.join(root, "public", "sitemap.xml"), "utf8"),
]);
const historicalHtml = await Promise.all(WEEKLY_EDITIONS.map((edition) =>
  readFile(path.join(dist, "esta-semana", edition.date), "utf8"),
));

verifyGraph(structuredData(homeHtml), "https://mexicochart.com/");
verifyGraph(structuredData(chartsHtml), "https://mexicochart.com/charts");
const chartsGraph = structuredData(chartsHtml);
const aboutGraph = structuredData(aboutHtml);
const articleGraph = structuredData(articleHtml);
const artistGraph = structuredData(artistHtml);
verifyGraph(aboutGraph, "https://mexicochart.com/acerca-de");
verifyGraph(articleGraph, "https://mexicochart.com/insights/mexico-top-10-ifpi-2026");
verifyGraph(artistGraph, "https://mexicochart.com/artist/peso-pluma");
verifyBreadcrumb(chartsGraph, "https://mexicochart.com/charts", ["Mexico Charts", "Charts de música en México"]);
verifyBreadcrumb(aboutGraph, "https://mexicochart.com/acerca-de", ["Mexico Charts", "Acerca de"]);
verifyBreadcrumb(articleGraph, "https://mexicochart.com/insights/mexico-top-10-ifpi-2026", ["Mexico Charts", "Industria", "México Top 10 IFPI 2026"]);
verifyBreadcrumb(artistGraph, "https://mexicochart.com/artist/peso-pluma", ["Mexico Charts", "Artistas", "Peso Pluma"]);
const about = aboutGraph["@graph"].find((node) => node["@id"] === pageId("https://mexicochart.com/acerca-de"));
assert(about["@type"] === "AboutPage", "About page is not an AboutPage");
assert(about.about?.["@id"] === ORGANIZATION_ID && about.mainEntity?.["@id"] === ORGANIZATION_ID, "About page is disconnected from Organization");
const articles = articleGraph["@graph"].filter((node) => node["@type"] === "Article" || node["@type"] === "NewsArticle");
assert(articles.length === 1, "Expected exactly one article entity");
assert(articles[0].publisher?.["@id"] === ORGANIZATION_ID, "Article publisher is disconnected");
assert(articles[0].mainEntityOfPage?.["@id"] === pageId("https://mexicochart.com/insights/mexico-top-10-ifpi-2026"), "Article mainEntityOfPage is disconnected");
for (const field of ["author", "datePublished", "dateModified"]) {
  assert(!(field in articles[0]), `Unreliable article ${field} must not be emitted`);
}
assert(!/<meta name="author"/i.test(articleHtml), "Article HTML must not claim an unsupported author");
assert(homeHtml.includes("Mexico Charts es una plataforma independiente"), "Homepage brand copy missing from initial HTML");
assert(!homeHtml.includes("https://www.youtube.com/@mexicocharts"), "Unverified YouTube profile must not appear in structured data");
assert(chartsHtml.includes("Charts de música en México"), "Charts H1 missing from initial HTML");
assert(chartsHtml.includes("Spotify, YouTube, Apple Music y Deezer"), "Charts platform context missing from initial HTML");
assert(chartsHtml.includes("diaria, semanal o intradía"), "Charts update cadence missing from initial HTML");
assert(/^<\?xml version="1\.0" encoding="UTF-8"\?>/.test(sitemap), "Sitemap XML declaration missing");
for (const value of [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((match) => match[1])) {
  assert(/^20\d{2}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), `Invalid sitemap lastmod: ${value}`);
}

for (const [index, edition] of WEEKLY_EDITIONS.entries()) {
  const html = historicalHtml[index];
  const canonicalUrl = `https://mexicochart.com/esta-semana/${edition.date}`;
  assert(html.includes(`<link rel="canonical" href="${canonicalUrl}" />`), `Incorrect historical canonical for ${edition.date}`);
  assert(html.includes(`<meta property="og:url" content="${canonicalUrl}" />`), `Incorrect historical Open Graph URL for ${edition.date}`);
  assert((html.match(/<h1\b/g) ?? []).length === 1, `Historical route ${edition.date} must contain exactly one initial H1`);
  assert(html.includes(edition.date) || html.includes(new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${edition.date}T12:00:00Z`))), `Historical route ${edition.date} lacks date-specific context`);
  assert(!html.includes("La industria de la música mexicana, en movimiento"), `Historical route ${edition.date} still contains the homepage shell`);
  const graph = structuredData(html);
  verifyGraph(graph, canonicalUrl);
  verifyBreadcrumb(graph, canonicalUrl, ["Mexico Charts", "Charts de música en México", "Esta semana", `Edición ${edition.date}`]);
  const page = graph["@graph"].find((node) => node["@id"] === pageId(canonicalUrl));
  assert(page.dateModified === edition.updatedAt, `Historical route ${edition.date} has unverified freshness`);
  assert(page.temporalCoverage === edition.date, `Historical route ${edition.date} lacks edition coverage`);
  assert(sitemap.includes(`<loc>${canonicalUrl}</loc>`), `Historical route ${edition.date} missing from sitemap`);
  assert(sitemap.includes(`<lastmod>${edition.updatedAt.slice(0, 10)}</lastmod>`), `Historical route ${edition.date} has incorrect sitemap lastmod`);
}

console.log("SEO audit passed: connected P0/P1 entity graphs, truthful article metadata, historical initial HTML, breadcrumbs, crawlable copy, and verified sitemap freshness fields.");
