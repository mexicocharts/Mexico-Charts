// Same stored public snapshot contract on profile and comparison. Zero is data.
export function listenerSnapshot(metadata, songstats) {
  const snapshot = songstats?.snapshot;
  const saved = snapshot?.spotifyMonthlyListeners;
  const value = saved ?? metadata?.spotifyListeners ?? null;
  const source = saved != null ? "Songstats" : "Metadatos editoriales";
  const date = saved != null ? snapshot.snapshotDate : null;
  return { value, source, date,
    context: `${source} · Spotify · oyentes mensuales globales · ${date ? `instantánea ${date}` : "fecha no disponible"}`,
    compact: value == null ? "—" : value >= 1e6 ? `${(value / 1e6).toFixed(1)}M` : value.toLocaleString("es-MX"),
  };
}
