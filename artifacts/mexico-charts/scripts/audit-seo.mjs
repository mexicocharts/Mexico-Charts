import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOGO_ID, ORGANIZATION_ID, WEBSITE_ID, pageId } from "../src/lib/structured-data.mjs";

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
  assert(Array.isArray(organization.sameAs) && organization.sameAs.length === 3, "Official sameAs list is incomplete");
  assert(website.publisher?.["@id"] === ORGANIZATION_ID, "WebSite publisher is disconnected");
  assert(page.isPartOf?.["@id"] === WEBSITE_ID, "WebPage is disconnected from WebSite");
  assert(page.publisher?.["@id"] === ORGANIZATION_ID, "WebPage publisher is disconnected");
}

const [homeHtml, chartsHtml, sitemap] = await Promise.all([
  readFile(path.join(dist, "index.html"), "utf8"),
  readFile(path.join(dist, "charts"), "utf8"),
  readFile(path.join(root, "public", "sitemap.xml"), "utf8"),
]);

verifyGraph(structuredData(homeHtml), "https://mexicochart.com/");
verifyGraph(structuredData(chartsHtml), "https://mexicochart.com/charts");
assert(homeHtml.includes("Mexico Charts es una plataforma independiente"), "Homepage brand copy missing from initial HTML");
assert(chartsHtml.includes("Charts de música en México"), "Charts H1 missing from initial HTML");
assert(chartsHtml.includes("Spotify, YouTube, Apple Music y Deezer"), "Charts platform context missing from initial HTML");
assert(chartsHtml.includes("diaria, semanal o intradía"), "Charts update cadence missing from initial HTML");
assert(/^<\?xml version="1\.0" encoding="UTF-8"\?>/.test(sitemap), "Sitemap XML declaration missing");
for (const value of [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((match) => match[1])) {
  assert(/^20\d{2}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), `Invalid sitemap lastmod: ${value}`);
}

console.log("SEO audit passed: connected entity graphs, crawlable P0 copy, and valid sitemap freshness fields.");
