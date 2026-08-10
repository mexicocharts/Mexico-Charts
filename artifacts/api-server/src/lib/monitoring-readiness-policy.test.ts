import assert from "node:assert/strict";
import test from "node:test";
import { evaluateMonitoringReadiness } from "./monitoring-readiness-policy";

function history(field: string, start: number) {
  return Array.from({ length: 101 }, (_, index) => {
    const date = new Date("2026-05-01T12:00:00.000Z");
    date.setUTCDate(date.getUTCDate() + index);
    return { date: date.toISOString().slice(0, 10), [field]: start + index * 100 };
  });
}

function completeInput() {
  return {
    historicStats: {
      artist_info: { name: "Example Artist" },
      stats: [
        { source: "spotify", data: { history: history("monthly_listeners_current", 1_000_000) } },
        { source: "youtube", data: { history: history("subscribers_total", 500_000) } },
        { source: "instagram", data: { history: history("followers_total", 250_000) } },
        { source: "tiktok", data: { history: history("followers_total", 300_000) } },
      ],
    },
    audience: { audience: [{ source: "spotify", data: { monthly_listeners: [] } }] },
    audienceDetails: {
      sources: {
        spotify: {
          audience: [{
            source: "spotify",
            data: {
              monthly_listeners: [{ city_name: "Ciudad de México", country_code: "MX", current_listeners: 100_000 }],
            },
          }],
        },
      },
    },
    catalog: { tracks: [{ id: "track-1" }] },
    currentSnapshotDate: "2026-08-09",
    currentMetrics: {
      spotifyMonthlyListeners: 1_010_000,
      spotifyFollowers: 900_000,
      youtubeSubscribers: 510_000,
      instagramFollowers: 260_000,
      tiktokFollowers: 310_000,
    },
    streamSnapshotDate: "2026-08-10",
    trackCount: 120,
    albumCount: 20,
    trackDailyStreams: 2_000_000,
    trackTotalStreams: 5_000_000_000,
    albumTotalStreams: 4_000_000_000,
    now: new Date("2026-08-10T12:00:00.000Z"),
  };
}

test("accepts an artist only when every paid-monitoring category is valuable", () => {
  const result = evaluateMonitoringReadiness(completeInput());
  assert.equal(result.ready, true);
  assert.equal(result.score, 100);
  assert.deepEqual(result.reasons, []);
});

test("rejects a technically complete artist when Mexico audience detail is empty", () => {
  const input = completeInput();
  input.audienceDetails = { sources: { spotify: { audience: [] } } };
  const result = evaluateMonitoringReadiness(input);
  assert.equal(result.ready, false);
  assert.ok(result.reasons.includes("missing_mexico_audience"));
});
