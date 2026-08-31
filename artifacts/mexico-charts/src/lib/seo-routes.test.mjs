import test from "node:test";
import assert from "node:assert/strict";
import { PLATFORM_CHART_ROUTES, getSeoRoute } from "./seo-routes.mjs";

test("platform chart routes have unique, self-canonical metadata", () => {
  assert.equal(PLATFORM_CHART_ROUTES.length, 4);
  assert.equal(new Set(PLATFORM_CHART_ROUTES.map(route => route.path)).size, 4);
  assert.equal(new Set(PLATFORM_CHART_ROUTES.map(route => route.title)).size, 4);
  assert.equal(new Set(PLATFORM_CHART_ROUTES.map(route => route.description)).size, 4);
  for (const route of PLATFORM_CHART_ROUTES) {
    const definition = getSeoRoute(route.path);
    assert.equal(definition?.canonicalPath, route.path);
    assert.equal(definition?.robots, "index,follow");
    assert.match(route.heading, /México/);
    assert.ok(route.body.length > 80);
  }
});

test("certifications metadata has one centralized definition", () => {
  assert.deepEqual(getSeoRoute("/industry/certifications"), {
    path: "/industry/certifications",
    canonicalPath: "/industry/certifications",
    title: "Certificaciones AMPROFON — Mexico Charts",
    description: "Certificaciones de la industria musical mexicana con fuente AMPROFON, niveles de oro, platino y diamante, y datos organizados por artista.",
    robots: "index,follow",
  });
});
