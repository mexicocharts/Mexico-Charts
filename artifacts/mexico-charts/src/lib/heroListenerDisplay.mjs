// Presentation for the hero only. Shared snapshot selection stays unchanged.
export function heroListenerDisplay(selected) {
  const value = selected.value;
  const source = value == null ? null : selected.source === "Songstats" ? "saved" : "editorial";
  const state = value == null ? "missing"
    : typeof value !== "number" || !Number.isFinite(value) || value < 0 ? "invalid"
    : source === "editorial" && value === 0 ? "unconfirmed"
    : "available";

  // Keep calendar dates intact; never substitute collection or current time.
  const rawDate = source === "saved" ? selected.date : null;
  let snapshotDate = null;
  if (typeof rawDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    const parsed = new Date(`${rawDate}T12:00:00Z`);
    if (!Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === rawDate) snapshotDate = rawDate;
  }
  return { state, compact: state === "available" ? selected.compact : null, source, snapshotDate };
}
