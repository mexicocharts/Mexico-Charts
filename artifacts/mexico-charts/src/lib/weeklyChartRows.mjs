/** Historical routes must never substitute a live chart when an archive is absent. */
export function selectWeeklyChartRows(requestedDate, archivedRows, liveRows, isMexican) {
  const rows = requestedDate ? (archivedRows ?? []) : liveRows.filter(isMexican);
  return rows.slice(0, 10);
}
