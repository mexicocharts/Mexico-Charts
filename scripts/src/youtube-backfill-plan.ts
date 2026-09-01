import { createRequire } from "node:module";
import { resolveDatabaseUrl } from "@workspace/db/database-url";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg") as {
  Pool: new (config: { connectionString: string }) => {
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
    end: () => Promise<void>;
  };
};

interface ArtistRow {
  artist_key: string;
  artist_name: string;
  youtube_subscribers?: string;
  youtube_views?: string;
}

const ARTIST_METADATA_URL =
  "https://docs.google.com/spreadsheets/d/18urSUcuMeQxpKvS0gwg5Irz3TSC9zpHJ/gviz/tq?tqx=out:csv&sheet=artist_metadata_active";

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    args.set(key, value);
  }
  return {
    limit: Math.max(1, Math.min(Number(args.get("limit") ?? 25), 100)),
    offset: Math.max(0, Number(args.get("offset") ?? 0)),
  };
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        i += 1;
      } else if (char === "\"") {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === "\"") quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
  }
  row.push(field);
  rows.push(row);
  return rows.filter(r => r.some(cell => cell.trim()));
}

function rowsToObjects(rows: string[][]): ArtistRow[] {
  const [headers = [], ...body] = rows;
  return body.map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header.trim()] = row[index]?.trim() ?? "";
    });
    return obj as unknown as ArtistRow;
  }).filter(row => row.artist_key && row.artist_name);
}

async function main() {
  const { limit, offset } = parseArgs();
  const pool = new Pool({ connectionString: resolveDatabaseUrl() });
  try {
    const csv = await fetch(ARTIST_METADATA_URL).then(res => {
      if (!res.ok) throw new Error(`artist metadata HTTP ${res.status}`);
      return res.text();
    });
    const artists = rowsToObjects(parseCsv(csv));

    const linkedRows = await pool.query<{ artist_key: string }>("select artist_key from youtube_channels");
    const linked = new Set(linkedRows.rows.map(row => row.artist_key));

    const candidateTable = await pool.query<{ exists: boolean }>(
      "select to_regclass('public.youtube_channel_candidates') is not null as exists",
    );
    const candidateRows = candidateTable.rows[0]?.exists
      ? await pool.query<{ artist_key: string; status: string }>("select artist_key, status from youtube_channel_candidates")
      : { rows: [] };
    const reviewed = new Set(
      candidateRows.rows
        .filter(row => ["review", "no_result", "error"].includes(row.status))
        .map(row => row.artist_key),
    );

    const unlinked = artists.filter(artist => !linked.has(artist.artist_key));
    const searchQueue = unlinked.filter(artist => !reviewed.has(artist.artist_key));
    const slice = searchQueue.slice(offset, offset + limit);

    const statusCounts = candidateRows.rows.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = (acc[row.status] ?? 0) + 1;
      return acc;
    }, {});

    console.log(`artists_total=${artists.length}`);
    console.log(`youtube_linked=${linked.size}`);
    console.log(`candidate_rows=${candidateRows.rows.length}`);
    console.log(`candidate_status_counts=${JSON.stringify(statusCounts)}`);
    console.log(`unlinked=${unlinked.length}`);
    console.log(`search_queue_unlinked_unreviewed=${searchQueue.length}`);
    console.log(`planned_offset=${offset}`);
    console.log(`planned_limit=${limit}`);
    console.log("planned_search_batch:");
    for (const artist of slice) {
      console.log([
        artist.artist_key,
        artist.artist_name,
        artist.youtube_subscribers ?? "",
        artist.youtube_views ?? "",
      ].join(","));
    }
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
