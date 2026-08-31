declare module "@/lib/structured-data.mjs" {
  export const SITE_URL: string;
  export const ORGANIZATION_ID: string;
  export const WEBSITE_ID: string;
  export const LOGO_ID: string;
  export const OFFICIAL_SOCIAL_URLS: readonly string[];
  export function pageId(canonicalUrl: string): string;
  export function breadcrumbId(canonicalUrl: string): string;
  export function buildStructuredDataGraph(options: {
    title: string;
    description: string;
    canonicalUrl: string;
    inLanguage?: string;
    additional?: Record<string, unknown> | Record<string, unknown>[];
    breadcrumbs?: { name: string; url: string }[];
  }): Record<string, unknown>;
}
