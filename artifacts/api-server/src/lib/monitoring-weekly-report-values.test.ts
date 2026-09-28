import test from "node:test";
import assert from "node:assert/strict";
import { exactReportChange, reportChangeColor, reportCatalogDaily } from "./monitoring-weekly-report";

test("exact report appendix retains all measured change digits", () => {
  assert.equal(exactReportChange(-934_947), "-934,947");
  assert.equal(exactReportChange(677_234_567), "+677,234,567");
  assert.equal(exactReportChange(0), "+0");
  assert.equal(exactReportChange(null), "Ventana sin lectura");
});

test("partial daily coverage is not described as absent or a complete aggregate", () => {
  const catalog = { snapshotDate: null, trackCount: 2, albumCount: 0,
    trackDailyStreams: null, albumDailyStreams: null, trackTotalStreams: null, albumTotalStreams: null,
    items: [
      { type: "track" as const, title: "Measured", dailyStreams: 123, totalStreams: 5000 },
      { type: "track" as const, title: "Unmeasured", dailyStreams: null, totalStreams: 4000 },
    ] };
  assert.deepEqual(reportCatalogDaily(catalog, "track"), { value: "Total incompleto", detail: "1 de 2 con lectura diaria" });
  assert.deepEqual(reportCatalogDaily(catalog, "album"), { value: "Sin lectura", detail: "0 de 0 con lectura diaria" });
  assert.deepEqual(reportCatalogDaily({ ...catalog, trackDailyStreams: 123 }, "track"), { value: "123", detail: "2 canciones" });
  assert.equal(catalog.trackDailyStreams, null);
});

test("negative audience growth uses the approved red loss treatment", () => {
  assert.equal(reportChangeColor("-934.9K / 30d"), "#FF5C68");
  assert.equal(reportChangeColor("+483.2K / 30d"), "#39FF14");
  assert.equal(reportChangeColor("188 canciones"), "#39FF14");
});
