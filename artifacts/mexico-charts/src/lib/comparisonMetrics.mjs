// Editorial normalization loses the distinction between blanks and zero.
// Only nullable provider readings can preserve a recorded zero reliably.
export function metricValue(value, { editorial = false } = {}) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    && (!editorial || value > 0) ? value : null;
}

export function comparisonBars(a, b, { compatible = true } = {}) {
  const left = metricValue(a);
  const right = metricValue(b);
  if (!compatible || left == null || right == null) {
    return { comparable: false, a: null, b: null, winner: null };
  }
  const max = Math.max(left, right);
  // Divide first to avoid overflowing the sum for very large finite readings.
  // The two artists occupy the entire line; the boundary moves with their ratio.
  const scaledTotal = max === 0 ? 0 : left / max + right / max;
  const leftWidth = max === 0 ? 0 : (left / max / scaledTotal) * 100;
  return {
    comparable: true,
    a: leftWidth,
    b: max === 0 ? 0 : 100 - leftWidth,
    winner: left === right ? null : left > right ? "a" : "b",
  };
}

export function comparisonScore(metrics) {
  const score = { a: 0, b: 0, ties: 0, unavailable: 0, compared: 0, total: metrics.length };
  for (const metric of metrics) {
    const result = comparisonBars(metric.a.value, metric.b.value, { compatible: metric.compatible });
    if (!result.comparable) score.unavailable += 1;
    else {
      score.compared += 1;
      if (result.winner) score[result.winner] += 1;
      else score.ties += 1;
    }
  }
  return { ...score, winner: score.a === score.b ? null : score.a > score.b ? "a" : "b" };
}

export function commonSourceReadings(a, b, fallbackA, fallbackB) {
  // Keep saved readings when both use the same source, including explicit zero
  // and differing dates. A source mismatch may use a complete common dataset.
  if (a.source !== b.source && metricValue(a.value) > 0 && metricValue(b.value) > 0
    && metricValue(fallbackA.value) != null && metricValue(fallbackB.value) != null
    && snapshotCompatibility(fallbackA, fallbackB).compatible) {
    return { a: fallbackA, b: fallbackB, usedFallback: true };
  }
  return { a, b, usedFallback: false };
}

export function snapshotCompatibility(a, b) {
  // Collection dates are not field observation dates. They can establish a
  // mismatch, but cannot certify that two source observation periods match.
  if (a.source !== b.source || Boolean(a.date) !== Boolean(b.date)
    || (a.date && b.date && a.date !== b.date)) {
    return { compatible: false, note: "Fuentes o fechas distintas · sin comparación temporal directa" };
  }
  return { compatible: true, note: a.date
    ? "Fecha de colección disponible; fecha de cada métrica no informada"
    : "Fechas no disponibles · equivalencia temporal no verificada" };
}

export function formatComparisonValue(value) {
  const number = metricValue(value);
  if (number == null) return "—";
  if (number >= 1e9) return `${(number / 1e9).toFixed(1)}B`;
  if (number >= 1e6) return `${(number / 1e6).toFixed(1)}M`;
  if (number >= 1e3) return `${(number / 1e3).toFixed(1)}K`;
  return number.toLocaleString("es-MX");
}
