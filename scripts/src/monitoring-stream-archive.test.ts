import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createRequire } from "node:module";

import {
  parseMonitoringCatalog,
  writeParquetArchive,
  type ArchiveRow,
} from "./monitoring-stream-archive.js";

const require = createRequire(import.meta.url);
const { ParquetReader } = require("parquetjs-lite") as {
  ParquetReader: {
    openFile: (path: string) => Promise<{
      getCursor: () => { next: () => Promise<Record<string, unknown> | null> };
      close: () => Promise<void>;
    }>;
  };
};

test("parseMonitoringCatalog retains exact stream counts", () => {
  const html = '<tr><td class="text"><div><a href="https://open.spotify.com/track/abc123">Canción</a></div></td><td>1,234,567</td><td>8,901</td></tr>';
  assert.deepEqual(parseMonitoringCatalog(html, "track"), [{
    itemType: "track",
    itemKey: "abc123",
    title: "Canción",
    spotifyUrl: "https://open.spotify.com/track/abc123",
    artworkUrl: null,
    totalStreams: 1_234_567,
    dailyStreams: 8_901,
    compilation: false,
  }]);
});

test("writeParquetArchive creates a readable partitioned archive", async () => {
  const directory = await mkdtemp(join(tmpdir(), "mexico-charts-parquet-test-"));
  const rows: ArchiveRow[] = [
    {
      artistKey: "luis-miguel",
      artistName: "Luis Miguel",
      snapshotDate: "2026-08-10",
      fetchedAt: "2026-08-10T12:00:00.000Z",
      itemType: "track",
      itemKey: "track-1",
      title: "Ahora Te Puedes Marchar",
      spotifyUrl: "https://open.spotify.com/track/track-1",
      artworkUrl: null,
      totalStreams: 123_456_789,
      dailyStreams: 45_678,
      compilation: false,
    },
    {
      artistKey: "luis-miguel",
      artistName: "Luis Miguel",
      snapshotDate: "2026-08-10",
      fetchedAt: "2026-08-10T12:00:00.000Z",
      itemType: "album",
      itemKey: "album-1",
      title: "Romance",
      spotifyUrl: null,
      artworkUrl: null,
      totalStreams: 987_654_321,
      dailyStreams: 76_543,
      compilation: false,
    },
  ];

  try {
    const archive = await writeParquetArchive(directory, "2026-08-10", rows);
    assert.equal(archive.objectKey, "stream-history/year=2026/month=08/day=10/catalog.parquet");
    assert.ok(archive.bytes > 0);
    assert.match(archive.sha256, /^[a-f0-9]{64}$/);
    assert.ok((await readFile(archive.path)).subarray(0, 4).equals(Buffer.from("PAR1")));

    const reader = await ParquetReader.openFile(archive.path);
    try {
      const cursor = reader.getCursor();
      const first = await cursor.next();
      const second = await cursor.next();
      assert.equal(first?.artist_key, "luis-miguel");
      assert.equal(first?.daily_streams, 45_678n);
      assert.equal(second?.item_type, "album");
      assert.equal(await cursor.next(), null);
    } finally {
      await reader.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
