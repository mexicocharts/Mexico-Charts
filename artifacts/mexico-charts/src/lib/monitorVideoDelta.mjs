const measuredNumber = value => value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value);

/** A delta is usable only with its genuine positive elapsed interval. */
export function monitorVideoDelta(delta, seconds) {
  const value = measuredNumber(delta);
  const elapsed = measuredNumber(seconds);
  return value !== null && elapsed !== null && elapsed > 0 ? value : null;
}

/** Never present a partial sum as the complete collection's change. */
export function completeMonitorVideoDelta(deltas) {
  return deltas.length && deltas.every(value => value !== null && Number.isFinite(value))
    ? deltas.reduce((total, value) => total + value, 0)
    : null;
}
