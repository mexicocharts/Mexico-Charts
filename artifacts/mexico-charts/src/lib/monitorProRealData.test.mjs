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
  assert.match(
    route,
    /\/api\/monitoring\/dashboard\/\$\{encodeURIComponent\(artistKey\)\}/,
  );
  assert.match(route, /<MonitorProExperience/);
  assert.doesNotMatch(route, /pesoPlumaMonitorDemo|MonitoringFeaturePreview/);
});

test("canonical experience exposes bounded and all-available real history windows", () => {
  assert.match(experience, /"7d" \| "30d" \| "90d" \| "6m" \| "1y" \| "all"/);
  assert.match(experience, /availableSpanDays >= days/);
  assert.match(experience, /range=all&resolution=auto/);
  assert.match(experience, /observaciones realmente entregadas/);
  assert.match(experience, /historial licenciado anterior todavía no está integrado/);
  assert.doesNotMatch(experience, /todo el historial disponible/);
  assert.match(experience, /data\.spotifyCatalog\.history/);
});

test("YouTube direct and derived values keep their approved labels", () => {
  assert.match(experience, /Fuente: YouTube Data API/);
  assert.match(experience, /Cálculo de Mexico Charts/);
  assert.match(experience, /video\.observedAt/);
});

test("unimplemented report and alert promises are identified honestly", () => {
  assert.match(
    experience,
    /envío por correo y exportación CSV\s+pendientes de implementación/,
  );
  assert.match(experience, /Configuración persistente aún no disponible/);
});
