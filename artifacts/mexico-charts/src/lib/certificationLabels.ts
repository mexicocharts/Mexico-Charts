export function formatCertificationLevels(certification: string, level: string): string {
  const tiers = certification
    .split("&")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  const counts = level
    .split("&")
    .map(value => Number.parseInt(value.trim(), 10))
    .filter(value => Number.isFinite(value));

  if (!tiers.length || tiers.length !== counts.length) return level || "—";
  return tiers
    .map((tier, index) => `${counts[index].toLocaleString("es-MX")}× ${tier.charAt(0).toUpperCase()}${tier.slice(1)}`)
    .join(" + ");
}
