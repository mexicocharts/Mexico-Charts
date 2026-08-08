import { useEffect } from "react";
import { Helmet } from "react-helmet-async";

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

const DEDUPED_HEAD_SELECTORS = [
  "title",
  'meta[name="description"]',
  'meta[name="robots"]',
  'link[rel="canonical"]',
  'meta[property="og:type"]',
  'meta[property="og:title"]',
  'meta[property="og:description"]',
  'meta[property="og:url"]',
  'meta[property="og:image"]',
  'meta[property="og:image:width"]',
  'meta[property="og:image:height"]',
  'meta[property="og:site_name"]',
  'meta[property="og:locale"]',
  'meta[name="twitter:card"]',
  'meta[name="twitter:title"]',
  'meta[name="twitter:description"]',
  'meta[name="twitter:image"]',
] as const;

function isHelmetManaged(node: Element) {
  return node.getAttribute("data-rh") === "true" || node.getAttribute("data-react-helmet") === "true";
}

function removeStaticSeoDuplicates() {
  if (typeof document === "undefined") return;

  DEDUPED_HEAD_SELECTORS.forEach((selector) => {
    const nodes = Array.from(document.head.querySelectorAll(selector));
    if (nodes.length <= 1) return;
    const managed = nodes.filter(isHelmetManaged);
    const keep = managed.at(-1) ?? nodes.at(-1);
    nodes.forEach((node) => {
      if (node !== keep) node.remove();
    });
  });
}

export default function PageSEO({ title, description, path = "/", ogImage = OG_IMAGE, type = "website", noindex = false, jsonLd }: PageSEOProps) {
  const canonical = `${SITE_URL}${path}`;
  const fullTitle = title.includes("Mexico Charts") ? title : `${title} — Mexico Charts`;
  const structuredData = jsonLd ? JSON.stringify(jsonLd) : null;

  useEffect(() => {
    const cleanupId = window.setTimeout(removeStaticSeoDuplicates, 0);
    return () => window.clearTimeout(cleanupId);
  }, [canonical, description, fullTitle, noindex, ogImage, structuredData, type]);

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={noindex ? "noindex,nofollow,noarchive" : "index,follow"} />
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="Mexico Charts" />
      <meta property="og:locale" content="es_MX" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
      {structuredData && <script type="application/ld+json">{structuredData}</script>}
    </Helmet>
  );
}
