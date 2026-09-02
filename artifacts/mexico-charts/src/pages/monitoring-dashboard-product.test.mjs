import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./MonitoringDashboard.tsx", import.meta.url), "utf8");
const accessSource = readFileSync(new URL("../lib/monitoringAccess.mjs", import.meta.url), "utf8");

test("dashboard renders the real Spotify stream catalog rather than only licensed release metadata", () => {
  assert.match(source, /spotifyCatalog:\s*\{/);
  assert.match(source, /type:\s*"track"\s*\|\s*"album"/);
  assert.match(source, /Todas las canciones y todos los álbumes/);
  assert.match(source, /catalog=\{data\.spotifyCatalog\}/);
  assert.match(source, /item\.dailyStreams/);
  assert.match(source, /item\.totalStreams/);
});

test("monitor report download is a PDF and not the legacy CSV", () => {
  assert.match(source, /mexico-charts-monitor-pro-.*\.pdf/);
  assert.match(source, /Descargar PDF/);
  assert.doesNotMatch(source, /Descargar CSV/);
});

test("dashboard keeps terminal authentication failures stable", () => {
  assert.match(source, /retry:\s*shouldRetryMonitoringDashboard/);
  assert.match(source, /MonitoringDashboardHttpError/);
  assert.match(accessSource, /error instanceof MonitoringDashboardHttpError/);
  assert.match(accessSource, /return false/);
});

test("internal founder can switch among every existing monitored artist", () => {
  assert.match(source, /\/api\/monitoring\/internal\/artists/);
  assert.match(source, /loadedData\?\.subscription\.accessSource === "internal"/);
  assert.match(source, /Cambiar artista/);
  assert.match(source, /setLocation\(`\/monitoreo\/\$\{encodeURIComponent\(event\.target\.value\)\}`\)/);
});
