export type ChartComparisonRow = Record<string, string>;

function rowRank(row: ChartComparisonRow, index: number): number {
  const parsed = Number.parseInt(row["Rank"] ?? row["rank"] ?? row["Position"] ?? row["position"] ?? "", 10);
  return Number.isFinite(parsed) ? parsed : index + 1;
}

function rowIdentity(row: ChartComparisonRow): string {
  return [row["Track ID"], row["Video ID"], row["Title"], row["Track Name"], row["Artist"], row["Artist Name"], row["Artist Names"]]
    .filter(Boolean).join("|").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9|]/g, "");
}

export function compareChartEditions(current: ChartComparisonRow[], previous: ChartComparisonRow[]) {
  const previousRank = new Map<string, number>(previous.flatMap((row, index): Array<[string, number]> => {
    const identity = rowIdentity(row);
    return identity ? [[identity, rowRank(row, index)]] : [];
  }));
  const entries = current.map((row, index) => {
    const rank = rowRank(row, index);
    const prior = previousRank.get(rowIdentity(row)) ?? null;
    return { rank, previousRank: prior, movement: prior == null ? null : prior - rank, debut: prior == null, row };
  });
  return {
    top10: entries.slice(0, 10),
    debuts: entries.filter(entry => entry.debut).slice(0, 10),
    climbers: entries.filter(entry => (entry.movement ?? 0) > 0).sort((a, b) => (b.movement ?? 0) - (a.movement ?? 0)).slice(0, 10),
    fallers: entries.filter(entry => (entry.movement ?? 0) < 0).sort((a, b) => (a.movement ?? 0) - (b.movement ?? 0)).slice(0, 10),
    mexicanEntries: entries.filter(entry => /^(true|yes|1)$/i.test(entry.row["Contains Mexican Artist"] ?? "")).slice(0, 25),
  };
}
