import { useEffect } from "react";

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
export default function PageSEO({ title, description, path = "/", ogImage = OG_IMAGE, type = "website", noindex = false, jsonLd }: PageSEOProps) {
  const canonical = `${SITE_URL}${path}`;
  const fullTitle = title.includes("Mexico Charts") ? title : `${title} — Mexico Charts`;
  const structuredData = JSON.stringify(jsonLd ?? {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: fullTitle,
    url: canonical,
    description,
    inLanguage: "es-MX",
  });

  useEffect(() => {
    document.title = fullTitle;
    Array.from(document.head.querySelectorAll("title")).slice(1).forEach(node => node.remove());

    upsertMeta("name", "description", description);
    upsertMeta("name", "robots", noindex ? "noindex,nofollow,noarchive" : "index,follow");
    upsertCanonical(canonical);

    upsertMeta("property", "og:type", type);
    upsertMeta("property", "og:title", fullTitle);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("property", "og:image", ogImage);
    upsertMeta("property", "og:image:width", "1200");
    upsertMeta("property", "og:image:height", "630");
    upsertMeta("property", "og:site_name", "Mexico Charts");
    upsertMeta("property", "og:locale", "es_MX");

    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", fullTitle);
    upsertMeta("name", "twitter:description", description);
    upsertMeta("name", "twitter:image", ogImage);

    upsertJsonLd(structuredData);
  }, [canonical, description, fullTitle, noindex, ogImage, structuredData, type]);

  return null;
}
