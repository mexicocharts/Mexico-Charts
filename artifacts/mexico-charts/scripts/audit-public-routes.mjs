import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "src", "App.tsx");
const srcDir = path.join(root, "src");
const sitemapPath = path.join(root, "public", "sitemap.xml");
const robotsPath = path.join(root, "public", "robots.txt");
const prerenderPath = path.join(root, "scripts", "prerender-static.mjs");
const siteUrl = "https://mexicochart.com";

function normalizeRoute(value) {
  if (!value) return null;
  let route = value.trim();
  if (route.startsWith(siteUrl)) route = route.slice(siteUrl.length) || "/";
  if (!route.startsWith("/")) return null;
  route = route.split(/[?#]/)[0] || "/";
  if (route.length > 1) route = route.replace(/\/+$/, "");
  return route;
}

function routeToRegex(route) {
  const escaped = route
    .split("/")
    .map((part) => {
      if (part.startsWith(":")) return "[^/]+";
      return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    })
    .join("/");
  return new RegExp(`^${escaped}$`);
}

function sorted(values) {
  return [...values].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
}

function difference(left, right) {
  return sorted([...left].filter((value) => !right.has(value)));
}

async function readSourceFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      files.push(...await readSourceFiles(fullPath));
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function collectInternalLinks(source) {
  const links = new Set();
  const patterns = [
    /\bhref=["'](\/[^"'`{}\s]*)["']/g,
    /\bhref=\{["'](\/[^"'`{}\s]*)["']\}/g,
    /\bnavigate\(["'](\/[^"'`{}\s]*)["']\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      const route = normalizeRoute(match[1]);
      if (route) links.add(route);
    }
  }
  return links;
}

function reportList(label, values) {
  if (values.length === 0) return;
  console.error(`\n${label}:`);
  for (const value of values) console.error(`  - ${value}`);
}

const [appSource, sitemapSource, robotsSource, prerenderSource] = await Promise.all([
  readFile(appPath, "utf8"),
  readFile(sitemapPath, "utf8"),
  readFile(robotsPath, "utf8"),
  readFile(prerenderPath, "utf8"),
]);

const appRoutes = new Set(
  [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)]
    .map((match) => normalizeRoute(match[1]))
    .filter(Boolean),
);

const staticRoutes = new Set([...appRoutes].filter((route) => !route.includes(":")));
const dynamicRouteRegexes = [...appRoutes]
  .filter((route) => route.includes(":"))
  .map((route) => ({ route, regex: routeToRegex(route) }));

const disallowedRoutes = new Set(
  [...robotsSource.matchAll(/^Disallow:\s*(\/\S*)/gm)]
    .map((match) => normalizeRoute(match[1]))
    .filter(Boolean),
);

function isDisallowed(route) {
  return [...disallowedRoutes].some((prefix) => route === prefix || route.startsWith(`${prefix}/`));
}

function isRoutable(route) {
  return staticRoutes.has(route) || dynamicRouteRegexes.some(({ regex }) => regex.test(route));
}

const sitemapRoutes = new Set(
  [...sitemapSource.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((match) => normalizeRoute(match[1]))
    .filter(Boolean),
);

const prerenderRoutes = new Set(
  [...prerenderSource.matchAll(/path:\s*"([^"]+)"/g)]
    .map((match) => normalizeRoute(match[1]))
    .filter(Boolean),
);

const publicStaticRoutes = new Set([...staticRoutes].filter((route) => !isDisallowed(route)));
const publicPrerenderRoutes = new Set([...prerenderRoutes].filter((route) => !isDisallowed(route)));

const sourceFiles = await readSourceFiles(srcDir);
const linkedRoutes = new Set();
for (const file of sourceFiles) {
  const source = await readFile(file, "utf8");
  for (const link of collectInternalLinks(source)) linkedRoutes.add(link);
}

const missingFromSitemap = difference(publicStaticRoutes, sitemapRoutes);
const missingFromPrerender = difference(sitemapRoutes, publicPrerenderRoutes);
const prerenderMissingFromSitemap = difference(publicPrerenderRoutes, sitemapRoutes);
const unroutableSitemapRoutes = sorted([...sitemapRoutes].filter((route) => !isRoutable(route)));
const unroutableInternalLinks = sorted([...linkedRoutes].filter((route) => !isRoutable(route)));
const privateSitemapRoutes = sorted([...sitemapRoutes].filter(isDisallowed));

const failures = [
  missingFromSitemap,
  missingFromPrerender,
  prerenderMissingFromSitemap,
  unroutableSitemapRoutes,
  unroutableInternalLinks,
  privateSitemapRoutes,
].some((list) => list.length > 0);

if (failures) {
  reportList("Public static app routes missing from sitemap", missingFromSitemap);
  reportList("Sitemap routes missing from prerender-static.mjs", missingFromPrerender);
  reportList("Public prerender routes missing from sitemap", prerenderMissingFromSitemap);
  reportList("Sitemap routes that are not handled by App routes", unroutableSitemapRoutes);
  reportList("Literal internal links that are not handled by App routes", unroutableInternalLinks);
  reportList("Robots-disallowed routes present in sitemap", privateSitemapRoutes);
  process.exit(1);
}

console.log(`Route audit passed: ${sitemapRoutes.size} sitemap routes, ${publicPrerenderRoutes.size} public prerender routes, ${linkedRoutes.size} literal internal links.`);
