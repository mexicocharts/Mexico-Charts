import assert from "node:assert/strict";
import test from "node:test";
import {
  deterministicMinMaxDownsample,
  mergeCompactHistoryPoints,
  releaseImpactFromCompactHistory,
  RELEASE_IMPACT_ELIGIBLE_METRICS,
  type CompactHistoryPoint,
} from "./monitoring-history-compact";

function point(date: string, value: number, mode: CompactHistoryPoint["acquisitionMode"] = "songstats_historical"): CompactHistoryPoint {
  return { date, value, provenanceRef: `${mode}:${date}`, acquisitionMode: mode };
}

function daily(startDate: string, days: number, initial = 10_000) {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(`${startDate}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + index);
    return point(date.toISOString().slice(0, 10), initial + index * 10);
  });
}

test("deterministic min/max downsampling is bounded and retains endpoints and extrema", () => {
  const points = daily("2020-01-01", 2_000);
  points[901] = point(points[901]!.date, 999_999);
  const first = deterministicMinMaxDownsample(points, 400);
  const second = deterministicMinMaxDownsample(points, 400);
  assert.deepEqual(first, second);
  assert.ok(first.length <= 400);
  assert.equal(first[0]?.date, points[0]?.date);
  assert.equal(first.at(-1)?.date, points.at(-1)?.date);
  assert.ok(first.some(candidate => candidate.value === 999_999));
});

test("native precedence retains Songstats as a compact alternative", () => {
  const merged = mergeCompactHistoryPoints([
    point("2026-08-01", 100),
    point("2026-08-01", 110, "scheduled_current_snapshot"),
    point("2026-08-01", 120, "mexico_charts_direct"),
  ]);
  assert.equal(merged[0]?.value, 120);
  assert.equal(merged[0]?.acquisitionMode, "mexico_charts_direct");
  assert.equal(merged[0]?.alternatives?.length, 2);
});

test("Release Impact rejects state metrics, tiny baselines, gaps, and outliers", () => {
  assert.equal(releaseImpactFromCompactHistory({
    releaseDate: "2026-02-01",
    metricKey: "spotifyPlaylists",
    points: daily("2026-01-01", 130),
  }).reason, "metric_not_eligible");

  assert.equal(releaseImpactFromCompactHistory({
    releaseDate: "2026-02-01",
    metricKey: "spotifyMonthlyListeners",
    points: daily("2026-01-01", 130, 1),
  }).reason, "baseline_too_small");

  const gapped = daily("2026-01-01", 130).filter(candidate =>
    candidate.date < "2026-02-02" || candidate.date > "2026-02-20");
  const gapResult = releaseImpactFromCompactHistory({
    releaseDate: "2026-02-01",
    metricKey: "spotifyFollowers",
    points: gapped,
  });
  assert.notEqual(gapResult.status, "available");

  const outlier = daily("2026-01-01", 130, 100);
  for (const candidate of outlier) {
    if (candidate.date >= "2026-02-06") candidate.value = 1_000_000;
  }
  const outlierResult = releaseImpactFromCompactHistory({
    releaseDate: "2026-02-01",
    metricKey: "spotifyFollowers",
    points: outlier,
  });
  assert.ok("windows" in outlierResult);
  assert.ok(outlierResult.windows?.some(window => window.reason === "percentage_outlier"));
});

test("Release Impact is available only for explicitly eligible metrics with dense evidence", () => {
  assert.deepEqual(Object.keys(RELEASE_IMPACT_ELIGIBLE_METRICS), [
    "spotifyFollowers",
    "spotifyMonthlyListeners",
    "spotifyStreams",
    "youtubeSubscribers",
    "youtubeChannelViews",
    "soundcloudStreams",
    "shazamCount",
  ]);
  const result = releaseImpactFromCompactHistory({
    releaseDate: "2026-02-01",
    metricKey: "spotifyFollowers",
    points: daily("2026-01-01", 140),
  });
  assert.equal(result.status, "available");
  assert.ok(result.windows?.some(window => window.status === "available"));
});
