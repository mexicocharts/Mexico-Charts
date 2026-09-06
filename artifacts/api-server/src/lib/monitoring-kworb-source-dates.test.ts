import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { transpileModule, ScriptTarget } from "typescript";
import { loadCompleteMonitoringKworbCatalog, parseMonitoringKworbSourceDate } from "./monitoring-kworb-catalog";
import { monitoringCatalogDateDescription, type MonitoringReportInput } from "./monitoring-report-pdf";
import { formatCatalogCutoff } from "../../../mexico-charts/src/lib/monitorCatalog.mjs";

test("Kworb source dates require one real declared calendar date, independently of capture time", () => {
  assert.equal(parseMonitoringKworbSourceDate("Last updated: 2026/08/29<br><br>"), "2026-08-29");
  assert.equal(parseMonitoringKworbSourceDate("<p>Last <b>updated</b>:&nbsp;2024/02/29</p>"), "2024-02-29");
  for (const html of ["", "Last updated:", "Last updated: —", "Last updated: 2026/02/29",
    "Last updated: 2026/13/01", "Last updated: 2026/04/31", "Last updated: 2026/8/29", "Last updated: 2026/08/29 extra",
    "Last updated: 2026/08/29<br>Last updated: 2026/09/05", "Last updated: 2026/08/29<br>Last updated: 2026/08/29"])
    assert.equal(parseMonitoringKworbSourceDate(html), null, html);
});

test("actual catalog loader preserves per-page dates across equal, mixed, unknown and cached captures", async () => {
  const originalFetch = globalThis.fetch, OriginalDate = Date;
  const credentials = [process.env["SPOTIFY_CLIENT_ID"], process.env["SPOTIFY_CLIENT_SECRET"]];
  delete process.env["SPOTIFY_CLIENT_ID"]; delete process.env["SPOTIFY_CLIENT_SECRET"];
  const fixedClock = "2026-09-06T15:16:17.000Z";
  class CaptureDate extends OriginalDate {
    constructor(value?: string | number) { super(value ?? fixedClock); }
    static override now() { return OriginalDate.parse(fixedClock); }
  }
  globalThis.Date = CaptureDate as DateConstructor;
  const page = (type: "track" | "album", date: string | null) => `${date == null ? "" : `Last updated: ${date}<br><br>`}
    <table><tr><td class="text"><a href="https://open.spotify.com/${type}/dateTest">Title</a></td><td>100</td><td>0</td></tr></table>`;
  try {
    for (const [name, tracks, albums, expected] of [
      ["equal", "2026/08/29", "2026/08/29", "2026-08-29"],
      ["mixed", "2026/08/29", "2026/09/05", null],
      ["partial", "2026/08/29", null, null], ["unknown", null, null, null],
    ] as const) {
      let calls = 0;
      globalThis.fetch = (async (input: string | URL | Request) => {
        calls++; const url = String(input);
        if (url.endsWith("_songs.html")) return new Response(page("track", tracks));
        if (url.endsWith("_albums.html")) return new Response(page("album", albums));
        if (url.startsWith("https://open.spotify.com/oembed?")) return Response.json({});
        throw new Error("Unexpected provider operation");
      }) as typeof fetch;
      const catalog = await loadCompleteMonitoringKworbCatalog(`source-date-${name}`);
      assert.equal(catalog.fetchedAt, fixedClock); assert.equal(catalog.snapshotDate, expected);
      assert.deepEqual(catalog.sourceDates, { tracks: tracks?.replaceAll("/", "-") ?? null, albums: albums?.replaceAll("/", "-") ?? null });
      assert.equal(catalog.items.length, 2); assert.ok(catalog.items.every(item => item.dailyStreams === 0));
      const previousCalls = calls;
      assert.deepEqual(await loadCompleteMonitoringKworbCatalog(`source-date-${name}`), catalog);
      assert.equal(calls, previousCalls, "cache must preserve observation dates without fetching again");
    }
  } finally {
    globalThis.fetch = originalFetch; globalThis.Date = OriginalDate;
    for (const [index, key] of ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"].entries()) {
      if (credentials[index] == null) delete process.env[key]; else process.env[key] = credentials[index];
    }
  }
});

test("UI and PDF cutoff descriptions preserve mixed/unknown source dates and stored archive dates", () => {
  const base = { source: "kworb_live_complete_catalog" as const, snapshotDate: "2026-09-06", trackCount: 1, albumCount: 1,
    trackDailyStreams: 0, albumDailyStreams: 0, trackTotalStreams: 100, albumTotalStreams: 100, items: [] };
  const cases: Array<[MonitoringReportInput["spotifyCatalog"], string, string]> = [
    [{ ...base, sourceDates: { tracks: "2026-08-29", albums: "2026-08-29" } }, "Corte 2026-08-29", "2026-08-29"],
    [{ ...base, sourceDates: { tracks: "2026-08-29", albums: "2026-09-05" } }, "Canciones: 2026-08-29 · Álbumes: 2026-09-05", "canciones 2026-08-29; álbumes 2026-09-05"],
    [{ ...base, sourceDates: { tracks: "2026-08-29", albums: null } }, "Canciones: 2026-08-29 · Álbumes: sin fecha", "canciones 2026-08-29; álbumes sin fecha"],
    [{ ...base }, "Canciones: sin fecha · Álbumes: sin fecha", "canciones sin fecha; álbumes sin fecha"],
    [{ ...base, source: "archive", sourceDates: null, snapshotDate: "2026-08-12" }, "Corte 2026-08-12", "2026-08-12"],
  ];
  for (const [catalog, ui, pdf] of cases) {
    assert.equal(formatCatalogCutoff(catalog, value => value ?? "sin fecha"), ui);
    assert.equal(monitoringCatalogDateDescription(catalog), pdf);
  }
});

test("the actual dashboard adapter retains source cutoffs and fetch provenance while leaving archive dates intact", async () => {
  const source = readFileSync(new URL("../routes/monitoring.ts", import.meta.url), "utf8");
  const start = source.indexOf("  let resolvedStreamItems:"), end = source.indexOf("  const prioritizedLiveVideos =", start);
  assert.ok(start > 0 && end > start);
  const stage = transpileModule(source.slice(start, end) + "\nreturn {resolvedStreamSummary,catalogSourceDates};", { compilerOptions: { target: ScriptTarget.ES2022 } }).outputText;
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  const load = new AsyncFunction("prioritizedStreamItems", "prioritizedStreamSummary", "prioritizedArtistIdentity", "dashboardStage",
    "loadCompleteMonitoringKworbCatalog", "summarizeMonitoringKworbCatalog", "active", stage);
  const archive = { snapshot_date: "2026-08-12", fetched_at: "2026-08-13T00:00:00Z" };
  for (const dates of [{ tracks: "2026-08-29", albums: "2026-08-29" }, { tracks: "2026-08-29", albums: "2026-09-05" },
    { tracks: "2026-08-29", albums: null }, { tracks: null, albums: null }, null]) {
    const expected = dates?.tracks != null && dates.tracks === dates.albums ? dates.tracks : null;
    const catalog = dates == null ? null : { source: "kworb_live_complete_catalog", fetchedAt: "2026-09-06T15:16:17Z",
      snapshotDate: expected, sourceDates: dates, items: [] };
    const value = await load([], [archive], [{ spotify_artist_id: "verified-id" }], async (_name: string, run: () => Promise<unknown>) => run(),
      async () => catalog, () => ({}), { artist_key: "artist" });
    assert.deepEqual(value.catalogSourceDates, dates);
    assert.equal(value.resolvedStreamSummary[0].snapshot_date, dates == null ? archive.snapshot_date : expected);
    assert.equal(value.resolvedStreamSummary[0].fetched_at, dates == null ? archive.fetched_at : catalog!.fetchedAt);
  }
});
