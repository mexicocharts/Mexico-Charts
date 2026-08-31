// Verified from official_chart_snapshots through /api/charts/history.
// Keep this manifest checked in so production builds never guess archive dates
// or depend on live network access. `updatedAt` is the newest saved snapshot
// timestamp among the weekly Spotify and YouTube chart sources for the edition.
export const WEEKLY_EDITIONS = [
  { date: "2026-08-27", updatedAt: "2026-08-31T01:08:26.830720Z" },
  { date: "2026-08-20", updatedAt: "2026-08-30T16:46:31.660638Z" },
  { date: "2026-08-13", updatedAt: "2026-08-23T14:37:48.521864Z" },
];

export function weeklyEdition(date) {
  return WEEKLY_EDITIONS.find((edition) => edition.date === date) ?? null;
}

export function weeklyEditionNeighbors(date) {
  const index = WEEKLY_EDITIONS.findIndex((edition) => edition.date === date);
  if (index < 0) return { newer: null, older: null };
  return {
    newer: WEEKLY_EDITIONS[index - 1] ?? null,
    older: WEEKLY_EDITIONS[index + 1] ?? null,
  };
}
