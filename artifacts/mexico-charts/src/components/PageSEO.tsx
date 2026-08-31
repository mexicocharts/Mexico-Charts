import { useEffect } from "react";
import { buildStructuredDataGraph } from "@/lib/structured-data.mjs";
import { getSeoRoute } from "@/lib/seo-routes.mjs";

const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") ?? "https://mexicochart.com";
const OG_IMAGE = `${SITE_URL}/opengraph.jpg`;

interface PageSEOProps {
  title: string;
  description: string;
  path?: string;
  ogImage?: string;
  type?: "website" | "article";
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  breadcrumbs?: { name: string; path: string }[];
}

function upsertMeta(attribute: "name" | "property", key: string, content: string) {
  const selector = `meta[${attribute}="${key}"]`;
  const existing = Array.from(document.head.querySelectorAll<HTMLMetaElement>(selector));
  const element = existing[0] ?? document.createElement("meta");
  if (!existing[0]) {
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
  existing.slice(1).forEach(node => node.remove());
}

function upsertCanonical(href: string) {
  const existing = Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="canonical"]'));
  const element = existing[0] ?? document.createElement("link");
  if (!existing[0]) {
    element.rel = "canonical";
    document.head.appendChild(element);
  }
  element.href = href;
  existing.slice(1).forEach(node => node.remove());
}

function upsertJsonLd(value: string) {
  const existing = Array.from(document.head.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'));
  const element = existing[0] ?? document.createElement("script");
  if (!existing[0]) {
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }
  element.dataset.mexicoChartsJsonld = "true";
  element.textContent = value;
  existing.slice(1).forEach(node => node.remove());
}

/**
 * Keeps route metadata current without rendering title/meta/link elements in
 * the React tree. React 19 hoists those elements into <head>; combining that
 * lifecycle with react-helmet caused profile navigation to unmount an already
 * removed node and leave visitors on a black page.
 */
export default function PageSEO({ title, description, path = "/", ogImage = OG_IMAGE, type = "website", noindex = false, jsonLd, breadcrumbs = [] }: PageSEOProps) {
  const routeDefinition = getSeoRoute(path);
  const resolvedPath = routeDefinition?.canonicalPath ?? path;
  const resolvedTitle = routeDefinition?.title ?? title;
  const resolvedDescription = routeDefinition?.description ?? description;
  const resolvedNoindex = routeDefinition ? routeDefinition.robots.startsWith("noindex") : noindex;
  const canonical = `${SITE_URL}${resolvedPath}`;
  const fullTitle = resolvedTitle.includes("Mexico Charts") ? resolvedTitle : `${resolvedTitle} — Mexico Charts`;
  const structuredData = JSON.stringify(buildStructuredDataGraph({
    title: fullTitle,
    description: resolvedDescription,
    canonicalUrl: canonical,
    additional: jsonLd ?? [],
    breadcrumbs: breadcrumbs.map(item => ({
      name: item.name,
      url: item.path === "/" ? `${SITE_URL}/` : `${SITE_URL}${item.path}`,
    })),
  }));

  useEffect(() => {
    document.title = fullTitle;
    Array.from(document.head.querySelectorAll("title")).slice(1).forEach(node => node.remove());

    upsertMeta("name", "description", resolvedDescription);
    upsertMeta("name", "robots", resolvedNoindex ? "noindex,nofollow,noarchive" : "index,follow");
    upsertCanonical(canonical);

    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", resolvedDescription);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:image", ogImage);
    upsertMeta("property", "og:image:width", "1200");
    upsertMeta("property", "og:image:height", "630");
    upsertMeta("property", "og:site_name", "Mexico Charts");
    upsertMeta("property", "og:locale", "es_MX");

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", resolvedDescription);
    upsertMeta("name", "twitter:image", ogImage);

    upsertJsonLd(structuredData);
  }, [canonical, fullTitle, ogImage, resolvedDescription, resolvedNoindex, structuredData, type]);

  return null;
}
