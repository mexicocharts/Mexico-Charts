import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const experience = readFileSync(
  new URL("../components/monitoring/MonitorProExperience.tsx", import.meta.url),
  "utf8",
);
const route = readFileSync(
  new URL("../pages/MonitoringDashboard.tsx", import.meta.url),
  "utf8",
);

test("actual shared monitoring routes render the canonical real-data experience", () => {
  assert.match(route, /useRoute\("\/monitoreo\/:artistKey"\)/);
  assert.match(route, /\/api\/monitoring\/dashboard\/\$\{encodeURIComponent\(artistKey\)\}/);
  assert.match(route, /<MonitorProExperience/);
  assert.doesNotMatch(route, /pesoPlumaMonitorDemo|MonitoringFeaturePreview/);
});

test("canonical experience exposes real 7, 30 and 90 day windows", () => {
  assert.match(experience, /useState<7 \| 30 \| 90>\(90\)/);
  assert.match(experience, /\(\[7, 30, 90\] as const\)/);
  assert.match(experience, /data\.spotifyCatalog\.history/);
});

test("YouTube direct and derived values keep their approved labels", () => {
  assert.match(experience, /Fuente: YouTube Data API/);
  assert.match(experience, /Cálculo de Mexico Charts/);
  assert.match(experience, /video\.observedAt/);
});

test("unimplemented report and alert promises are identified honestly", () => {
  assert.match(experience, /resumen semanal por correo y exportación CSV pendientes de implementación/);
  assert.match(experience, /Configuración persistente aún no disponible/);
});
