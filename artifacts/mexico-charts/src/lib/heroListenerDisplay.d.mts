export function heroListenerDisplay(selected: {value: unknown; source: string; date?: string | null; compact: string}): {
  state: "missing" | "invalid" | "unconfirmed" | "available";
  compact: string | null;
  source: "saved" | "editorial" | null;
  snapshotDate: string | null;
};
