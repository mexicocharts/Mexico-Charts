export function formatCertificationLevels(certification: string, level: string): string {
  const tiers = certification
    .split("&")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  const counts = level
    .split("&")
    .map(value => /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN);

  if (!level) return "—";
  if (!tiers.length || counts.some(count => !Number.isSafeInteger(count)) || tiers.length !== counts.length || tiers.some(tier => !["oro", "platino", "diamante"].includes(tier))) return `Nivel no verificado · ${level}`;
  return tiers
    .map((tier, index) => `${counts[index].toLocaleString("es-MX")}× ${tier.charAt(0).toUpperCase()}${tier.slice(1)}`)
    .join(" + ");
}
