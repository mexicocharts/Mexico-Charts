declare module "@/lib/seo-routes.mjs" {
  export interface SeoRouteDefinition {
    path: string;
    canonicalPath: string;
    title: string;
    description: string;
    robots: string;
  }
  export interface PlatformChartRoute extends SeoRouteDefinition {
    platform: "Spotify" | "YouTube" | "Apple Music" | "Deezer";
    heading: string;
    body: string;
    breadcrumbs: readonly (readonly [string, string])[];
  }
  export const SEO_ROUTE_DEFINITIONS: Readonly<Record<string, SeoRouteDefinition>>;
  export const PLATFORM_CHART_ROUTES: readonly PlatformChartRoute[];
  export function getSeoRoute(path: string): SeoRouteDefinition | null;
  export function getPlatformChartRoute(path: string): PlatformChartRoute | null;
  export function getPlatformChartRouteByPlatform(platform: string): PlatformChartRoute | null;
  export function applySeoRouteDefinition<T extends { path: string }>(route: T): T & Partial<SeoRouteDefinition>;
}
