import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(root, "../..");
const dist = path.join(root, "dist", "public");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [chartsHtml, artifactConfig, projectConfig, appSource, apiPackage, chartsSource] = await Promise.all([
  readFile(path.join(dist, "charts"), "utf8"),
  readFile(path.join(root, ".replit-artifact", "artifact.toml"), "utf8"),
  readFile(path.join(repoRoot, ".replit"), "utf8"),
  readFile(path.join(repoRoot, "artifacts", "api-server", "src", "app.ts"), "utf8"),
  readFile(path.join(repoRoot, "artifacts", "api-server", "package.json"), "utf8"),
  readFile(path.join(root, "src", "pages", "ChartsHub.tsx"), "utf8"),
]);

assert(chartsHtml.includes("<title>Charts de música en México"), "/charts output has the wrong title");
assert(chartsHtml.includes('<link rel="canonical" href="https://mexicochart.com/charts" />'), "/charts output has the wrong canonical");
assert((chartsHtml.match(/<h1\b/g) ?? []).length === 1, "/charts output must contain one initial H1");
assert(!chartsHtml.includes("La industria de la música mexicana, en movimiento"), "/charts still contains the homepage shell");
assert(artifactConfig.indexOf('from = "/charts/spotify"') < artifactConfig.indexOf('from = "/*"'), "Platform rewrite must precede the SPA catch-all");
assert(artifactConfig.includes('from = "/charts/"\nto = "/charts"'), "Trailing-slash chart rewrite is missing");

assert(projectConfig.includes('path = "/assets/*"') && projectConfig.includes("max-age=31536000, immutable"), "Hashed asset cache policy is missing");
assert(projectConfig.includes('path = "/images/ui/*"'), "Versioned UI image cache policy is missing");
assert(appSource.includes("app.use(compression({ threshold: 1024 }))"), "API transport compression middleware is missing");
assert(JSON.parse(apiPackage).dependencies.compression === "1.8.1", "API compression dependency is not pinned");

for (const family of ["mexico-charts-logo", "cert-gold", "cert-platinum", "cert-diamond"]) {
  for (const size of [64, 128, 192]) {
    const file = path.join(root, "public", "images", "ui", `${family}-ui-v1-${size}.png`);
    const info = await stat(file);
    assert(info.size < 75_000, `${path.basename(file)} exceeds the 75 KB UI asset budget`);
  }
}

assert(chartsSource.includes('loading="lazy"'), "Below-fold chart thumbnails are not lazy loaded");
assert(chartsSource.includes('width={800} height={500} loading="eager"'), "Visible chart detail artwork lost eager intrinsic delivery");
assert(!chartsSource.includes("priority={i < 4}"), "Below-fold chart rows are incorrectly promoted to eager loading");
assert(chartsSource.includes("<ResponsiveThumbnail"), "Chart thumbnails are missing intrinsic responsive delivery");

const indexHtml = await readFile(path.join(dist, "index.html"), "utf8");
const scriptPath = indexHtml.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];
const stylePath = indexHtml.match(/<link[^>]+href="([^"]+\.css)"/)?.[1];
assert(scriptPath && stylePath, "Unable to resolve built entry assets");
const [scriptInfo, styleInfo] = await Promise.all([
  stat(path.join(dist, scriptPath.replace(/^\//, ""))),
  stat(path.join(dist, stylePath.replace(/^\//, ""))),
]);
assert(scriptInfo.size <= 425_000, `Entry JavaScript exceeds 425 KB: ${scriptInfo.size}`);
assert(styleInfo.size <= 205_000, `Entry CSS exceeds 205 KB: ${styleInfo.size}`);

const rootFiles = await readdir(dist);
for (const expected of ["charts", "charts-spotify.html", "charts-youtube.html", "charts-apple-music.html", "charts-deezer.html"]) {
  assert(rootFiles.includes(expected), `Missing flat static route target: ${expected}`);
}

console.log(`Performance audit passed: /charts raw identity, route rewrites, delivery policies, responsive UI assets, lazy thumbnails, and entry budgets (${scriptInfo.size} B JS / ${styleInfo.size} B CSS).`);
