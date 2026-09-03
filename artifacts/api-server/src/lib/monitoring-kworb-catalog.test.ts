import assert from "node:assert/strict";
import test from "node:test";
import { parseMonitoringKworbCatalog } from "./monitoring-kworb-catalog";

test("parses complete Kworb rows without imposing the free-profile top-ten limit", () => {
  const rows = Array.from({ length: 12 }, (_, index) =>
    `<tr><td class="text"><div><a href="https://open.spotify.com/track/id${index}">Track ${index}</a></div></td><td>${1_000 + index}</td><td>${10 + index}</td></tr>`,
  ).join("");
  const parsed = parseMonitoringKworbCatalog(rows, "track");
  assert.equal(parsed.length, 12);
  assert.equal(parsed[11]?.key, "id11");
  assert.equal(parsed[11]?.dailyStreams, 21);
});

test("preserves album compilation markers and real stream values", () => {
  const html = '<tr><td class="text"><div>^ <a href="https://open.spotify.com/album/abc123">Collection</a></div></td><td>2,000</td><td>31</td></tr>';
  assert.deepEqual(parseMonitoringKworbCatalog(html, "album"), [{
    type: "album",
    key: "abc123",
    title: "Collection",
    spotifyUrl: "https://open.spotify.com/album/abc123",
    compilation: true,
    totalStreams: 2_000,
    dailyStreams: 31,
  }]);
});
