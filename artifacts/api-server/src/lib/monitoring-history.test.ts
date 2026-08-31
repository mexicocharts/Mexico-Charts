import assert from "node:assert/strict";
import test from "node:test";
import {
  assembleMonitoringHistory,
  releaseImpactFromAvailableHistory,
  type MonitoringHistoricalObservation,
  type MonitoringHistoryAcquisitionMode,
} from "./monitoring-history";

function observation(
  date: string,
  value: number,
  acquisitionMode: MonitoringHistoryAcquisitionMode = "songstats_historical",
): MonitoringHistoricalObservation {
  return {
    metricKey: "spotifyFollowers",
    date,
    value,
    provenance: {
      provider: acquisitionMode === "mexico_charts_direct" ? "mexico_charts" : "songstats",
      source: "spotify",
      granularity: acquisitionMode === "mexico_charts_direct" ? "intraday" : "daily",
      acquisitionMode,
      providerObservationDate: date,
      providerObservationAt: acquisitionMode === "mexico_charts_direct"
        ? `${date}T18:30:00Z`
        : null,
      fetchedAt: `${date}T20:00:00Z`,
      identityValidationStatus: "verified",
    },
  };
}

function dailyHistory(startDate: string, days: number) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(`${startDate}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return observation(date.toISOString().slice(0, 10), 1_000 + index * 10);
  });
}

test("selects native/direct precedence while retaining provider alternatives", () => {
  const series = assembleMonitoringHistory([
    observation("2026-08-01", 100, "songstats_historical"),
    observation("2026-08-01", 105, "scheduled_current_snapshot"),
    observation("2026-08-01", 110, "mexico_charts_direct"),
  ]).spotifyFollowers!;
  assert.equal(series.points[0]?.value, 110);
  assert.equal(series.points[0]?.provenance.acquisitionMode, "mexico_charts_direct");
  assert.equal(series.points[0]?.alternatives.length, 2);
  assert.equal(series.points[0]?.alternatives[0]?.provenance.acquisitionMode, "scheduled_current_snapshot");
});

test("derives long windows, YoY, peaks, multi-year status and actual earliest date", () => {
  const series = assembleMonitoringHistory(dailyHistory("2023-01-01", 1_340)).spotifyFollowers!;
  assert.equal(series.earliestAvailableDate, "2023-01-01");
  assert.ok(series.growth.days7);
  assert.ok(series.growth.days30);
  assert.ok(series.growth.days90);
  assert.ok(series.growth.months6);
  assert.ok(series.growth.year1);
  assert.ok(series.growth.yearOverYear);
  assert.ok(series.multiYear);
  assert.equal(series.historicalPeak?.date, series.latestAvailableDate);
  assert.equal(series.historicalPeak?.label, "peak_in_available_history");
});

test("does not derive a growth window when a baseline gap exceeds tolerance", () => {
  const series = assembleMonitoringHistory([
    observation("2026-01-01", 100),
    observation("2026-04-15", 200),
  ]).spotifyFollowers!;
  assert.equal(series.growth.days90, null);
  assert.equal(series.missingDateCount, 103);
  assert.deepEqual(series.missingIntervals, [{
    startDate: "2026-01-02",
    endDate: "2026-04-14",
    days: 103,
  }]);
});

test("release impact remains conditional on valid before and after points", () => {
  const series = assembleMonitoringHistory(dailyHistory("2025-01-01", 500));
  const available = releaseImpactFromAvailableHistory({
    releaseDate: "2025-06-01",
    series,
    metricKeys: ["spotifyFollowers"],
  });
  assert.equal(available?.status, "available");
  assert.ok(available?.windows.find(window => window.days === 90)?.metrics.length);

  const unavailable = releaseImpactFromAvailableHistory({
    releaseDate: "2020-01-01",
    series,
    metricKeys: ["spotifyFollowers"],
  });
  assert.equal(unavailable, null);
});
