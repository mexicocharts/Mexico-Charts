import assert from "node:assert/strict";
import test from "node:test";
import { monitorReportRecommendation } from "./monitorReport.mjs";

test("compact impact without a legacy release object does not crash Reports", () => {
  const impact = { releaseDate: "2026-09-20", availableMetricCount: 0, metrics: [{ metricKey: "spotify_monthly_listeners", status: "unavailable" }] };
  assert.match(monitorReportRecommendation(impact, []), /ventana de comparación suficiente/);
});
test("available impact uses only a matching real release date", () => {
  const impact = { releaseDate: "2026-09-20", availableMetricCount: 1, metrics: [{ metricKey: "spotify_monthly_listeners", status: "available" }] };
  assert.equal(monitorReportRecommendation(impact, [{ title: "Recorded release", releaseDate: "2026-09-20T00:00:00Z" }]), "Revisar el impacto real de Recorded release");
  assert.equal(monitorReportRecommendation(impact, [{ title: "Different release", releaseDate: "2026-09-01" }]), "Revisar el impacto del lanzamiento del 2026-09-20");
});
test("failed impact queries remain pending rather than absent", () => {
  for (const status of ["failed", "budget_exhausted"]) {
    assert.match(monitorReportRecommendation({ releaseDate: "2026-09-20", availableMetricCount: 0, metrics: [{ status }] }, []), /Consulta de impacto pendiente/);
  }
  assert.match(monitorReportRecommendation(null, []), /evidencia suficiente/);
});
