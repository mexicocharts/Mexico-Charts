import type { SongstatsArtistInfo } from "./songstats-client";

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object"
    ? value as Record<string, unknown>
    : undefined;
}

export function artistInfoFromPayload(
  payload: Record<string, unknown> | undefined,
): SongstatsArtistInfo | undefined {
  const data = recordValue(payload?.["data"]);
  const nested = recordValue(payload?.["artist_info"])
    ?? recordValue(data?.["artist_info"]);
  if (nested) return nested as SongstatsArtistInfo;
  if (data && (data["songstats_artist_id"] || data["links"])) {
    return data as SongstatsArtistInfo;
  }
  return undefined;
}

export function sourceIdsFromInfoPayload(
  payload: Record<string, unknown> | undefined,
): string[] {
  const data = recordValue(payload?.["data"]);
  const sourceIds = payload?.["source_ids"] ?? data?.["source_ids"];
  return Array.isArray(sourceIds)
    ? sourceIds.filter((value): value is string => typeof value === "string")
    : [];
}
