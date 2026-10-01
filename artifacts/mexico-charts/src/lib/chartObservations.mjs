/** @param {{dailyViews?: number|null,dailyStreams?: number|null,value?: number|null}} point */
export function observationValue(point) {
  const value = "dailyViews" in point ? point.dailyViews : "dailyStreams" in point ? point.dailyStreams : point.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
/** Keep the last N known observations, including explicit nulls between them. */
export function recentObservations(points, limit = 15) {
  let count = 0;
  for (let index = points.length - 1; index >= 0; index--) {
    if (observationValue(points[index]) != null && ++count === limit) return points.slice(index);
  }
  return points;
}
/** Date-proportional x coordinates; a gap/null starts a new segment. */
export function observationCoordinates(points, left, width) {
  const times = points.map(point => Date.parse(`${point.date.slice(0,10)}T12:00:00Z`));
  const span = (times.at(-1) ?? 0) - (times[0] ?? 0);
  return points.map((point,index) => ({date:point.date, value:observationValue(point),
    x:left + (span > 0 ? (times[index] - times[0]) / span * width : 0),
    startsSegment:index === 0 || observationValue(points[index - 1]) == null || times[index] - times[index - 1] > 86400000,
  }));
}
