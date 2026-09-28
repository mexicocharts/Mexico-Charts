/** Presentation only: rounding must not announce an unreached milestone. */
export function monitorMilestoneProgress(views, target) {
  if (!Number.isFinite(views) || views < 0 || !Number.isFinite(target) || target <= 0) {
    return { percent: 0, label: "—" };
  }
  const percent = Math.min(100, (views / target) * 100);
  const rounded = Number(percent.toFixed(1));
  return { percent, label: views < target && rounded === 100 ? "<100" : String(rounded) };
}
