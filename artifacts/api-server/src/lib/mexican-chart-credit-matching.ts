export function normalizeChartArtistName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function normalizeChartArtistCredit(value: string): string {
  return normalizeChartArtistName(
    value
      .replace(/\s+(?:&|y|and)\s+/gi, " ")
      .replace(/\s+de\s+(?:ren[eé]\s+camacho|humberto\s+pab[oó]n)\s*$/gi, ""),
  );
}

export function splitChartArtistCredit(credit: string): string[] {
  return credit
    .split(/,|&|\/|\s+feat\.?\s+|\s+ft\.?\s+|\s+x\s+|\s+and\s+|\s+y\s+|\s+junto\s+a\s+/gi)
    .map(value => value.trim())
    .filter(value => value.length > 1);
}

export function matchedMexicanArtists(credit: string, verifiedNorms: Set<string>): string[] {
  const cleanCredit = credit.trim();
  if (!cleanCredit) return [];
  if (
    verifiedNorms.has(normalizeChartArtistName(cleanCredit))
    || verifiedNorms.has(normalizeChartArtistCredit(cleanCredit))
  ) return [cleanCredit];

  return splitChartArtistCredit(cleanCredit).filter(part => (
    verifiedNorms.has(normalizeChartArtistName(part))
    || verifiedNorms.has(normalizeChartArtistCredit(part))
  ));
}
