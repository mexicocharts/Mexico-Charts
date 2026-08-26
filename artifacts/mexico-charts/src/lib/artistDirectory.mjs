import { canonicalArtistHref, resolveCanonicalArtist } from "./artistRoutes.mjs";

const GENERIC_METADATA_VALUES = new Set([
  "",
  "undefined",
  "unknown",
  "por clasificar",
  "música mexicana",
]);

const METRIC_FIELDS = [
  "spotifyListeners",
  "spotifyFollowers",
  "spotifyStreams",
  "spotifyPlaylistReach",
  "youtubeSubscribers",
  "youtubeViews",
  "tiktokFollowers",
  "instagramFollowers",
  "facebookFollowers",
  "deezerFans",
  "soundcloudFollowers",
];

function normalizedValue(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function metadataSpecificity(value) {
  return GENERIC_METADATA_VALUES.has(normalizedValue(value)) ? 0 : 1;
}

function populatedMetricCount(record) {
  return METRIC_FIELDS.reduce((count, field) => count + (Number(record[field]) > 0 ? 1 : 0), 0);
}

function isUsableImageUrl(value) {
  if (typeof value !== "string" || !value.trim()) return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function recordQuality(record) {
  return (
    metadataSpecificity(record.genre) * 8
    + metadataSpecificity(record.subgenre) * 8
    + metadataSpecificity(record.country) * 2
    + metadataSpecificity(record.label)
    + populatedMetricCount(record)
  );
}

function profileIdentityFor(record) {
  const resolved = resolveCanonicalArtist(record.displayName) ?? resolveCanonicalArtist(record.artistKey);
  if (!resolved) return null;
  const href = canonicalArtistHref(resolved.path);
  if (!href) return null;
  return {
    canonicalName: resolved.name,
    profileHref: href,
    profileSlug: resolved.slug,
  };
}

function mergeDuplicateRecords(records, identity) {
  const ranked = records
    .map((record, index) => ({ record, index, quality: recordQuality(record) }))
    .sort((a, b) => b.quality - a.quality || a.index - b.index);
  const primary = ranked[0].record;
  const merged = { ...primary };

  // Keep the most complete row's identity/labels, while filling blank metrics
  // from another row representing this same canonical profile.
  for (const { record } of ranked.slice(1)) {
    for (const [key, value] of Object.entries(record)) {
      if (merged[key] == null || merged[key] === "" || merged[key] === "—") {
        if (value != null && value !== "") merged[key] = value;
      }
    }
  }

  return {
    ...merged,
    canonicalName: identity.canonicalName,
    profileHref: identity.profileHref,
    profileSlug: identity.profileSlug,
  };
}

/**
 * Produces the public artist directory from metadata rows.
 *
 * The profile catalog is the source of truth for public routes. Rows are
 * grouped by the resolved canonical profile path, which merges aliases and
 * casing variants without conflating unrelated names that have no shared
 * catalog identity.
 */
export function auditArtistDirectoryRecords(records) {
  const groups = new Map();
  const excluded = [];

  records.forEach((record, sourceIndex) => {
    const identity = profileIdentityFor(record);
    if (!identity) {
      excluded.push({
        sourceIndex,
        artistKey: record.artistKey,
        displayName: record.displayName,
        reason: "missing-profile-route",
      });
      return;
    }

    const existing = groups.get(identity.profileHref);
    if (existing) {
      existing.records.push(record);
    } else {
      groups.set(identity.profileHref, { identity, records: [record] });
    }
  });

  const artists = [];
  const duplicateGroups = [];
  for (const group of groups.values()) {
    if (group.records.length > 1) {
      duplicateGroups.push({
        profileHref: group.identity.profileHref,
        canonicalName: group.identity.canonicalName,
        sourceNames: group.records.map(record => record.displayName),
      });
    }
    artists.push(mergeDuplicateRecords(group.records, group.identity));
  }

  return { artists, excluded, duplicateGroups };
}

export function imageCandidates(primaryUrl, fallbackUrl) {
  return [primaryUrl, fallbackUrl].filter((url, index, urls) => (
    isUsableImageUrl(url)
    && urls.indexOf(url) === index
  ));
}

export function directoryImageState({
  primaryUrl,
  fallbackUrl,
  imageLookupReady,
  fallbackLookupLoading = false,
  failedUrls = new Set(),
}) {
  const candidates = imageCandidates(primaryUrl, fallbackUrl).filter(url => !failedUrls.has(url));
  if (candidates.length > 0) return { state: "image", candidates };
  if (!imageLookupReady || fallbackLookupLoading) return { state: "loading", candidates: [] };
  return { state: "initial", candidates: [] };
}