import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { resolveDatabaseUrl } from "@workspace/db/database-url";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg") as {
  Pool: new (config: { connectionString: string }) => {
    connect: () => Promise<{ query: (sql: string, params?: unknown[]) => Promise<{ rowCount: number | null }>; release: () => void }>;
    end: () => Promise<void>;
  };
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index++; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { values.push(value); value = ""; }
    else value += char;
  }
  values.push(value);
  return values;
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find(value => value.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const input = resolve(arg("file") ?? process.env["ARTIST_SOCIAL_DISCOVERY_CSV"] ?? "./final-social-account-discovery.csv");
  const write = arg("write") === "true";
  const lines = (await readFile(input, "utf8")).trim().split(/\r?\n/);
  const columns = parseCsvLine(lines.shift() ?? "");
  const rows = lines.map(line => Object.fromEntries(columns.map((column, index) => [column, parseCsvLine(line)[index] ?? ""])))
    .filter(row => row.status === "verified" && Number(row.confidence) >= 90);
  console.log(JSON.stringify({ mode: write ? "write" : "dry-run", input, eligible: rows.length }, null, 2));
  if (!write) return;
  const databaseUrl = resolveDatabaseUrl();

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const row of rows) {
      await client.query(`
        INSERT INTO artist_social_account_candidates (
          artist_key, platform, canonical_url, evidence_sources, confidence, status,
          discovered_at, verified_at, last_checked_at, created_at, updated_at
        ) VALUES ($1,$2,$3,$4::jsonb,$5,'verified',$6::date,$7::date,now(),now(),now())
        ON CONFLICT (artist_key, platform, canonical_url) DO UPDATE SET
          evidence_sources = excluded.evidence_sources,
          confidence = excluded.confidence,
          status = CASE WHEN artist_social_account_candidates.status = 'rejected' THEN 'rejected' ELSE 'verified' END,
          verified_at = CASE WHEN artist_social_account_candidates.status = 'rejected' THEN artist_social_account_candidates.verified_at ELSE excluded.verified_at END,
          last_checked_at = now(), updated_at = now()
      `, [
        row.artist_key, row.platform, row.canonical_url,
        JSON.stringify(String(row.evidence_sources ?? "").split("+").filter(Boolean)), Number(row.confidence),
        row.discovery_date || new Date().toISOString().slice(0, 10),
        row.verification_date || row.discovery_date || new Date().toISOString().slice(0, 10),
      ]);
    }
    await client.query("COMMIT");
    console.log(`IMPORTED:${rows.length}`);
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
