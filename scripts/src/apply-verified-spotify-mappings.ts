import { createRequire } from "node:module";
import { resolveDatabaseUrl } from "@workspace/db/database-url";

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
  allowInsert?: boolean;
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
  { catalogArtistName: "El Movimiento Alterado", spotifyArtistId: "30fa9LT7XVys8DcigD1k9x" },
  { catalogArtistName: "Los Austeros De Durango", spotifyArtistId: "3R6Kbe18UcjsGkBGWElC51" },
  { catalogArtistName: "Joy Huerta", spotifyArtistId: "6iH6aIbOCOdO3Ja6JeyOm1" },
  { catalogArtistName: "Roberto Junior Y Su Bandeño", spotifyArtistId: "6lcyDWmvYnBiGgHO9knEOb" },
  { catalogArtistName: "Saul Alarcon", spotifyArtistId: "4zDxqX7DmkPcNfXkrPuYro" },
  { catalogArtistName: "La Dinastía de Tuzantla Michoacán", spotifyArtistId: "2u7j1pjcNuLlfgiNrByi0R" },
  { catalogArtistName: "Alto Linaje", spotifyArtistId: "5fUua1kfdZhAopUPazcdC5" },
  { catalogArtistName: "Los Avila", spotifyArtistId: "0A0oFtNpb7CV86uWlxjnQo" },
  { catalogArtistName: "Toño Lizarraga", spotifyArtistId: "58kEJAbZ1Knbo4UI2phUQv" },
  { catalogArtistName: "Adan Chalino Sanchez", spotifyArtistId: "2zyNL1jSCA6HH5m0BZZTgy" },
  { catalogArtistName: "LDNE", spotifyArtistId: "5hkcGbdTv8nC62vVT7RJmZ" },
  { catalogArtistName: "Banda La Ejecutiva", spotifyArtistId: "6BHFzhrhbK5ogpJ8H2z71Y" },
  { catalogArtistName: "Beto Y Sus Canarios", spotifyArtistId: "1Y4RbL9WTMzu0TTobNbNSv" },
  { catalogArtistName: "Angel Tumbado", spotifyArtistId: "6Vlv2tBpKw6ib5C7DHkOfq" },
  { catalogArtistName: "Banda Rancho Viejo De Julio Aramburo La Bandononona", spotifyArtistId: "39dmt5DRpnyJKgz5bc4ZNV" },
  { catalogArtistName: "Los Nuevos Elegantes", spotifyArtistId: "3RtWK9v7X0AvL18T3LeC7i" },
  { catalogArtistName: "Grupo Secreto", spotifyArtistId: "3qDB4quRSDMBXygOU4JAbg", allowInsert: true },
  { catalogArtistName: "Los Amos De Nuevo Leon", spotifyArtistId: "2PpOrMC4P8PG2yi0S3ft0l" },
  { catalogArtistName: "Omar Ruiz", spotifyArtistId: "2ylQO8qFEBINvkNNZGe4uC" },
  { catalogArtistName: "Los Tiranos Del Norte", spotifyArtistId: "1utHYFInTd5VfFdsshUQ7H" },
  { catalogArtistName: "Los Minis de Caborca", spotifyArtistId: "09Hzsy5bgnADJzIVlYUoQ3" },
  { catalogArtistName: "Nivel C", spotifyArtistId: "0CUbRHUcHesT778ioJt9oM" },
  { catalogArtistName: "Banda la Sinaloense de Alex Ojeda", spotifyArtistId: "6ucSqPKWD0QdphhjNrVnUf" },
  { catalogArtistName: "Grupo Pegasso Del Pollo Esteban", spotifyArtistId: "00YglmekVqqlHbv8N8erfv" },
  { catalogArtistName: "Hector Rubio", spotifyArtistId: "2uSJ9ywE44eIRoTMatARAy" },
  { catalogArtistName: "Los Buitres De Culiacán", spotifyArtistId: "535ap2f16rTOKTMPTkvbGB" },
  { catalogArtistName: "Los Player's de Tuzantla", spotifyArtistId: "77UR8eXyohRSAMyLhYfdxW" },
  { catalogArtistName: "Leandro Ríos", spotifyArtistId: "1FEYq0PPuI50GJRqKKPT6w" },
  { catalogArtistName: "Cuarto de Milla", spotifyArtistId: "5yambtXlsDmaV304q7CRIe" },
  { catalogArtistName: "Arsenal Efectivo", spotifyArtistId: "2MMXs21RASEwAmU7gRheQ0" },
  { catalogArtistName: "Los Pescadores Del Rio Conchos", spotifyArtistId: "3h88VTqRj3GbUd2W41ZY5U" },
  { catalogArtistName: "Macariø Martínez", spotifyArtistId: "228pVneav5qwbCGQrrqQo4" },
  { catalogArtistName: "Yolo Aventuras", spotifyArtistId: "1KIhj73vkkW08uTibyGf37" },
  { catalogArtistName: "Los Amables Del Norte", spotifyArtistId: "7r1Ecc2TAxhyLeGac53N6K" },
  { catalogArtistName: "Susy Mouriz", spotifyArtistId: "3xS6l6yhhkX1736IycBSSh" },
  { catalogArtistName: "Farid Dieck", spotifyArtistId: "6K96Qw9BnJJedyklrfjC0M" },
  { catalogArtistName: "Beto Zapata", spotifyArtistId: "2kV0efFqE8KyEzv7YVBQlx" },
  { catalogArtistName: "Los Hnos Rodriguez", spotifyArtistId: "4pLBsWSdyApz2k5JtPnmGU" },
  { catalogArtistName: "Esteban Gabriel", spotifyArtistId: "6RPeBghYnSwGV6FOw7huuN" },
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
  const connectionString = resolveDatabaseUrl();

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
    const insertableMissing = missing.filter(mapping => mapping.allowInsert);
    const invalidMissing = missing.filter(mapping => !mapping.allowInsert);
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
      insertableMissing: insertableMissing.map(mapping => mapping.artistKey),
      invalidMissing: invalidMissing.map(mapping => mapping.artistKey),
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

    if (invalidMissing.length > 0 || conflicting.length > 0) {
      throw new Error("Validation failed; no database changes were made.");
    }
    if (!write) {
      console.log("DRY_RUN_OK");
      return;
    }

    await client.query("BEGIN");
    for (const mapping of insertableMissing) {
      const result = await client.query(
        `INSERT INTO kworb_coverage (
           artist_key,
           artist_name,
           spotify_id,
           has_spotify,
           status,
           consecutive_failures,
           last_discovered_at
         )
         VALUES ($1, $2, $3, TRUE, 'active', 0, NOW())
         ON CONFLICT (artist_key) DO NOTHING`,
        [mapping.artistKey, mapping.catalogArtistName, mapping.spotifyArtistId],
      );
      if (result.rowCount !== 1) {
        throw new Error(`Atomic insert failed for ${mapping.artistKey}; rolling back.`);
      }
    }
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
