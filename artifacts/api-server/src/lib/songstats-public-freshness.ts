export type DatedMetric = {
  value: number | null | undefined;
  date: string | null | undefined;
};

function validDate(value: string | null | undefined): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return value;
}

/**
 * Selects the newest available public metric without mixing an older historic
 * value with the date from a newer current snapshot. On equal/unknown dates,
 * the dedicated current snapshot wins because it is the direct current-stats
 * response rather than the final point in a historic series.
 */
export function chooseFreshSongstatsMetric(
  currentSnapshot: DatedMetric,
  historicSnapshot: DatedMetric,
): number | null {
  const currentValue = currentSnapshot.value ?? null;
  const historicValue = historicSnapshot.value ?? null;

  if (currentValue == null) return historicValue;
  if (historicValue == null) return currentValue;

  const currentDate = validDate(currentSnapshot.date);
  const historicDate = validDate(historicSnapshot.date);
  if (currentDate && historicDate && historicDate > currentDate) {
    return historicValue;
  }
  return currentValue;
}

/**
 * Keeps the headline audience reading consistent with the historic series
 * used to calculate growth. The dedicated current-stats snapshot remains a
 * fallback for metrics that Songstats does not include in that series.
 */
export function chooseCanonicalSongstatsMetric(
  currentSnapshot: DatedMetric,
  historicSnapshot: DatedMetric,
): number | null {
  return historicSnapshot.value ?? currentSnapshot.value ?? null;
}

export function newestSongstatsDate(
  ...dates: Array<string | null | undefined>
): string | null {
  return dates
    .map(validDate)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;
}
