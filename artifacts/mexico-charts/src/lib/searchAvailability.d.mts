export type SearchQueryState = {
  isPending: boolean;
  isFetching: boolean;
  isError: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
};
export function searchAvailability(enabled: boolean, resultCount: number, queries: SearchQueryState[]): {
  instruction: boolean;
  showEmpty: boolean;
  warning: boolean;
  activity: "loading" | "updating" | "paused" | "unavailable" | null;
};
export function searchAvailabilityCopy(language: "es" | "en"): Record<"instruction" | "results" | "empty" | "warning" | "loading" | "updating" | "paused" | "unavailable", string>;
