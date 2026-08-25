import { artistProfileRoutes } from "../../scripts/artist-profile-routes.mjs";

function slugifyArtist(value = "") {
  let decoded = String(value);
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Malformed URL escapes are treated as an unknown identifier, never an exception.
  }
  return decoded
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " y ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const catalog = artistProfileRoutes.map((route) => ({
  ...route,
  slug: route.path.replace(/^\/artist\//, ""),
}));

// Confirmed provider alias: both names resolve to Spotify artist id
// 6AcOTCYBMvjKYy4zms0kaC. Keep the alias routable for old links, but never
// expose it as a second public profile.
const legacyAliases = new Map([
  ["banda-el-recodo-de-cruz-lizarraga", "banda-el-recodo"],
]);

const aliases = new Map();
const ambiguousAliases = new Set();

function addAlias(alias, artist) {
  if (!alias || ambiguousAliases.has(alias)) return;
  const existing = aliases.get(alias);
  if (existing && existing.path !== artist.path) {
    aliases.delete(alias);
    ambiguousAliases.add(alias);
    return;
  }
  aliases.set(alias, artist);
}

for (const artist of catalog) {
  const nameSlug = slugifyArtist(artist.name);
  for (const alias of new Set([
    artist.slug,
    nameSlug,
    artist.slug.replace(/-/g, ""),
    nameSlug.replace(/-/g, ""),
  ])) {
    addAlias(alias, artist);
  }
}

export const artistCatalogCount = catalog.length;
export const canonicalArtistCatalog = Object.freeze(catalog);

export function resolveCanonicalArtist(value) {
  if (!value) return null;
  const withoutQuery = String(value).split(/[?#]/, 1)[0];
  const identifier = withoutQuery.replace(/^https?:\/\/[^/]+/i, "").replace(/^\/artist\//, "");
  const slug = slugifyArtist(identifier);
  const legacyCanonicalSlug = legacyAliases.get(slug) ?? legacyAliases.get(slug.replace(/-/g, ""));
  if (legacyCanonicalSlug) {
    return catalog.find((artist) => artist.slug === legacyCanonicalSlug) ?? null;
  }
  return aliases.get(slug) ?? aliases.get(slug.replace(/-/g, "")) ?? null;
}

export function canonicalArtistHref(value) {
  return resolveCanonicalArtist(value)?.path ?? null;
}

export function artistSearchHref(value) {
  const query = String(value ?? "").trim();
  return query ? `/artists?q=${encodeURIComponent(query)}` : "/artists";
}

export function isHiddenArtistAlias(value) {
  const slug = slugifyArtist(value);
  return legacyAliases.has(slug) || legacyAliases.has(slug.replace(/-/g, ""));
}

export { slugifyArtist };
