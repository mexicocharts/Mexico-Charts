declare module "@/data/weekly-editions.mjs" {
  export interface WeeklyEdition {
    date: string;
    updatedAt: string;
  }

  export const WEEKLY_EDITIONS: readonly WeeklyEdition[];
  export function weeklyEdition(date: string): WeeklyEdition | null;
  export function weeklyEditionNeighbors(date: string): {
    newer: WeeklyEdition | null;
    older: WeeklyEdition | null;
  };
}
