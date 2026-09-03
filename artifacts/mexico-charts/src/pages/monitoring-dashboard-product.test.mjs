import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync(
  new URL("./MonitoringDashboard.tsx", import.meta.url),
  "utf8",
);
const experience = readFileSync(
  new URL("../components/monitoring/MonitorProExperience.tsx", import.meta.url),
  "utf8",
);
const accessSource = readFileSync(
  new URL("../lib/monitoringAccess.mjs", import.meta.url),
  "utf8",
);

test("all artists render through the recovered canonical Monitor Pro experience", () => {
  assert.match(page, /<MonitorProExperience/);
  assert.match(page, /data=\{data\}/);
  assert.doesNotMatch(
    page,
    /data\.subscription\.artistName\s*===\s*["']Peso Pluma/,
  );
  for (const view of [
    "Panel",
    "Tendencias",
    "Spotify",
    "YouTube",
    "Mercados",
    "Comparar",
    "Alertas",
    "Reportes",
  ]) {
    assert.match(experience, new RegExp(`label: "${view}"`));
  }
});

test("canonical presentation is parameterized and contains no Peso Pluma demo dependency", () => {
  assert.match(experience, /data\.subscription\.artistName/);
  assert.match(experience, /data\.subscription\.artistImageUrl/);
  assert.match(experience, /data\.spotifyCatalog\.items/);
  assert.match(experience, /data\.liveVideos/);
  assert.match(experience, /data\.topMexicoCities/);
  assert.match(experience, /data\.history/);
  assert.doesNotMatch(
    experience,
    /pesoPlumaMonitorDemo|const peso\s*=|Peso Pluma vs/,
  );
});

test("unavailable comparison and alert data is stated rather than fabricated", () => {
  assert.match(experience, /No se muestran[\s\S]*cifras de\s+demostración/);
  assert.match(experience, /Configuración persistente aún no disponible/);
  assert.match(experience, /Sin puntuación fabricada/);
});

test("report download remains a server-generated PDF", () => {
  assert.match(page, /\/api\/monitoring\/report\//);
  assert.match(page, /mexico-charts-monitor-pro-.*\.pdf/);
  assert.match(experience, /onDownloadReport/);
  assert.match(experience, /Descargar PDF/);
  assert.doesNotMatch(page, /Descargar CSV/);
});

test("dashboard keeps terminal authentication failures stable", () => {
  assert.match(page, /retry:\s*shouldRetryMonitoringDashboard/);
  assert.match(page, /MonitoringDashboardHttpError/);
  assert.match(accessSource, /error instanceof MonitoringDashboardHttpError/);
  assert.match(accessSource, /return false/);
});

test("internal founder can switch among existing monitored artists without changing presentation", () => {
  assert.match(page, /\/api\/monitoring\/internal\/artists/);
  assert.match(page, /data\?\.subscription\.accessSource === "internal"/);
  assert.match(experience, /Cambiar artista/);
  assert.match(
    page,
    /setLocation\(`\/monitoreo\/\$\{encodeURIComponent\(nextArtistKey\)\}`\)/,
  );
});
