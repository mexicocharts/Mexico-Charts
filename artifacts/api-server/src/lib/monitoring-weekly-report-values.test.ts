import test from "node:test";
import assert from "node:assert/strict";
import { exactReportChange, reportChangeColor } from "./monitoring-weekly-report";

test("exact report appendix retains all measured change digits", () => {
  assert.equal(exactReportChange(-934_947), "-934,947");
  assert.equal(exactReportChange(677_234_567), "+677,234,567");
  assert.equal(exactReportChange(0), "+0");
  assert.equal(exactReportChange(null), "Ventana sin lectura");
});

test("negative audience growth uses the approved red loss treatment", () => {
  assert.equal(reportChangeColor("-934.9K / 30d"), "#FF5C68");
  assert.equal(reportChangeColor("+483.2K / 30d"), "#39FF14");
  assert.equal(reportChangeColor("188 canciones"), "#39FF14");
});
