import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { resolveDatabaseUrl } from "@workspace/db/database-url";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg") as {
  Pool: new (config: { connectionString: string }) => {
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
    end: () => Promise<void>;
  };
};

interface ReviewRow {
  artist_key: string;
  artist_name: string;
  status: string;
  best_score: number;
  candidates: Array<{
    mbid: string;
    name: string;
    score: number;
    type: string | null;
    country: string | null;
    areaName: string | null;
    disambiguation: string | null;
    reasons: string[];
  }>;
}

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    args.set(key, value);
  }
  return {
    status: args.get("status") ?? "review",
    out: args.get("out") ?? "./musicbrainz-review-candidates.csv",
  };
}

function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, "\"\"")}"`;
}

function toCsv(rows: ReviewRow[]) {
  const header = [
    "artist_key",
    "artist_name",
    "status",
    "best_score",
    "candidate_name",
    "candidate_score",
    "musicbrainz_url",
    "type",
    "country",
    "area",
    "disambiguation",
    "reasons",
  ];
  const lines = rows.map(row => {
    const best = row.candidates[0];
    return [
      row.artist_key,
      row.artist_name,
      row.status,
      row.best_score,
      best?.name ?? "",
      best?.score ?? "",
      best?.mbid ? `https://musicbrainz.org/artist/${best.mbid}` : "",
      best?.type ?? "",
      best?.country ?? "",
      best?.areaName ?? "",
      best?.disambiguation ?? "",
      best?.reasons?.join("; ") ?? "",
    ].map(csvCell).join(",");
  });
  return [header.map(csvCell).join(","), ...lines].join("\n") + "\n";
}

async function main() {
  const databaseUrl = resolveDatabaseUrl();
  const { status, out } = parseArgs();
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const result = await pool.query<ReviewRow>(
      `select artist_key, artist_name, status, best_score, candidates
       from musicbrainz_artist_candidates
       where status = $1
       order by best_score desc, artist_name asc`,
      [status],
    );
    await writeFile(out, toCsv(result.rows), "utf8");
    console.log(`Exported ${result.rows.length} ${status} MusicBrainz candidate rows to ${out}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
