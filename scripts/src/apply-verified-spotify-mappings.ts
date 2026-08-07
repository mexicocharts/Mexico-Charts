import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("../../lib/db/node_modules/pg") as {
  Pool: new (config: { connectionString: string }) => {
    connect: () => Promise<{
      query: <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<{ rows: T[]; rowCount: number | null }>;
      release: () => void;
    }>;
    end: () => Promise<void>;
  };
};

interface VerifiedMapping {
  catalogArtistName: string;
  spotifyArtistId: string;
}

interface CoverageRow {
  artist_key: string;
  artist_name: string;
  spotify_id: string | null;
  has_spotify: boolean;
  status: string;
}

const VERIFIED_MAPPINGS: VerifiedMapping[] = [
  { catalogArtistName: "emmanuellcortess_", spotifyArtistId: "7hDt3OE2ubsKzO9rMYPXox" },
  { catalogArtistName: "Grupo Cañaveral", spotifyArtistId: "48zixAu4wMDZwpVbOenDU7" },
  { catalogArtistName: "La Original Banda El Limón de Salvador Lizárraga", spotifyArtistId: "2ghByd8ucnRTWceSAnAZ0G" },
  { catalogArtistName: "Chuy Lizarraga y Su Banda Tierra Sinaloense", spotifyArtistId: "1DA8SLXtp8MMVpgaOWzMQr" },
  { catalogArtistName: "jovanny Cadena", spotifyArtistId: "0aaYORc6Zmp1SCXhRRDwNW" },
  { catalogArtistName: "El Mimoso", spotifyArtistId: "7AUgYiThuW80zSOwY7Ub2g" },
  { catalogArtistName: "Banda Tito Y Su Torbellino", spotifyArtistId: "0c2yelD6HE33WZYXbn8CEJ" },
  { catalogArtistName: "Moenia", spotifyArtistId: "3QmmtMrEf7aQrsd1VtejAV" },
  { catalogArtistName: "Sonora Santanera", spotifyArtistId: "3CsPxFJGyNa9ep79CFWN77" },
  { catalogArtistName: "Banda La Costeña", spotifyArtistId: "1r8tUG15NMJEj1j5NynES7" },
  { catalogArtistName: "Grupo Viento Y Sol", spotifyArtistId: "0RauGa7My7mBTeV3udcpTt" },
  { catalogArtistName: "Grupo Primer Grado", spotifyArtistId: "3eRCLeO8w7xvvg1o39acC7" },
  { catalogArtistName: "Grupo Kual Dinastía Pedraza", spotifyArtistId: "4r880LQXdnpTflv3uqV4kX" },
  { catalogArtistName: "Julio Preciado Y Su Banda Perla Del Pacifico", spotifyArtistId: "1skKkfQtM2dprTwRld9p3p" },
  { catalogArtistName: "Los Buchones De Culiacan", spotifyArtistId: "7J8LbpTbAh807es1ruPYNa" },
  { catalogArtistName: "Dinamicos Jrs", spotifyArtistId: "3GEFlcbzfzakUiKCx038mZ" },
  { catalogArtistName: "Nivel Codiciado", spotifyArtistId: "5aHKxMwIrPVwy4m6FTOiXK" },
  { catalogArtistName: "Los Nuevos Ilegales", spotifyArtistId: "0dAcy3ayJIW98jdHTacqac" },
];

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function shouldWrite(): boolean {
  return process.argv.slice(2).includes("--write=true");
}

async function main() {
  const connectionString = process.env["DATABASE_URL"];
  if (!connectionString) throw new Error("Missing DATABASE_URL.");

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  const write = shouldWrite();

  try {
    const expected = VERIFIED_MAPPINGS.map(mapping => ({
      ...mapping,
      artistKey: toSlug(mapping.catalogArtistName),
    }));
    const artistKeys = expected.map(mapping => mapping.artistKey);
    const spotifyIds = expected.map(mapping => mapping.spotifyArtistId);

    const { rows } = await client.query<CoverageRow>(
      `SELECT artist_key, artist_name, spotify_id, has_spotify, status
         FROM kworb_coverage
        WHERE artist_key = ANY($1::text[])
        ORDER BY artist_key`,
      [artistKeys],
    );
    const rowByKey = new Map(rows.map(row => [row.artist_key, row]));
    const missing = expected.filter(mapping => !rowByKey.has(mapping.artistKey));
    const conflicting = expected.filter(mapping => {
      const current = rowByKey.get(mapping.artistKey)?.spotify_id;
      return current != null && current !== mapping.spotifyArtistId;
    });

    const duplicateAssignments = await client.query<Pick<CoverageRow, "artist_key" | "artist_name" | "spotify_id">>(
      `SELECT artist_key, artist_name, spotify_id
         FROM kworb_coverage
        WHERE spotify_id = ANY($1::text[])
          AND NOT (artist_key = ANY($2::text[]))
        ORDER BY spotify_id, artist_key`,
      [spotifyIds, artistKeys],
    );

    console.log(JSON.stringify({
      mode: write ? "write" : "dry-run",
      requested: expected.length,
      found: rows.length,
      missing: missing.map(mapping => mapping.artistKey),
      conflicting: conflicting.map(mapping => ({
        artistKey: mapping.artistKey,
        current: rowByKey.get(mapping.artistKey)?.spotify_id,
        proposed: mapping.spotifyArtistId,
      })),
      existingAliasAssignments: duplicateAssignments.rows,
      mappings: expected.map(mapping => {
        const row = rowByKey.get(mapping.artistKey);
        return {
          artistKey: mapping.artistKey,
          catalogArtistName: mapping.catalogArtistName,
          databaseArtistName: row?.artist_name ?? null,
          currentSpotifyId: row?.spotify_id ?? null,
          proposedSpotifyId: mapping.spotifyArtistId,
        };
      }),
    }, null, 2));

    if (missing.length > 0 || conflicting.length > 0) {
      throw new Error("Validation failed; no database changes were made.");
    }
    if (!write) {
      console.log("DRY_RUN_OK");
      return;
    }

    await client.query("BEGIN");
    for (const mapping of expected) {
      const result = await client.query(
        `UPDATE kworb_coverage
            SET spotify_id = $1,
                has_spotify = TRUE,
                status = 'active',
                consecutive_failures = 0,
                last_failed_at = NULL,
                last_discovered_at = NOW()
          WHERE artist_key = $2
            AND (spotify_id IS NULL OR spotify_id = $1)`,
        [mapping.spotifyArtistId, mapping.artistKey],
      );
      if (result.rowCount !== 1) {
        throw new Error(`Atomic update failed for ${mapping.artistKey}; rolling back.`);
      }
    }
    await client.query("COMMIT");
    console.log(`WRITE_OK:${expected.length}`);
  } catch (error) {
    if (write) await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
