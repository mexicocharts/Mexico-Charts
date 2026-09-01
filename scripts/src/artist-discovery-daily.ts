import { resolveDatabaseUrl } from "@workspace/db/database-url";
import { runArtistDiscoveryImport } from "./artist-discovery-import-charts-hub";
import { runArtistDiscoveryReverify } from "./artist-discovery-reverify-candidates";

function parseArgs() {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    args.set(key, value);
  }
  return {
    baseUrl: args.get("baseUrl"),
    country: args.get("country") ?? "MX",
    date: args.get("date") ?? new Date().toISOString().slice(0, 10),
    maxRowsPerSheet: Number(args.get("maxRowsPerSheet") ?? 0),
    verifyLimit: Math.max(0, Math.min(Number(args.get("verifyLimit") ?? 150), 500)),
    skipVerify: args.get("skipVerify") === "true",
  };
}

async function main() {
  const options = parseArgs();
  resolveDatabaseUrl();

  console.log(`Artist discovery daily start date=${options.date} country=${options.country}`);
  try {
    await runArtistDiscoveryImport({
      baseUrl: options.baseUrl ?? "https://mexicochart.com",
      country: options.country,
      chartDate: options.date,
      write: true,
      maxRowsPerSheet: options.maxRowsPerSheet,
    });

    if (!options.skipVerify && options.verifyLimit > 0) {
      await runArtistDiscoveryReverify({
        limit: options.verifyLimit,
        write: true,
        wikidata: true,
        musicbrainz: true,
      });
    }

    console.log(`Artist discovery daily complete date=${options.date}`);
  } catch (err) {
    console.error(`Artist discovery daily failed date=${options.date}:`, err);
    process.exitCode = 1;
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

export {};
