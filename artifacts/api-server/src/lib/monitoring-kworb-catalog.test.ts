import assert from "node:assert/strict";
import test from "node:test";
import {
  loadCompleteMonitoringKworbCatalog,
  parseMonitoringKworbCatalog,
} from "./monitoring-kworb-catalog";

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
