export type YoutubeMonitorRow = {
  artist_key?: string | null;
  video_id: string;
  canonical_url?: string | null;
};

export function normalizedYoutubeArtistIdentity(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function canonicalYoutubeWatchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

export function dedupeYoutubeMonitorRows<T extends YoutubeMonitorRow>(rows: T[]): T[] {
  const unique = new Map<string, T>();
  for (const row of rows) {
    const key = `${normalizedYoutubeArtistIdentity(row.artist_key)}:${row.video_id}`;
    if (!unique.has(key)) {
      unique.set(key, { ...row, canonical_url: canonicalYoutubeWatchUrl(row.video_id) });
    }
  }
  return [...unique.values()];
}
