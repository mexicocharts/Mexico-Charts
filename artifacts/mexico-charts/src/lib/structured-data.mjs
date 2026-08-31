export const SITE_URL = "https://mexicochart.com";
export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const LOGO_ID = `${SITE_URL}/#logo`;

export const OFFICIAL_SOCIAL_URLS = [
  "https://www.instagram.com/mexicocharts/",
  "https://www.tiktok.com/@mexicocharts",
];

const WEB_PAGE_TYPES = new Set(["WebPage", "AboutPage", "ContactPage", "CollectionPage"]);

function typesOf(node) {
  const value = node?.["@type"];
  return Array.isArray(value) ? value : value ? [value] : [];
}

function normalizeEntityReferences(value) {
  if (Array.isArray(value)) return value.map(normalizeEntityReferences);
  if (!value || typeof value !== "object") return value;

  const node = Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "@context")
      .map(([key, child]) => [key, normalizeEntityReferences(child)]),
  );
  const types = typesOf(node);

  if (types.includes("Organization") && node.name === "Mexico Charts") {
    return { "@id": ORGANIZATION_ID };
  }
  if (types.includes("WebSite") && (!node.name || node.name === "Mexico Charts")) {
    return { "@id": WEBSITE_ID };
  }
  return node;
}

export function pageId(canonicalUrl) {
  return `${canonicalUrl}#webpage`;
}

export function breadcrumbId(canonicalUrl) {
  return `${canonicalUrl}#breadcrumb`;
}

export function buildStructuredDataGraph({ title, description, canonicalUrl, inLanguage = "es-MX", additional = [], breadcrumbs = [] }) {
  const extras = (Array.isArray(additional) ? additional : [additional])
    .filter(Boolean)
    .flatMap((value) => value?.["@graph"] ?? [value])
    .map(normalizeEntityReferences);

  const customPageIndex = extras.findIndex((node) => typesOf(node).some((type) => WEB_PAGE_TYPES.has(type)));
  const customPage = customPageIndex >= 0 ? extras.splice(customPageIndex, 1)[0] : {};
  const canonicalPageId = pageId(canonicalUrl);
  const breadcrumbItems = breadcrumbs.filter((item) => item?.name && item?.url);
  const breadcrumb = breadcrumbItems.length > 1
    ? {
        "@type": "BreadcrumbList",
        "@id": breadcrumbId(canonicalUrl),
        itemListElement: breadcrumbItems.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: item.url,
        })),
      }
    : null;
  const page = {
    ...customPage,
    "@type": customPage["@type"] ?? "WebPage",
    "@id": canonicalPageId,
    url: canonicalUrl,
    name: customPage.name ?? title,
    description: customPage.description ?? description,
    inLanguage: customPage.inLanguage ?? inLanguage,
    isPartOf: { "@id": WEBSITE_ID },
    publisher: { "@id": ORGANIZATION_ID },
    ...(breadcrumb ? { breadcrumb: { "@id": breadcrumb["@id"] } } : {}),
  };

  const connectedExtras = extras.map((node) => {
    if (typesOf(node).some((type) => type === "Article" || type === "NewsArticle")) {
      return { ...node, mainEntityOfPage: { "@id": canonicalPageId } };
    }
    return node;
  });

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORGANIZATION_ID,
        name: "Mexico Charts",
        url: `${SITE_URL}/`,
        logo: { "@id": LOGO_ID },
        image: { "@id": LOGO_ID },
        sameAs: OFFICIAL_SOCIAL_URLS,
      },
      {
        "@type": "ImageObject",
        "@id": LOGO_ID,
        url: `${SITE_URL}/mexico-charts-logo.png`,
        contentUrl: `${SITE_URL}/mexico-charts-logo.png`,
        caption: "Mexico Charts",
      },
      {
        "@type": "WebSite",
        "@id": WEBSITE_ID,
        name: "Mexico Charts",
        url: `${SITE_URL}/`,
        publisher: { "@id": ORGANIZATION_ID },
        inLanguage: "es-MX",
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/artists?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      },
      page,
      ...(breadcrumb ? [breadcrumb] : []),
      ...connectedExtras,
    ],
  };
}
