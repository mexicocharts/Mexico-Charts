export function mexicoChartArchiveDate(instant = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(instant);
}

export function parseProprietaryChartCsv(text: string): { headers: string[]; rows: Array<Record<string, string>> } {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (!lines.length) return { headers: [], rows: [] };
  const split = (line: string) => {
    const values: string[] = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (char === '"' && quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else if (char === '"') quoted = !quoted;
      else if (char === "," && !quoted) { values.push(value); value = ""; }
      else value += char;
    }
    values.push(value);
    return values;
  };
  const headers = split(lines[0]).map(value => value.replace(/^\uFEFF/, "").trim());
  const rows = lines.slice(1).map(line => {
    const values = split(line);
    return Object.fromEntries(headers.map((header, index) => [header, (values[index] ?? "").trim()]));
  }).filter(row => Object.values(row).some(Boolean));
  return { headers, rows };
}

export function chartEditionDate(
  rows: Array<Record<string, string>>,
  fallback: string,
): string {
  const first = rows[0];
  if (!first) return fallback;
  for (const key of ["Chart Date", "chart_date", "Date", "date", "Week Ending", "week_ending"]) {
    const value = first[key]?.trim();
    if (!value) continue;
    const iso = value.match(/\b(20\d{2}-\d{2}-\d{2})\b/)?.[1];
    if (iso) return iso;
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return fallback;
}
