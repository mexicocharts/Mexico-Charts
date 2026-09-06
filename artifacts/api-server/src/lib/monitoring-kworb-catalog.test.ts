import assert from "node:assert/strict";
import test from "node:test";
import {
  loadCompleteMonitoringKworbCatalog,
  parseMonitoringKworbCatalog,
  summarizeMonitoringKworbCatalog,
} from "./monitoring-kworb-catalog";
import { monitoringCatalogReportRows } from "./monitoring-report-pdf";
import { compareCatalogCounts, formatCatalogDaily } from "../../../mexico-charts/src/lib/monitorCatalog.mjs";

// Exact adjacent rows from public Kworb 3BallMTY pages captured 2026-09-06,
// source date 2026-08-29. Blank daily cells previously swallowed the next row.
const capturedSongs = `<tr><td class="text"><div><a href="https://open.spotify.com/track/7smxlQScx9U3hO0HauLpGh" target="_blank">Tu Pa' Que Te Vas (feat. Jotdog)</a></div></td><td>651,684</td><td></td></tr>
<tr><td class="text"><div><a href="https://open.spotify.com/track/4iYCEPiwEVEqxK2dYurfLw" target="_blank">Ferrari</a></div></td><td>625,949</td><td>239</td></tr>`;
const capturedAlbums = `<tr><td class="text"><div><a href="https://open.spotify.com/album/1i3BUST2FCsabvTnlK9Rwq" target="_blank">Inténtalo (Deluxe Edition)</a></div></td><td>404,213,072</td><td></td></tr>
<tr><td class="text"><div><a href="https://open.spotify.com/album/1wu3UHAO3cvb38tj4VkAmh" target="_blank">Inténtalo</a></div></td><td>402,841,116</td><td>304,667</td></tr>
<tr><td class="text"><div><a href="https://open.spotify.com/album/5trXODX2kXgViIFuvKrwMo" target="_blank">Globall</a></div></td><td>46,269,335</td><td></td></tr>
<tr><td class="text"><div><a href="https://open.spotify.com/album/7I7PhRSm4HZmNggp2lYLlo" target="_blank">Somos</a></div></td><td>9,064,981</td><td>1,770</td></tr>`;

test("captured blank daily rows keep every title, ID and its own metrics within the original row", () => {
  const fields = (html: string, type: "track" | "album") => parseMonitoringKworbCatalog(html, type)
    .map(({ key, title, totalStreams, dailyStreams }) => [key, title, totalStreams, dailyStreams]);
  assert.deepEqual(fields(capturedSongs, "track"), [
    ["7smxlQScx9U3hO0HauLpGh", "Tu Pa' Que Te Vas (feat. Jotdog)", 651684, null],
    ["4iYCEPiwEVEqxK2dYurfLw", "Ferrari", 625949, 239],
  ]);
  assert.deepEqual(fields(capturedAlbums, "album"), [
    ["1i3BUST2FCsabvTnlK9Rwq", "Inténtalo (Deluxe Edition)", 404213072, null],
    ["1wu3UHAO3cvb38tj4VkAmh", "Inténtalo", 402841116, 304667],
    ["5trXODX2kXgViIFuvKrwMo", "Globall", 46269335, null],
    ["7I7PhRSm4HZmNggp2lYLlo", "Somos", 9064981, 1770],
  ]);
});

test("row parsing preserves real zero, signed daily corrections, unknown malformed totals and varied title markup", () => {
  const values = [["0", "0", 0, 0], ["1,234", "-12", 1234, -12], ["", "", null, null],
    ["&nbsp;", "—", null, null], ["1,23", "1-2", null, null], ["-99", "-1,234", null, -1234],
    ["9007199254740992", "NaN", null, null], ["1.5", "1e3", null, null]];
  const html = values.map(([total, daily], index) => `<TR data-position='${index}'>
    <TD data-label='title' class='other text'><a title='track' href='https://open.spotify.com/track/sameid'>* Caf&#xE9; &amp; Rock &#39;${index}&#39;</a></TD>
    <TD class='numeric'><span>${total}</span></TD><TD>${daily}</TD></TR>`).join("\n");
  const parsed = parseMonitoringKworbCatalog(html, "track");
  assert.equal(parsed.length, values.length, "duplicate IDs remain separate source rows; no masking/deduplication");
  parsed.forEach((item, index) => {
    assert.equal(item.key, "sameid");
    assert.equal(item.title, `Café & Rock '${index}'`);
    assert.equal(item.totalStreams, values[index]![2]);
    assert.equal(item.dailyStreams, values[index]![3]);
  });
});

test("parsed unknowns survive dashboard totals, frontend presentation and actual PDF table adaptation", () => {
  const items = [...parseMonitoringKworbCatalog(capturedSongs, "track"), ...parseMonitoringKworbCatalog(capturedAlbums, "album")];
  const summary = summarizeMonitoringKworbCatalog(items);
  assert.deepEqual(summary, { trackCount: 2, albumCount: 4, trackDailyStreams: null, albumDailyStreams: null,
    trackTotalStreams: 1277633, albumTotalStreams: 862388504 });
  const tracks = items.filter(item => item.type === "track");
  assert.deepEqual([...tracks].sort((a, b) => compareCatalogCounts(a.dailyStreams, b.dailyStreams)).map(item => [item.title, formatCatalogDaily(item.dailyStreams, String)]),
    [["Ferrari", "+239"], ["Tu Pa' Que Te Vas (feat. Jotdog)", "—"]]);
  assert.deepEqual(monitoringCatalogReportRows(tracks), [["Ferrari", "+239", "625.9K"], ["Tu Pa' Que Te Vas (feat. Jotdog)", "—", "651.7K"]]);
  const zero = { ...tracks[0]!, title: "measured zero", totalStreams: 0, dailyStreams: 0 };
  const correction = { ...zero, title: "signed correction", dailyStreams: -12 };
  assert.deepEqual(monitoringCatalogReportRows([tracks[0]!, correction, zero]).map(row => row.slice(0, 2)),
    [["measured zero", "+0"], ["signed correction", "-12"], ["Tu Pa' Que Te Vas (feat. Jotdog)", "—"]]);
  assert.equal(summarizeMonitoringKworbCatalog([zero]).trackDailyStreams, 0);
  assert.equal(summarizeMonitoringKworbCatalog([{ ...zero, totalStreams: null }]).trackTotalStreams, null);
  assert.equal(summarizeMonitoringKworbCatalog([{ ...zero, totalStreams: Number.MAX_SAFE_INTEGER }, { ...zero, totalStreams: 1 }]).trackTotalStreams, null);
});

test("parses complete Kworb rows without imposing the free-profile top-ten limit", () => {
  const rows = Array.from(
    { length: 12 },
    (_, index) =>
      `<tr><td class="text"><div><a href="https://open.spotify.com/track/id${index}">Track ${index}</a></div></td><td>${1_000 + index}</td><td>${10 + index}</td></tr>`,
  ).join("");
  const parsed = parseMonitoringKworbCatalog(rows, "track");
  assert.equal(parsed.length, 12);
  assert.equal(parsed[11]?.key, "id11");
  assert.equal(parsed[11]?.dailyStreams, 21);
});

test("preserves album compilation markers and real stream values", () => {
  const html =
    '<tr><td class="text"><div>^ <a href="https://open.spotify.com/album/abc123">Collection</a></div></td><td>2,000</td><td>31</td></tr>';
  assert.deepEqual(parseMonitoringKworbCatalog(html, "album"), [
    {
      type: "album",
      key: "abc123",
      title: "Collection",
      spotifyUrl: "https://open.spotify.com/album/abc123",
      artworkUrl: null,
      compilation: true,
      totalStreams: 2_000,
      dailyStreams: 31,
    },
  ]);
});

test("uses bounded public Spotify oEmbed artwork when metadata credentials are unavailable", async () => {
  const originalFetch = globalThis.fetch;
  const originalClientId = process.env["SPOTIFY_CLIENT_ID"];
  const originalClientSecret = process.env["SPOTIFY_CLIENT_SECRET"];
  delete process.env["SPOTIFY_CLIENT_ID"];
  delete process.env["SPOTIFY_CLIENT_SECRET"];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("_songs.html"))
      return new Response(
        '<tr><td class="text"><div><a href="https://open.spotify.com/track/track123">Track</a></div></td><td>1,000</td><td>10</td></tr>',
      );
    if (url.endsWith("_albums.html"))
      return new Response(
        '<tr><td class="text"><div><a href="https://open.spotify.com/album/album123">Album</a></div></td><td>2,000</td><td>20</td></tr>',
      );
    if (url.startsWith("https://open.spotify.com/oembed?"))
      return Response.json({
        thumbnail_url: "https://image-cdn-fa.spotifycdn.com/image/test",
      });
    throw new Error(`Unexpected URL: ${url}`);
  }) as typeof fetch;
  try {
    const catalog = await loadCompleteMonitoringKworbCatalog(
      "test-oembed-artist",
    );
    assert.equal(catalog.items.length, 2);
    assert.ok(
      catalog.items.every(
        (item) =>
          item.artworkUrl ===
          "https://image-cdn-fa.spotifycdn.com/image/test",
      ),
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalClientId == null) delete process.env["SPOTIFY_CLIENT_ID"];
    else process.env["SPOTIFY_CLIENT_ID"] = originalClientId;
    if (originalClientSecret == null)
      delete process.env["SPOTIFY_CLIENT_SECRET"];
    else process.env["SPOTIFY_CLIENT_SECRET"] = originalClientSecret;
  }
});
