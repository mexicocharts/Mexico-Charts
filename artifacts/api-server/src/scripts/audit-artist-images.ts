import { auditArtistImageCoverage } from "../lib/artist-image-resolver";
import { canonicalArtistCatalog } from "../../../mexico-charts/src/lib/artistRoutes.mjs";

const names = canonicalArtistCatalog.map((artist) => artist.name);
const report = await auditArtistImageCoverage(names);
const slugsByName = new Map(canonicalArtistCatalog.map((artist) => [artist.name, artist.slug]));
console.log(JSON.stringify({
  ...report,
  unresolved: report.unresolved.map((item) => ({
    ...item,
    slug: slugsByName.get(item.artistName) ?? null,
  })),
}, null, 2));