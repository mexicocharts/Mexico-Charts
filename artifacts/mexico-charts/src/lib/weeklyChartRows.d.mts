type Row = Record<string, string>;
export function selectWeeklyChartRows(
  requestedDate: string | null,
  archivedRows: Row[] | undefined,
  liveRows: Row[],
  isMexican: (row: Row) => boolean,
): Row[];
