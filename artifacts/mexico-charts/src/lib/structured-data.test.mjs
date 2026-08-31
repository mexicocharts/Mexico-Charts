import test from "node:test";
import assert from "node:assert/strict";
import {
  LOGO_ID,
  ORGANIZATION_ID,
  SITE_URL,
  WEBSITE_ID,
  breadcrumbId,
  buildStructuredDataGraph,
  pageId,
} from "./structured-data.mjs";

test("keeps the P0 entity IDs stable and adds one connected breadcrumb", () => {
  const canonicalUrl = `${SITE_URL}/charts`;
  const graph = buildStructuredDataGraph({
    title: "Charts de música en México — Mexico Charts",
    description: "Charts consolidados.",
    canonicalUrl,
    breadcrumbs: [
      { name: "Mexico Charts", url: `${SITE_URL}/` },
      { name: "Charts de música en México", url: canonicalUrl },
    ],
  });
  const nodes = graph["@graph"];

  assert.equal(nodes.filter(node => node["@id"] === ORGANIZATION_ID).length, 1);
  assert.equal(nodes.filter(node => node["@id"] === WEBSITE_ID).length, 1);
  assert.equal(nodes.filter(node => node["@id"] === LOGO_ID).length, 1);
  assert.equal(nodes.filter(node => node["@id"] === breadcrumbId(canonicalUrl)).length, 1);
  assert.deepEqual(
    nodes.find(node => node["@id"] === pageId(canonicalUrl)).breadcrumb,
    { "@id": breadcrumbId(canonicalUrl) },
  );
});

test("connects AboutPage and Article nodes without fabricating article metadata", () => {
  const aboutUrl = `${SITE_URL}/acerca-de`;
  const aboutGraph = buildStructuredDataGraph({
    title: "Acerca de Mexico Charts",
    description: "Acerca de Mexico Charts.",
    canonicalUrl: aboutUrl,
    additional: {
      "@type": "AboutPage",
      about: { "@id": ORGANIZATION_ID },
      mainEntity: { "@id": ORGANIZATION_ID },
    },
  });
  const about = aboutGraph["@graph"].find(node => node["@id"] === pageId(aboutUrl));
  assert.equal(about["@type"], "AboutPage");
  assert.equal(about.isPartOf["@id"], WEBSITE_ID);
  assert.equal(about.publisher["@id"], ORGANIZATION_ID);
  assert.equal(about.about["@id"], ORGANIZATION_ID);

  const articleUrl = `${SITE_URL}/insights/example`;
  const articleGraph = buildStructuredDataGraph({
    title: "Insight — Mexico Charts",
    description: "Insight editorial.",
    canonicalUrl: articleUrl,
    additional: {
      "@type": "Article",
      headline: "Insight",
      publisher: { "@id": ORGANIZATION_ID },
    },
  });
  const article = articleGraph["@graph"].find(node => node["@type"] === "Article");
  assert.equal(article.publisher["@id"], ORGANIZATION_ID);
  assert.equal(article.mainEntityOfPage["@id"], pageId(articleUrl));
  assert.equal("author" in article, false);
  assert.equal("datePublished" in article, false);
  assert.equal("dateModified" in article, false);
});
