import { createRequire } from "node:module";
import { resolveDatabaseUrl } from "@workspace/db/database-url";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg") as {
  Pool: new (config: { connectionString: string }) => {
    query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[] }>;
    end: () => Promise<void>;
  };
};

interface CandidateRow {
  artist_key: string;
  artist_name: string;
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
    minScore: Math.max(0, Math.min(Number(args.get("minScore") ?? 65), 100)),
    write: args.get("write") === "true",
  };
}

async function main() {
  const databaseUrl = resolveDatabaseUrl();
  const { minScore, write } = parseArgs();
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const result = await pool.query<CandidateRow>(
      `select artist_key, artist_name, candidates
       from musicbrainz_artist_candidates
       where status = 'review'
         and best_score >= $1
       order by best_score desc, artist_name asc`,
      [minScore],
    );

    let approved = 0;
    console.log(`${write ? "Approving" : "Dry run"} ${result.rows.length} MusicBrainz candidates with score >= ${minScore}.`);

    for (const row of result.rows) {
      const best = row.candidates[0];
      if (!best?.mbid) continue;

      console.log(`${write ? "APPROVE" : "WOULD_APPROVE"},${row.artist_key},${row.artist_name},score=${best.score},${best.mbid},${best.name},${best.type ?? ""},${best.country ?? ""}`);

      if (write) {
        await pool.query(
          `insert into musicbrainz_artists (
            artist_key, mbid, name, sort_name, disambiguation, type, country,
            area_name, begin_date, end_date, aliases, tags, relations,
            verified, last_updated, linked_at
          ) values ($1,$2,$3,$4,$5,$6,$7,$8,null,null,'[]'::jsonb,'[]'::jsonb,'[]'::jsonb,'auto_review_accepted',now(),now())
          on conflict (artist_key) do nothing`,
          [
            row.artist_key,
            best.mbid,
            best.name,
            null,
            best.disambiguation,
            best.type,
            best.country,
            best.areaName,
          ],
        );
        await pool.query("delete from musicbrainz_artist_candidates where artist_key = $1", [row.artist_key]);
      }
      approved += 1;
    }

    const linked = await pool.query<{ count: number }>("select count(*)::int as count from musicbrainz_artists");
    const candidates = await pool.query<{ count: number }>("select count(*)::int as count from musicbrainz_artist_candidates");
    console.log(`Done. approved=${approved} db_musicbrainz_artists=${linked.rows[0].count} candidate_rows=${candidates.rows[0].count}`);
  } finally {
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
